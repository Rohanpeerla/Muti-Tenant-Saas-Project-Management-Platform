import json
import logging
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.billing.models import (
    SubscriptionPlan,
    WorkspaceSubscription,
    BillingInvoice,
    StripeWebhookEvent
)
from apps.billing.serializers import (
    SubscriptionPlanSerializer,
    WorkspaceSubscriptionSerializer,
    WorkspaceUsageSerializer,
    BillingInvoiceSerializer
)
from apps.billing.usage_service import (
    get_or_create_workspace_subscription,
    get_or_create_workspace_usage
)
from apps.billing.stripe_service import (
    create_checkout_session,
    create_customer_portal_session,
    get_stripe_client
)
from apps.billing.tasks import process_stripe_webhook_event_task

logger = logging.getLogger(__name__)


def get_active_workspace_membership(workspace, user):
    return WorkspaceMembership.objects.filter(
        workspace=workspace,
        user=user,
        status=WorkspaceMembership.Status.ACTIVE
    ).first()


def has_billing_admin_access(workspace, user):
    """
    Billing management is strictly restricted to workspace OWNER and ADMIN.
    """
    if workspace.owner_id == user.id:
        return True
    membership = get_active_workspace_membership(workspace, user)
    if not membership:
        return False
    return membership.role in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN]


