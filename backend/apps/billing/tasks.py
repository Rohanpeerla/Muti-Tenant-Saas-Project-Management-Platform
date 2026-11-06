import datetime
import logging
from celery import shared_task
from django.utils import timezone
from apps.billing.models import (
    SubscriptionPlan,
    WorkspaceSubscription,
    BillingInvoice,
    StripeWebhookEvent
)
from apps.workspaces.models import Workspace

logger = logging.getLogger(__name__)


def timestamp_to_datetime(ts):
    if not ts:
        return None
    return timezone.make_aware(datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc))


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_stripe_webhook_event_task(self, event_id, event_type, payload):
    """
    Asynchronously processes verified Stripe events idempotently.
    """
    event_record, created = StripeWebhookEvent.objects.get_or_create(
        stripe_event_id=event_id,
        defaults={'event_type': event_type}
    )

    if event_record.processed:
        logger.info(f'Stripe event {event_id} already processed. Skipping.')
        return 'already_processed'

    try:
        data_object = payload.get('data', {}).get('object', {})

        if event_type == 'checkout.session.completed':
            _handle_checkout_session_completed(data_object)

        elif event_type in ['customer.subscription.created', 'customer.subscription.updated']:
            _handle_subscription_updated(data_object)

        elif event_type == 'customer.subscription.deleted':
            _handle_subscription_deleted(data_object)

        elif event_type == 'invoice.payment_succeeded':
            _handle_invoice_payment_succeeded(data_object)

        elif event_type == 'invoice.payment_failed':
            _handle_invoice_payment_failed(data_object)

        event_record.processed = True
        event_record.processed_at = timezone.now()
        event_record.save(update_fields=['processed', 'processed_at'])
        logger.info(f'Successfully processed Stripe event {event_id} ({event_type}).')
        return 'processed'

    except Exception as e:
        error_msg = str(e)
        logger.error(f'Error processing Stripe webhook {event_id}: {error_msg}')
        event_record.error = error_msg
        event_record.save(update_fields=['error'])
        raise self.retry(exc=e, countdown=30 * (2 ** self.request.retries))


def _handle_checkout_session_completed(session):
    workspace_id = session.get('client_reference_id') or session.get('metadata', {}).get('workspace_id')
    plan_id = session.get('metadata', {}).get('plan_id')
    billing_interval = session.get('metadata', {}).get('billing_interval', 'monthly')
    customer_id = session.get('customer')
    subscription_id = session.get('subscription')

    if not workspace_id:
        logger.warning('Checkout session missing workspace_id in metadata.')
        return

    workspace = Workspace.objects.filter(id=workspace_id).first()
    if not workspace:
        logger.warning(f'Workspace {workspace_id} not found for checkout session.')
        return

    sub = workspace.subscription
    if plan_id:
        target_plan = SubscriptionPlan.objects.filter(id=plan_id).first()
        if target_plan:
            sub.plan = target_plan

    if customer_id:
        sub.stripe_customer_id = customer_id
    if subscription_id:
        sub.stripe_subscription_id = subscription_id

    sub.status = WorkspaceSubscription.SubscriptionStatus.ACTIVE
    sub.billing_interval = billing_interval
    sub.cancel_at_period_end = False
    sub.save()

    # Send notification to workspace owner
    _notify_billing_event(
        workspace=workspace,
        title='Subscription Activated',
        message=f'Workspace "{workspace.name}" has been upgraded to the {sub.plan.name} plan.'
    )


