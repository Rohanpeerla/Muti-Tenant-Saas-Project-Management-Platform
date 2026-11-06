import os
from django.conf import settings
from django.db import transaction, models
from django.db.models import Q, F
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.boards.models import Board, BoardColumn, WorkflowTransition
from apps.projects.models import Project
from apps.projects.views import can_manage_project
from apps.workspaces.models import WorkspaceMembership, log_audit_event
from apps.workspaces.permissions import get_active_workspace_membership
from .models import (
    Issue,
    Comment,
    IssueAttachment,
    IssueActivity,
    record_issue_activity,
)
from .serializers import (
    IssueSerializer,
    IssueCreateSerializer,
    IssueUpdateSerializer,
    IssueMoveSerializer,
    CommentSerializer,
    IssueAttachmentSerializer,
    IssueActivitySerializer,
)


class ProjectIssueListView(APIView):
    """
    GET /api/projects/{project_id}/issues/
    POST /api/projects/{project_id}/issues/
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

        queryset = Issue.objects.filter(project=project).select_related(
            'reporter', 'assignee', 'board', 'sprint', 'project'
        )

        # Filters
        status_param = request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        priority_param = request.query_params.get('priority')
        if priority_param:
            queryset = queryset.filter(priority=priority_param)

        assignee_param = request.query_params.get('assignee')
        if assignee_param:
            queryset = queryset.filter(assignee_id=assignee_param)

        sprint_param = request.query_params.get('sprint')
        if sprint_param:
            if sprint_param == 'none':
                queryset = queryset.filter(sprint__isnull=True)
            else:
                queryset = queryset.filter(sprint_id=sprint_param)

        board_param = request.query_params.get('board')
        if board_param:
            queryset = queryset.filter(board_id=board_param)

        search_param = request.query_params.get('search')
        if search_param:
            queryset = queryset.filter(
                Q(title__icontains=search_param) |
                Q(issue_key__icontains=search_param) |
                Q(description__icontains=search_param)
            )

        # Ordering
        ordering = request.query_params.get('ordering', 'position')
        if ordering in ['position', '-position', 'created_at', '-created_at', 'priority', '-priority', 'due_date', '-due_date']:
            queryset = queryset.order_by(ordering, 'created_at')
        else:
            queryset = queryset.order_by('position', '-created_at')

        serializer = IssueSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, project_id):
        project, err = self.get_project(project_id, request.user)
        if err:
            return err

        membership = get_active_workspace_membership(project.workspace, request.user)
        if membership.role == 'VIEWER':
            return Response(
                {'error': 'Viewers have read-only access and cannot create tasks.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Plan limit check
        try:
            from apps.billing.usage_service import check_workspace_limits
            check_workspace_limits(project.workspace, 'create_task', count_to_add=1)
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = IssueCreateSerializer(
            data=request.data,
            context={'project': project, 'request': request}
        )
        if serializer.is_valid():
            issue = serializer.save()
            record_issue_activity(
                issue=issue,
                actor=request.user,
                activity_type=IssueActivity.ActivityType.CREATED,
                description=f'Task created by {request.user.first_name or request.user.username}'
            )
            log_audit_event(
                workspace=issue.workspace,
                actor=request.user,
                action='TASK_CREATED',
                entity_type='Issue',
                entity_id=issue.id,
                description=f'Task [{issue.issue_key}] "{issue.title}" created.'
            )

            # Task assignment notification
            if issue.assignee and issue.assignee_id != request.user.id:
                try:
                    from apps.notifications.services import create_notification
                    from apps.notifications.models import Notification
                    create_notification(
                        recipient=issue.assignee,
                        workspace=issue.workspace,
                        notification_type=Notification.NotificationType.TASK_ASSIGNED,
                        title=f'Task Assigned: [{issue.issue_key}] {issue.title}',
                        message=f'{request.user.get_full_name() or request.user.username} assigned you to task [{issue.issue_key}].',
                        related_entity_type='issue',
                        related_entity_id=str(issue.id),
                        actor=request.user,
                        email_template='task_assignment.html',
                        email_context={
                            'issue_key': issue.issue_key,
                            'issue_title': issue.title,
                            'project_name': issue.project.name,
                            'assigner_name': request.user.get_full_name() or request.user.username,
                            'priority': issue.priority,
                            'due_date': str(issue.due_date) if issue.due_date else '',
                            'action_url': f'/projects/{issue.project_id}/issues/{issue.id}'
                        }
                    )
                except Exception:
                    pass

            # Webhook dispatch
            try:
                from apps.webhooks.services import trigger_workspace_webhooks
                trigger_workspace_webhooks(
                    workspace=issue.workspace,
                    event_type='task.created',
                    payload={
                        'event': 'task.created',
                        'issue_id': str(issue.id),
                        'issue_key': issue.issue_key,
                        'title': issue.title,
                        'project_id': str(issue.project_id),
                        'status': issue.status,
                        'priority': issue.priority,
                        'assignee': issue.assignee.email if issue.assignee else None,
                        'reporter': issue.reporter.email if issue.reporter else None,
                        'created_by': request.user.email
                    }
                )
            except Exception:
                pass

            return Response(IssueSerializer(issue).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class IssueDetailView(APIView):
    """
    GET /api/issues/{issue_id}/
    PATCH /api/issues/{issue_id}/
    DELETE /api/issues/{issue_id}/
    """
    permission_classes = [IsAuthenticated]

    def get_issue(self, issue_id, user):
        issue = get_object_or_404(Issue, id=issue_id, workspace__is_active=True)
        membership = get_active_workspace_membership(issue.workspace, user)
        if not membership:
            return None, Response(
                {'error': 'You do not have access to this issue.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return issue, None

    def get(self, request, issue_id):
        issue, err = self.get_issue(issue_id, request.user)
        if err:
            return err

        return Response(IssueSerializer(issue).data, status=status.HTTP_200_OK)

    def patch(self, request, issue_id):
        issue, err = self.get_issue(issue_id, request.user)
        if err:
            return err

        membership = get_active_workspace_membership(issue.workspace, request.user)
        if membership.role == 'VIEWER':
            return Response(
                {'error': 'Viewers have read-only access and cannot edit tasks.'},
                status=status.HTTP_403_FORBIDDEN
            )

        old_status = issue.status
        old_priority = issue.priority
        old_assignee = issue.assignee
        old_sprint = issue.sprint
        old_title = issue.title

        serializer = IssueUpdateSerializer(issue, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()

            # Record activities for changed fields
            if old_status != updated.status:
                record_issue_activity(
                    issue=updated,
                    actor=request.user,
                    activity_type=IssueActivity.ActivityType.STATUS_CHANGED,
                    description=f'Status changed from {old_status} to {updated.status}',
                    field_changed='status',
                    previous_value=old_status,
                    new_value=updated.status
                )
            if old_priority != updated.priority:
                record_issue_activity(
                    issue=updated,
                    actor=request.user,
                    activity_type=IssueActivity.ActivityType.PRIORITY_CHANGED,
                    description=f'Priority changed from {old_priority} to {updated.priority}',
                    field_changed='priority',
                    previous_value=old_priority,
                    new_value=updated.priority
                )
            if old_assignee != updated.assignee:
                prev_name = (old_assignee.first_name or old_assignee.username) if old_assignee else 'Unassigned'
                new_name = (updated.assignee.first_name or updated.assignee.username) if updated.assignee else 'Unassigned'
                record_issue_activity(
                    issue=updated,
                    actor=request.user,
                    activity_type=IssueActivity.ActivityType.ASSIGNEE_CHANGED,
                    description=f'Assignee changed from {prev_name} to {new_name}',
                    field_changed='assignee',
                    previous_value=prev_name,
                    new_value=new_name
                )
            if old_sprint != updated.sprint:
                record_issue_activity(
                    issue=updated,
                    actor=request.user,
                    activity_type=IssueActivity.ActivityType.SPRINT_CHANGED,
                    description=f'Sprint changed from {old_sprint.name if old_sprint else "Backlog"} to {updated.sprint.name if updated.sprint else "Backlog"}',
                    field_changed='sprint',
                    previous_value=old_sprint.name if old_sprint else '',
                    new_value=updated.sprint.name if updated.sprint else ''
                )
            if old_title != updated.title:
                record_issue_activity(
                    issue=updated,
                    actor=request.user,
                    activity_type=IssueActivity.ActivityType.UPDATED,
                    description='Task title was updated',
                    field_changed='title',
                    previous_value=old_title,
                    new_value=updated.title
                )

            # Notifications & Webhooks for updates
            try:
                from apps.notifications.services import create_notification
                from apps.notifications.models import Notification
                from apps.webhooks.services import trigger_workspace_webhooks

                # 1. Assignee changed
                if old_assignee != updated.assignee and updated.assignee and updated.assignee_id != request.user.id:
                    create_notification(
                        recipient=updated.assignee,
                        workspace=updated.workspace,
                        notification_type=Notification.NotificationType.TASK_ASSIGNED,
                        title=f'Task Assigned: [{updated.issue_key}] {updated.title}',
                        message=f'{request.user.get_full_name() or request.user.username} assigned you to [{updated.issue_key}].',
                        related_entity_type='issue',
                        related_entity_id=str(updated.id),
                        actor=request.user,
                        email_template='task_assignment.html',
                        email_context={
                            'issue_key': updated.issue_key,
                            'issue_title': updated.title,
                            'project_name': updated.project.name,
                            'assigner_name': request.user.get_full_name() or request.user.username,
                            'priority': updated.priority,
                            'due_date': str(updated.due_date) if updated.due_date else '',
                            'action_url': f'/projects/{updated.project_id}/issues/{updated.id}'
                        }
                    )
                    trigger_workspace_webhooks(
                        workspace=updated.workspace,
                        event_type='task.assigned',
                        payload={
                            'event': 'task.assigned',
                            'issue_id': str(updated.id),
                            'issue_key': updated.issue_key,
                            'assignee': updated.assignee.email,
                            'assigned_by': request.user.email
                        }
                    )

                # 2. Status changed
                if old_status != updated.status:
                    if updated.assignee and updated.assignee_id != request.user.id:
                        create_notification(
                            recipient=updated.assignee,
                            workspace=updated.workspace,
                            notification_type=Notification.NotificationType.TASK_STATUS_CHANGED,
                            title=f'Task Status Updated: [{updated.issue_key}] {updated.title}',
                            message=f'Status of [{updated.issue_key}] changed from {old_status} to {updated.status} by {request.user.get_full_name() or request.user.username}.',
                            related_entity_type='issue',
                            related_entity_id=str(updated.id),
                            actor=request.user,
                            email_template='task_update.html',
                            email_context={
                                'issue_key': updated.issue_key,
                                'issue_title': updated.title,
                                'actor_name': request.user.get_full_name() or request.user.username,
                                'update_message': f'Status changed from {old_status} to {updated.status}.',
                                'action_url': f'/projects/{updated.project_id}/issues/{updated.id}'
                            }
                        )
                    trigger_workspace_webhooks(
                        workspace=updated.workspace,
                        event_type='task.status_changed',
                        payload={
                            'event': 'task.status_changed',
                            'issue_id': str(updated.id),
                            'issue_key': updated.issue_key,
                            'old_status': old_status,
                            'new_status': updated.status,
                            'updated_by': request.user.email
                        }
                    )
                    if updated.status.upper() == 'DONE':
                        trigger_workspace_webhooks(
                            workspace=updated.workspace,
                            event_type='task.completed',
                            payload={
                                'event': 'task.completed',
                                'issue_id': str(updated.id),
                                'issue_key': updated.issue_key,
                                'completed_by': request.user.email
                            }
                        )

                # 3. Generic task.updated webhook
                trigger_workspace_webhooks(
                    workspace=updated.workspace,
                    event_type='task.updated',
                    payload={
                        'event': 'task.updated',
                        'issue_id': str(updated.id),
                        'issue_key': updated.issue_key,
                        'title': updated.title,
                        'status': updated.status,
                        'priority': updated.priority,
                        'updated_by': request.user.email
                    }
                )
            except Exception:
                pass

            return Response(IssueSerializer(updated).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, issue_id):
        issue, err = self.get_issue(issue_id, request.user)
        if err:
            return err

        # Only managers or task reporter can delete tasks
        is_manager = can_manage_project(issue.project, request.user)
        is_reporter = issue.reporter_id == request.user.id

        if not (is_manager or is_reporter):
            return Response(
                {'error': 'Only project managers or the task reporter can delete this task.'},
                status=status.HTTP_403_FORBIDDEN
            )

        key = issue.issue_key
        title = issue.title
        ws = issue.workspace
        iss_id = issue.id
        issue.delete()
        log_audit_event(
            workspace=ws,
            actor=request.user,
            action='TASK_DELETED',
            entity_type='Issue',
            entity_id=iss_id,
            description=f'Task [{key}] "{title}" was deleted.'
        )
        return Response(
            {'status': 'success', 'message': f'Issue {key} deleted successfully.'},
            status=status.HTTP_200_OK
        )


class IssueMoveView(APIView):
    """
    POST /api/issues/{issue_id}/move/
    Optimized endpoint for Kanban drag-and-drop: updates status and position atomically.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, issue_id):
        issue = get_object_or_404(Issue, id=issue_id, workspace__is_active=True)
        membership = get_active_workspace_membership(issue.workspace, request.user)
        if not membership:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
        if membership.role == 'VIEWER':
            return Response({'error': 'Viewers cannot move tasks.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = IssueMoveSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_status = serializer.validated_data['status']
        new_position = serializer.validated_data['position']
        board_id = serializer.validated_data.get('board_id')

        # Validate custom workflow transitions if board has configured transitions
        target_board = None
        if board_id:
            target_board = Board.objects.filter(id=board_id, project=issue.project).first()
        if not target_board:
            target_board = issue.board

        if target_board and issue.status != new_status:
            transitions = WorkflowTransition.objects.filter(board=target_board)
            if transitions.exists():
                src_col = BoardColumn.objects.filter(board=target_board, key=issue.status).first()
                dst_col = BoardColumn.objects.filter(board=target_board, key=new_status).first()
                if src_col and dst_col:
                    is_permitted = WorkflowTransition.objects.filter(
                        board=target_board,
                        from_column=src_col,
                        to_column=dst_col
                    ).exists()
                    if not is_permitted:
                        return Response(
                            {'error': f'Workflow transition from "{src_col.name}" to "{dst_col.name}" is not permitted.'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

        with transaction.atomic():
            old_status = issue.status
            old_position = issue.position

            # Shift other issues in new column to accommodate new position
            Issue.objects.filter(
                project=issue.project,
                status=new_status,
                position__gte=new_position
            ).exclude(pk=issue.pk).update(position=models.F('position') + 1)

            issue.status = new_status
            issue.position = new_position
            if board_id and target_board:
                issue.board = target_board

            issue.save(update_fields=['status', 'position', 'board', 'updated_at'])

            record_issue_activity(
                issue=issue,
                actor=request.user,
                activity_type=IssueActivity.ActivityType.STATUS_CHANGED if old_status != new_status else IssueActivity.ActivityType.MOVED,
                description=f'Task status moved from {old_status} to {new_status}' if old_status != new_status else f'Task position updated in {new_status}',
                field_changed='status' if old_status != new_status else 'position',
                previous_value=old_status if old_status != new_status else old_position,
                new_value=new_status if old_status != new_status else new_position
            )

        # Trigger notification & webhooks outside transaction
        if old_status != new_status:
            try:
                from apps.notifications.services import create_notification
                from apps.notifications.models import Notification
                from apps.webhooks.services import trigger_workspace_webhooks

                if issue.assignee and issue.assignee_id != request.user.id:
                    create_notification(
                        recipient=issue.assignee,
                        workspace=issue.workspace,
                        notification_type=Notification.NotificationType.TASK_STATUS_CHANGED,
                        title=f'Task Status Updated: [{issue.issue_key}] {issue.title}',
                        message=f'Task [{issue.issue_key}] moved from {old_status} to {new_status} by {request.user.get_full_name() or request.user.username}.',
                        related_entity_type='issue',
                        related_entity_id=str(issue.id),
                        actor=request.user,
                        email_template='task_update.html',
                        email_context={
                            'issue_key': issue.issue_key,
                            'issue_title': issue.title,
                            'actor_name': request.user.get_full_name() or request.user.username,
                            'update_message': f'Task status moved from {old_status} to {new_status}.',
                            'action_url': f'/projects/{issue.project_id}/issues/{issue.id}'
                        }
                    )

                trigger_workspace_webhooks(
                    workspace=issue.workspace,
                    event_type='task.status_changed',
                    payload={
                        'event': 'task.status_changed',
                        'issue_id': str(issue.id),
                        'issue_key': issue.issue_key,
                        'old_status': old_status,
                        'new_status': new_status,
                        'updated_by': request.user.email
                    }
                )

                if new_status.upper() == 'DONE':
                    trigger_workspace_webhooks(
                        workspace=issue.workspace,
                        event_type='task.completed',
                        payload={
                            'event': 'task.completed',
                            'issue_id': str(issue.id),
                            'issue_key': issue.issue_key,
                            'completed_by': request.user.email
                        }
                    )
            except Exception:
                pass

        return Response(IssueSerializer(issue).data, status=status.HTTP_200_OK)


class IssueCommentListView(APIView):
    """
    GET /api/issues/{issue_id}/comments/
    POST /api/issues/{issue_id}/comments/
    """
    permission_classes = [IsAuthenticated]

    def get_issue(self, issue_id, user):
        issue = get_object_or_404(Issue, id=issue_id, workspace__is_active=True)
        membership = get_active_workspace_membership(issue.workspace, user)
        if not membership:
            return None, Response({'error': 'You do not have access to this issue.'}, status=status.HTTP_403_FORBIDDEN)
        return issue, None

    def get(self, request, issue_id):
        issue, err = self.get_issue(issue_id, request.user)
        if err:
            return err
        comments = issue.comments.select_related('author').order_by('created_at')
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, issue_id):
        issue, err = self.get_issue(issue_id, request.user)
        if err:
            return err

        membership = get_active_workspace_membership(issue.workspace, request.user)
        if membership.role == 'VIEWER':
            return Response({'error': 'Viewers cannot create comments.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            comment = Comment.objects.create(
                issue=issue,
                workspace=issue.workspace,
                author=request.user,
                content=serializer.validated_data['content']
            )
            record_issue_activity(
                issue=issue,
                actor=request.user,
                activity_type=IssueActivity.ActivityType.COMMENT_ADDED,
                description=f'Comment added by {request.user.first_name or request.user.username}'
            )

            # Notifications & Webhooks for comment
            try:
                import re
                from django.contrib.auth import get_user_model
                from apps.notifications.services import create_notification
                from apps.notifications.models import Notification
                from apps.webhooks.services import trigger_workspace_webhooks

                User = get_user_model()
                notified_user_ids = {request.user.id}

                # Check @mentions
                mentions = re.findall(r'@([a-zA-Z0-9_.-]+)', comment.content)
                for username in mentions:
                    mentioned_user = User.objects.filter(username__iexact=username).first()
                    if mentioned_user and mentioned_user.id not in notified_user_ids:
                        create_notification(
                            recipient=mentioned_user,
                            workspace=issue.workspace,
                            notification_type=Notification.NotificationType.TASK_MENTIONED,
                            title=f'Mentioned in task: [{issue.issue_key}] {issue.title}',
                            message=f'{request.user.get_full_name() or request.user.username} mentioned you in a comment on [{issue.issue_key}]: "{comment.content[:100]}"',
                            related_entity_type='issue',
                            related_entity_id=str(issue.id),
                            actor=request.user,
                            email_template='task_update.html',
                            email_context={
                                'issue_key': issue.issue_key,
                                'issue_title': issue.title,
                                'actor_name': request.user.get_full_name() or request.user.username,
                                'update_message': f'Mentioned you: {comment.content[:200]}',
                                'action_url': f'/projects/{issue.project_id}/issues/{issue.id}'
                            }
                        )
                        notified_user_ids.add(mentioned_user.id)

                # Notify assignee
                if issue.assignee and issue.assignee_id not in notified_user_ids:
                    create_notification(
                        recipient=issue.assignee,
                        workspace=issue.workspace,
                        notification_type=Notification.NotificationType.TASK_COMMENTED,
                        title=f'New Comment on [{issue.issue_key}] {issue.title}',
                        message=f'{request.user.get_full_name() or request.user.username} commented on [{issue.issue_key}]: "{comment.content[:100]}"',
                        related_entity_type='issue',
                        related_entity_id=str(issue.id),
                        actor=request.user,
                        email_template='task_update.html',
                        email_context={
                            'issue_key': issue.issue_key,
                            'issue_title': issue.title,
                            'actor_name': request.user.get_full_name() or request.user.username,
                            'update_message': f'Added a comment: {comment.content[:200]}',
                            'action_url': f'/projects/{issue.project_id}/issues/{issue.id}'
                        }
                    )
                    notified_user_ids.add(issue.assignee_id)

                # Notify reporter if different
                if issue.reporter and issue.reporter_id not in notified_user_ids:
                    create_notification(
                        recipient=issue.reporter,
                        workspace=issue.workspace,
                        notification_type=Notification.NotificationType.TASK_COMMENTED,
                        title=f'New Comment on [{issue.issue_key}] {issue.title}',
                        message=f'{request.user.get_full_name() or request.user.username} commented on your reported task [{issue.issue_key}].',
                        related_entity_type='issue',
                        related_entity_id=str(issue.id),
                        actor=request.user,
                        email_template='task_update.html',
                        email_context={
                            'issue_key': issue.issue_key,
                            'issue_title': issue.title,
                            'actor_name': request.user.get_full_name() or request.user.username,
                            'update_message': f'Added a comment: {comment.content[:200]}',
                            'action_url': f'/projects/{issue.project_id}/issues/{issue.id}'
                        }
                    )
                    notified_user_ids.add(issue.reporter_id)

                # Webhook
                trigger_workspace_webhooks(
                    workspace=issue.workspace,
                    event_type='comment.created',
                    payload={
                        'event': 'comment.created',
                        'comment_id': str(comment.id),
                        'issue_id': str(issue.id),
                        'issue_key': issue.issue_key,
                        'author': request.user.email,
                        'content': comment.content[:200]
                    }
                )
            except Exception:
                pass

            return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CommentDetailView(APIView):
    """
    PATCH /api/comments/{comment_id}/
    DELETE /api/comments/{comment_id}/
    """
    permission_classes = [IsAuthenticated]

    def get_comment_and_check_access(self, comment_id, user):
        comment = get_object_or_404(Comment, id=comment_id, workspace__is_active=True)
        membership = get_active_workspace_membership(comment.workspace, user)
        if not membership:
            return None, None, Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
        return comment, membership, None

    def patch(self, request, comment_id):
        comment, membership, err = self.get_comment_and_check_access(comment_id, request.user)
        if err:
            return err

        is_author = comment.author_id == request.user.id
        is_admin = membership.role in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN]

        if not (is_author or is_admin):
            return Response({'error': 'You can only edit your own comments.'}, status=status.HTTP_403_FORBIDDEN)
        if membership.role == 'VIEWER':
            return Response({'error': 'Viewers cannot edit comments.'}, status=status.HTTP_403_FORBIDDEN)

        content = request.data.get('content', '').strip()
        if not content:
            return Response({'content': ['Comment content cannot be empty.']}, status=status.HTTP_400_BAD_REQUEST)

        comment.content = content
        comment.is_edited = True
        comment.save(update_fields=['content', 'is_edited', 'updated_at'])

        return Response(CommentSerializer(comment).data, status=status.HTTP_200_OK)

    def delete(self, request, comment_id):
        comment, membership, err = self.get_comment_and_check_access(comment_id, request.user)
        if err:
            return err

        is_author = comment.author_id == request.user.id
        is_admin = membership.role in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN]

        if not (is_author or is_admin):
            return Response({'error': 'You do not have permission to delete this comment.'}, status=status.HTTP_403_FORBIDDEN)
        if membership.role == 'VIEWER':
            return Response({'error': 'Viewers cannot delete comments.'}, status=status.HTTP_403_FORBIDDEN)

        issue = comment.issue
        comment.delete()
        record_issue_activity(
            issue=issue,
            actor=request.user,
            activity_type=IssueActivity.ActivityType.COMMENT_DELETED,
            description=f'Comment deleted by {request.user.first_name or request.user.username}'
        )

        return Response({'status': 'success', 'message': 'Comment deleted.'}, status=status.HTTP_200_OK)


ALLOWED_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.csv', '.txt'}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


class IssueAttachmentListView(APIView):
    """
    GET /api/issues/{issue_id}/attachments/
    POST /api/issues/{issue_id}/attachments/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_issue(self, issue_id, user):
        issue = get_object_or_404(Issue, id=issue_id, workspace__is_active=True)
        membership = get_active_workspace_membership(issue.workspace, user)
        if not membership:
            return None, Response({'error': 'You do not have access to this issue.'}, status=status.HTTP_403_FORBIDDEN)
        return issue, None

    def get(self, request, issue_id):
        issue, err = self.get_issue(issue_id, request.user)
        if err:
            return err
        attachments = issue.attachments.select_related('uploaded_by').order_by('-uploaded_at')
        serializer = IssueAttachmentSerializer(attachments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, issue_id):
        issue, err = self.get_issue(issue_id, request.user)
        if err:
            return err

        membership = get_active_workspace_membership(issue.workspace, request.user)
        if membership.role == 'VIEWER':
            return Response({'error': 'Viewers cannot upload attachments.'}, status=status.HTTP_403_FORBIDDEN)

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'file': ['No file was provided.']}, status=status.HTTP_400_BAD_REQUEST)

        # File size validation
        if uploaded_file.size > MAX_UPLOAD_SIZE:
            return Response(
                {'error': f'File exceeds maximum allowed size of 10 MB ({round(uploaded_file.size / (1024*1024), 2)} MB uploaded).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # File extension validation
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {'error': f'Unsupported file extension "{ext}". Allowed formats: PDF, PNG, JPG, JPEG, DOCX, XLSX, CSV, TXT.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Plan storage limit check
        try:
            from apps.billing.usage_service import check_workspace_limits
            check_workspace_limits(issue.workspace, 'upload_attachment', count_to_add=uploaded_file.size)
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        attachment = IssueAttachment.objects.create(
            issue=issue,
            workspace=issue.workspace,
            uploaded_by=request.user,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            file_size=uploaded_file.size,
            mime_type=uploaded_file.content_type or 'application/octet-stream'
        )

        record_issue_activity(
            issue=issue,
            actor=request.user,
            activity_type=IssueActivity.ActivityType.ATTACHMENT_UPLOADED,
            description=f'Uploaded attachment "{attachment.original_filename}"'
        )

        return Response(IssueAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class AttachmentDownloadView(APIView):
    """
    GET /api/attachments/{attachment_id}/download/
    Authenticated and authorized download of private task attachments.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, attachment_id):
        attachment = get_object_or_404(IssueAttachment, id=attachment_id, workspace__is_active=True)
        membership = get_active_workspace_membership(attachment.workspace, request.user)
        if not membership:
            return Response({'error': 'You do not have permission to download this file.'}, status=status.HTTP_403_FORBIDDEN)

        if not attachment.file or not os.path.exists(attachment.file.path):
            raise Http404('File not found on disk.')

        return FileResponse(
            attachment.file.open('rb'),
            as_attachment=True,
            filename=attachment.original_filename
        )


class AttachmentDetailView(APIView):
    """
    DELETE /api/attachments/{attachment_id}/
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, attachment_id):
        attachment = get_object_or_404(IssueAttachment, id=attachment_id, workspace__is_active=True)
        membership = get_active_workspace_membership(attachment.workspace, request.user)
        if not membership:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        is_uploader = attachment.uploaded_by_id == request.user.id
        is_admin = membership.role in [WorkspaceMembership.Role.OWNER, WorkspaceMembership.Role.ADMIN]

        if not (is_uploader or is_admin):
            return Response({'error': 'You do not have permission to delete this attachment.'}, status=status.HTTP_403_FORBIDDEN)
        if membership.role == 'VIEWER':
            return Response({'error': 'Viewers cannot delete attachments.'}, status=status.HTTP_403_FORBIDDEN)

        issue = attachment.issue
        fname = attachment.original_filename
        attachment.delete()

        record_issue_activity(
            issue=issue,
            actor=request.user,
            activity_type=IssueActivity.ActivityType.ATTACHMENT_DELETED,
            description=f'Attachment "{fname}" was deleted'
        )

        return Response({'status': 'success', 'message': 'Attachment deleted.'}, status=status.HTTP_200_OK)


class IssueActivityListView(APIView):
    """
    GET /api/issues/{issue_id}/activities/
    GET /api/issues/{issue_id}/activity/
    Returns chronological timeline events for a task.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, issue_id):
        issue = get_object_or_404(Issue, id=issue_id, workspace__is_active=True)
        membership = get_active_workspace_membership(issue.workspace, request.user)
        if not membership:
            return Response({'error': 'You do not have access to this issue.'}, status=status.HTTP_403_FORBIDDEN)

        activities = issue.activities.select_related('actor').order_by('-created_at')
        serializer = IssueActivitySerializer(activities, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

