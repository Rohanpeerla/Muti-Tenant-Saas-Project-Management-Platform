import uuid
from django.conf import settings
from django.db import models


class Workspace(models.Model):
    """
    Workspace representing an independent tenant organization.
    All tenant-owned records link to a Workspace for isolation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    description = models.TextField(blank=True, default='')
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='owned_workspaces',
        help_text='Primary workspace owner and administrator.'
    )
    logo = models.CharField(max_length=500, blank=True, default='', help_text='Optional URL or file reference for workspace logo.')
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Workspace'
        verbose_name_plural = 'Workspaces'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['slug'], name='workspace_slug_idx'),
            models.Index(fields=['is_active', 'created_at'], name='workspace_active_created_idx'),
            models.Index(fields=['owner', 'is_active'], name='workspace_owner_active_idx'),
        ]

    def __str__(self):
        return f'{self.name} ({self.slug})'


class WorkspaceMembership(models.Model):
    """
    Associates a User with a Workspace under a specific Role and Membership Status.
    """
    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Owner'
        ADMIN = 'ADMIN', 'Admin'
        PROJECT_MANAGER = 'PROJECT_MANAGER', 'Project Manager'
        MEMBER = 'MEMBER', 'Member'
        VIEWER = 'VIEWER', 'Viewer'

    class Status(models.TextChoices):
        INVITED = 'INVITED', 'Invited'
        ACTIVE = 'ACTIVE', 'Active'
        SUSPENDED = 'SUSPENDED', 'Suspended'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workspace_memberships'
    )
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.MEMBER,
        db_index=True
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )
    joined_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Workspace Membership'
        verbose_name_plural = 'Workspace Memberships'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'user'],
                name='unique_workspace_user_membership'
            )
        ]
        indexes = [
            models.Index(fields=['workspace', 'role'], name='ws_member_role_idx'),
            models.Index(fields=['workspace', 'status'], name='ws_member_status_idx'),
            models.Index(fields=['user', 'status'], name='user_member_status_idx'),
        ]

    def __str__(self):
        return f'{self.user} - {self.workspace.name} ({self.role}/{self.status})'


class AuditLog(models.Model):
    """
    Workspace-level audit log recording critical security, administrative,
    and business mutations within a tenant organization.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        db_index=True
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=100, db_index=True)
    entity_type = models.CharField(max_length=100, db_index=True)
    entity_id = models.CharField(max_length=255, blank=True, default='')
    description = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'action'], name='audit_ws_action_idx'),
            models.Index(fields=['workspace', 'entity_type'], name='audit_ws_entity_idx'),
            models.Index(fields=['workspace', 'created_at'], name='audit_ws_created_idx'),
        ]

    def __str__(self):
        actor_name = self.actor.username if self.actor else 'System'
        return f'[{self.workspace.slug}] {self.action} on {self.entity_type} by {actor_name}'


def log_audit_event(workspace, actor, action, entity_type, entity_id='', description='', metadata=None):
    """
    Utility helper to safely record an audit log event within a workspace.
    Filters out any sensitive credential keys from metadata.
    """
    if metadata is None:
        metadata = {}
    # Sanitize metadata: never store password or token secrets
    sanitized_meta = {}
    sensitive_keys = {'password', 'token', 'access', 'refresh', 'secret', 'key', 'auth'}
    for k, v in metadata.items():
        if any(s in k.lower() for s in sensitive_keys):
            sanitized_meta[k] = '***REDACTED***'
        else:
            sanitized_meta[k] = v

    return AuditLog.objects.create(
        workspace=workspace,
        actor=actor if actor and getattr(actor, 'is_authenticated', False) else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        description=description,
        metadata=sanitized_meta
    )


