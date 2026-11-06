import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q
from apps.workspaces.models import Workspace, WorkspaceMembership


class Project(models.Model):
    """
    Project scoped strictly to a tenant Workspace.
    """
    class Status(models.TextChoices):
        PLANNING = 'PLANNING', 'Planning'
        ACTIVE = 'ACTIVE', 'Active'
        ON_HOLD = 'ON_HOLD', 'On Hold'
        COMPLETED = 'COMPLETED', 'Completed'
        ARCHIVED = 'ARCHIVED', 'Archived'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='projects',
        db_index=True
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    key = models.CharField(
        max_length=10,
        blank=True,
        default='',
        db_index=True,
        help_text='Short project key used as prefix for issue identifiers (e.g. DEV, PRJ).'
    )
    description = models.TextField(blank=True, default='')
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='owned_projects'
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PLANNING,
        db_index=True
    )
    priority = models.CharField(
        max_length=30,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True
    )
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Project'
        verbose_name_plural = 'Projects'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'slug'],
                name='unique_project_slug_per_workspace'
            ),
            models.UniqueConstraint(
                fields=['workspace', 'key'],
                name='unique_project_key_per_workspace'
            ),
            models.CheckConstraint(
                condition=Q(due_date__gte=F('start_date')) | Q(due_date__isnull=True) | Q(start_date__isnull=True),
                name='project_due_date_gte_start_date'
            ),
        ]
        indexes = [
            models.Index(fields=['workspace', 'slug'], name='project_ws_slug_idx'),
            models.Index(fields=['workspace', 'key'], name='project_ws_key_idx'),
            models.Index(fields=['workspace', 'status'], name='project_ws_status_idx'),
            models.Index(fields=['workspace', 'priority'], name='project_ws_priority_idx'),
        ]

    def clean(self):
        super().clean()
        # Date validation
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValidationError({'due_date': 'Project due date cannot be earlier than its start date.'})

        # Tenant isolation validation: project owner must be a member of the workspace
        if self.workspace_id and self.owner_id:
            is_member = WorkspaceMembership.objects.filter(
                workspace_id=self.workspace_id,
                user_id=self.owner_id,
                status=WorkspaceMembership.Status.ACTIVE
            ).exists()
            # Also allow the workspace owner even before separate membership row creation
            if not is_member and self.workspace.owner_id != self.owner_id:
                raise ValidationError({'owner': 'Project owner must be an active member of the project workspace.'})

    def save(self, *args, **kwargs):
        if not self.key and self.workspace_id:
            cleaned = ''.join(c for c in (self.name or self.slug) if c.isalnum()).upper()
            base_key = cleaned[:4] if len(cleaned) >= 2 else 'PRJ'
            candidate = base_key
            counter = 1
            while Project.objects.filter(workspace_id=self.workspace_id, key=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base_key[:3]}{counter}"
                counter += 1
            self.key = candidate
        elif self.key:
            self.key = self.key.strip().upper()

        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.workspace.slug}/{self.slug})'


class ProjectMember(models.Model):
    """
    Project-level membership and role assignment.
    """
    class Role(models.TextChoices):
        PROJECT_MANAGER = 'PROJECT_MANAGER', 'Project Manager'
        MEMBER = 'MEMBER', 'Member'
        VIEWER = 'VIEWER', 'Viewer'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.MEMBER,
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Project Member'
        verbose_name_plural = 'Project Members'
        ordering = ['role', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'user'],
                name='unique_project_user_membership'
            )
        ]
        indexes = [
            models.Index(fields=['project', 'role'], name='proj_member_role_idx'),
        ]

    def clean(self):
        super().clean()
        # Tenant isolation validation: user must be an active workspace member
        if self.project_id and self.user_id:
            is_member = WorkspaceMembership.objects.filter(
                workspace_id=self.project.workspace_id,
                user_id=self.user_id,
                status=WorkspaceMembership.Status.ACTIVE
            ).exists()
            if not is_member and self.project.workspace.owner_id != self.user_id:
                raise ValidationError({
                    'user': 'Project member must be an active member of the project workspace.'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user} - {self.project.name} ({self.role})'

