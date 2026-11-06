from rest_framework import serializers
from apps.billing.models import (
    SubscriptionPlan,
    WorkspaceSubscription,
    WorkspaceUsage,
    BillingInvoice
)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'monthly_price',
            'yearly_price',
            'currency',
            'max_members',
            'max_projects',
            'max_tasks',
            'max_storage_bytes',
            'max_webhooks',
            'features',
            'is_active',
        ]


class WorkspaceUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceUsage
        fields = [
            'members_count',
            'projects_count',
            'tasks_count',
            'storage_used_bytes',
            'webhooks_count',
            'last_calculated_at',
        ]


class WorkspaceSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    plan_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = WorkspaceSubscription
        fields = [
            'id',
            'workspace',
            'plan',
            'plan_id',
            'stripe_customer_id',
            'status',
            'billing_interval',
            'current_period_start',
            'current_period_end',
            'trial_start',
            'trial_end',
            'cancel_at_period_end',
            'canceled_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'workspace',
            'stripe_customer_id',
            'status',
            'current_period_start',
            'current_period_end',
            'trial_start',
            'trial_end',
            'canceled_at',
            'created_at',
            'updated_at',
        ]


class BillingInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingInvoice
        fields = [
            'id',
            'stripe_invoice_id',
            'invoice_number',
            'amount_due',
            'amount_paid',
            'currency',
            'status',
            'billing_period_start',
            'billing_period_end',
            'invoice_pdf_url',
            'hosted_invoice_url',
            'created_at',
        ]
        read_only_fields = fields