def _handle_subscription_updated(subscription_obj):
    stripe_sub_id = subscription_obj.get('id')
    customer_id = subscription_obj.get('customer')
    status_str = subscription_obj.get('status', '').upper()
    cancel_at_period_end = subscription_obj.get('cancel_at_period_end', False)
    current_period_start = timestamp_to_datetime(subscription_obj.get('current_period_start'))
    current_period_end = timestamp_to_datetime(subscription_obj.get('current_period_end'))

    sub = WorkspaceSubscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
    if not sub and customer_id:
        sub = WorkspaceSubscription.objects.filter(stripe_customer_id=customer_id).first()

    if not sub:
        logger.warning(f'No local WorkspaceSubscription found for Stripe sub {stripe_sub_id}')
        return

    if stripe_sub_id:
        sub.stripe_subscription_id = stripe_sub_id
    if customer_id:
        sub.stripe_customer_id = customer_id

    # Map Stripe status to local model
    status_map = {
        'ACTIVE': WorkspaceSubscription.SubscriptionStatus.ACTIVE,
        'TRIALING': WorkspaceSubscription.SubscriptionStatus.TRIALING,
        'PAST_DUE': WorkspaceSubscription.SubscriptionStatus.PAST_DUE,
        'CANCELED': WorkspaceSubscription.SubscriptionStatus.CANCELED,
        'UNPAID': WorkspaceSubscription.SubscriptionStatus.UNPAID,
        'INCOMPLETE': WorkspaceSubscription.SubscriptionStatus.INCOMPLETE,
        'INCOMPLETE_EXPIRED': WorkspaceSubscription.SubscriptionStatus.INCOMPLETE_EXPIRED,
    }
    sub.status = status_map.get(status_str, WorkspaceSubscription.SubscriptionStatus.ACTIVE)
    sub.cancel_at_period_end = cancel_at_period_end
    if current_period_start:
        sub.current_period_start = current_period_start
    if current_period_end:
        sub.current_period_end = current_period_end

    sub.save()


def _handle_subscription_deleted(subscription_obj):
    stripe_sub_id = subscription_obj.get('id')
    sub = WorkspaceSubscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
    if not sub:
        return

    free_plan = SubscriptionPlan.objects.filter(slug='free').first()
    if free_plan:
        sub.plan = free_plan
    sub.status = WorkspaceSubscription.SubscriptionStatus.CANCELED
    sub.canceled_at = timezone.now()
    sub.save()

    _notify_billing_event(
        workspace=sub.workspace,
        title='Subscription Canceled',
        message=f'The paid subscription for workspace "{sub.workspace.name}" has ended and reverted to the Free plan.'
    )


def _handle_invoice_payment_succeeded(invoice_obj):
    invoice_id = invoice_obj.get('id')
    customer_id = invoice_obj.get('customer')
    amount_paid = invoice_obj.get('amount_paid', 0)
    amount_due = invoice_obj.get('amount_due', 0)
    currency = invoice_obj.get('currency', 'usd')
    invoice_number = invoice_obj.get('number', '')
    invoice_pdf = invoice_obj.get('invoice_pdf', '')
    hosted_invoice_url = invoice_obj.get('hosted_invoice_url', '')

    period_start = timestamp_to_datetime(invoice_obj.get('period_start'))
    period_end = timestamp_to_datetime(invoice_obj.get('period_end'))

    sub = WorkspaceSubscription.objects.filter(stripe_customer_id=customer_id).first()
    if not sub:
        return

    BillingInvoice.objects.update_or_create(
        stripe_invoice_id=invoice_id,
        defaults={
            'workspace': sub.workspace,
            'invoice_number': invoice_number,
            'amount_due': amount_due,
            'amount_paid': amount_paid,
            'currency': currency,
            'status': 'paid',
            'billing_period_start': period_start,
            'billing_period_end': period_end,
            'invoice_pdf_url': invoice_pdf or '',
            'hosted_invoice_url': hosted_invoice_url or '',
        }
    )

    _notify_billing_event(
        workspace=sub.workspace,
        title='Payment Succeeded',
        message=f'Payment of ${amount_paid / 100:.2f} for workspace "{sub.workspace.name}" was successful.'
    )


def _handle_invoice_payment_failed(invoice_obj):
    customer_id = invoice_obj.get('customer')
    amount_due = invoice_obj.get('amount_due', 0)

    sub = WorkspaceSubscription.objects.filter(stripe_customer_id=customer_id).first()
    if not sub:
        return

    sub.status = WorkspaceSubscription.SubscriptionStatus.PAST_DUE
    sub.save(update_fields=['status', 'updated_at'])

    _notify_billing_event(
        workspace=sub.workspace,
        title='Payment Failed',
        message=f'Payment of ${amount_due / 100:.2f} for workspace "{sub.workspace.name}" failed. Please update your payment method.'
    )


def _notify_billing_event(workspace, title, message):
    """
    Dispatches billing notification to workspace owner.
    """
    try:
        from apps.notifications.services import create_notification
        from apps.notifications.models import Notification

        if workspace.owner:
            create_notification(
                recipient=workspace.owner,
                workspace=workspace,
                notification_type=Notification.NotificationType.PROJECT_UPDATED,
                title=title,
                message=message,
                related_entity_type='workspace',
                related_entity_id=str(workspace.id)
            )
    except Exception as e:
        logger.warning(f'Failed to send billing notification: {e}')

