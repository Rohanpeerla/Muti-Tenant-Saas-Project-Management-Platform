from django.urls import path
from .views import (
    SprintDetailView,
    SprintStartView,
    SprintCompleteView,
)

app_name = 'sprints'

urlpatterns = [
    path('<uuid:sprint_id>/', SprintDetailView.as_view(), name='sprint_detail'),
    path('<uuid:sprint_id>/start/', SprintStartView.as_view(), name='sprint_start'),
    path('<uuid:sprint_id>/complete/', SprintCompleteView.as_view(), name='sprint_complete'),
]
