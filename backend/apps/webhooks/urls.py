from django.urls import path
from apps.webhooks.views import (
    WorkspaceWebhookListCreateView,
    WebhookDetailView,
    WebhookTestView,
    WebhookRotateSecretView,
    WebhookDeliveriesListView,
    WebhookDeliveryRetryView
)

urlpatterns = [
    path('workspaces/<uuid:workspace_id>/webhooks/', WorkspaceWebhookListCreateView.as_view(), name='workspace-webhooks'),
    path('webhooks/<uuid:webhook_id>/', WebhookDetailView.as_view(), name='webhook-detail'),
    path('webhooks/<uuid:webhook_id>/test/', WebhookTestView.as_view(), name='webhook-test'),
    path('webhooks/<uuid:webhook_id>/rotate-secret/', WebhookRotateSecretView.as_view(), name='webhook-rotate-secret'),
    path('webhooks/<uuid:webhook_id>/deliveries/', WebhookDeliveriesListView.as_view(), name='webhook-deliveries'),
    path('webhook-deliveries/<uuid:delivery_id>/retry/', WebhookDeliveryRetryView.as_view(), name='webhook-delivery-retry'),
]

