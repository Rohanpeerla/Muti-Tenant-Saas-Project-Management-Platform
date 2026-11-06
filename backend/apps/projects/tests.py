import datetime
import uuid
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from apps.workspaces.models import Workspace, WorkspaceMembership
from .models import Project

User = get_user_model()


class ProjectModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.member = User.objects.create_user(email='member@test.com', username='member', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='outsider', password='Password123!')

        self.workspace = Workspace.objects.create(name='SprintSync Org', slug='sprintsync', owner=self.owner)
        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
            status=WorkspaceMembership.Status.ACTIVE
        )

    def test_project_creation(self):
        today = datetime.date.today()
        due = today + datetime.timedelta(days=30)
        proj = Project.objects.create(
            workspace=self.workspace,
            name='Mobile App Redesign',
            slug='mobile-app',
            description='Redesign native iOS & Android apps',
            owner=self.member,
            status=Project.Status.ACTIVE,
            priority=Project.Priority.HIGH,
            start_date=today,
            due_date=due
        )
        self.assertIsInstance(proj.id, uuid.UUID)
        self.assertEqual(proj.workspace, self.workspace)
        self.assertEqual(proj.owner, self.member)
        self.assertEqual(proj.status, Project.Status.ACTIVE)
        self.assertEqual(proj.priority, Project.Priority.HIGH)
        self.assertEqual(str(proj), 'Mobile App Redesign (sprintsync/mobile-app)')

    def test_workspace_owner_can_own_project(self):
        proj = Project.objects.create(
            workspace=self.workspace,
            name='Backend Core',
            slug='backend-core',
            owner=self.owner
        )
        self.assertEqual(proj.owner, self.owner)

    def test_unique_project_slug_within_workspace(self):
        Project.objects.create(workspace=self.workspace, name='Proj 1', slug='unique-slug', owner=self.owner)
        with self.assertRaises((IntegrityError, ValidationError)):
            Project.objects.create(workspace=self.workspace, name='Proj 2', slug='unique-slug', owner=self.owner)

    def test_same_slug_allowed_in_different_workspaces(self):
        ws2 = Workspace.objects.create(name='Other Org', slug='other-org', owner=self.owner)
        p1 = Project.objects.create(workspace=self.workspace, name='Proj 1', slug='shared-slug', owner=self.owner)
        p2 = Project.objects.create(workspace=ws2, name='Proj 2', slug='shared-slug', owner=self.owner)
        self.assertEqual(p1.slug, p2.slug)
        self.assertNotEqual(p1.workspace, p2.workspace)

    def test_invalid_owner_membership_rejected(self):
        # Outsider does not belong to self.workspace
        with self.assertRaises(ValidationError):
            Project.objects.create(
                workspace=self.workspace,
                name='Unauthorized Project',
                slug='unauthorized',
                owner=self.outsider
            )

    def test_due_date_preceding_start_date_rejected(self):
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        with self.assertRaises(ValidationError):
            Project.objects.create(
                workspace=self.workspace,
                name='Invalid Dates',
                slug='invalid-dates',
                owner=self.owner,
                start_date=today,
                due_date=yesterday
            )


class ProjectAPITests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        self.client = APIClient()
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.pm = User.objects.create_user(email='pm@test.com', username='pm', password='Password123!')
        self.member = User.objects.create_user(email='member@test.com', username='member', password='Password123!')
        self.viewer = User.objects.create_user(email='viewer@test.com', username='viewer', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='outsider', password='Password123!')

        self.workspace = Workspace.objects.create(name='SprintSync Org', slug='sprintsync', owner=self.owner)
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.owner, role=WorkspaceMembership.Role.OWNER, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.pm, role=WorkspaceMembership.Role.PROJECT_MANAGER, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.member, role=WorkspaceMembership.Role.MEMBER, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.viewer, role=WorkspaceMembership.Role.VIEWER, status=WorkspaceMembership.Status.ACTIVE)

        self.project = Project.objects.create(
            workspace=self.workspace,
            name='Core Platform',
            slug='core-platform',
            key='CORE',
            owner=self.owner,
            status=Project.Status.ACTIVE
        )

    def auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_create_project_success(self):
        self.auth(self.pm)
        payload = {
            'name': 'Customer Portal',
            'key': 'PORT',
            'description': 'Self-service portal',
            'status': 'ACTIVE',
            'priority': 'HIGH',
        }
        res = self.client.post(f'/api/workspaces/{self.workspace.id}/projects/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['name'], 'Customer Portal')
        self.assertEqual(res.data['key'], 'PORT')

        # Verify default board was created
        created_proj = Project.objects.get(id=res.data['id'])
        self.assertTrue(created_proj.boards.filter(is_default=True).exists())
        # Verify creator was assigned ProjectManager
        self.assertTrue(created_proj.memberships.filter(user=self.pm, role='PROJECT_MANAGER').exists())

    def test_viewer_cannot_create_project(self):
        self.auth(self.viewer)
        res = self.client.post(f'/api/workspaces/{self.workspace.id}/projects/', {'name': 'Unauthorized'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_list_workspace_projects_with_filters(self):
        self.auth(self.member)
        res = self.client.get(f'/api/workspaces/{self.workspace.id}/projects/?search=Core')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['key'], 'CORE')

    def test_cross_tenant_project_access_rejected(self):
        self.auth(self.outsider)
        res = self.client.get(f'/api/projects/{self.project.id}/')
        self.assertEqual(res.status_code, 403)

    def test_project_members_management(self):
        self.auth(self.owner)
        # Add member to project
        add_res = self.client.post(
            f'/api/projects/{self.project.id}/members/',
            {'email': self.member.email, 'role': 'MEMBER'},
            format='json'
        )
        self.assertEqual(add_res.status_code, 201)
        membership_id = add_res.data['id']

        # List members
        list_res = self.client.get(f'/api/projects/{self.project.id}/members/')
        self.assertEqual(list_res.status_code, 200)
        self.assertGreaterEqual(len(list_res.data), 1)

        # Remove member
        del_res = self.client.delete(f'/api/projects/{self.project.id}/members/{membership_id}/')
        self.assertEqual(del_res.status_code, 200)

