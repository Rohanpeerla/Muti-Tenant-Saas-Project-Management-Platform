import secrets
import uuid
from django.conf import settings
from django.db import models


class Webhook(models.Model):
    EVENT_CHOICES = [
        ('task.created', 'Task Created'),
        ('task.updated', 'Task Updated'),
        ('task.assigned', 'Task Assigned'),
        ('task.status_changed', 'Task Status Changed'),
        ('task.completed', 'Task Completed'),
        ('comment.created', 'Comment Created'),
        ('project.created', 'Project Created'),
        ('sprint.started', 'Sprint Started'),
        ('sprint.completed', 'Sprint Completed'),
        ('member.invited', 'Member Invited'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='webhooks'
    )
    name = models.CharField(max_length=150)
    target_url = models.URLField(max_length=500)
    secret = models.CharField(max_length=128)
    subscribed_events = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_webhooks'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_delivery_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'is_active']),
            models.Index(fields=['workspace', 'created_at']),
        ]

    def save(self, *args, **kwargs):
        if not self.secret:
            self.secret = secrets.token_hex(32)
        super().save(*args, **kwargs)

    def rotate_secret(self):
        new_secret = secrets.token_hex(32)
        self.secret = new_secret
        self.save(update_fields=['secret', 'updated_at'])
        return new_secret

    def __str__(self):
        return f'{self.name} ({self.workspace.name})'


class WebhookDelivery(models.Model):
    class DeliveryStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'
        RETRYING = 'RETRYING', 'Retrying'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    webhook = models.ForeignKey(
        Webhook,
        on_delete=models.CASCADE,
        related_name='deliveries'
    )
    event_type = models.CharField(max_length=100)
    event_id = models.UUIDField(default=uuid.uuid4)
    request_payload = models.JSONField(default=dict)
    response_status = models.IntegerField(null=True, blank=True)
    response_summary = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING
    )
    attempt_count = models.IntegerField(default=0)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['webhook', 'created_at']),
            models.Index(fields=['status', 'next_retry_at']),
        ]

    def __str__(self):
        return f'{self.event_type} on {self.webhook.name} [{self.status}]'

