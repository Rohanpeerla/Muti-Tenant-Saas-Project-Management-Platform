import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.projects.models import Project
from apps.boards.models import Board


class Issue(models.Model):
    """
    Core issue tracking entity scoped to a workspace and project.
    """
    class IssueType(models.TextChoices):
        TASK = 'TASK', 'Task'
        BUG = 'BUG', 'Bug'
        STORY = 'STORY', 'Story'
        EPIC = 'EPIC', 'Epic'

    class Status(models.TextChoices):
        TODO = 'TODO', 'To Do'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        IN_REVIEW = 'IN_REVIEW', 'In Review'
        DONE = 'DONE', 'Done'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='issues',
        db_index=True
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='issues',
        db_index=True
    )
    board = models.ForeignKey(
        Board,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='issues'
    )
    sprint = models.ForeignKey(
        'sprints.Sprint',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='issues'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    issue_key = models.CharField(max_length=50, db_index=True)
    issue_type = models.CharField(
        max_length=30,
        choices=IssueType.choices,
        default=IssueType.TASK,
        db_index=True
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.TODO,
        db_index=True
    )
    priority = models.CharField(
        max_length=30,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='reported_issues'
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_issues'
    )
    due_date = models.DateField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Issue'
        verbose_name_plural = 'Issues'
        ordering = ['position', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'issue_key'],
                name='unique_issue_key_per_workspace'
            )
        ]
        indexes = [
            models.Index(fields=['workspace', 'issue_key'], name='issue_ws_key_idx'),
            models.Index(fields=['project', 'status'], name='issue_project_status_idx'),
            models.Index(fields=['project', 'priority'], name='issue_project_priority_idx'),
            models.Index(fields=['project', 'assignee'], name='issue_project_assignee_idx'),
            models.Index(fields=['project', 'sprint'], name='issue_project_sprint_idx'),
            models.Index(fields=['board', 'status'], name='issue_board_status_idx'),
            models.Index(fields=['workspace', 'status'], name='issue_ws_status_idx'),
        ]

    def clean(self):
        super().clean()
        # Tenant isolation validation: project must match workspace
        if self.workspace_id and self.project_id:
            if self.workspace_id != self.project.workspace_id:
                raise ValidationError({
                    'workspace': 'Issue workspace must match the workspace of its project.'
                })

        # Tenant isolation validation: board must match project and workspace
        if self.board_id:
            if self.board.project_id != self.project_id:
                raise ValidationError({
                    'board': 'Associated board must belong to the same project as the issue.'
                })
            if self.board.workspace_id != self.workspace_id:
                raise ValidationError({
                    'board': 'Associated board must belong to the same workspace as the issue.'
                })

        # Tenant isolation validation: sprint must match project and workspace
        if self.sprint_id:
            if self.sprint.project_id != self.project_id:
                raise ValidationError({
                    'sprint': 'Associated sprint must belong to the same project as the issue.'
                })
            if self.sprint.workspace_id != self.workspace_id:
                raise ValidationError({
                    'sprint': 'Associated sprint must belong to the same workspace as the issue.'
                })

        # Membership validation: reporter must belong to the workspace
        if self.workspace_id and self.reporter_id:
            is_reporter_member = WorkspaceMembership.objects.filter(
                workspace_id=self.workspace_id,
                user_id=self.reporter_id,
                status=WorkspaceMembership.Status.ACTIVE
            ).exists()
            if not is_reporter_member and self.workspace.owner_id != self.reporter_id:
                raise ValidationError({
                    'reporter': 'Issue reporter must be an active member of the workspace.'
                })

        # Membership validation: assignee (if set) must belong to the workspace
        if self.workspace_id and self.assignee_id:
            is_assignee_member = WorkspaceMembership.objects.filter(
                workspace_id=self.workspace_id,
                user_id=self.assignee_id,
                status=WorkspaceMembership.Status.ACTIVE
            ).exists()
            if not is_assignee_member and self.workspace.owner_id != self.assignee_id:
                raise ValidationError({
                    'assignee': 'Issue assignee must be an active member of the workspace.'
                })

    def save(self, *args, **kwargs):
        # Auto-align workspace from project if omitted
        if self.project_id and not self.workspace_id:
            self.workspace = self.project.workspace

        # Auto-generate issue key if omitted
        if not self.issue_key and self.project_id and self.workspace_id:
            prefix = self.project.key or 'ISSUE'
            last_count = Issue.objects.filter(project_id=self.project_id).count() + 1
            candidate = f"{prefix}-{last_count}"
            while Issue.objects.filter(workspace_id=self.workspace_id, issue_key=candidate).exclude(pk=self.pk).exists():
                last_count += 1
                candidate = f"{prefix}-{last_count}"
            self.issue_key = candidate

        self.full_clean()
        super().save(*args, **kwargs)


    def __str__(self):
        return f'[{self.issue_key}] {self.title}'


