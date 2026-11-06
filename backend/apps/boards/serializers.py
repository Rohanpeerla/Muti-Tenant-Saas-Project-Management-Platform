from rest_framework import serializers
from apps.projects.models import Project
from .models import Board, BoardColumn, WorkflowTransition


class BoardColumnSerializer(serializers.ModelSerializer):
    """
    Representation of a board workflow column.
    """
    class Meta:
        model = BoardColumn
        fields = [
            'id',
            'board',
            'name',
            'key',
            'position',
            'color',
            'is_default',
            'is_completion',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'board', 'created_at', 'updated_at']


class BoardSerializer(serializers.ModelSerializer):
    """
    Representation of a Board including its workflow columns.
    """
    columns = BoardColumnSerializer(many=True, read_only=True)
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = [
            'id',
            'workspace',
            'project',
            'name',
            'description',
            'is_default',
            'position',
            'columns',
            'task_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'project', 'created_at', 'updated_at']

    def get_task_count(self, obj):
        return obj.issues.count()


class BoardCreateSerializer(serializers.Serializer):
    """
    Serializer to create a new board in a project.
    """
    name = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    is_default = serializers.BooleanField(required=False, default=False)

    def create(self, validated_data):
        project = self.context['project']
        is_default = validated_data.get('is_default', False)

        if is_default:
            Board.objects.filter(project=project, is_default=True).update(is_default=False)

        # Calculate next position
        next_pos = Board.objects.filter(project=project).count()

        return Board.objects.create(
            workspace=project.workspace,
            project=project,
            name=validated_data['name'],
            description=validated_data.get('description', ''),
            is_default=is_default,
            position=next_pos
        )


class AddBoardColumnSerializer(serializers.Serializer):
    """
    Serializer to add a custom column to a board.
    """
    name = serializers.CharField(max_length=100, required=True, trim_whitespace=True)
    key = serializers.CharField(max_length=50, required=False, allow_blank=True)
    position = serializers.IntegerField(required=False, default=None)
    color = serializers.CharField(max_length=50, required=False, default='#6366f1')
    is_default = serializers.BooleanField(required=False, default=False)
    is_completion = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        board = self.context['board']
        name = attrs['name']
        key = attrs.get('key', '').strip().upper() or name.strip().upper().replace(' ', '_')

        # Prevent duplicate column key on same board
        if BoardColumn.objects.filter(board=board, key=key).exists():
            raise serializers.ValidationError({'key': f'A column with key "{key}" already exists on this board.'})

        attrs['key'] = key
        return attrs

    def create(self, validated_data):
        board = self.context['board']
        key = validated_data['key']
        name = validated_data['name']
        position = validated_data.get('position')
        color = validated_data.get('color', '#6366f1')
        is_default = validated_data.get('is_default', False)
        is_completion = validated_data.get('is_completion', False)

        if is_default:
            BoardColumn.objects.filter(board=board, is_default=True).update(is_default=False)
        if is_completion:
            BoardColumn.objects.filter(board=board, is_completion=True).update(is_completion=False)

        if position is None:
            position = BoardColumn.objects.filter(board=board).count()

        return BoardColumn.objects.create(
            board=board,
            name=name,
            key=key,
            position=position,
            color=color,
            is_default=is_default,
            is_completion=is_completion
        )


class WorkflowTransitionSerializer(serializers.ModelSerializer):
    """
    Serializer for workflow status transitions on a Kanban board.
    """
    from_column_name = serializers.ReadOnlyField(source='from_column.name')
    to_column_name = serializers.ReadOnlyField(source='to_column.name')
    from_column_key = serializers.ReadOnlyField(source='from_column.key')
    to_column_key = serializers.ReadOnlyField(source='to_column.key')

    class Meta:
        model = WorkflowTransition
        fields = [
            'id',
            'board',
            'from_column',
            'from_column_name',
            'from_column_key',
            'to_column',
            'to_column_name',
            'to_column_key',
            'created_at',
        ]
        read_only_fields = ['id', 'board', 'created_at']

    def validate(self, attrs):
        board = self.context['board']
        from_col = attrs.get('from_column')
        to_col = attrs.get('to_column')

        if from_col.board_id != board.id:
            raise serializers.ValidationError({'from_column': 'Source column must belong to this board.'})
        if to_col.board_id != board.id:
            raise serializers.ValidationError({'to_column': 'Destination column must belong to this board.'})
        if from_col.id == to_col.id:
            raise serializers.ValidationError({'to_column': 'Source and destination columns must be different.'})
        if WorkflowTransition.objects.filter(board=board, from_column=from_col, to_column=to_col).exists():
            raise serializers.ValidationError({'non_field_errors': 'This transition already exists on this board.'})

        return attrs

    def create(self, validated_data):
        board = self.context['board']
        return WorkflowTransition.objects.create(board=board, **validated_data)


