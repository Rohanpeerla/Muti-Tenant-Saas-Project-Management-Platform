from django.contrib import admin
from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'workspace', 'owner', 'status', 'priority', 'due_date')
    list_filter = ('status', 'priority', 'workspace')
    search_fields = ('name', 'slug', 'workspace__name', 'owner__email')
    prepopulated_fields = {'slug': ('name',)}

