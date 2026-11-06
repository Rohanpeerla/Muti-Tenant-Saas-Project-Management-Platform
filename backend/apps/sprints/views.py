from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.issues.models import Issue
from apps.projects.models import Project
from apps.projects.views import can_manage_project
from apps.workspaces.permissions import get_active_workspace_membership
from .models import Sprint
from .serializers import (
    SprintSerializer,
    SprintCreateSerializer,
    SprintUpdateSerializer,
)


class ProjectSprintListView(APIView):
    """
    GET /api/projects/{project_id}/sprints/
    POST /api/projects/{project_id}/sprints/
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

        sprints = Sprint.objects.filter(project=project).order_by('-created_at')
        serializer = SprintSerializer(sprints, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, project_id):
        project, err = self.get_project(project_id, request.user)
        if err:
            return err

        if not can_manage_project(project, request.user):
            return Response(
                {'error': 'You do not have permission to create sprints for this project.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = SprintCreateSerializer(
            data=request.data,
            context={'project': project, 'request': request}
        )
        if serializer.is_valid():
            sprint = serializer.save()
            return Response(SprintSerializer(sprint).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SprintDetailView(APIView):
    """
    GET /api/sprints/{sprint_id}/
    PATCH /api/sprints/{sprint_id}/
    DELETE /api/sprints/{sprint_id}/
    """
    permission_classes = [IsAuthenticated]

    def get_sprint(self, sprint_id, user):
        sprint = get_object_or_404(Sprint, id=sprint_id, workspace__is_active=True)
        membership = get_active_workspace_membership(sprint.workspace, user)
        if not membership:
            return None, Response(
                {'error': 'You do not have access to this sprint.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return sprint, None

    def get(self, request, sprint_id):
        sprint, err = self.get_sprint(sprint_id, request.user)
        if err:
            return err

        return Response(SprintSerializer(sprint).data, status=status.HTTP_200_OK)

    def patch(self, request, sprint_id):
        sprint, err = self.get_sprint(sprint_id, request.user)
        if err:
            return err

        if not can_manage_project(sprint.project, request.user):
            return Response(
                {'error': 'You do not have permission to update this sprint.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = SprintUpdateSerializer(sprint, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(SprintSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, sprint_id):
        sprint, err = self.get_sprint(sprint_id, request.user)
        if err:
            return err

        if not can_manage_project(sprint.project, request.user):
            return Response(
                {'error': 'You do not have permission to delete this sprint.'},
                status=status.HTTP_403_FORBIDDEN
            )

        name = sprint.name
        # Unassign issues safely
        Issue.objects.filter(sprint=sprint).update(sprint=None)
        sprint.delete()
        return Response(
            {'status': 'success', 'message': f'Sprint "{name}" deleted.'},
            status=status.HTTP_200_OK
        )


class SprintStartView(APIView):
    """
    POST /api/sprints/{sprint_id}/start/
    Activates the sprint. Enforces that only one sprint is active per project.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, id=sprint_id, workspace__is_active=True)
        if not can_manage_project(sprint.project, request.user):
            return Response(
                {'error': 'You do not have permission to start sprints.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Enforce single active sprint per project rule
        active_exists = Sprint.objects.filter(
            project=sprint.project,
            status=Sprint.Status.ACTIVE
        ).exclude(pk=sprint.pk).exists()

        if active_exists:
            return Response(
                {'error': 'Another sprint is already active in this project. Please complete or pause it first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sprint.status = Sprint.Status.ACTIVE
        sprint.save(update_fields=['status', 'updated_at'])

        try:
            from apps.webhooks.services import trigger_workspace_webhooks
            trigger_workspace_webhooks(
                workspace=sprint.workspace,
                event_type='sprint.started',
                payload={
                    'event': 'sprint.started',
                    'sprint_id': str(sprint.id),
                    'sprint_name': sprint.name,
                    'project_id': str(sprint.project_id),
                    'project_name': sprint.project.name,
                    'started_by': request.user.email
                }
            )
        except Exception:
            pass

        return Response(
            {'status': 'success', 'message': f'Sprint "{sprint.name}" is now active.', 'sprint': SprintSerializer(sprint).data},
            status=status.HTTP_200_OK
        )


class SprintCompleteView(APIView):
    """
    POST /api/sprints/{sprint_id}/complete/
    Marks the sprint as completed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, id=sprint_id, workspace__is_active=True)
        if not can_manage_project(sprint.project, request.user):
            return Response(
                {'error': 'You do not have permission to complete sprints.'},
                status=status.HTTP_403_FORBIDDEN
            )

        sprint.status = Sprint.Status.COMPLETED
        sprint.save(update_fields=['status', 'updated_at'])

        try:
            from apps.webhooks.services import trigger_workspace_webhooks
            trigger_workspace_webhooks(
                workspace=sprint.workspace,
                event_type='sprint.completed',
                payload={
                    'event': 'sprint.completed',
                    'sprint_id': str(sprint.id),
                    'sprint_name': sprint.name,
                    'project_id': str(sprint.project_id),
                    'project_name': sprint.project.name,
                    'completed_by': request.user.email
                }
            )
        except Exception:
            pass

        return Response(
            {'status': 'success', 'message': f'Sprint "{sprint.name}" marked as completed.', 'sprint': SprintSerializer(sprint).data},
            status=status.HTTP_200_OK
        )
