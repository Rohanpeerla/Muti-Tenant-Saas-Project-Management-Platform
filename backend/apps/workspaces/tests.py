import uuid
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Workspace, WorkspaceMembership

User = get_user_model()


class WorkspaceModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@acme.com',
            username='owner',
            password='Password123!'
        )
        self.member = User.objects.create_user(
            email='member@acme.com',
            username='member',
            password='Password123!'
        )

    def test_workspace_creation(self):
        ws = Workspace.objects.create(
            name='Acme Corp',
            slug='acme-corp',
            description='Primary organization workspace',
            owner=self.owner
        )
        self.assertIsInstance(ws.id, uuid.UUID)
        self.assertEqual(ws.name, 'Acme Corp')
        self.assertEqual(ws.slug, 'acme-corp')
        self.assertEqual(ws.owner, self.owner)
        self.assertTrue(ws.is_active)
        self.assertEqual(str(ws), 'Acme Corp (acme-corp)')

    def test_workspace_unique_slug(self):
        Workspace.objects.create(
            name='Workspace One',
            slug='shared-slug',
            owner=self.owner
        )
        with self.assertRaises(IntegrityError):
            Workspace.objects.create(
                name='Workspace Two',
                slug='shared-slug',
                owner=self.owner
            )

    def test_user_can_own_multiple_workspaces(self):
        ws1 = Workspace.objects.create(name='WS 1', slug='ws-1', owner=self.owner)
        ws2 = Workspace.objects.create(name='WS 2', slug='ws-2', owner=self.owner)
        self.assertEqual(self.owner.owned_workspaces.count(), 2)
        self.assertIn(ws1, self.owner.owned_workspaces.all())
        self.assertIn(ws2, self.owner.owned_workspaces.all())

    def test_workspace_membership_creation(self):
        ws = Workspace.objects.create(name='Acme Corp', slug='acme', owner=self.owner)
        membership = WorkspaceMembership.objects.create(
            workspace=ws,
            user=self.member,
            role=WorkspaceMembership.Role.PROJECT_MANAGER,
            status=WorkspaceMembership.Status.ACTIVE
        )
        self.assertIsInstance(membership.id, uuid.UUID)
        self.assertEqual(membership.role, WorkspaceMembership.Role.PROJECT_MANAGER)
        self.assertEqual(membership.status, WorkspaceMembership.Status.ACTIVE)
        self.assertIn('PROJECT_MANAGER', str(membership))

    def test_duplicate_membership_prevention(self):
        ws = Workspace.objects.create(name='Acme Corp', slug='acme', owner=self.owner)
        WorkspaceMembership.objects.create(
            workspace=ws,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER
        )
        with self.assertRaises(IntegrityError):
            WorkspaceMembership.objects.create(
                workspace=ws,
                user=self.member,
                role=WorkspaceMembership.Role.ADMIN
            )

    def test_user_can_belong_to_multiple_workspaces(self):
        ws1 = Workspace.objects.create(name='Acme', slug='acme', owner=self.owner)
        ws2 = Workspace.objects.create(name='Beta', slug='beta', owner=self.owner)

        m1 = WorkspaceMembership.objects.create(workspace=ws1, user=self.member, role=WorkspaceMembership.Role.MEMBER)
        m2 = WorkspaceMembership.objects.create(workspace=ws2, user=self.member, role=WorkspaceMembership.Role.ADMIN)

        self.assertEqual(self.member.workspace_memberships.count(), 2)
        self.assertEqual(m1.role, WorkspaceMembership.Role.MEMBER)
        self.assertEqual(m2.role, WorkspaceMembership.Role.ADMIN)

    def test_valid_role_and_status_choices(self):
        roles = [
            WorkspaceMembership.Role.OWNER,
            WorkspaceMembership.Role.ADMIN,
            WorkspaceMembership.Role.PROJECT_MANAGER,
            WorkspaceMembership.Role.MEMBER,
            WorkspaceMembership.Role.VIEWER,
        ]
        statuses = [
            WorkspaceMembership.Status.INVITED,
            WorkspaceMembership.Status.ACTIVE,
            WorkspaceMembership.Status.SUSPENDED,
        ]
        self.assertEqual(len(roles), 5)
        self.assertEqual(len(statuses), 3)


class WorkspaceRBACAndTenantIsolationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Workspace A: Acme
        self.user_a_owner = User.objects.create_user(email='owner_a@acme.com', username='owner_a', password='Password123!')
        self.user_a_admin = User.objects.create_user(email='admin_a@acme.com', username='admin_a', password='Password123!')
        self.user_a_pm = User.objects.create_user(email='pm_a@acme.com', username='pm_a', password='Password123!')
        self.user_a_member = User.objects.create_user(email='member_a@acme.com', username='member_a', password='Password123!')
        self.user_a_viewer = User.objects.create_user(email='viewer_a@acme.com', username='viewer_a', password='Password123!')
        self.user_a_suspended = User.objects.create_user(email='suspended_a@acme.com', username='suspended_a', password='Password123!')
        self.user_a_invited = User.objects.create_user(email='invited_a@acme.com', username='invited_a', password='Password123!')

        self.workspace_a = Workspace.objects.create(name='Acme Workspace', slug='acme-ws', owner=self.user_a_owner)
        self.m_a_owner = WorkspaceMembership.objects.create(workspace=self.workspace_a, user=self.user_a_owner, role=WorkspaceMembership.Role.OWNER, status=WorkspaceMembership.Status.ACTIVE)
        self.m_a_admin = WorkspaceMembership.objects.create(workspace=self.workspace_a, user=self.user_a_admin, role=WorkspaceMembership.Role.ADMIN, status=WorkspaceMembership.Status.ACTIVE)
        self.m_a_pm = WorkspaceMembership.objects.create(workspace=self.workspace_a, user=self.user_a_pm, role=WorkspaceMembership.Role.PROJECT_MANAGER, status=WorkspaceMembership.Status.ACTIVE)
        self.m_a_member = WorkspaceMembership.objects.create(workspace=self.workspace_a, user=self.user_a_member, role=WorkspaceMembership.Role.MEMBER, status=WorkspaceMembership.Status.ACTIVE)
        self.m_a_viewer = WorkspaceMembership.objects.create(workspace=self.workspace_a, user=self.user_a_viewer, role=WorkspaceMembership.Role.VIEWER, status=WorkspaceMembership.Status.ACTIVE)
        self.m_a_suspended = WorkspaceMembership.objects.create(workspace=self.workspace_a, user=self.user_a_suspended, role=WorkspaceMembership.Role.MEMBER, status=WorkspaceMembership.Status.SUSPENDED)
        self.m_a_invited = WorkspaceMembership.objects.create(workspace=self.workspace_a, user=self.user_a_invited, role=WorkspaceMembership.Role.MEMBER, status=WorkspaceMembership.Status.INVITED)

        # Workspace B: Beta (Completely isolated)
        self.user_b_owner = User.objects.create_user(email='owner_b@beta.com', username='owner_b', password='Password123!')
        self.workspace_b = Workspace.objects.create(name='Beta Workspace', slug='beta-ws', owner=self.user_b_owner)
        self.m_b_owner = WorkspaceMembership.objects.create(workspace=self.workspace_b, user=self.user_b_owner, role=WorkspaceMembership.Role.OWNER, status=WorkspaceMembership.Status.ACTIVE)

        # Candidate user to be invited
        self.candidate = User.objects.create_user(email='candidate@test.com', username='candidate', password='Password123!')

    def authenticate_as(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_workspace_list_shows_only_active_memberships(self):
        self.authenticate_as(self.user_a_member)
        response = self.client.get('/api/workspaces/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        workspace_ids = [ws['id'] for ws in response.data]
        self.assertIn(str(self.workspace_a.id), workspace_ids)
        self.assertNotIn(str(self.workspace_b.id), workspace_ids)

    def test_suspended_user_cannot_see_workspace(self):
        self.authenticate_as(self.user_a_suspended)
        response = self.client.get('/api/workspaces/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        workspace_ids = [ws['id'] for ws in response.data]
        self.assertNotIn(str(self.workspace_a.id), workspace_ids)

    def test_invited_user_cannot_see_workspace(self):
        self.authenticate_as(self.user_a_invited)
        response = self.client.get('/api/workspaces/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        workspace_ids = [ws['id'] for ws in response.data]
        self.assertNotIn(str(self.workspace_a.id), workspace_ids)

    def test_active_member_can_view_workspace_members(self):
        self.authenticate_as(self.user_a_viewer)
        response = self.client.get(f'/api/workspaces/{self.workspace_a.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 5)

    def test_cross_tenant_view_members_blocked(self):
        # User B attempts to access Workspace A's member list
        self.authenticate_as(self.user_b_owner)
        response = self.client.get(f'/api/workspaces/{self.workspace_a.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_add_member(self):
        self.authenticate_as(self.user_a_owner)
        payload = {
            'email': 'candidate@test.com',
            'role': WorkspaceMembership.Role.MEMBER
        }
        response = self.client.post(f'/api/workspaces/{self.workspace_a.id}/members/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['email'], 'candidate@test.com')

    def test_admin_can_add_member(self):
        self.authenticate_as(self.user_a_admin)
        payload = {
            'email': 'candidate@test.com',
            'role': WorkspaceMembership.Role.PROJECT_MANAGER
        }
        response = self.client.post(f'/api/workspaces/{self.workspace_a.id}/members/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_member_and_viewer_cannot_add_members(self):
        # Regular member
        self.authenticate_as(self.user_a_member)
        payload = {'email': 'candidate@test.com', 'role': WorkspaceMembership.Role.MEMBER}
        response = self.client.post(f'/api/workspaces/{self.workspace_a.id}/members/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Viewer
        self.authenticate_as(self.user_a_viewer)
        response = self.client.post(f'/api/workspaces/{self.workspace_a.id}/members/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_tenant_add_member_blocked(self):
        # User B attempts to add member to Workspace A
        self.authenticate_as(self.user_b_owner)
        payload = {'email': 'candidate@test.com', 'role': WorkspaceMembership.Role.MEMBER}
        response = self.client.post(f'/api/workspaces/{self.workspace_a.id}/members/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_assign_owner_role(self):
        # Admin cannot promote someone to OWNER
        self.authenticate_as(self.user_a_admin)
        payload = {'email': 'candidate@test.com', 'role': WorkspaceMembership.Role.OWNER}
        response = self.client.post(f'/api/workspaces/{self.workspace_a.id}/members/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('role', response.data)

    def test_user_cannot_escalate_own_role(self):
        # Admin attempts to promote themselves to OWNER
        self.authenticate_as(self.user_a_admin)
        payload = {'role': WorkspaceMembership.Role.OWNER}
        response = self.client.patch(
            f'/api/workspaces/{self.workspace_a.id}/members/{self.m_a_admin.id}/',
            payload,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_cannot_modify_an_owner(self):
        self.authenticate_as(self.user_a_admin)
        payload = {'role': WorkspaceMembership.Role.MEMBER}
        response = self.client.patch(
            f'/api/workspaces/{self.workspace_a.id}/members/{self.m_a_owner.id}/',
            payload,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_last_owner_cannot_be_demoted(self):
        self.authenticate_as(self.user_a_owner)
        payload = {'role': WorkspaceMembership.Role.MEMBER}
        response = self.client.patch(
            f'/api/workspaces/{self.workspace_a.id}/members/{self.m_a_owner.id}/',
            payload,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_last_owner_cannot_be_removed(self):
        self.authenticate_as(self.user_a_owner)
        response = self.client.delete(
            f'/api/workspaces/{self.workspace_a.id}/members/{self.m_a_owner.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_remove_regular_member(self):
        self.authenticate_as(self.user_a_admin)
        response = self.client.delete(
            f'/api/workspaces/{self.workspace_a.id}/members/{self.m_a_member.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(WorkspaceMembership.objects.filter(id=self.m_a_member.id).exists())

    def test_cross_tenant_remove_member_blocked(self):
        # User B attempts to remove User A's member from Workspace A
        self.authenticate_as(self.user_b_owner)
        response = self.client.delete(
            f'/api/workspaces/{self.workspace_a.id}/members/{self.m_a_member.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class WorkspaceStage4ManagementAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.owner = User.objects.create_user(email='owner@testcorp.com', username='test_owner', password='Password123!')
        self.admin = User.objects.create_user(email='admin@testcorp.com', username='test_admin', password='Password123!')
        self.member = User.objects.create_user(email='member@testcorp.com', username='test_member', password='Password123!')
        self.viewer = User.objects.create_user(email='viewer@testcorp.com', username='test_viewer', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='test_outsider', password='Password123!')

        self.workspace = Workspace.objects.create(
            name='Test Corp Workspace',
            slug='test-corp-workspace',
            description='Initial description',
            owner=self.owner
        )
        self.m_owner = WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.owner,
            role=WorkspaceMembership.Role.OWNER,
            status=WorkspaceMembership.Status.ACTIVE
        )
        self.m_admin = WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.admin,
            role=WorkspaceMembership.Role.ADMIN,
            status=WorkspaceMembership.Status.ACTIVE
        )
        self.m_member = WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
            status=WorkspaceMembership.Status.ACTIVE
        )
        self.m_viewer = WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.viewer,
            role=WorkspaceMembership.Role.VIEWER,
            status=WorkspaceMembership.Status.ACTIVE
        )

    def authenticate_as(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_create_workspace_success(self):
        self.authenticate_as(self.outsider)
        payload = {
            'name': 'Outsider New Org',
            'description': 'A new enterprise workspace'
        }
        response = self.client.post('/api/workspaces/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Outsider New Org')
        self.assertEqual(response.data['slug'], 'outsider-new-org')
        self.assertEqual(response.data['current_user_role'], 'OWNER')
        self.assertEqual(response.data['member_count'], 1)

        # Verify database state
        ws = Workspace.objects.get(id=response.data['id'])
        self.assertEqual(ws.owner, self.outsider)
        membership = WorkspaceMembership.objects.get(workspace=ws, user=self.outsider)
        self.assertEqual(membership.role, WorkspaceMembership.Role.OWNER)
        self.assertEqual(membership.status, WorkspaceMembership.Status.ACTIVE)
        self.assertIsNotNone(membership.joined_at)

    def test_create_workspace_auto_slug_collision_resolution(self):
        self.authenticate_as(self.outsider)
        # Create first
        self.client.post('/api/workspaces/', {'name': 'Duplicate Name'}, format='json')
        # Create second with same name
        response2 = self.client.post('/api/workspaces/', {'name': 'Duplicate Name'}, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response2.data['slug'].startswith('duplicate-name-'))

    def test_create_workspace_unauthenticated_rejected(self):
        response = self.client.post('/api/workspaces/', {'name': 'No Auth'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_workspace_blank_name_rejected(self):
        self.authenticate_as(self.outsider)
        response = self.client.post('/api/workspaces/', {'name': '   '}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_workspace_detail_as_member(self):
        self.authenticate_as(self.member)
        response = self.client.get(f'/api/workspaces/{self.workspace.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Test Corp Workspace')
        self.assertEqual(response.data['current_user_role'], 'MEMBER')
        self.assertEqual(response.data['member_count'], 4)

    def test_get_workspace_detail_as_outsider_forbidden(self):
        self.authenticate_as(self.outsider)
        response = self.client.get(f'/api/workspaces/{self.workspace.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_workspace_as_owner_success(self):
        self.authenticate_as(self.owner)
        payload = {'name': 'Updated Corp Name', 'description': 'Updated description'}
        response = self.client.patch(f'/api/workspaces/{self.workspace.id}/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Corp Name')
        self.assertEqual(response.data['description'], 'Updated description')

    def test_update_workspace_as_admin_success(self):
        self.authenticate_as(self.admin)
        payload = {'description': 'Admin updated description'}
        response = self.client.patch(f'/api/workspaces/{self.workspace.id}/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['description'], 'Admin updated description')

    def test_update_workspace_as_member_and_viewer_forbidden(self):
        self.authenticate_as(self.member)
        response = self.client.patch(f'/api/workspaces/{self.workspace.id}/', {'name': 'Hacked'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate_as(self.viewer)
        response = self.client.patch(f'/api/workspaces/{self.workspace.id}/', {'name': 'Hacked'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_workspace_as_admin_forbidden(self):
        self.authenticate_as(self.admin)
        response = self.client.delete(f'/api/workspaces/{self.workspace.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Workspace.objects.filter(id=self.workspace.id).exists())

    def test_delete_workspace_as_owner_success(self):
        self.authenticate_as(self.owner)
        response = self.client.delete(f'/api/workspaces/{self.workspace.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Workspace.objects.filter(id=self.workspace.id).exists())
        self.assertFalse(WorkspaceMembership.objects.filter(workspace_id=self.workspace.id).exists())

    def test_suspend_and_reactivate_member(self):
        self.authenticate_as(self.admin)
        # Suspend member
        response = self.client.patch(
            f'/api/workspaces/{self.workspace.id}/members/{self.m_member.id}/',
            {'status': WorkspaceMembership.Status.SUSPENDED},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], WorkspaceMembership.Status.SUSPENDED)

        # Verify suspended member is now blocked from workspace
        self.authenticate_as(self.member)
        access_res = self.client.get(f'/api/workspaces/{self.workspace.id}/')
        self.assertEqual(access_res.status_code, status.HTTP_403_FORBIDDEN)

        # Reactivate member
        self.authenticate_as(self.admin)
        reactivate_res = self.client.patch(
            f'/api/workspaces/{self.workspace.id}/members/{self.m_member.id}/',
            {'status': WorkspaceMembership.Status.ACTIVE},
            format='json'
        )
        self.assertEqual(reactivate_res.status_code, status.HTTP_200_OK)
        self.assertEqual(reactivate_res.data['status'], WorkspaceMembership.Status.ACTIVE)

        # Verify access restored
        self.authenticate_as(self.member)
        restore_res = self.client.get(f'/api/workspaces/{self.workspace.id}/')
        self.assertEqual(restore_res.status_code, status.HTTP_200_OK)

    def test_invited_user_can_view_and_accept_invitation(self):
        # 1. Admin invites outsider
        self.authenticate_as(self.admin)
        invite_res = self.client.post(
            f'/api/workspaces/{self.workspace.id}/members/',
            {'email': self.outsider.email, 'role': WorkspaceMembership.Role.MEMBER},
            format='json'
        )
        self.assertEqual(invite_res.status_code, status.HTTP_201_CREATED)
        membership_id = invite_res.data['id']
        self.assertEqual(invite_res.data['status'], 'INVITED')

        # 2. Outsider cannot see workspace in active workspace list
        self.authenticate_as(self.outsider)
        ws_res = self.client.get('/api/workspaces/')
        self.assertEqual(len(ws_res.data), 0)

        # 3. Outsider views pending invitations
        invites_res = self.client.get('/api/workspaces/invitations/')
        self.assertEqual(invites_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(invites_res.data), 1)
        self.assertEqual(invites_res.data[0]['id'], membership_id)
        self.assertEqual(invites_res.data[0]['workspace']['name'], self.workspace.name)

        # 4. Outsider accepts the invitation
        accept_res = self.client.post(f'/api/workspaces/invitations/{membership_id}/accept/')
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_res.data['membership']['status'], 'ACTIVE')

        # 5. Outsider now sees the workspace as an active member
        ws_res2 = self.client.get('/api/workspaces/')
        self.assertEqual(len(ws_res2.data), 1)
        self.assertEqual(ws_res2.data[0]['id'], str(self.workspace.id))
        self.assertEqual(ws_res2.data[0]['current_user_role'], 'MEMBER')

    def test_invited_user_can_decline_invitation(self):
        # 1. Admin invites outsider
        self.authenticate_as(self.admin)
        invite_res = self.client.post(
            f'/api/workspaces/{self.workspace.id}/members/',
            {'email': self.outsider.email, 'role': WorkspaceMembership.Role.VIEWER},
            format='json'
        )
        membership_id = invite_res.data['id']

        # 2. Outsider declines invitation
        self.authenticate_as(self.outsider)
        decline_res = self.client.post(f'/api/workspaces/invitations/{membership_id}/decline/')
        self.assertEqual(decline_res.status_code, status.HTTP_200_OK)

        # 3. Invitation is gone
        invites_res = self.client.get('/api/workspaces/invitations/')
        self.assertEqual(len(invites_res.data), 0)
        self.assertFalse(WorkspaceMembership.objects.filter(id=membership_id).exists())

    def test_owner_and_admin_can_view_audit_logs_while_member_and_viewer_rejected(self):
        from apps.workspaces.models import log_audit_event
        log_audit_event(
            workspace=self.workspace,
            actor=self.owner,
            action='SECURITY_TEST',
            entity_type='Test',
            description='Test event'
        )

        # OWNER can view audit logs
        self.authenticate_as(self.owner)
        owner_res = self.client.get(f'/api/workspaces/{self.workspace.id}/audit-logs/')
        self.assertEqual(owner_res.status_code, status.HTTP_200_OK)
        # Check either paginated or list
        data = owner_res.data.get('results', owner_res.data)
        self.assertTrue(len(data) >= 1)

        # ADMIN can view audit logs
        self.authenticate_as(self.admin)
        admin_res = self.client.get(f'/api/workspaces/{self.workspace.id}/audit-logs/')
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)

        # MEMBER cannot view audit logs
        self.authenticate_as(self.member)
        mem_res = self.client.get(f'/api/workspaces/{self.workspace.id}/audit-logs/')
        self.assertEqual(mem_res.status_code, status.HTTP_403_FORBIDDEN)

        # VIEWER cannot view audit logs
        self.authenticate_as(self.viewer)
        view_res = self.client.get(f'/api/workspaces/{self.workspace.id}/audit-logs/')
        self.assertEqual(view_res.status_code, status.HTTP_403_FORBIDDEN)

        # Cross-tenant outsider cannot view audit logs
        self.authenticate_as(self.outsider)
        cross_res = self.client.get(f'/api/workspaces/{self.workspace.id}/audit-logs/')
        self.assertEqual(cross_res.status_code, status.HTTP_403_FORBIDDEN)



