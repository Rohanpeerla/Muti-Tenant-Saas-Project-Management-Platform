from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Workspace, WorkspaceMembership, AuditLog, log_audit_event
from .permissions import (
    IsWorkspaceMember,
    IsWorkspaceAdmin,
    get_active_workspace_membership,
)
from .serializers import (
    WorkspaceSerializer,
    WorkspaceCreateSerializer,
    WorkspaceUpdateSerializer,
    WorkspaceMembershipSerializer,
    WorkspaceInvitationSerializer,
    AddWorkspaceMemberSerializer,
    UpdateWorkspaceMemberSerializer,
    AuditLogSerializer,
)


class WorkspaceListView(APIView):
    """
    GET /api/workspaces/
    Lists all workspaces where the authenticated user has an ACTIVE membership or is owner.

    POST /api/workspaces/
    Creates a new workspace, automatically setting the caller as OWNER with an active membership.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        active_ws_ids = WorkspaceMembership.objects.filter(
            user=request.user,
            status=WorkspaceMembership.Status.ACTIVE
        ).values_list('workspace_id', flat=True)

        workspaces = Workspace.objects.filter(
            id__in=active_ws_ids,
            is_active=True
        ).distinct()

        serializer = WorkspaceSerializer(
            workspaces,
            many=True,
            context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = WorkspaceCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            workspace = serializer.save()
            log_audit_event(
                workspace=workspace,
                actor=request.user,
                action='WORKSPACE_CREATED',
                entity_type='Workspace',
                entity_id=workspace.id,
                description=f'Workspace "{workspace.name}" was created by {request.user.email}.'
            )
            response_serializer = WorkspaceSerializer(
                workspace,
                context={'request': request}
            )
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkspaceDetailView(APIView):
    """
    GET /api/workspaces/{workspace_id}/
    Returns workspace details for active members only.

    PATCH /api/workspaces/{workspace_id}/
    Updates workspace settings. Accessible by OWNER and ADMIN only.

    DELETE /api/workspaces/{workspace_id}/
    Deletes the workspace. Accessible by OWNER only.
    """
    permission_classes = [IsAuthenticated]

    def get_workspace_and_membership(self, workspace_id, user):
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        membership = get_active_workspace_membership(workspace, user)
        if not membership:
            return None, None, Response(
                {'error': 'You do not have access to this workspace.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return workspace, membership, None

    def get(self, request, workspace_id):
        workspace, membership, error_response = self.get_workspace_and_membership(workspace_id, request.user)
        if error_response:
            return error_response

        serializer = WorkspaceSerializer(workspace, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, workspace_id):
        workspace, membership, error_response = self.get_workspace_and_membership(workspace_id, request.user)
        if error_response:
            return error_response

        if membership.role not in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN]:
            return Response(
                {'error': 'Administrative permissions (Owner or Admin) are required to update workspace settings.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = WorkspaceUpdateSerializer(workspace, data=request.data, partial=True)
        if serializer.is_valid():
            updated_workspace = serializer.save()
            log_audit_event(
                workspace=updated_workspace,
                actor=request.user,
                action='WORKSPACE_UPDATED',
                entity_type='Workspace',
                entity_id=updated_workspace.id,
                description=f'Workspace settings updated.'
            )
            return Response(
                WorkspaceSerializer(updated_workspace, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, workspace_id):
        workspace, membership, error_response = self.get_workspace_and_membership(workspace_id, request.user)
        if error_response:
            return error_response

        is_owner = (workspace.owner_id == request.user.id) or (membership.role == WorkspaceMembership.Role.OWNER)
        if not is_owner:
            return Response(
                {'error': 'Only the workspace Owner has permission to delete this workspace.'},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            workspace.delete()

        return Response(
            {'status': 'success', 'message': 'Workspace deleted successfully.'},
            status=status.HTTP_200_OK
        )


class WorkspaceMemberListView(APIView):
    """
    GET /api/workspaces/{workspace_id}/members/
    POST /api/workspaces/{workspace_id}/members/
    """
    permission_classes = [IsAuthenticated]

    def get_workspace(self, workspace_id, user):
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        membership = get_active_workspace_membership(workspace, user)
        if not membership:
            return None, Response(
                {'error': 'You do not have access to this workspace.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return workspace, None

    def get(self, request, workspace_id):
        workspace, error_response = self.get_workspace(workspace_id, request.user)
        if error_response:
            return error_response

        memberships = WorkspaceMembership.objects.filter(
            workspace=workspace
        ).select_related('user').order_by('role', '-created_at')

        serializer = WorkspaceMembershipSerializer(memberships, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, workspace_id):
        workspace, error_response = self.get_workspace(workspace_id, request.user)
        if error_response:
            return error_response

        caller_membership = get_active_workspace_membership(workspace, request.user)
        if caller_membership.role not in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN]:
            return Response(
                {'error': 'Administrative permissions (Owner or Admin) are required to add members.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Enforce subscription plan member limit
        try:
            from apps.billing.usage_service import check_workspace_limits
            check_workspace_limits(workspace, 'add_member', count_to_add=1)
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AddWorkspaceMemberSerializer(
            data=request.data,
            context={'workspace': workspace, 'request': request}
        )
        if serializer.is_valid():
            membership = serializer.save()
            log_audit_event(
                workspace=workspace,
                actor=request.user,
                action='MEMBER_INVITED' if membership.status == WorkspaceMembership.Status.INVITED else 'MEMBER_ADDED',
                entity_type='WorkspaceMembership',
                entity_id=membership.id,
                description=f'Member {membership.user.email} added/invited with role {membership.role}.'
            )

            # Trigger notification & invitation email
            if membership.user_id != request.user.id:
                try:
                    from apps.notifications.services import create_notification
                    from apps.notifications.models import Notification
                    create_notification(
                        recipient=membership.user,
                        workspace=workspace,
                        notification_type=Notification.NotificationType.WORKSPACE_INVITATION,
                        title=f'Invitation to join {workspace.name}',
                        message=f'{request.user.get_full_name() or request.user.username} invited you to join workspace "{workspace.name}" as {membership.role}.',
                        related_entity_type='workspace',
                        related_entity_id=str(workspace.id),
                        actor=request.user,
                        email_template='workspace_invitation.html',
                        email_context={
                            'inviter_name': request.user.get_full_name() or request.user.username,
                            'role': membership.role,
                            'action_url': '/workspaces'
                        }
                    )
                except Exception:
                    pass

            # Trigger workspace webhook
            try:
                from apps.webhooks.services import trigger_workspace_webhooks
                trigger_workspace_webhooks(
                    workspace=workspace,
                    event_type='member.invited',
                    payload={
                        'event': 'member.invited',
                        'workspace_id': str(workspace.id),
                        'workspace_name': workspace.name,
                        'user_email': membership.user.email,
                        'role': membership.role,
                        'invited_by': request.user.email
                    }
                )
            except Exception:
                pass

            return Response(
                WorkspaceMembershipSerializer(membership).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkspaceMemberDetailView(APIView):
    """
    PATCH /api/workspaces/{workspace_id}/members/{membership_id}/
    DELETE /api/workspaces/{workspace_id}/members/{membership_id}/
    """
    permission_classes = [IsAuthenticated]

    def get_workspace_and_membership(self, workspace_id, membership_id, user):
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)

        caller_membership = get_active_workspace_membership(workspace, user)
        if not caller_membership or caller_membership.role not in [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN
        ]:
            return None, None, Response(
                {'error': 'Administrative permissions (Owner or Admin) are required.'},
                status=status.HTTP_403_FORBIDDEN
            )

        membership = get_object_or_404(
            WorkspaceMembership,
            id=membership_id,
            workspace=workspace
        )

        return workspace, membership, None

    def patch(self, request, workspace_id, membership_id):
        workspace, membership, error_response = self.get_workspace_and_membership(
            workspace_id,
            membership_id,
            request.user
        )
        if error_response:
            return error_response

        serializer = UpdateWorkspaceMemberSerializer(
            membership,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            updated = serializer.save()
            log_audit_event(
                workspace=workspace,
                actor=request.user,
                action='MEMBER_UPDATED',
                entity_type='WorkspaceMembership',
                entity_id=updated.id,
                description=f'Member {updated.user.email} updated to role={updated.role}, status={updated.status}.'
            )
            return Response(
                WorkspaceMembershipSerializer(updated).data,
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, workspace_id, membership_id):
        workspace, membership, error_response = self.get_workspace_and_membership(
            workspace_id,
            membership_id,
            request.user
        )
        if error_response:
            return error_response

        caller_membership = get_active_workspace_membership(workspace, request.user)
        caller_is_owner = (workspace.owner_id == request.user.id) or (
            caller_membership and caller_membership.role == WorkspaceMembership.Role.OWNER
        )

        # 1. Non-owner ADMIN cannot remove an OWNER
        if membership.role == WorkspaceMembership.Role.OWNER and not caller_is_owner:
            return Response(
                {'error': 'Only the workspace Owner can remove another Owner.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Cannot remove the last OWNER
        if membership.role == WorkspaceMembership.Role.OWNER:
            active_owners = WorkspaceMembership.objects.filter(
                workspace=workspace,
                role=WorkspaceMembership.Role.OWNER,
                status=WorkspaceMembership.Status.ACTIVE
            ).exclude(id=membership.id).count()

            if active_owners == 0:
                return Response(
                    {'error': 'Cannot remove the last active Owner of this workspace.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 3. Cannot remove workspace owner entity
        if workspace.owner_id == membership.user_id:
            return Response(
                {'error': 'The primary organization owner cannot be removed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        removed_user_email = membership.user.email
        membership_id_str = str(membership.id)
        membership.delete()
        log_audit_event(
            workspace=workspace,
            actor=request.user,
            action='MEMBER_REMOVED',
            entity_type='WorkspaceMembership',
            entity_id=membership_id_str,
            description=f'Member {removed_user_email} was removed from the workspace.'
        )
        return Response(
            {'status': 'success', 'message': 'Member removed successfully.'},
            status=status.HTTP_200_OK
        )


class WorkspaceInvitationListView(APIView):
    """
    GET /api/workspaces/invitations/
    Returns all pending invitations (status=INVITED) for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        invitations = WorkspaceMembership.objects.filter(
            user=request.user,
            status=WorkspaceMembership.Status.INVITED,
            workspace__is_active=True
        ).select_related('workspace', 'workspace__owner', 'user').order_by('-created_at')

        serializer = WorkspaceInvitationSerializer(invitations, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkspaceInvitationAcceptView(APIView):
    """
    POST /api/workspaces/invitations/<uuid:membership_id>/accept/
    Accepts a pending invitation, transitioning status to ACTIVE and recording joined_at.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, membership_id):
        membership = get_object_or_404(
            WorkspaceMembership,
            id=membership_id,
            user=request.user,
            status=WorkspaceMembership.Status.INVITED,
            workspace__is_active=True
        )

        with transaction.atomic():
            membership.status = WorkspaceMembership.Status.ACTIVE
            membership.joined_at = timezone.now()
            membership.save(update_fields=['status', 'joined_at', 'updated_at'])

        return Response({
            'status': 'success',
            'message': f'You have joined {membership.workspace.name}.',
            'membership': WorkspaceMembershipSerializer(membership).data,
            'workspace': WorkspaceSerializer(membership.workspace, context={'request': request}).data,
        }, status=status.HTTP_200_OK)


class WorkspaceInvitationDeclineView(APIView):
    """
    POST /api/workspaces/invitations/<uuid:membership_id>/decline/
    Declines a pending invitation by deleting the invited membership.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, membership_id):
        membership = get_object_or_404(
            WorkspaceMembership,
            id=membership_id,
            user=request.user,
            status=WorkspaceMembership.Status.INVITED,
            workspace__is_active=True
        )

        workspace_name = membership.workspace.name
        log_audit_event(
            workspace=membership.workspace,
            actor=request.user,
            action='INVITATION_DECLINED',
            entity_type='WorkspaceMembership',
            entity_id=membership.id,
            description=f'{request.user.email} declined invitation to {workspace_name}.'
        )
        membership.delete()

        return Response({
            'status': 'success',
            'message': f'Declined invitation to {workspace_name}.'
        }, status=status.HTTP_200_OK)


