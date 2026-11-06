from django.contrib import admin
from .models import Sprint


@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'workspace', 'status', 'start_date', 'end_date')
    list_filter = ('status', 'workspace')
    search_fields = ('name', 'project__name', 'workspace__name')

