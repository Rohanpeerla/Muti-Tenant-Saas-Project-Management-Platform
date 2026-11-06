from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.issues.models import Issue
from apps.projects.models import Project
from apps.projects.views import can_manage_project
from apps.workspaces.permissions import get_active_workspace_membership
from .models import Board, BoardColumn, WorkflowTransition
from .serializers import (
    BoardSerializer,
    BoardCreateSerializer,
    BoardColumnSerializer,
    AddBoardColumnSerializer,
    WorkflowTransitionSerializer,
)


class ProjectBoardListView(APIView):
    """
    GET /api/projects/{project_id}/boards/
    POST /api/projects/{project_id}/boards/
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

        boards = Board.objects.filter(project=project).prefetch_related('columns').order_by('position', 'created_at')
        serializer = BoardSerializer(boards, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, project_id):
        project, err = self.get_project(project_id, request.user)
        if err:
            return err

        if not can_manage_project(project, request.user):
            return Response(
                {'error': 'You do not have permission to create boards in this project.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = BoardCreateSerializer(
            data=request.data,
            context={'project': project, 'request': request}
        )
        if serializer.is_valid():
            board = serializer.save()
            return Response(BoardSerializer(board).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BoardDetailView(APIView):
    """
    GET /api/boards/{board_id}/
    PATCH /api/boards/{board_id}/
    DELETE /api/boards/{board_id}/
    """
    permission_classes = [IsAuthenticated]

    def get_board(self, board_id, user):
        board = get_object_or_404(Board, id=board_id, workspace__is_active=True)
        membership = get_active_workspace_membership(board.workspace, user)
        if not membership:
            return None, Response(
                {'error': 'You do not have access to this board.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return board, None

    def get(self, request, board_id):
        board, err = self.get_board(board_id, request.user)
        if err:
            return err

        serializer = BoardSerializer(board)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, board_id):
        board, err = self.get_board(board_id, request.user)
        if err:
            return err

        if not can_manage_project(board.project, request.user):
            return Response(
                {'error': 'You do not have permission to update this board.'},
                status=status.HTTP_403_FORBIDDEN
            )

        name = request.data.get('name')
        description = request.data.get('description')
        is_default = request.data.get('is_default')

        if name is not None:
            board.name = name.strip()
        if description is not None:
            board.description = description.strip()
        if is_default is not None and is_default is True:
            Board.objects.filter(project=board.project, is_default=True).exclude(pk=board.pk).update(is_default=False)
            board.is_default = True

        board.save()
        return Response(BoardSerializer(board).data, status=status.HTTP_200_OK)

    def delete(self, request, board_id):
        board, err = self.get_board(board_id, request.user)
        if err:
            return err

        if not can_manage_project(board.project, request.user):
            return Response(
                {'error': 'You do not have permission to delete this board.'},
                status=status.HTTP_403_FORBIDDEN
            )

        board_name = board.name
        board.delete()
        return Response(
            {'status': 'success', 'message': f'Board "{board_name}" deleted.'},
            status=status.HTTP_200_OK
        )


class BoardColumnListView(APIView):
    """
    POST /api/boards/{board_id}/columns/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, board_id):
        board = get_object_or_404(Board, id=board_id, workspace__is_active=True)
        if not can_manage_project(board.project, request.user):
            return Response(
                {'error': 'You do not have permission to modify columns on this board.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AddBoardColumnSerializer(
            data=request.data,
            context={'board': board, 'request': request}
        )
        if serializer.is_valid():
            column = serializer.save()
            return Response(BoardColumnSerializer(column).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BoardColumnDetailView(APIView):
    """
    PATCH /api/boards/{board_id}/columns/{column_id}/
    DELETE /api/boards/{board_id}/columns/{column_id}/
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, board_id, column_id):
        board = get_object_or_404(Board, id=board_id, workspace__is_active=True)
        if not can_manage_project(board.project, request.user):
            return Response(
                {'error': 'You do not have permission to modify columns on this board.'},
                status=status.HTTP_403_FORBIDDEN
            )

        column = get_object_or_404(BoardColumn, id=column_id, board=board)

        name = request.data.get('name')
        position = request.data.get('position')
        color = request.data.get('color')
        is_default = request.data.get('is_default')
        is_completion = request.data.get('is_completion')

        if name is not None:
            column.name = name.strip()
        if position is not None:
            column.position = int(position)
        if color is not None:
            column.color = color.strip()
        if is_default is not None:
            if is_default:
                BoardColumn.objects.filter(board=board, is_default=True).update(is_default=False)
            column.is_default = bool(is_default)
        if is_completion is not None:
            if is_completion:
                BoardColumn.objects.filter(board=board, is_completion=True).update(is_completion=False)
            column.is_completion = bool(is_completion)

        column.save()
        return Response(BoardColumnSerializer(column).data, status=status.HTTP_200_OK)

    def delete(self, request, board_id, column_id):
        board = get_object_or_404(Board, id=board_id, workspace__is_active=True)
        if not can_manage_project(board.project, request.user):
            return Response(
                {'error': 'You do not have permission to delete columns on this board.'},
                status=status.HTTP_403_FORBIDDEN
            )

        column = get_object_or_404(BoardColumn, id=column_id, board=board)

        # Check if tasks are assigned to this column's status/key
        has_tasks = Issue.objects.filter(
            project=board.project,
            status=column.key
        ).exists()

        if has_tasks:
            return Response(
                {'error': f'Cannot delete column "{column.name}" because it currently contains active tasks. Please reassign or complete those tasks first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        column.delete()
        return Response(
            {'status': 'success', 'message': f'Column "{column.name}" deleted.'},
            status=status.HTTP_200_OK
        )


class BoardColumnsReorderView(APIView):
    """
    POST /api/boards/{board_id}/columns/reorder/
    Updates positions for an array of column IDs in the order provided.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, board_id):
        board = get_object_or_404(Board, id=board_id, workspace__is_active=True)
        if not can_manage_project(board.project, request.user):
            return Response(
                {'error': 'You do not have permission to reorder columns on this board.'},
                status=status.HTTP_403_FORBIDDEN
            )

        column_ids = request.data.get('column_ids', [])
        if not isinstance(column_ids, list):
            return Response({'error': 'column_ids must be a list of column UUIDs.'}, status=status.HTTP_400_BAD_REQUEST)

        for index, col_id in enumerate(column_ids):
            BoardColumn.objects.filter(id=col_id, board=board).update(position=index)

        columns = board.columns.order_by('position', 'created_at')
        return Response(BoardColumnSerializer(columns, many=True).data, status=status.HTTP_200_OK)


class WorkflowTransitionListView(APIView):
    """
    GET /api/boards/{board_id}/transitions/
    POST /api/boards/{board_id}/transitions/
    """
    permission_classes = [IsAuthenticated]

    def get_board(self, board_id, user):
        board = get_object_or_404(Board, id=board_id, workspace__is_active=True)
        membership = get_active_workspace_membership(board.workspace, user)
        if not membership:
            return None, Response({'error': 'You do not have access to this board.'}, status=status.HTTP_403_FORBIDDEN)
        return board, None

    def get(self, request, board_id):
        board, err = self.get_board(board_id, request.user)
        if err:
            return err
        transitions = board.transitions.select_related('from_column', 'to_column')
        serializer = WorkflowTransitionSerializer(transitions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, board_id):
        board, err = self.get_board(board_id, request.user)
        if err:
            return err

        if not can_manage_project(board.project, request.user):
            return Response(
                {'error': 'Administrative permissions required to configure workflow transitions.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Plan feature flag check for custom workflows
        try:
            from apps.billing.usage_service import check_workspace_limits
            check_workspace_limits(board.workspace, 'custom_workflow')
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = WorkflowTransitionSerializer(
            data=request.data,
            context={'board': board, 'request': request}
        )
        if serializer.is_valid():
            transition = serializer.save()
            return Response(WorkflowTransitionSerializer(transition).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkflowTransitionDetailView(APIView):
    """
    DELETE /api/boards/{board_id}/transitions/{transition_id}/
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, board_id, transition_id):
        board = get_object_or_404(Board, id=board_id, workspace__is_active=True)
        if not can_manage_project(board.project, request.user):
            return Response(
                {'error': 'Administrative permissions required to delete workflow transitions.'},
                status=status.HTTP_403_FORBIDDEN
            )

        transition = get_object_or_404(WorkflowTransition, id=transition_id, board=board)
        transition.delete()
        return Response({'status': 'success', 'message': 'Workflow transition deleted.'}, status=status.HTTP_200_OK)

