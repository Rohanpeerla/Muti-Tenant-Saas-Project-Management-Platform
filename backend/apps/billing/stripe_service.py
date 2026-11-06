import logging
import stripe
from django.conf import settings
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


def get_stripe_client():
    """
    Configures and validates Stripe client in Test Mode.
    Rejects missing or live-mode credentials.
    """
    secret_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
    if not secret_key:
        raise ValidationError('Stripe secret key is not configured.')

    # Safeguard: Never permit live-mode keys in this environment
    if secret_key.startswith('sk_live_'):
        raise ValidationError('Live Stripe credentials are prohibited. Only Stripe Test Mode keys (sk_test_*) are permitted.')

    stripe.api_key = secret_key
    return stripe


def get_or_create_stripe_customer(workspace, user):
    """
    Retrieves or provisions a Stripe Customer for the workspace.
    """
    client = get_stripe_client()
    sub = workspace.subscription

    if sub.stripe_customer_id:
        return sub.stripe_customer_id

    try:
        customer = client.Customer.create(
            email=user.email,
            name=f'{workspace.name} (SprintSync Workspace)',
            metadata={
                'workspace_id': str(workspace.id),
                'workspace_slug': workspace.slug,
                'owner_email': workspace.owner.email if workspace.owner else user.email,
            }
        )
        sub.stripe_customer_id = customer.id
        sub.save(update_fields=['stripe_customer_id', 'updated_at'])
        return customer.id
    except Exception as e:
        logger.error(f'Failed to create Stripe customer for workspace {workspace.id}: {e}')
        raise ValidationError(f'Stripe error: {str(e)}')


def create_checkout_session(workspace, plan, billing_interval, user):
    """
    Creates a Stripe Checkout Session in subscription mode.
    Uses trusted server-side plan pricing in smallest currency units (cents).
    """
    client = get_stripe_client()
    customer_id = get_or_create_stripe_customer(workspace, user)

    # Free plan does not need checkout
    if plan.slug == 'free':
        raise ValidationError('Free plan does not require checkout.')

    price_cents = plan.yearly_price if billing_interval == 'yearly' else plan.monthly_price
    interval_unit = 'year' if billing_interval == 'yearly' else 'month'

    success_url = getattr(
        settings,
        'STRIPE_SUCCESS_URL',
        'http://localhost:5173/billing/success?session_id={CHECKOUT_SESSION_ID}'
    )
    cancel_url = getattr(
        settings,
        'STRIPE_CANCEL_URL',
        f'http://localhost:5173/workspaces/{workspace.id}/settings/billing'
    )

    try:
        session = client.checkout.Session.create(
            customer=customer_id,
            client_reference_id=str(workspace.id),
            payment_method_types=['card'],
            mode='subscription',
            line_items=[
                {
                    'price_data': {
                        'currency': plan.currency,
                        'product_data': {
                            'name': f'SprintSync {plan.name} Plan ({billing_interval.capitalize()})',
                            'description': plan.description,
                            'metadata': {
                                'plan_id': str(plan.id),
                                'plan_slug': plan.slug,
                            }
                        },
                        'unit_amount': price_cents,
                        'recurring': {
                            'interval': interval_unit,
                        },
                    },
                    'quantity': 1,
                }
            ],
            metadata={
                'workspace_id': str(workspace.id),
                'plan_id': str(plan.id),
                'plan_slug': plan.slug,
                'billing_interval': billing_interval,
            },
            subscription_data={
                'metadata': {
                    'workspace_id': str(workspace.id),
                    'plan_id': str(plan.id),
                    'billing_interval': billing_interval,
                }
            },
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return session.url, session.id
    except Exception as e:
        logger.error(f'Error creating Stripe checkout session: {e}')
        raise ValidationError(f'Stripe Checkout failed: {str(e)}')


def create_customer_portal_session(workspace, return_url=None):
    """
    Creates a Stripe Customer Portal session URL for managing cards and subscriptions.
    """
    client = get_stripe_client()
    sub = workspace.subscription

    if not sub.stripe_customer_id:
        raise ValidationError('No Stripe customer record found for this workspace. Please subscribe to a paid plan first.')

    if not return_url:
        return_url = f'http://localhost:5173/workspaces/{workspace.id}/settings/billing'

    try:
        portal_session = client.billing_portal.Session.create(
            customer=sub.stripe_customer_id,
            return_url=return_url,
        )
        return portal_session.url
    except Exception as e:
        logger.error(f'Error creating customer portal session: {e}')
        raise ValidationError(f'Stripe Portal error: {str(e)}')