class SubscriptionPlansListView(APIView):
    """
    GET /api/billing/plans/
    Public/Authenticated listing of all active subscription plans.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True).order_by('monthly_price')
        serializer = SubscriptionPlanSerializer(plans, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkspaceSubscriptionDetailView(APIView):
    """
    GET /api/billing/subscription/?workspace_id=...
    Retrieves the current subscription and up-to-date usage metrics for a workspace.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id:
            return Response({'error': 'workspace_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        if not has_billing_admin_access(workspace, request.user):
            return Response(
                {'error': 'Only workspace owners and administrators can view or manage billing.'},
                status=status.HTTP_403_FORBIDDEN
            )

        sub = get_or_create_workspace_subscription(workspace)
        usage = get_or_create_workspace_usage(workspace)
        usage.recalculate()

        data = WorkspaceSubscriptionSerializer(sub).data
        data['usage'] = WorkspaceUsageSerializer(usage).data
        data['is_billing_admin'] = True
        return Response(data, status=status.HTTP_200_OK)


class StripeCheckoutView(APIView):
    """
    POST /api/billing/checkout/
    Initiates Stripe Checkout session in Test Mode.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_id = request.data.get('workspace_id')
        plan_id = request.data.get('plan_id')
        billing_interval = request.data.get('billing_interval', 'monthly')

        if not workspace_id or not plan_id:
            return Response(
                {'error': 'workspace_id and plan_id are required fields.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        if not has_billing_admin_access(workspace, request.user):
            return Response(
                {'error': 'Only workspace owners and administrators can manage billing.'},
                status=status.HTTP_403_FORBIDDEN
            )

        plan = get_object_or_404(SubscriptionPlan, id=plan_id, is_active=True)

        checkout_url, session_id = create_checkout_session(
            workspace=workspace,
            plan=plan,
            billing_interval=billing_interval,
            user=request.user
        )

        return Response({
            'status': 'success',
            'checkout_url': checkout_url,
            'session_id': session_id,
            'message': 'Stripe checkout session initialized.'
        }, status=status.HTTP_200_OK)


class CustomerPortalView(APIView):
    """
    POST /api/billing/customer-portal/
    Generates a Stripe hosted Customer Portal session for updating cards or viewing receipts.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_id = request.data.get('workspace_id')
        return_url = request.data.get('return_url')

        if not workspace_id:
            return Response({'error': 'workspace_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        if not has_billing_admin_access(workspace, request.user):
            return Response(
                {'error': 'Only workspace owners and administrators can access the billing portal.'},
                status=status.HTTP_403_FORBIDDEN
            )

        portal_url = create_customer_portal_session(workspace, return_url)
        return Response({
            'status': 'success',
            'portal_url': portal_url
        }, status=status.HTTP_200_OK)


class CancelSubscriptionView(APIView):
    """
    POST /api/billing/cancel-subscription/
    Flags the subscription to cancel at the end of the current billing period.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            return Response({'error': 'workspace_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        if not has_billing_admin_access(workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        sub = get_or_create_workspace_subscription(workspace)

        # Cancel on Stripe if stripe subscription exists
        if sub.stripe_subscription_id:
            try:
                client = get_stripe_client()
                client.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)
            except Exception as e:
                logger.error(f'Stripe cancel error: {e}')

        sub.cancel_at_period_end = True
        sub.save(update_fields=['cancel_at_period_end', 'updated_at'])

        return Response({
            'status': 'success',
            'message': 'Subscription will be canceled at the end of the billing period.',
            'subscription': WorkspaceSubscriptionSerializer(sub).data
        }, status=status.HTTP_200_OK)


class ReactivateSubscriptionView(APIView):
    """
    POST /api/billing/reactivate-subscription/
    Restores an active subscription that was previously scheduled for cancellation.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            return Response({'error': 'workspace_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        if not has_billing_admin_access(workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        sub = get_or_create_workspace_subscription(workspace)

        if sub.stripe_subscription_id:
            try:
                client = get_stripe_client()
                client.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=False)
            except Exception as e:
                logger.error(f'Stripe reactivate error: {e}')

        sub.cancel_at_period_end = False
        sub.save(update_fields=['cancel_at_period_end', 'updated_at'])

        return Response({
            'status': 'success',
            'message': 'Subscription renewed and cancellation revoked.',
            'subscription': WorkspaceSubscriptionSerializer(sub).data
        }, status=status.HTTP_200_OK)


class BillingInvoicesListView(APIView):
    """
    GET /api/billing/invoices/?workspace_id=...
    Lists payment history and downloadable Stripe invoice links for the workspace.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id:
            return Response({'error': 'workspace_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        if not has_billing_admin_access(workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        invoices = BillingInvoice.objects.filter(workspace=workspace).order_by('-created_at')
        serializer = BillingInvoiceSerializer(invoices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StripeWebhookView(APIView):
    """
    POST /api/billing/stripe/webhook/
    Receives raw webhook events from Stripe, validates the cryptographic signature,
    and dispatches asynchronous event handling.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.body
        sig_header = request.headers.get('Stripe-Signature')
        endpoint_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)

        client = get_stripe_client()
        event = None

        try:
            if endpoint_secret and endpoint_secret != 'whsec_placeholder_for_local_dev':
                event = client.Webhook.construct_event(
                    payload=payload,
                    sig_header=sig_header,
                    secret=endpoint_secret
                )
            else:
                # Fallback for local mock testing if secret not configured
                data = json.loads(payload.decode('utf-8'))
                event = data
        except ValueError as e:
            logger.warning(f'Invalid Stripe payload: {e}')
            return Response({'error': 'Invalid payload'}, status=status.HTTP_400_BAD_REQUEST)
        except client.error.SignatureVerificationError as e:
            logger.warning(f'Invalid Stripe signature: {e}')
            return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.warning(f'Webhook verification error: {e}')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        event_id = event.get('id')
        event_type = event.get('type')

        # Check early idempotency
        if event_id and StripeWebhookEvent.objects.filter(stripe_event_id=event_id, processed=True).exists():
            return Response({'status': 'already_processed', 'duplicate': True, 'event_id': event_id}, status=status.HTTP_200_OK)

        # Asynchronously process the event via Celery
        process_stripe_webhook_event_task.delay(
            event_id=event_id,
            event_type=event_type,
            payload=event
        )

        return Response({'status': 'received', 'event_id': event_id}, status=status.HTTP_200_OK)
