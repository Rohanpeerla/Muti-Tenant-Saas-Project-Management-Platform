import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        TASK_ASSIGNED = 'TASK_ASSIGNED', 'Task Assigned'
        TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED', 'Task Status Changed'
        TASK_COMMENTED = 'TASK_COMMENTED', 'Task Commented'
        TASK_MENTIONED = 'TASK_MENTIONED', 'Task Mentioned'
        TASK_DUE_SOON = 'TASK_DUE_SOON', 'Task Due Soon'
        TASK_OVERDUE = 'TASK_OVERDUE', 'Task Overdue'
        PROJECT_CREATED = 'PROJECT_CREATED', 'Project Created'
        PROJECT_UPDATED = 'PROJECT_UPDATED', 'Project Updated'
        SPRINT_STARTED = 'SPRINT_STARTED', 'Sprint Started'
        SPRINT_COMPLETED = 'SPRINT_COMPLETED', 'Sprint Completed'
        WORKSPACE_INVITATION = 'WORKSPACE_INVITATION', 'Workspace Invitation'
        WEBHOOK_FAILURE = 'WEBHOOK_FAILURE', 'Webhook Delivery Failure'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    related_entity_type = models.CharField(max_length=50, blank=True, default='')
    related_entity_id = models.CharField(max_length=255, blank=True, default='')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read', 'created_at']),
            models.Index(fields=['workspace', 'recipient']),
            models.Index(fields=['recipient', 'created_at']),
        ]

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    def __str__(self):
        return f'[{self.notification_type}] {self.title} -> {self.recipient.email}'


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    email_enabled = models.BooleanField(default=True)
    in_app_enabled = models.BooleanField(default=True)
    task_assignment = models.BooleanField(default=True)
    comment_notifications = models.BooleanField(default=True)
    mention_notifications = models.BooleanField(default=True)
    due_date_reminders = models.BooleanField(default=True)
    project_sprint_notifications = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_or_create_for_user(cls, user):
        obj, _ = cls.objects.get_or_create(user=user)
        return obj

    def __str__(self):
        return f'Preferences for {self.user.email}'

