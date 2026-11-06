from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.boards.models import Board
from apps.projects.models import Project, ProjectMember
from apps.sprints.models import Sprint
from apps.workspaces.models import WorkspaceMembership
from .models import Issue, Comment, IssueAttachment, IssueActivity

User = get_user_model()


class IssueSerializer(serializers.ModelSerializer):
    """
    Representation of an Issue / Task including reporter and assignee user details.
    """
    reporter = UserSerializer(read_only=True)
    assignee = UserSerializer(read_only=True)
    project_key = serializers.CharField(source='project.key', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    sprint_name = serializers.CharField(source='sprint.name', read_only=True)
    board_name = serializers.CharField(source='board.name', read_only=True)

    class Meta:
        model = Issue
        fields = [
            'id',
            'workspace',
            'project',
            'project_key',
            'project_name',
            'board',
            'board_name',
            'sprint',
            'sprint_name',
            'title',
            'description',
            'issue_key',
            'issue_type',
            'status',
            'priority',
            'reporter',
            'assignee',
            'due_date',
            'position',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'project', 'issue_key', 'reporter', 'created_at', 'updated_at']


class IssueCreateSerializer(serializers.Serializer):
    """
    Serializer to create a new task/issue within a project.
    """
    title = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    issue_type = serializers.ChoiceField(choices=Issue.IssueType.choices, default=Issue.IssueType.TASK)
    status = serializers.CharField(max_length=50, default='TODO')
    priority = serializers.ChoiceField(choices=Issue.Priority.choices, default=Issue.Priority.MEDIUM)
    assignee_id = serializers.UUIDField(required=False, allow_null=True)
    board_id = serializers.UUIDField(required=False, allow_null=True)
    sprint_id = serializers.UUIDField(required=False, allow_null=True)
    due_date = serializers.DateField(required=False, allow_null=True)
    position = serializers.IntegerField(required=False, default=None)

    def validate(self, attrs):
        project = self.context['project']
        workspace = project.workspace

        # Validate assignee belongs to workspace
        assignee_id = attrs.get('assignee_id')
        if assignee_id:
            assignee = User.objects.filter(id=assignee_id).first()
            if not assignee:
                raise serializers.ValidationError({'assignee_id': 'Selected assignee user does not exist.'})
            is_member = WorkspaceMembership.objects.filter(
                workspace=workspace,
                user=assignee,
                status=WorkspaceMembership.Status.ACTIVE
            ).exists()
            if not is_member and workspace.owner_id != assignee.id:
                raise serializers.ValidationError({'assignee_id': 'Assignee must be an active member of this workspace.'})
            attrs['assignee'] = assignee

        # Validate board belongs to project
        board_id = attrs.get('board_id')
        if board_id:
            board = Board.objects.filter(id=board_id, project=project).first()
            if not board:
                raise serializers.ValidationError({'board_id': 'Selected board does not belong to this project.'})
            attrs['board'] = board
        else:
            # Fallback to default board if available
            attrs['board'] = Board.objects.filter(project=project, is_default=True).first()

        # Validate sprint belongs to project
        sprint_id = attrs.get('sprint_id')
        if sprint_id:
            sprint = Sprint.objects.filter(id=sprint_id, project=project).first()
            if not sprint:
                raise serializers.ValidationError({'sprint_id': 'Selected sprint does not belong to this project.'})
            attrs['sprint'] = sprint

        return attrs

    def create(self, validated_data):
        project = self.context['project']
        request_user = self.context['request'].user
        status_val = validated_data.get('status', 'TODO')

        # Auto position: place at end of column
        pos = validated_data.get('position')
        if pos is None:
            last = Issue.objects.filter(project=project, status=status_val).count()
            pos = last

        issue = Issue.objects.create(
            workspace=project.workspace,
            project=project,
            board=validated_data.get('board'),
            sprint=validated_data.get('sprint'),
            title=validated_data['title'],
            description=validated_data.get('description', ''),
            issue_type=validated_data.get('issue_type', Issue.IssueType.TASK),
            status=status_val,
            priority=validated_data.get('priority', Issue.Priority.MEDIUM),
            reporter=request_user,
            assignee=validated_data.get('assignee'),
            due_date=validated_data.get('due_date'),
            position=pos,
        )
        return issue


class IssueUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer to update an issue's attributes.
    """
    assignee_id = serializers.UUIDField(required=False, allow_null=True)
    board_id = serializers.UUIDField(required=False, allow_null=True)
    sprint_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Issue
        fields = [
            'title',
            'description',
            'issue_type',
            'status',
            'priority',
            'assignee_id',
            'board_id',
            'sprint_id',
            'due_date',
            'position',
        ]

    def validate(self, attrs):
        project = self.instance.project
        workspace = project.workspace

        if 'assignee_id' in attrs:
            aid = attrs.pop('assignee_id')
            if aid is None:
                attrs['assignee'] = None
            else:
                user = User.objects.filter(id=aid).first()
                if not user:
                    raise serializers.ValidationError({'assignee_id': 'User not found.'})
                is_member = WorkspaceMembership.objects.filter(
                    workspace=workspace,
                    user=user,
                    status=WorkspaceMembership.Status.ACTIVE
                ).exists()
                if not is_member and workspace.owner_id != user.id:
                    raise serializers.ValidationError({'assignee_id': 'User must be an active workspace member.'})
                attrs['assignee'] = user

        if 'board_id' in attrs:
            bid = attrs.pop('board_id')
            if bid is None:
                attrs['board'] = None
            else:
                board = Board.objects.filter(id=bid, project=project).first()
                if not board:
                    raise serializers.ValidationError({'board_id': 'Board not found in this project.'})
                attrs['board'] = board

        if 'sprint_id' in attrs:
            sid = attrs.pop('sprint_id')
            if sid is None:
                attrs['sprint'] = None
            else:
                sprint = Sprint.objects.filter(id=sid, project=project).first()
                if not sprint:
                    raise serializers.ValidationError({'sprint_id': 'Sprint not found in this project.'})
                attrs['sprint'] = sprint

        return attrs


class IssueMoveSerializer(serializers.Serializer):
    """
    Serializer specifically for Kanban drag-and-drop movement.
    """
    status = serializers.CharField(max_length=50, required=True)
    position = serializers.IntegerField(required=True, min_value=0)
    board_id = serializers.UUIDField(required=False, allow_null=True)


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = [
            'id',
            'issue',
            'workspace',
            'author',
            'content',
            'is_edited',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'issue', 'workspace', 'author', 'is_edited', 'created_at', 'updated_at']

    def validate_content(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError('Comment content cannot be empty.')
        if len(val) > 10000:
            raise serializers.ValidationError('Comment content exceeds maximum limit (10,000 characters).')
        return val


class IssueAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = IssueAttachment
        fields = [
            'id',
            'issue',
            'workspace',
            'uploaded_by',
            'original_filename',
            'file_size',
            'mime_type',
            'download_url',
            'uploaded_at',
        ]
        read_only_fields = [
            'id',
            'issue',
            'workspace',
            'uploaded_by',
            'original_filename',
            'file_size',
            'mime_type',
            'download_url',
            'uploaded_at',
        ]

    def get_download_url(self, obj):
        return f'/api/attachments/{obj.id}/download/'


class IssueActivitySerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = IssueActivity
        fields = [
            'id',
            'issue',
            'workspace',
            'actor',
            'activity_type',
            'description',
            'field_changed',
            'previous_value',
            'new_value',
            'metadata',
            'created_at',
        ]
        read_only_fields = fields


