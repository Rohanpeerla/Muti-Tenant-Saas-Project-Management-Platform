from django.contrib import admin
from .models import Board


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'workspace', 'is_default', 'position')
    list_filter = ('is_default', 'workspace')
    search_fields = ('name', 'project__name', 'workspace__name')

