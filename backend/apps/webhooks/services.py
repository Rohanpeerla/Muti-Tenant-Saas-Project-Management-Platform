import logging
from django.db import transaction
from apps.webhooks.models import Webhook, WebhookDelivery
from apps.webhooks.tasks import deliver_webhook_task

logger = logging.getLogger(__name__)


def trigger_workspace_webhooks(workspace, event_type, payload):
    """
    Finds all active webhooks subscribed to event_type for a given workspace,
    persists a WebhookDelivery log entry, and enqueues deliver_webhook_task.
    """
    if not workspace:
        return []

    # Find active webhooks where the event is subscribed
    webhooks = Webhook.objects.filter(workspace=workspace, is_active=True)
    matching_webhooks = [
        wh for wh in webhooks
        if event_type in wh.subscribed_events or '*' in wh.subscribed_events
    ]

    if not matching_webhooks:
        return []

    deliveries = []
    for wh in matching_webhooks:
        delivery = WebhookDelivery.objects.create(
            webhook=wh,
            event_type=event_type,
            request_payload=payload,
            status=WebhookDelivery.DeliveryStatus.PENDING
        )
        deliveries.append(delivery)

        # Trigger delivery task asynchronously once the transaction commits
        transaction.on_commit(
            lambda d_id=delivery.id: deliver_webhook_task.delay(d_id)
        )

    return deliveries

