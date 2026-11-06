import uuid
from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone


class SubscriptionPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    monthly_price = models.IntegerField(default=0, help_text='Price in smallest currency unit (cents)')
    yearly_price = models.IntegerField(default=0, help_text='Price in smallest currency unit (cents)')
    currency = models.CharField(max_length=10, default='usd')
    stripe_monthly_price_id = models.CharField(max_length=100, blank=True, default='')
    stripe_yearly_price_id = models.CharField(max_length=100, blank=True, default='')

    # Configurable plan limits
    max_members = models.IntegerField(default=5)
    max_projects = models.IntegerField(default=3)
    max_tasks = models.IntegerField(default=100)
    max_storage_bytes = models.BigIntegerField(default=104857600)  # 100 MB default
    max_webhooks = models.IntegerField(default=0)

    # Feature flags
    features = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['monthly_price', 'created_at']

    def __str__(self):
        return f'{self.name} (${self.monthly_price / 100:.2f}/mo)'


class WorkspaceSubscription(models.Model):
    class SubscriptionStatus(models.TextChoices):
        FREE = 'FREE', 'Free'
        INCOMPLETE = 'INCOMPLETE', 'Incomplete'
        TRIALING = 'TRIALING', 'Trialing'
        ACTIVE = 'ACTIVE', 'Active'
        PAST_DUE = 'PAST_DUE', 'Past Due'
        CANCELED = 'CANCELED', 'Canceled'
        UNPAID = 'UNPAID', 'Unpaid'
        INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED', 'Incomplete Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='subscription'
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name='subscriptions'
    )
    stripe_customer_id = models.CharField(max_length=100, blank=True, default='', db_index=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True, default='', db_index=True)
    stripe_price_id = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(
        max_length=30,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.FREE
    )
    billing_interval = models.CharField(max_length=20, default='monthly')
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['workspace', 'status']),
            models.Index(fields=['stripe_customer_id']),
            models.Index(fields=['stripe_subscription_id']),
        ]

    @property
    def is_active_or_trialing(self):
        return self.status in [self.SubscriptionStatus.ACTIVE, self.SubscriptionStatus.TRIALING, self.SubscriptionStatus.FREE]

    def __str__(self):
        return f'{self.workspace.name} - {self.plan.name} ({self.status})'


class WorkspaceUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='usage'
    )
    members_count = models.IntegerField(default=0)
    projects_count = models.IntegerField(default=0)
    tasks_count = models.IntegerField(default=0)
    storage_used_bytes = models.BigIntegerField(default=0)
    webhooks_count = models.IntegerField(default=0)
    last_calculated_at = models.DateTimeField(auto_now=True)

    def recalculate(self):
        """
        Recalculates accurate usage metrics from database records.
        """
        from apps.workspaces.models import WorkspaceMembership
        from apps.projects.models import Project
        from apps.issues.models import Issue, IssueAttachment
        from apps.webhooks.models import Webhook

        # Members: active workspace members
        self.members_count = WorkspaceMembership.objects.filter(
            workspace=self.workspace,
            status=WorkspaceMembership.Status.ACTIVE
        ).count()

        # Projects
        self.projects_count = Project.objects.filter(workspace=self.workspace).count()

        # Tasks
        self.tasks_count = Issue.objects.filter(workspace=self.workspace).count()

        # Storage
        storage_agg = IssueAttachment.objects.filter(workspace=self.workspace).aggregate(total=Sum('file_size'))
        self.storage_used_bytes = storage_agg['total'] or 0

        # Webhooks
        self.webhooks_count = Webhook.objects.filter(workspace=self.workspace, is_active=True).count()

        self.save()
        return self

    def __str__(self):
        return f'Usage for {self.workspace.name}'


class BillingInvoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='invoices'
    )
    stripe_invoice_id = models.CharField(max_length=100, unique=True, db_index=True)
    invoice_number = models.CharField(max_length=100, blank=True, default='')
    amount_due = models.IntegerField(default=0)
    amount_paid = models.IntegerField(default=0)
    currency = models.CharField(max_length=10, default='usd')
    status = models.CharField(max_length=30, default='paid')
    billing_period_start = models.DateTimeField(null=True, blank=True)
    billing_period_end = models.DateTimeField(null=True, blank=True)
    invoice_pdf_url = models.URLField(max_length=500, blank=True, default='')
    hosted_invoice_url = models.URLField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.invoice_number or self.stripe_invoice_id} ({self.workspace.name})'


class StripeWebhookEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stripe_event_id = models.CharField(max_length=100, unique=True, db_index=True)
    event_type = models.CharField(max_length=100)
    processed = models.BooleanField(default=False)
    error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.event_type} [{self.stripe_event_id}]'

