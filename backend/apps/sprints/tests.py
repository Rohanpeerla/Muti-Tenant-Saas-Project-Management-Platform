import datetime
import uuid
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from apps.workspaces.models import Workspace
from apps.projects.models import Project
from .models import Sprint

User = get_user_model()


class SprintModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.workspace1 = Workspace.objects.create(name='SprintSync Org', slug='sprintsync', owner=self.owner)
        self.workspace2 = Workspace.objects.create(name='Other Org', slug='other', owner=self.owner)

        self.project1 = Project.objects.create(
            workspace=self.workspace1,
            name='Cloud Infrastructure',
            slug='cloud-infra',
            owner=self.owner
        )

    def test_sprint_creation(self):
        today = datetime.date.today()
        end = today + datetime.timedelta(days=14)
        sprint = Sprint.objects.create(
            workspace=self.workspace1,
            project=self.project1,
            name='Sprint 1 - Foundation',
            goal='Deploy core microservices and database schemas',
            status=Sprint.Status.ACTIVE,
            start_date=today,
            end_date=end
        )
        self.assertIsInstance(sprint.id, uuid.UUID)
        self.assertEqual(sprint.workspace, self.workspace1)
        self.assertEqual(sprint.project, self.project1)
        self.assertEqual(sprint.status, Sprint.Status.ACTIVE)
        self.assertEqual(str(sprint), 'Sprint 1 - Foundation - Cloud Infrastructure (ACTIVE)')

    def test_sprint_auto_aligns_workspace(self):
        sprint = Sprint.objects.create(
            project=self.project1,
            name='Auto-aligned Sprint'
        )
        self.assertEqual(sprint.workspace, self.project1.workspace)

    def test_sprint_date_validation_rejected_if_end_before_start(self):
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        with self.assertRaises(ValidationError):
            Sprint.objects.create(
                workspace=self.workspace1,
                project=self.project1,
                name='Invalid Dates Sprint',
                start_date=today,
                end_date=yesterday
            )

    def test_cross_workspace_sprint_association_rejected(self):
        # Project is in workspace1, but sprint assigned to workspace2
        with self.assertRaises(ValidationError):
            Sprint.objects.create(
                workspace=self.workspace2,
                project=self.project1,
                name='Mismatched Sprint'
            )

    def test_multiple_sprints_per_project(self):
        s1 = Sprint.objects.create(project=self.project1, name='Sprint 1')
        s2 = Sprint.objects.create(project=self.project1, name='Sprint 2')
        self.assertEqual(self.project1.sprints.count(), 2)
        self.assertIn(s1, self.project1.sprints.all())
        self.assertIn(s2, self.project1.sprints.all())


class SprintAPITests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.workspaces.models import WorkspaceMembership
        from apps.issues.models import Issue

        self.client = APIClient()
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.workspace = Workspace.objects.create(name='SprintSync Org', slug='sprintsync', owner=self.owner)
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.owner, role=WorkspaceMembership.Role.OWNER, status=WorkspaceMembership.Status.ACTIVE)

        self.project = Project.objects.create(
            workspace=self.workspace,
            name='Cloud Infrastructure',
            slug='cloud-infra',
            key='CLD',
            owner=self.owner
        )
        self.sprint1 = Sprint.objects.create(
            workspace=self.workspace,
            project=self.project,
            name='Sprint 1',
            status=Sprint.Status.PLANNED
        )

    def auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_start_sprint_and_single_active_sprint_rule(self):
        self.auth(self.owner)
        # Start sprint 1
        res1 = self.client.post(f'/api/sprints/{self.sprint1.id}/start/')
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.data['sprint']['status'], 'ACTIVE')

        # Create sprint 2 and attempt to start while sprint 1 is active
        sprint2 = Sprint.objects.create(workspace=self.workspace, project=self.project, name='Sprint 2', status=Sprint.Status.PLANNED)
        res2 = self.client.post(f'/api/sprints/{sprint2.id}/start/')
        self.assertEqual(res2.status_code, 400)
        self.assertIn('already active', res2.data['error'].lower())

        # Complete sprint 1
        res_comp = self.client.post(f'/api/sprints/{self.sprint1.id}/complete/')
        self.assertEqual(res_comp.status_code, 200)
        self.assertEqual(res_comp.data['sprint']['status'], 'COMPLETED')

        # Now sprint 2 can start
        res2_ok = self.client.post(f'/api/sprints/{sprint2.id}/start/')
        self.assertEqual(res2_ok.status_code, 200)
        self.assertEqual(res2_ok.data['sprint']['status'], 'ACTIVE')

    def test_sprint_progress_calculation(self):
        from apps.issues.models import Issue
        self.auth(self.owner)
        Issue.objects.create(workspace=self.workspace, project=self.project, sprint=self.sprint1, title='T1', status='DONE', reporter=self.owner)
        Issue.objects.create(workspace=self.workspace, project=self.project, sprint=self.sprint1, title='T2', status='TODO', reporter=self.owner)

        detail_res = self.client.get(f'/api/sprints/{self.sprint1.id}/')
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(detail_res.data['total_tasks'], 2)
        self.assertEqual(detail_res.data['completed_tasks'], 1)
        self.assertEqual(detail_res.data['remaining_tasks'], 1)
        self.assertEqual(detail_res.data['progress_percentage'], 50)


