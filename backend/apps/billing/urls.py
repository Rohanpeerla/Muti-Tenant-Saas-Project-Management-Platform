from django.urls import path
from apps.billing.views import (
    SubscriptionPlansListView,
    WorkspaceSubscriptionDetailView,
    StripeCheckoutView,
    CustomerPortalView,
    CancelSubscriptionView,
    ReactivateSubscriptionView,
    BillingInvoicesListView,
    StripeWebhookView
)

urlpatterns = [
    path('plans/', SubscriptionPlansListView.as_view(), name='billing-plans'),
    path('subscription/', WorkspaceSubscriptionDetailView.as_view(), name='billing-subscription'),
    path('checkout/', StripeCheckoutView.as_view(), name='billing-checkout'),
    path('customer-portal/', CustomerPortalView.as_view(), name='billing-customer-portal'),
    path('cancel-subscription/', CancelSubscriptionView.as_view(), name='billing-cancel-subscription'),
    path('reactivate-subscription/', ReactivateSubscriptionView.as_view(), name='billing-reactivate-subscription'),
    path('invoices/', BillingInvoicesListView.as_view(), name='billing-invoices'),
    path('stripe/webhook/', StripeWebhookView.as_view(), name='billing-stripe-webhook'),
]

