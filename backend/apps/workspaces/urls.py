from django.urls import path
from apps.projects.views import WorkspaceProjectListView
from .views import (
    WorkspaceListView,
    WorkspaceDetailView,
    WorkspaceMemberListView,
    WorkspaceMemberDetailView,
    WorkspaceInvitationListView,
    WorkspaceInvitationAcceptView,
    WorkspaceInvitationDeclineView,
    WorkspaceAuditLogListView,
)

app_name = 'workspaces'

urlpatterns = [
    path('', WorkspaceListView.as_view(), name='workspace_list'),
    path('invitations/', WorkspaceInvitationListView.as_view(), name='workspace_invitations'),
    path('invitations/<uuid:membership_id>/accept/', WorkspaceInvitationAcceptView.as_view(), name='workspace_invitation_accept'),
    path('invitations/<uuid:membership_id>/decline/', WorkspaceInvitationDeclineView.as_view(), name='workspace_invitation_decline'),
    path('<uuid:workspace_id>/', WorkspaceDetailView.as_view(), name='workspace_detail'),
    path('<uuid:workspace_id>/audit-logs/', WorkspaceAuditLogListView.as_view(), name='workspace_audit_logs'),
    path('<uuid:workspace_id>/projects/', WorkspaceProjectListView.as_view(), name='workspace_projects'),
    path('<uuid:workspace_id>/members/', WorkspaceMemberListView.as_view(), name='workspace_members'),
    path('<uuid:workspace_id>/members/<uuid:membership_id>/', WorkspaceMemberDetailView.as_view(), name='workspace_member_detail'),
]
