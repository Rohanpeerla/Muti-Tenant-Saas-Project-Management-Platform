import uuid
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.boards.models import Board
from apps.workspaces.models import Workspace, WorkspaceMembership
from .models import Project, ProjectMember

User = get_user_model()


class ProjectMemberSerializer(serializers.ModelSerializer):
    """
    Representation of a project member and their role.
    """
    user = UserSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = [
            'id',
            'project',
            'user',
            'role',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project', 'created_at', 'updated_at']


class AddProjectMemberSerializer(serializers.Serializer):
    """
    Serializer to assign an active workspace member to a project.
    """
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(
        choices=ProjectMember.Role.choices,
        default=ProjectMember.Role.MEMBER
    )

    def validate_email(self, value):
        normalized = value.strip().lower()
        try:
            user = User.objects.get(email__iexact=normalized)
        except User.DoesNotExist:
            raise serializers.ValidationError('No registered user found with this email address.')
        return normalized

    def validate(self, attrs):
        project = self.context['project']
        email = attrs['email']
        user = User.objects.get(email__iexact=email)

        # 1. User must have active membership in project's workspace
        is_ws_member = WorkspaceMembership.objects.filter(
            workspace=project.workspace,
            user=user,
            status=WorkspaceMembership.Status.ACTIVE
        ).exists()
        if not is_ws_member and project.workspace.owner_id != user.id:
            raise serializers.ValidationError({
                'email': 'User must be an active member of this workspace to join this project.'
            })

        # 2. Prevent duplicate project assignment
        if ProjectMember.objects.filter(project=project, user=user).exists():
            raise serializers.ValidationError({
                'email': 'This user is already a member of this project.'
            })

        attrs['target_user'] = user
        return attrs

    def create(self, validated_data):
        project = self.context['project']
        target_user = validated_data['target_user']
        role = validated_data.get('role', ProjectMember.Role.MEMBER)

        return ProjectMember.objects.create(
            project=project,
            user=target_user,
            role=role
        )


class ProjectSerializer(serializers.ModelSerializer):
    """
    Full representation of a project with calculated progress metrics.
    """
    owner = UserSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()
    completed_task_count = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()
    active_sprint = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id',
            'workspace',
            'name',
            'slug',
            'key',
            'description',
            'owner',
            'status',
            'priority',
            'start_date',
            'due_date',
            'member_count',
            'task_count',
            'completed_task_count',
            'progress_percentage',
            'active_sprint',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'owner', 'created_at', 'updated_at']

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_task_count(self, obj):
        return obj.issues.count()

    def get_completed_task_count(self, obj):
        return obj.issues.filter(status='DONE').count()

    def get_progress_percentage(self, obj):
        total = obj.issues.count()
        if total == 0:
            return 0
        done = obj.issues.filter(status='DONE').count()
        return round((done / total) * 100)

    def get_active_sprint(self, obj):
        active = obj.sprints.filter(status='ACTIVE').first()
        if active:
            return {
                'id': str(active.id),
                'name': active.name,
                'status': active.status,
                'end_date': active.end_date,
            }
        return None


class ProjectCreateSerializer(serializers.Serializer):
    """
    Serializer to create a project, auto-generating slug and key, and
    setting up a default Board and ProjectManager membership.
    """
    name = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    key = serializers.CharField(max_length=10, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    status = serializers.ChoiceField(choices=Project.Status.choices, default=Project.Status.PLANNING)
    priority = serializers.ChoiceField(choices=Project.Priority.choices, default=Project.Priority.MEDIUM)
    start_date = serializers.DateField(required=False, allow_null=True)
    due_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        start = attrs.get('start_date')
        due = attrs.get('due_date')
        if start and due and due < start:
            raise serializers.ValidationError({'due_date': 'Project due date cannot be earlier than start date.'})
        return attrs

    def create(self, validated_data):
        workspace = self.context['workspace']
        request_user = self.context['request'].user
        name = validated_data['name']

        # Generate unique slug within workspace
        base_slug = slugify(name) or 'project'
        slug = base_slug
        while Project.objects.filter(workspace=workspace, slug=slug).exists():
            slug = f"{base_slug}-{uuid.uuid4().hex[:4]}"

        # Generate unique key within workspace
        key_input = validated_data.get('key', '').strip().upper()
        if key_input:
            key = key_input
            if Project.objects.filter(workspace=workspace, key=key).exists():
                raise serializers.ValidationError({'key': 'A project with this key already exists in this workspace.'})
        else:
            cleaned = ''.join(c for c in name if c.isalnum()).upper()
            base_key = cleaned[:4] if len(cleaned) >= 2 else 'PRJ'
            key = base_key
            counter = 1
            while Project.objects.filter(workspace=workspace, key=key).exists():
                key = f"{base_key[:3]}{counter}"
                counter += 1

        with transaction.atomic():
            project = Project.objects.create(
                workspace=workspace,
                name=name,
                slug=slug,
                key=key,
                description=validated_data.get('description', ''),
                owner=request_user,
                status=validated_data.get('status', Project.Status.PLANNING),
                priority=validated_data.get('priority', Project.Priority.MEDIUM),
                start_date=validated_data.get('start_date'),
                due_date=validated_data.get('due_date'),
            )

            # Assign creator as Project Manager
            ProjectMember.objects.create(
                project=project,
                user=request_user,
                role=ProjectMember.Role.PROJECT_MANAGER
            )

            # Create default Kanban Board
            Board.objects.create(
                workspace=workspace,
                project=project,
                name=f'{name} Board',
                is_default=True
            )

        return project


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer to update project settings and metadata.
    """
    class Meta:
        model = Project
        fields = [
            'name',
            'description',
            'status',
            'priority',
            'start_date',
            'due_date',
            'owner',
        ]

    def validate(self, attrs):
        start = attrs.get('start_date', self.instance.start_date)
        due = attrs.get('due_date', self.instance.due_date)
        if start and due and due < start:
            raise serializers.ValidationError({'due_date': 'Due date cannot be earlier than start date.'})
        return attrs