class WorkspaceAuditLogListView(APIView):
    """
    GET /api/workspaces/<uuid:workspace_id>/audit-logs/
    Returns paginated audit logs for a workspace.
    Restricted to OWNER and ADMIN only.
    MEMBER, VIEWER, and non-members receive HTTP 403 Forbidden.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, workspace_id):
        workspace = get_object_or_404(Workspace, id=workspace_id, is_active=True)
        membership = get_active_workspace_membership(workspace, request.user)
        if not membership or membership.role not in [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN,
        ]:
            return Response(
                {'error': 'Administrative permissions (Owner or Admin) are required to view audit logs.'},
                status=status.HTTP_403_FORBIDDEN
            )

        logs = AuditLog.objects.filter(workspace=workspace).select_related('actor').order_by('-created_at')

        # Filters
        actor_id = request.query_params.get('actor')
        action = request.query_params.get('action')
        entity_type = request.query_params.get('entity_type')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if actor_id:
            logs = logs.filter(actor_id=actor_id)
        if action:
            logs = logs.filter(action__iexact=action)
        if entity_type:
            logs = logs.filter(entity_type__iexact=entity_type)
        if start_date:
            logs = logs.filter(created_at__date__gte=start_date)
        if end_date:
            logs = logs.filter(created_at__date__lte=end_date)

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 30
        page = paginator.paginate_queryset(logs, request)
        if page is not None:
            serializer = AuditLogSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)



