from rest_framework import serializers
from .models import Sprint


class SprintSerializer(serializers.ModelSerializer):
    """
    Representation of a sprint with progress and task count metrics.
    """
    total_tasks = serializers.SerializerMethodField()
    completed_tasks = serializers.SerializerMethodField()
    remaining_tasks = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Sprint
        fields = [
            'id',
            'workspace',
            'project',
            'name',
            'goal',
            'status',
            'start_date',
            'end_date',
            'total_tasks',
            'completed_tasks',
            'remaining_tasks',
            'progress_percentage',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'project', 'created_at', 'updated_at']

    def get_total_tasks(self, obj):
        return obj.issues.count()

    def get_completed_tasks(self, obj):
        return obj.issues.filter(status='DONE').count()

    def get_remaining_tasks(self, obj):
        total = obj.issues.count()
        done = obj.issues.filter(status='DONE').count()
        return max(0, total - done)

    def get_progress_percentage(self, obj):
        total = obj.issues.count()
        if total == 0:
            return 0
        done = obj.issues.filter(status='DONE').count()
        return round((done / total) * 100)


class SprintCreateSerializer(serializers.Serializer):
    """
    Serializer to create a new planned sprint within a project.
    """
    name = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    goal = serializers.CharField(required=False, allow_blank=True, default='')
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'Sprint end date cannot precede its start date.'})
        return attrs

    def create(self, validated_data):
        project = self.context['project']
        return Sprint.objects.create(
            workspace=project.workspace,
            project=project,
            name=validated_data['name'],
            goal=validated_data.get('goal', ''),
            status=Sprint.Status.PLANNED,
            start_date=validated_data.get('start_date'),
            end_date=validated_data.get('end_date'),
        )


class SprintUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer to update sprint details.
    """
    class Meta:
        model = Sprint
        fields = [
            'name',
            'goal',
            'start_date',
            'end_date',
            'status',
        ]

    def validate(self, attrs):
        start = attrs.get('start_date', self.instance.start_date)
        end = attrs.get('end_date', self.instance.end_date)
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'Sprint end date cannot precede start date.'})
        return attrs

