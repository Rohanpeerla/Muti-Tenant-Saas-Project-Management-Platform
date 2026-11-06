"""
URL configuration for project management platform.
"""
from django.contrib import admin
from django.urls import path, include
from apps.issues.views import (
    CommentDetailView,
    AttachmentDownloadView,
    AttachmentDetailView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/workspaces/', include('apps.workspaces.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/boards/', include('apps.boards.urls')),
    path('api/issues/', include('apps.issues.urls')),
    path('api/comments/<uuid:comment_id>/', CommentDetailView.as_view(), name='comment_detail'),
    path('api/attachments/<uuid:attachment_id>/download/', AttachmentDownloadView.as_view(), name='attachment_download'),
    path('api/attachments/<uuid:attachment_id>/', AttachmentDetailView.as_view(), name='attachment_detail'),
    path('api/sprints/', include('apps.sprints.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/billing/', include('apps.billing.urls')),
    path('api/', include('apps.webhooks.urls')),
    path('api/', include('apps.core.urls')),
]
