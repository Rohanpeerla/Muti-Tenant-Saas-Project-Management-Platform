from rest_framework import serializers
from apps.notifications.models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    workspace_name = serializers.ReadOnlyField(source='workspace.name')

    class Meta:
        model = Notification
        fields = [
            'id',
            'workspace',
            'workspace_name',
            'notification_type',
            'title',
            'message',
            'related_entity_type',
            'related_entity_id',
            'is_read',
            'created_at',
            'read_at',
        ]
        read_only_fields = ['id', 'workspace', 'workspace_name', 'notification_type', 'title', 'message', 'related_entity_type', 'related_entity_id', 'created_at', 'read_at']


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            'email_enabled',
            'in_app_enabled',
            'task_assignment',
            'comment_notifications',
            'mention_notifications',
            'due_date_reminders',
            'project_sprint_notifications',
            'updated_at',
        ]
        read_only_fields = ['updated_at']

