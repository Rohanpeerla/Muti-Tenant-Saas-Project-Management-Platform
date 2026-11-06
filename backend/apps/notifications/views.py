from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.notifications.models import Notification, NotificationPreference
from apps.notifications.serializers import (
    NotificationSerializer,
    NotificationPreferenceSerializer
)


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationListView(APIView):
    """
    GET /api/notifications/
    Lists current user's notifications with pagination and is_read filtering.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user)

        workspace_id = request.query_params.get('workspace_id')
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)

        is_read_param = request.query_params.get('is_read')
        if is_read_param is not None:
            if is_read_param.lower() in ('true', '1'):
                qs = qs.filter(is_read=True)
            elif is_read_param.lower() in ('false', '0'):
                qs = qs.filter(is_read=False)

        paginator = NotificationPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = NotificationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class NotificationUnreadCountView(APIView):
    """
    GET /api/notifications/unread-count/
    Returns total unread notifications count for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user, is_read=False)
        workspace_id = request.query_params.get('workspace_id')
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)

        return Response({'unread_count': qs.count()}, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    """
    PATCH /api/notifications/{notification_id}/read/
    Marks a single notification as read.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        notification = get_object_or_404(Notification, id=notification_id, recipient=request.user)
        notification.mark_as_read()
        return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)


class NotificationMarkAllReadView(APIView):
    """
    POST /api/notifications/mark-all-read/
    Marks all notifications for current user as read.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        qs = Notification.objects.filter(recipient=request.user, is_read=False)
        workspace_id = request.data.get('workspace_id') or request.query_params.get('workspace_id')
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)

        updated_count = qs.update(is_read=True, read_at=timezone.now())
        return Response({
            'status': 'success',
            'marked_read': updated_count,
            'message': f'Marked {updated_count} notifications as read.'
        }, status=status.HTTP_200_OK)


class NotificationDetailView(APIView):
    """
    DELETE /api/notifications/{notification_id}/
    Deletes an individual notification.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, notification_id):
        notification = get_object_or_404(Notification, id=notification_id, recipient=request.user)
        notification.delete()
        return Response({'status': 'success', 'message': 'Notification deleted.'}, status=status.HTTP_200_OK)


class NotificationClearReadView(APIView):
    """
    DELETE /api/notifications/clear-read/
    Removes all read notifications for current user.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        qs = Notification.objects.filter(recipient=request.user, is_read=True)
        workspace_id = request.query_params.get('workspace_id')
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)

        deleted_count, _ = qs.delete()
        return Response({
            'status': 'success',
            'cleared_count': deleted_count,
            'message': f'Cleared {deleted_count} read notifications.'
        }, status=status.HTTP_200_OK)


class NotificationPreferencesView(APIView):
    """
    GET /api/notifications/preferences/
    PATCH /api/notifications/preferences/
    Manage the authenticated user's notification preferences.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pref = NotificationPreference.get_or_create_for_user(request.user)
        serializer = NotificationPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        pref = NotificationPreference.get_or_create_for_user(request.user)
        serializer = NotificationPreferenceSerializer(pref, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

