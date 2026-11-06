import hashlib
import hmac
import json
import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
import requests
from apps.webhooks.models import WebhookDelivery, Webhook
from apps.webhooks.security import validate_webhook_url

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def deliver_webhook_task(self, delivery_id):
    """
    Asynchronous task to deliver a webhook payload to the target URL with HMAC signature.
    Includes SSRF validation, response inspection, and exponential backoff retry.
    """
    try:
        delivery = WebhookDelivery.objects.select_related('webhook', 'webhook__workspace').get(id=delivery_id)
    except WebhookDelivery.DoesNotExist:
        logger.warning(f'WebhookDelivery {delivery_id} does not exist. Aborting.')
        return 'not_found'

    webhook = delivery.webhook
    if not webhook.is_active:
        delivery.status = WebhookDelivery.DeliveryStatus.FAILED
        delivery.response_summary = 'Webhook is inactive.'
        delivery.completed_at = timezone.now()
        delivery.save()
        return 'webhook_inactive'

    # Re-validate destination URL security at dispatch time (SSRF defense)
    try:
        validate_webhook_url(webhook.target_url)
    except Exception as e:
        delivery.status = WebhookDelivery.DeliveryStatus.FAILED
        delivery.response_summary = f'Destination URL failed security validation: {str(e)}'
        delivery.completed_at = timezone.now()
        delivery.save()
        logger.warning(f'Webhook {webhook.id} target URL rejected: {e}')
        return 'security_rejected'

    delivery.attempt_count += 1
    delivery.last_attempted_at = timezone.now()

    # Prepare signed payload
    payload_json = json.dumps(delivery.request_payload, sort_keys=True)
    signature = hmac.new(
        webhook.secret.encode('utf-8'),
        payload_json.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'SprintSync-Webhook/1.0',
        'X-SprintSync-Event': delivery.event_type,
        'X-SprintSync-Event-ID': str(delivery.event_id),
        'X-SprintSync-Signature': f'sha256={signature}',
    }

    try:
        # Request with strict timeouts and redirects disabled
        response = requests.post(
            webhook.target_url,
            data=payload_json,
            headers=headers,
            timeout=(5, 10),
            allow_redirects=False
        )

        delivery.response_status = response.status_code
        # Limit response summary length to avoid bloated logs
        delivery.response_summary = response.text[:500] if response.text else f'HTTP {response.status_code}'

        if 200 <= response.status_code < 300:
            delivery.status = WebhookDelivery.DeliveryStatus.SUCCESS
            delivery.completed_at = timezone.now()
            delivery.save()

            webhook.last_delivery_at = timezone.now()
            webhook.save(update_fields=['last_delivery_at'])
            return 'success'
        else:
            raise requests.RequestException(f'Received HTTP {response.status_code}')

    except Exception as e:
        error_msg = str(e)[:500]
        logger.warning(f'Webhook delivery attempt {delivery.attempt_count} failed for {webhook.id}: {error_msg}')

        if delivery.attempt_count < 3:
            delivery.status = WebhookDelivery.DeliveryStatus.RETRYING
            retry_seconds = 30 * (2 ** (delivery.attempt_count - 1))
            delivery.next_retry_at = timezone.now() + timedelta(seconds=retry_seconds)
            delivery.response_summary = f'Attempt {delivery.attempt_count} failed: {error_msg}'
            delivery.save()
            raise self.retry(exc=e, countdown=retry_seconds)
        else:
            delivery.status = WebhookDelivery.DeliveryStatus.FAILED
            delivery.completed_at = timezone.now()
            delivery.response_summary = f'Final failure: {error_msg}'
            delivery.save()

            # Optional notification of delivery failure to workspace owner
            try:
                from apps.notifications.services import create_notification
                from apps.notifications.models import Notification
                if webhook.workspace.owner:
                    create_notification(
                        recipient=webhook.workspace.owner,
                        workspace=webhook.workspace,
                        notification_type=Notification.NotificationType.WEBHOOK_FAILURE,
                        title=f'Webhook Failure: {webhook.name}',
                        message=f'Webhook "{webhook.name}" failed delivery for event "{delivery.event_type}".',
                        related_entity_type='webhook',
                        related_entity_id=str(webhook.id)
                    )
            except Exception as notify_err:
                logger.error(f'Failed to send webhook failure notification: {notify_err}')

            return 'failed'


@shared_task
def retry_failed_webhooks_task():
    """
    Periodic job to discover and re-dispatch RETRYING webhook deliveries.
    """
    now = timezone.now()
    retrying_deliveries = WebhookDelivery.objects.filter(
        status=WebhookDelivery.DeliveryStatus.RETRYING,
        next_retry_at__lte=now
    )

    count = 0
    for delivery in retrying_deliveries:
        deliver_webhook_task.delay(delivery.id)
        count += 1

    if count:
        logger.info(f'Enqueued {count} retrying webhook deliveries.')
    return count