class Comment(models.Model):
    """
    User discussion comment associated with a specific task/issue.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    issue = models.ForeignKey(
        Issue,
        on_delete=models.CASCADE,
        related_name='comments',
        db_index=True
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='issue_comments',
        db_index=True
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='issue_comments'
    )
    content = models.TextField()
    is_edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Issue Comment'
        verbose_name_plural = 'Issue Comments'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['issue', 'created_at'], name='comment_issue_created_idx'),
            models.Index(fields=['workspace', 'created_at'], name='comment_ws_created_idx'),
        ]

    def clean(self):
        super().clean()
        if self.issue_id and not self.workspace_id:
            self.workspace = self.issue.workspace

        if self.workspace_id and self.issue_id:
            if self.workspace_id != self.issue.workspace_id:
                raise ValidationError({'workspace': 'Comment workspace must match issue workspace.'})

        # Membership check: author must belong to workspace
        if self.workspace_id and self.author_id:
            is_member = WorkspaceMembership.objects.filter(
                workspace_id=self.workspace_id,
                user_id=self.author_id,
                status=WorkspaceMembership.Status.ACTIVE
            ).exists()
            if not is_member and self.workspace.owner_id != self.author_id:
                raise ValidationError({'author': 'Comment author must be an active member of the workspace.'})

    def save(self, *args, **kwargs):
        if self.issue_id and not self.workspace_id:
            self.workspace = self.issue.workspace
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Comment by {self.author.username} on [{self.issue.issue_key}]'


def issue_attachment_upload_path(instance, filename):
    import re
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    ws_id = instance.issue.workspace_id if instance.issue_id else 'common'
    iss_id = instance.issue_id if instance.issue_id else 'tasks'
    return f'attachments/{ws_id}/{iss_id}/{uuid.uuid4().hex[:8]}_{safe_name}'


class IssueAttachment(models.Model):
    """
    Uploaded file associated with an issue, verified against size and extension policies.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    issue = models.ForeignKey(
        Issue,
        on_delete=models.CASCADE,
        related_name='attachments',
        db_index=True
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='issue_attachments',
        db_index=True
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='issue_attachments'
    )
    file = models.FileField(upload_to=issue_attachment_upload_path)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text='File size in bytes')
    mime_type = models.CharField(max_length=100, blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Issue Attachment'
        verbose_name_plural = 'Issue Attachments'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['issue', 'uploaded_at'], name='attach_issue_uploaded_idx'),
            models.Index(fields=['workspace', 'uploaded_at'], name='attach_ws_uploaded_idx'),
        ]

    def clean(self):
        super().clean()
        if self.issue_id and not self.workspace_id:
            self.workspace = self.issue.workspace

        if self.workspace_id and self.issue_id:
            if self.workspace_id != self.issue.workspace_id:
                raise ValidationError({'workspace': 'Attachment workspace must match issue workspace.'})

        if self.workspace_id and self.uploaded_by_id:
            is_member = WorkspaceMembership.objects.filter(
                workspace_id=self.workspace_id,
                user_id=self.uploaded_by_id,
                status=WorkspaceMembership.Status.ACTIVE
            ).exists()
            if not is_member and self.workspace.owner_id != self.uploaded_by_id:
                raise ValidationError({'uploaded_by': 'Uploader must be an active workspace member.'})

    def save(self, *args, **kwargs):
        if self.issue_id and not self.workspace_id:
            self.workspace = self.issue.workspace
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Clean up physical file on disk
        if self.file:
            try:
                self.file.delete(save=False)
            except Exception:
                pass
        super().delete(*args, **kwargs)

    def __str__(self):
        return f'{self.original_filename} on [{self.issue.issue_key}]'


class IssueActivity(models.Model):
    """
    Audit and activity timeline event associated with task changes.
    """
    class ActivityType(models.TextChoices):
        CREATED = 'CREATED', 'Task Created'
        UPDATED = 'UPDATED', 'Task Updated'
        STATUS_CHANGED = 'STATUS_CHANGED', 'Status Changed'
        PRIORITY_CHANGED = 'PRIORITY_CHANGED', 'Priority Changed'
        ASSIGNEE_CHANGED = 'ASSIGNEE_CHANGED', 'Assignee Changed'
        COMMENT_ADDED = 'COMMENT_ADDED', 'Comment Added'
        COMMENT_DELETED = 'COMMENT_DELETED', 'Comment Deleted'
        ATTACHMENT_UPLOADED = 'ATTACHMENT_UPLOADED', 'Attachment Uploaded'
        ATTACHMENT_DELETED = 'ATTACHMENT_DELETED', 'Attachment Deleted'
        SPRINT_CHANGED = 'SPRINT_CHANGED', 'Sprint Changed'
        MOVED = 'MOVED', 'Task Moved'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    issue = models.ForeignKey(
        Issue,
        on_delete=models.CASCADE,
        related_name='activities',
        db_index=True
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='issue_activities',
        db_index=True
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='issue_activities'
    )
    activity_type = models.CharField(
        max_length=50,
        choices=ActivityType.choices,
        default=ActivityType.UPDATED,
        db_index=True
    )
    description = models.TextField()
    field_changed = models.CharField(max_length=100, blank=True, default='')
    previous_value = models.TextField(blank=True, default='')
    new_value = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Issue Activity'
        verbose_name_plural = 'Issue Activities'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['issue', 'created_at'], name='activity_issue_created_idx'),
            models.Index(fields=['workspace', 'created_at'], name='activity_ws_created_idx'),
        ]

    def __str__(self):
        actor_name = self.actor.username if self.actor else 'System'
        return f'[{self.issue.issue_key}] {self.activity_type} by {actor_name}'


def record_issue_activity(issue, actor, activity_type, description, field_changed='', previous_value='', new_value='', metadata=None):
    """
    Helper function to safely record an activity event on an issue.
    """
    if metadata is None:
        metadata = {}
    return IssueActivity.objects.create(
        issue=issue,
        workspace=issue.workspace,
        actor=actor if actor and getattr(actor, 'is_authenticated', False) else None,
        activity_type=activity_type,
        description=description,
        field_changed=field_changed,
        previous_value=str(previous_value) if previous_value is not None else '',
        new_value=str(new_value) if new_value is not None else '',
        metadata=metadata
    )


