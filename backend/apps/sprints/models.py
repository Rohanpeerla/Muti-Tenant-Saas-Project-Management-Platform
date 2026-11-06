import uuid
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q
from apps.workspaces.models import Workspace
from apps.projects.models import Project


class Sprint(models.Model):
    """
    Agile sprint iteration scoped to a specific project and workspace.
    """
    class Status(models.TextChoices):
        PLANNED = 'PLANNED', 'Planned'
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='sprints',
        db_index=True
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='sprints',
        db_index=True
    )
    name = models.CharField(max_length=255)
    goal = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PLANNED,
        db_index=True
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Sprint'
        verbose_name_plural = 'Sprints'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gte=F('start_date')) | Q(end_date__isnull=True) | Q(start_date__isnull=True),
                name='sprint_end_date_gte_start_date'
            )
        ]
        indexes = [
            models.Index(fields=['workspace', 'status'], name='sprint_ws_status_idx'),
            models.Index(fields=['project', 'status'], name='sprint_project_status_idx'),
            models.Index(fields=['start_date', 'end_date'], name='sprint_dates_idx'),
        ]

    def clean(self):
        super().clean()
        # Date consistency validation
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({
                'end_date': 'Sprint end date cannot precede its start date.'
            })

        # Tenant isolation validation: sprint workspace must match project workspace
        if self.workspace_id and self.project_id:
            if self.workspace_id != self.project.workspace_id:
                raise ValidationError({
                    'workspace': 'Sprint workspace must match the workspace of its associated project.'
                })

    def save(self, *args, **kwargs):
        # Auto-align workspace from project if omitted
        if self.project_id and not self.workspace_id:
            self.workspace = self.project.workspace
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} - {self.project.name} ({self.status})'
