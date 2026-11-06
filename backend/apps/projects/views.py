from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.workspaces.permissions import get_active_workspace_membership
from .models import Project, ProjectMember
from .serializers import (
    ProjectSerializer,
    ProjectCreateSerializer,
    ProjectUpdateSerializer,
    ProjectMemberSerializer,
    AddProjectMemberSerializer,
)


def can_manage_project(project, user):
    """
    Checks if a user has managerial authority over a project.
    Granted to: Workspace Owner, Workspace Admin, Project Owner, or Project Manager.
    """
    ws_membership = get_active_workspace_membership(project.workspace, user)
    if not ws_membership:
        return False
    if ws_membership.role in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN]:
        return True
    if project.owner_id == user.id:
        return True
    # Check ProjectMember role
    pm = ProjectMember.objects.filter(
        project=project,
        user=user,
        role=ProjectMember.Role.PROJECT_MANAGER
    ).exists()
    return pm


class WorkspaceProjectListView(APIView):
    """
    GET /api/workspaces/{workspace_id}/projects/
    POST /api/workspaces/{workspace_id}/projects/
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

    def get(self, request, workspace_id=None):
        ws_id = workspace_id or request.query_params.get('workspace_id')
        if not ws_id:
            return Response({'error': 'Workspace ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        workspace, err = self.get_workspace(ws_id, request.user)
        if err:
            return err

        queryset = Project.objects.filter(workspace=workspace).select_related('owner', 'workspace')

        # Filters
        status_param = request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        priority_param = request.query_params.get('priority')
        if priority_param:
            queryset = queryset.filter(priority=priority_param)

        search_param = request.query_params.get('search')
        if search_param:
            queryset = queryset.filter(
                Q(name__icontains=search_param) |
                Q(key__icontains=search_param) |
                Q(description__icontains=search_param)
            )

        # Sorting
        sort_by = request.query_params.get('ordering', '-created_at')
        if sort_by in ['created_at', '-created_at', 'due_date', '-due_date', 'name', '-name', 'priority', '-priority']:
            queryset = queryset.order_by(sort_by)

        serializer = ProjectSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, workspace_id=None):
        ws_id = workspace_id or request.query_params.get('workspace_id') or request.data.get('workspace')
        if not ws_id:
            return Response({'error': 'Workspace ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        workspace, err = self.get_workspace(ws_id, request.user)
        if err:
            return err

        # Only OWNER, ADMIN, or PROJECT_MANAGER in workspace can create projects
        ws_membership = get_active_workspace_membership(workspace, request.user)
        if ws_membership.role not in [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.PROJECT_MANAGER,
        ]:
            return Response(
                {'error': 'You do not have permission to create projects in this workspace.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Plan limit check
        try:
            from apps.billing.usage_service import check_workspace_limits
            check_workspace_limits(workspace, 'create_project', count_to_add=1)
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ProjectCreateSerializer(
            data=request.data,
            context={'workspace': workspace, 'request': request}
        )
        if serializer.is_valid():
            project = serializer.save()
            try:
                from apps.webhooks.services import trigger_workspace_webhooks
                trigger_workspace_webhooks(
                    workspace=workspace,
                    event_type='project.created',
                    payload={
                        'event': 'project.created',
                        'project_id': str(project.id),
                        'project_name': project.name,
                        'project_key': project.key,
                        'owner': project.owner.email if project.owner else None,
                        'created_by': request.user.email,
                    }
                )
            except Exception:
                pass
            return Response(
                ProjectSerializer(project, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProjectDetailView(APIView):
    """
    GET /api/projects/{project_id}/
    PATCH /api/projects/{project_id}/
    DELETE /api/projects/{project_id}/
    """
    permission_classes = [IsAuthenticated]

    def get_project_and_membership(self, project_id, user):
        project = get_object_or_404(Project, id=project_id, workspace__is_active=True)
        membership = get_active_workspace_membership(project.workspace, user)
        if not membership:
            return None, None, Response(
                {'error': 'You do not have access to this project.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return project, membership, None

    def get(self, request, project_id):
        project, _, err = self.get_project_and_membership(project_id, request.user)
        if err:
            return err

        serializer = ProjectSerializer(project, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, project_id):
        project, _, err = self.get_project_and_membership(project_id, request.user)
        if err:
            return err

        if not can_manage_project(project, request.user):
            return Response(
                {'error': 'You do not have permission to update this project.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ProjectUpdateSerializer(project, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(
                ProjectSerializer(updated, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, project_id):
        project, ws_membership, err = self.get_project_and_membership(project_id, request.user)
        if err:
            return err

        # Only Workspace Owner, Workspace Admin, or Project Owner can delete
        is_owner_or_admin = (
            ws_membership.role in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN] or
            project.owner_id == request.user.id
        )
        if not is_owner_or_admin:
            return Response(
                {'error': 'Only workspace administrators or the project owner can delete this project.'},
                status=status.HTTP_403_FORBIDDEN
            )

        project_name = project.name
        project.delete()
        return Response(
            {'status': 'success', 'message': f'Project "{project_name}" deleted successfully.'},
            status=status.HTTP_200_OK
        )


class ProjectMemberListView(APIView):
    """
    GET /api/projects/{project_id}/members/
    POST /api/projects/{project_id}/members/
    """
    permission_classes = [IsAuthenticated]

    def get_project(self, project_id, user):
        project = get_object_or_404(Project, id=project_id, workspace__is_active=True)
        membership = get_active_workspace_membership(project.workspace, user)
        if not membership:
            return None, Response(
                {'error': 'You do not have access to this project.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return project, None

    def get(self, request, project_id):
        project, err = self.get_project(project_id, request.user)
        if err:
            return err

        members = ProjectMember.objects.filter(project=project).select_related('user').order_by('role', '-created_at')
        serializer = ProjectMemberSerializer(members, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, project_id):
        project, err = self.get_project(project_id, request.user)
        if err:
            return err

        if not can_manage_project(project, request.user):
            return Response(
                {'error': 'You do not have permission to assign members to this project.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AddProjectMemberSerializer(
            data=request.data,
            context={'project': project, 'request': request}
        )
        if serializer.is_valid():
            member = serializer.save()
            return Response(
                ProjectMemberSerializer(member).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProjectMemberDetailView(APIView):
    """
    DELETE /api/projects/{project_id}/members/{membership_id}/
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, project_id, membership_id):
        project = get_object_or_404(Project, id=project_id, workspace__is_active=True)
        if not can_manage_project(project, request.user):
            return Response(
                {'error': 'You do not have permission to remove members from this project.'},
                status=status.HTTP_403_FORBIDDEN
            )

        membership = get_object_or_404(ProjectMember, id=membership_id, project=project)
        membership.delete()
        return Response(
            {'status': 'success', 'message': 'Member removed from project.'},
            status=status.HTTP_200_OK
        )
