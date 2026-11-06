from django.urls import path
from .views import (
    ProjectBoardListView,
    BoardDetailView,
    BoardColumnListView,
    BoardColumnDetailView,
    BoardColumnsReorderView,
    WorkflowTransitionListView,
    WorkflowTransitionDetailView,
)

app_name = 'boards'

urlpatterns = [
    path('<uuid:board_id>/', BoardDetailView.as_view(), name='board_detail'),
    path('<uuid:board_id>/columns/', BoardColumnListView.as_view(), name='board_columns'),
    path('<uuid:board_id>/columns/reorder/', BoardColumnsReorderView.as_view(), name='board_columns_reorder'),
    path('<uuid:board_id>/columns/<uuid:column_id>/', BoardColumnDetailView.as_view(), name='board_column_detail'),
    path('<uuid:board_id>/transitions/', WorkflowTransitionListView.as_view(), name='board_transitions'),
    path('<uuid:board_id>/transitions/<uuid:transition_id>/', WorkflowTransitionDetailView.as_view(), name='board_transition_detail'),
]
