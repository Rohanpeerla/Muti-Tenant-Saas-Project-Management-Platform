from django.urls import path
from apps.boards.views import ProjectBoardListView
from apps.issues.views import ProjectIssueListView
from apps.sprints.views import ProjectSprintListView
from .views import (
    WorkspaceProjectListView,
    ProjectDetailView,
    ProjectMemberListView,
    ProjectMemberDetailView,
)

app_name = 'projects'

urlpatterns = [
    path('', WorkspaceProjectListView.as_view(), name='project_list'),
    path('<uuid:project_id>/', ProjectDetailView.as_view(), name='project_detail'),
    path('<uuid:project_id>/boards/', ProjectBoardListView.as_view(), name='project_boards'),
    path('<uuid:project_id>/issues/', ProjectIssueListView.as_view(), name='project_issues'),
    path('<uuid:project_id>/sprints/', ProjectSprintListView.as_view(), name='project_sprints'),
    path('<uuid:project_id>/members/', ProjectMemberListView.as_view(), name='project_members'),
    path('<uuid:project_id>/members/<uuid:membership_id>/', ProjectMemberDetailView.as_view(), name='project_member_detail'),
]
