import uuid
from django.core.exceptions import ValidationError
from django.db import models
from apps.workspaces.models import Workspace
from apps.projects.models import Project


class Board(models.Model):
    """
    Kanban or Scrum board belonging to a specific project and workspace.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='boards',
        db_index=True
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='boards',
        db_index=True
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    is_default = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Board'
        verbose_name_plural = 'Boards'
        ordering = ['position', 'created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'name'],
                name='unique_board_name_per_project'
            )
        ]
        indexes = [
            models.Index(fields=['project', 'position'], name='board_project_pos_idx'),
            models.Index(fields=['workspace', 'project'], name='board_ws_project_idx'),
        ]

    def clean(self):
        super().clean()
        # Tenant isolation validation: Board's workspace must match Project's workspace
        if self.workspace_id and self.project_id:
            if self.workspace_id != self.project.workspace_id:
                raise ValidationError({
                    'workspace': 'Board workspace must match the workspace of its associated project.'
                })

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        # Auto-align workspace from project if omitted
        if self.project_id and not self.workspace_id:
            self.workspace = self.project.workspace
        self.full_clean()
        super().save(*args, **kwargs)
        if is_new:
            self.create_default_columns()

    def create_default_columns(self):
        default_columns = [
            ('To Do', 'TODO', 0, '#94a3b8', True, False),
            ('In Progress', 'IN_PROGRESS', 1, '#6366f1', False, False),
            ('In Review', 'IN_REVIEW', 2, '#f59e0b', False, False),
            ('Done', 'DONE', 3, '#10b981', False, True),
        ]
        columns_to_create = [
            BoardColumn(
                board=self,
                name=name,
                key=key,
                position=pos,
                color=color,
                is_default=is_def,
                is_completion=is_comp
            )
            for name, key, pos, color, is_def, is_comp in default_columns
            if not BoardColumn.objects.filter(board=self, key=key).exists()
        ]
        if columns_to_create:
            BoardColumn.objects.bulk_create(columns_to_create)

    def __str__(self):
        return f'{self.name} - {self.project.name}'


class BoardColumn(models.Model):
    """
    Workflow status column belonging to a Kanban/Scrum Board.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name='columns'
    )
    name = models.CharField(max_length=100)
    key = models.CharField(max_length=50, db_index=True)
    position = models.PositiveIntegerField(default=0)
    color = models.CharField(max_length=50, default='#6366f1')
    is_default = models.BooleanField(default=False)
    is_completion = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Board Column'
        verbose_name_plural = 'Board Columns'
        ordering = ['position', 'created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['board', 'key'],
                name='unique_board_column_key'
            )
        ]
        indexes = [
            models.Index(fields=['board', 'position'], name='board_col_pos_idx'),
            models.Index(fields=['board', 'key'], name='board_col_key_idx'),
        ]

    def __str__(self):
        return f'{self.name} ({self.key}) - {self.board.name}'


class WorkflowTransition(models.Model):
    """
    Defines allowed directed status transitions between columns on a board.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        Board,
        on_delete=models.CASCADE,
        related_name='transitions',
        db_index=True
    )
    from_column = models.ForeignKey(
        BoardColumn,
        on_delete=models.CASCADE,
        related_name='outgoing_transitions'
    )
    to_column = models.ForeignKey(
        BoardColumn,
        on_delete=models.CASCADE,
        related_name='incoming_transitions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Workflow Transition'
        verbose_name_plural = 'Workflow Transitions'
        constraints = [
            models.UniqueConstraint(
                fields=['board', 'from_column', 'to_column'],
                name='unique_board_workflow_transition'
            )
        ]
        indexes = [
            models.Index(fields=['board'], name='wf_transition_board_idx'),
        ]

    def clean(self):
        super().clean()
        if self.from_column_id and self.from_column.board_id != self.board_id:
            raise ValidationError({'from_column': 'Source column must belong to the same board.'})
        if self.to_column_id and self.to_column.board_id != self.board_id:
            raise ValidationError({'to_column': 'Destination column must belong to the same board.'})
        if self.from_column_id and self.to_column_id and self.from_column_id == self.to_column_id:
            raise ValidationError({'to_column': 'Source and destination columns must be different.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.board.name}: {self.from_column.name} -> {self.to_column.name}'



