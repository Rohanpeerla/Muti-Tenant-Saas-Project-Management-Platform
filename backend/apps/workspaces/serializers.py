import uuid
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers
from apps.accounts.serializers import UserSerializer
from .models import Workspace, WorkspaceMembership, AuditLog

User = get_user_model()


class WorkspaceSerializer(serializers.ModelSerializer):
    """
    Representation of a Workspace including the authenticated user's active role
    and active member count.
    """
    current_user_role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Workspace
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'owner',
            'logo',
            'is_active',
            'current_user_role',
            'member_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'owner', 'created_at', 'updated_at']

    def get_current_user_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        # Check explicit membership
        membership = obj.memberships.filter(
            user=request.user,
            status=WorkspaceMembership.Status.ACTIVE
        ).first()

        if membership:
            return membership.role
        elif obj.owner_id == request.user.id:
            return WorkspaceMembership.Role.OWNER
        return None

    def get_member_count(self, obj):
        return obj.memberships.filter(status=WorkspaceMembership.Status.ACTIVE).count()


class WorkspaceCreateSerializer(serializers.Serializer):
    """
    Serializer to create a new Workspace and automatically assign the creator
    as OWNER with an active WorkspaceMembership in a database transaction.
    """
    name = serializers.CharField(max_length=255, required=True, trim_whitespace=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Workspace name cannot be empty.')
        return cleaned

    def create(self, validated_data):
        request_user = self.context['request'].user
        name = validated_data['name']
        description = validated_data.get('description', '')

        base_slug = slugify(name)
        if not base_slug:
            base_slug = 'workspace'

        slug = base_slug
        while Workspace.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        with transaction.atomic():
            workspace = Workspace.objects.create(
                name=name,
                slug=slug,
                description=description,
                owner=request_user,
                is_active=True
            )
            WorkspaceMembership.objects.create(
                workspace=workspace,
                user=request_user,
                role=WorkspaceMembership.Role.OWNER,
                status=WorkspaceMembership.Status.ACTIVE,
                joined_at=timezone.now()
            )

        return workspace


class WorkspaceUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer to update workspace settings (Owner and Admins only).
    """
    class Meta:
        model = Workspace
        fields = ['name', 'description', 'logo']

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Workspace name cannot be empty.')
        return cleaned


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    """
    Detailed representation of a user's membership in a workspace.
    """
    user = UserSerializer(read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = [
            'id',
            'workspace',
            'user',
            'role',
            'status',
            'joined_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'joined_at', 'created_at', 'updated_at']


class WorkspaceInvitationSerializer(serializers.ModelSerializer):
    """
    Representation of a pending workspace invitation for a user,
    including full workspace and inviter metadata.
    """
    workspace = WorkspaceSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = [
            'id',
            'workspace',
            'user',
            'role',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'user', 'role', 'status', 'created_at', 'updated_at']



class AddWorkspaceMemberSerializer(serializers.Serializer):
    """
    Serializer to invite a member to a workspace by email.
    Defaults to INVITED status.
    """
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(
        choices=WorkspaceMembership.Role.choices,
        default=WorkspaceMembership.Role.MEMBER
    )
    status = serializers.ChoiceField(
        choices=WorkspaceMembership.Status.choices,
        default=WorkspaceMembership.Status.INVITED
    )

    def validate_email(self, value):
        normalized = value.strip().lower()
        try:
            user = User.objects.get(email__iexact=normalized)
        except User.DoesNotExist:
            raise serializers.ValidationError('No registered user found with this email address.')
        return normalized

    def validate(self, attrs):
        workspace = self.context['workspace']
        request_user = self.context['request'].user
        email = attrs['email']
        role = attrs.get('role', WorkspaceMembership.Role.MEMBER)

        target_user = User.objects.get(email__iexact=email)

        # Check existing membership
        if WorkspaceMembership.objects.filter(workspace=workspace, user=target_user).exists():
            raise serializers.ValidationError({'email': 'This user is already a member of this workspace.'})

        # Check caller's role for privilege escalation
        caller_membership = WorkspaceMembership.objects.filter(
            workspace=workspace,
            user=request_user,
            status=WorkspaceMembership.Status.ACTIVE
        ).first()

        caller_is_owner = (workspace.owner_id == request_user.id) or (
            caller_membership and caller_membership.role == WorkspaceMembership.Role.OWNER
        )

        # Only OWNER can assign OWNER role
        if role == WorkspaceMembership.Role.OWNER and not caller_is_owner:
            raise serializers.ValidationError({'role': 'Only the workspace Owner can grant the OWNER role.'})

        attrs['target_user'] = target_user
        return attrs

    def create(self, validated_data):
        workspace = self.context['workspace']
        target_user = validated_data['target_user']
        role = validated_data.get('role', WorkspaceMembership.Role.MEMBER)
        status_val = validated_data.get('status', WorkspaceMembership.Status.INVITED)

        membership = WorkspaceMembership.objects.create(
            workspace=workspace,
            user=target_user,
            role=role,
            status=status_val,
            joined_at=timezone.now() if status_val == WorkspaceMembership.Status.ACTIVE else None
        )
        return membership


class UpdateWorkspaceMemberSerializer(serializers.ModelSerializer):
    """
    Serializer for updating an existing member's role or status.
    """
    class Meta:
        model = WorkspaceMembership
        fields = ['role', 'status']

    def validate(self, attrs):
        membership = self.instance
        workspace = membership.workspace
        request_user = self.context['request'].user

        new_role = attrs.get('role', membership.role)
        new_status = attrs.get('status', membership.status)

        caller_membership = WorkspaceMembership.objects.filter(
            workspace=workspace,
            user=request_user,
            status=WorkspaceMembership.Status.ACTIVE
        ).first()

        caller_is_owner = (workspace.owner_id == request_user.id) or (
            caller_membership and caller_membership.role == WorkspaceMembership.Role.OWNER
        )

        # 1. Prevent users from modifying their own role or status (self-escalation / self-demotion lockout)
        if membership.user_id == request_user.id and new_role != membership.role:
            raise serializers.ValidationError({'role': 'You cannot modify your own membership role.'})

        # 2. Non-owner ADMIN cannot touch an OWNER
        if membership.role == WorkspaceMembership.Role.OWNER and not caller_is_owner:
            raise serializers.ValidationError({'non_field_errors': 'Only the workspace Owner can modify an Owner membership.'})

        # 3. Non-owner ADMIN cannot promote someone to OWNER
        if new_role == WorkspaceMembership.Role.OWNER and not caller_is_owner:
            raise serializers.ValidationError({'role': 'Only the workspace Owner can grant the OWNER role.'})

        # 4. Prevent demoting/deactivating the last OWNER
        if membership.role == WorkspaceMembership.Role.OWNER:
            if new_role != WorkspaceMembership.Role.OWNER or new_status != WorkspaceMembership.Status.ACTIVE:
                active_owner_count = WorkspaceMembership.objects.filter(
                    workspace=workspace,
                    role=WorkspaceMembership.Role.OWNER,
                    status=WorkspaceMembership.Status.ACTIVE
                ).exclude(id=membership.id).count()

                if active_owner_count == 0:
                    raise serializers.ValidationError({
                        'non_field_errors': 'Cannot demote or deactivate the last active Owner of this workspace.'
                    })

        return attrs

    def update(self, instance, validated_data):
        new_status = validated_data.get('status', instance.status)
        if instance.status != WorkspaceMembership.Status.ACTIVE and new_status == WorkspaceMembership.Status.ACTIVE:
            if not instance.joined_at:
                instance.joined_at = timezone.now()

        return super().update(instance, validated_data)


class AuditLogSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'workspace',
            'actor',
            'action',
            'entity_type',
            'entity_id',
            'description',
            'metadata',
            'created_at',
        ]
        read_only_fields = fields



