from django.contrib import admin
from .models import Issue


@admin.register(Issue)
class IssueAdmin(admin.ModelAdmin):
    list_display = ('issue_key', 'title', 'project', 'workspace', 'issue_type', 'status', 'priority', 'assignee')
    list_filter = ('issue_type', 'status', 'priority', 'workspace')
    search_fields = ('issue_key', 'title', 'project__name', 'assignee__email')

