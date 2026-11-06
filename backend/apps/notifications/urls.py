from django.urls import path
from apps.notifications.views import (
    NotificationListView,
    NotificationUnreadCountView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    NotificationDetailView,
    NotificationClearReadView,
    NotificationPreferencesView
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', NotificationUnreadCountView.as_view(), name='notification-unread-count'),
    path('<uuid:notification_id>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification-mark-all-read'),
    path('<uuid:notification_id>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('clear-read/', NotificationClearReadView.as_view(), name='notification-clear-read'),
    path('preferences/', NotificationPreferencesView.as_view(), name='notification-preferences'),
]

