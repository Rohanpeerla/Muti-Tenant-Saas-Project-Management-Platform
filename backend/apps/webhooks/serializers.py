from rest_framework import serializers
from apps.webhooks.models import Webhook, WebhookDelivery
from apps.webhooks.security import validate_webhook_url


class WebhookSerializer(serializers.ModelSerializer):
    secret_preview = serializers.SerializerMethodField()
    created_by_email = serializers.ReadOnlyField(source='created_by.email')

    class Meta:
        model = Webhook
        fields = [
            'id',
            'workspace',
            'name',
            'target_url',
            'subscribed_events',
            'is_active',
            'secret_preview',
            'created_by',
            'created_by_email',
            'created_at',
            'updated_at',
            'last_delivery_at',
        ]
        read_only_fields = ['id', 'workspace', 'created_by', 'created_at', 'updated_at', 'last_delivery_at', 'secret_preview']

    def get_secret_preview(self, obj):
        if obj.secret:
            return f'••••••••{obj.secret[-6:]}'
        return None

    def validate_target_url(self, value):
        validate_webhook_url(value)
        return value

    def validate_subscribed_events(self, value):
        if not isinstance(value, list) or len(value) == 0:
            raise serializers.ValidationError('At least one event must be selected.')
        valid_events = {choice[0] for choice in Webhook.EVENT_CHOICES}
        valid_events.add('*')
        for ev in value:
            if ev not in valid_events:
                raise serializers.ValidationError(f'Unknown event type: "{ev}".')
        return value


class WebhookCreateSerializer(WebhookSerializer):
    """
    Serializer used on creation: includes full plaintext secret once so the user can copy it.
    """
    secret = serializers.CharField(read_only=True)

    class Meta(WebhookSerializer.Meta):
        fields = WebhookSerializer.Meta.fields + ['secret']


class WebhookDeliverySerializer(serializers.ModelSerializer):
    webhook_name = serializers.ReadOnlyField(source='webhook.name')

    class Meta:
        model = WebhookDelivery
        fields = [
            'id',
            'webhook',
            'webhook_name',
            'event_type',
            'event_id',
            'request_payload',
            'response_status',
            'response_summary',
            'status',
            'attempt_count',
            'next_retry_at',
            'created_at',
            'last_attempted_at',
            'completed_at',
        ]
        read_only_fields = fields

