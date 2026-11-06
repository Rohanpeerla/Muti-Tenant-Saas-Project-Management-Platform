import uuid
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.webhooks.models import Webhook, WebhookDelivery
from apps.webhooks.serializers import (
    WebhookSerializer,
    WebhookCreateSerializer,
    WebhookDeliverySerializer
)
from apps.webhooks.tasks import deliver_webhook_task


def get_active_workspace_membership(workspace, user):
    """
    Returns active WorkspaceMembership or None.
    """
    return WorkspaceMembership.objects.filter(
        workspace=workspace,
        user=user,
        status=WorkspaceMembership.Status.ACTIVE
    ).first()


def has_webhook_admin_access(workspace, user):
    """
    Restricts webhook management to workspace OWNER and ADMIN.
    """
    if workspace.owner_id == user.id:
        return True
    membership = get_active_workspace_membership(workspace, user)
    if not membership:
        return False
    return membership.role in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN]


class WebhookPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class WorkspaceWebhookListCreateView(APIView):
    """
    GET /api/workspaces/{workspace_id}/webhooks/
    POST /api/workspaces/{workspace_id}/webhooks/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, workspace_id):
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        if not has_webhook_admin_access(workspace, request.user):
            return Response(
                {'error': 'Only workspace owners and administrators can manage webhooks.'},
                status=status.HTTP_403_FORBIDDEN
            )

        webhooks = Webhook.objects.filter(workspace=workspace)
        serializer = WebhookSerializer(webhooks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, workspace_id):
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        if not has_webhook_admin_access(workspace, request.user):
            return Response(
                {'error': 'Only workspace owners and administrators can create webhooks.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Plan limit & feature check
        try:
            from apps.billing.usage_service import check_workspace_limits
            check_workspace_limits(workspace, 'create_webhook', count_to_add=1)
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = WebhookCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        webhook = serializer.save(workspace=workspace, created_by=request.user)

        # Log audit event
        try:
            from apps.workspaces.models import log_audit_event
            log_audit_event(
                workspace=workspace,
                actor=request.user,
                event_type='WEBHOOK_CREATED',
                description=f'Webhook "{webhook.name}" was created.',
                metadata={'webhook_id': str(webhook.id), 'target_url': webhook.target_url}
            )
        except Exception:
            pass

        return Response(WebhookCreateSerializer(webhook).data, status=status.HTTP_201_CREATED)


class WebhookDetailView(APIView):
    """
    PATCH /api/webhooks/{webhook_id}/
    DELETE /api/webhooks/{webhook_id}/
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, webhook_id):
        webhook = get_object_or_404(Webhook, id=webhook_id, workspace__is_active=True)
        if not has_webhook_admin_access(webhook.workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = WebhookSerializer(webhook, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, webhook_id):
        webhook = get_object_or_404(Webhook, id=webhook_id, workspace__is_active=True)
        if not has_webhook_admin_access(webhook.workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        name = webhook.name
        workspace = webhook.workspace
        webhook.delete()

        try:
            from apps.workspaces.models import log_audit_event
            log_audit_event(
                workspace=workspace,
                actor=request.user,
                event_type='WEBHOOK_DELETED',
                description=f'Webhook "{name}" was deleted.',
                metadata={'webhook_id': str(webhook_id)}
            )
        except Exception:
            pass

        return Response({'status': 'success', 'message': f'Webhook "{name}" deleted.'}, status=status.HTTP_200_OK)


class WebhookTestView(APIView):
    """
    POST /api/webhooks/{webhook_id}/test/
    Sends a test ping event to the configured webhook URL.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, webhook_id):
        webhook = get_object_or_404(Webhook, id=webhook_id, workspace__is_active=True)
        if not has_webhook_admin_access(webhook.workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        payload = {
            'event': 'test.ping',
            'timestamp': timezone.now().isoformat(),
            'workspace': {
                'id': str(webhook.workspace.id),
                'name': webhook.workspace.name,
            },
            'message': 'SprintSync webhook test event successfully dispatched.',
            'triggered_by': request.user.email,
        }

        delivery = WebhookDelivery.objects.create(
            webhook=webhook,
            event_type='test.ping',
            request_payload=payload,
            status=WebhookDelivery.DeliveryStatus.PENDING
        )

        deliver_webhook_task.delay(delivery.id)

        return Response({
            'status': 'dispatched',
            'delivery_id': delivery.id,
            'message': 'Test webhook event scheduled for delivery.'
        }, status=status.HTTP_200_OK)


class WebhookRotateSecretView(APIView):
    """
    POST /api/webhooks/{webhook_id}/rotate-secret/
    Generates a new signing secret for the webhook and returns it once.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, webhook_id):
        webhook = get_object_or_404(Webhook, id=webhook_id, workspace__is_active=True)
        if not has_webhook_admin_access(webhook.workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        new_secret = webhook.rotate_secret()
        return Response({
            'status': 'success',
            'message': 'Webhook secret rotated successfully.',
            'new_secret': new_secret
        }, status=status.HTTP_200_OK)


class WebhookDeliveriesListView(APIView):
    """
    GET /api/webhooks/{webhook_id}/deliveries/
    Lists delivery history for a webhook.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, webhook_id):
        webhook = get_object_or_404(Webhook, id=webhook_id, workspace__is_active=True)
        if not has_webhook_admin_access(webhook.workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        deliveries = WebhookDelivery.objects.filter(webhook=webhook)
        paginator = WebhookPagination()
        page = paginator.paginate_queryset(deliveries, request)
        serializer = WebhookDeliverySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class WebhookDeliveryRetryView(APIView):
    """
    POST /api/webhook-deliveries/{delivery_id}/retry/
    Manually retries a webhook delivery.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, delivery_id):
        delivery = get_object_or_404(WebhookDelivery, id=delivery_id)
        if not has_webhook_admin_access(delivery.webhook.workspace, request.user):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        delivery.status = WebhookDelivery.DeliveryStatus.PENDING
        delivery.attempt_count = 0
        delivery.save()

        deliver_webhook_task.delay(delivery.id)

        return Response({
            'status': 're-enqueued',
            'message': 'Webhook delivery queued for retry.'
        }, status=status.HTTP_200_OK)

