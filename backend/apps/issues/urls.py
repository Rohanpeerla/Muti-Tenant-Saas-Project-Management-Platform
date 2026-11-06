from django.urls import path
from .views import (
    IssueDetailView,
    IssueMoveView,
    IssueCommentListView,
    IssueAttachmentListView,
    IssueActivityListView,
)

app_name = 'issues'

urlpatterns = [
    path('<uuid:issue_id>/', IssueDetailView.as_view(), name='issue_detail'),
    path('<uuid:issue_id>/move/', IssueMoveView.as_view(), name='issue_move'),
    path('<uuid:issue_id>/comments/', IssueCommentListView.as_view(), name='issue_comments'),
    path('<uuid:issue_id>/attachments/', IssueAttachmentListView.as_view(), name='issue_attachments'),
    path('<uuid:issue_id>/activities/', IssueActivityListView.as_view(), name='issue_activities'),
    path('<uuid:issue_id>/activity/', IssueActivityListView.as_view(), name='issue_activity'),
]
