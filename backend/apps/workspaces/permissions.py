from rest_framework import permissions
from .models import Workspace, WorkspaceMembership


def get_active_workspace_membership(workspace, user):
    """
    Returns the active WorkspaceMembership for a user in a given workspace, or None.
    If the user is the workspace owner, returns a virtual or existing OWNER membership.
    """
    if not user or not user.is_authenticated or not workspace:
        return None

    membership = WorkspaceMembership.objects.filter(
        workspace=workspace,
        user=user,
        status=WorkspaceMembership.Status.ACTIVE
    ).first()

    # Fallback for workspace owner if not explicitly in membership table
    if not membership and workspace.owner_id == user.id:
        return WorkspaceMembership(
            workspace=workspace,
            user=user,
            role=WorkspaceMembership.Role.OWNER,
            status=WorkspaceMembership.Status.ACTIVE
        )

    return membership


class IsWorkspaceMember(permissions.BasePermission):
    """
    Allows access only to active members of the target workspace.
    """
    message = 'You do not have active membership access to this workspace.'

    def has_permission(self, request, view):
        workspace = getattr(view, 'workspace', None)
        if not workspace:
            workspace_id = view.kwargs.get('workspace_id') or view.kwargs.get('pk')
            if workspace_id:
                try:
                    workspace = Workspace.objects.get(id=workspace_id, is_active=True)
                    view.workspace = workspace
                except (Workspace.DoesNotExist, ValueError):
                    return False

        if not workspace:
            return True  # Object-level check will handle or list view handles its own query

        membership = get_active_workspace_membership(workspace, request.user)
        return membership is not None

    def has_object_permission(self, request, view, obj):
        workspace = getattr(obj, 'workspace', None) or (obj if isinstance(obj, Workspace) else None)
        if not workspace:
            return False
        membership = get_active_workspace_membership(workspace, request.user)
        return membership is not None


class IsWorkspaceAdmin(permissions.BasePermission):
    """
    Allows access only to OWNER or ADMIN active members of the workspace.
    """
    message = 'Administrative permissions (Owner or Admin) are required for this action.'

    def has_permission(self, request, view):
        workspace = getattr(view, 'workspace', None)
        if not workspace:
            workspace_id = view.kwargs.get('workspace_id') or view.kwargs.get('pk')
            if workspace_id:
                try:
                    workspace = Workspace.objects.get(id=workspace_id, is_active=True)
                    view.workspace = workspace
                except (Workspace.DoesNotExist, ValueError):
                    return False

        if not workspace:
            return True

        membership = get_active_workspace_membership(workspace, request.user)
        if not membership:
            return False

        return membership.role in [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN
        ]

    def has_object_permission(self, request, view, obj):
        workspace = getattr(obj, 'workspace', None) or (obj if isinstance(obj, Workspace) else None)
        if not workspace:
            return False
        membership = get_active_workspace_membership(workspace, request.user)
        if not membership:
            return False
        return membership.role in [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN
        ]


class IsWorkspaceOwner(permissions.BasePermission):
    """
    Allows access strictly to the OWNER of the workspace.
    """
    message = 'Only the workspace Owner has permission to perform this action.'

    def has_permission(self, request, view):
        workspace = getattr(view, 'workspace', None)
        if not workspace:
            workspace_id = view.kwargs.get('workspace_id') or view.kwargs.get('pk')
            if workspace_id:
                try:
                    workspace = Workspace.objects.get(id=workspace_id, is_active=True)
                    view.workspace = workspace
                except (Workspace.DoesNotExist, ValueError):
                    return False

        if not workspace:
            return True

        membership = get_active_workspace_membership(workspace, request.user)
        if not membership:
            return False
        return membership.role == WorkspaceMembership.Role.OWNER

    def has_object_permission(self, request, view, obj):
        workspace = getattr(obj, 'workspace', None) or (obj if isinstance(obj, Workspace) else None)
        if not workspace:
            return False
        membership = get_active_workspace_membership(workspace, request.user)
        if not membership:
            return False
        return membership.role == WorkspaceMembership.Role.OWNER


class IsProjectManagerOrAbove(permissions.BasePermission):
    """
    Allows access to OWNER, ADMIN, or PROJECT_MANAGER members.
    """
    message = 'Project Manager or higher permissions are required for this action.'

    def has_permission(self, request, view):
        workspace = getattr(view, 'workspace', None)
        if not workspace:
            workspace_id = view.kwargs.get('workspace_id') or view.kwargs.get('pk')
            if workspace_id:
                try:
                    workspace = Workspace.objects.get(id=workspace_id, is_active=True)
                    view.workspace = workspace
                except (Workspace.DoesNotExist, ValueError):
                    return False

        if not workspace:
            return True

        membership = get_active_workspace_membership(workspace, request.user)
        if not membership:
            return False
        return membership.role in [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.PROJECT_MANAGER
        ]


class IsWorkspaceMemberOrReadOnly(permissions.BasePermission):
    """
    Grants read-only access (GET/HEAD/OPTIONS) to all active members (including VIEWER).
    Grants write access only to active members with role != VIEWER.
    """
    message = 'Viewers have read-only access to this workspace.'

    def has_permission(self, request, view):
        workspace = getattr(view, 'workspace', None)
        if not workspace:
            workspace_id = view.kwargs.get('workspace_id') or view.kwargs.get('pk')
            if workspace_id:
                try:
                    workspace = Workspace.objects.get(id=workspace_id, is_active=True)
                    view.workspace = workspace
                except (Workspace.DoesNotExist, ValueError):
                    return False

        if not workspace:
            return True

        membership = get_active_workspace_membership(workspace, request.user)
        if not membership:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return membership.role != WorkspaceMembership.Role.VIEWER

