from django.contrib import admin
from .models import Workspace, WorkspaceMembership


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'owner', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'slug', 'owner__email', 'owner__username')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'workspace', 'role', 'status', 'joined_at')
    list_filter = ('role', 'status', 'workspace')
    search_fields = ('user__email', 'user__username', 'workspace__name')

