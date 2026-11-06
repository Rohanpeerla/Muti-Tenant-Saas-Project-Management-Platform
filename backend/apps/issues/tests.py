import uuid
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.projects.models import Project
from apps.boards.models import Board
from .models import Issue

User = get_user_model()


class IssueModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.dev = User.objects.create_user(email='dev@test.com', username='dev', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='outsider', password='Password123!')

        self.workspace1 = Workspace.objects.create(name='Acme Corp', slug='acme', owner=self.owner)
        self.workspace2 = Workspace.objects.create(name='Beta Inc', slug='beta', owner=self.outsider)

        WorkspaceMembership.objects.create(
            workspace=self.workspace1,
            user=self.dev,
            role=WorkspaceMembership.Role.MEMBER,
            status=WorkspaceMembership.Status.ACTIVE
        )

        self.project1 = Project.objects.create(
            workspace=self.workspace1,
            name='Acme Web',
            slug='acme-web',
            owner=self.owner
        )
        self.project2 = Project.objects.create(
            workspace=self.workspace2,
            name='Beta App',
            slug='beta-app',
            owner=self.outsider
        )

        self.board1 = Board.objects.create(
            workspace=self.workspace1,
            project=self.project1,
            name='Sprint 1 Board'
        )
        self.board2 = Board.objects.create(
            workspace=self.workspace2,
            project=self.project2,
            name='Beta Board'
        )

    def test_issue_creation(self):
        issue = Issue.objects.create(
            workspace=self.workspace1,
            project=self.project1,
            board=self.board1,
            title='Implement JWT Authentication',
            description='Configure token refresh and access lifetimes',
            issue_key='ACM-101',
            issue_type=Issue.IssueType.TASK,
            status=Issue.Status.IN_PROGRESS,
            priority=Issue.Priority.HIGH,
            reporter=self.owner,
            assignee=self.dev,
            position=1
        )
        self.assertIsInstance(issue.id, uuid.UUID)
        self.assertEqual(issue.issue_key, 'ACM-101')
        self.assertEqual(issue.status, Issue.Status.IN_PROGRESS)
        self.assertEqual(issue.priority, Issue.Priority.HIGH)
        self.assertEqual(issue.reporter, self.owner)
        self.assertEqual(issue.assignee, self.dev)
        self.assertEqual(str(issue), '[ACM-101] Implement JWT Authentication')

    def test_unique_issue_key_within_workspace(self):
        Issue.objects.create(
            workspace=self.workspace1,
            project=self.project1,
            title='Issue A',
            issue_key='KEY-1',
            reporter=self.owner
        )
        with self.assertRaises((IntegrityError, ValidationError)):
            Issue.objects.create(
                workspace=self.workspace1,
                project=self.project1,
                title='Issue B',
                issue_key='KEY-1',
                reporter=self.owner
            )

    def test_same_issue_key_allowed_in_different_workspaces(self):
        i1 = Issue.objects.create(
            workspace=self.workspace1,
            project=self.project1,
            title='Issue 1',
            issue_key='TASK-1',
            reporter=self.owner
        )
        i2 = Issue.objects.create(
            workspace=self.workspace2,
            project=self.project2,
            title='Issue 2',
            issue_key='TASK-1',
            reporter=self.outsider
        )
        self.assertEqual(i1.issue_key, i2.issue_key)
        self.assertNotEqual(i1.workspace, i2.workspace)

    def test_reporter_must_be_workspace_member(self):
        with self.assertRaises(ValidationError):
            Issue.objects.create(
                workspace=self.workspace1,
                project=self.project1,
                title='Unauthorized reporter',
                issue_key='FAIL-1',
                reporter=self.outsider
            )

    def test_assignee_must_be_workspace_member(self):
        with self.assertRaises(ValidationError):
            Issue.objects.create(
                workspace=self.workspace1,
                project=self.project1,
                title='Unauthorized assignee',
                issue_key='FAIL-2',
                reporter=self.owner,
                assignee=self.outsider
            )

    def test_board_project_workspace_consistency_enforced(self):
        # Attempt to link board from workspace2 to issue in workspace1
        with self.assertRaises(ValidationError):
            Issue.objects.create(
                workspace=self.workspace1,
                project=self.project1,
                board=self.board2,
                title='Inconsistent board',
                issue_key='FAIL-3',
                reporter=self.owner
            )

    def test_issue_auto_aligns_workspace_from_project(self):
        issue = Issue.objects.create(
            project=self.project1,
            title='Auto-aligned Workspace Issue',
            issue_key='AUTO-1',
            reporter=self.owner
        )
        self.assertEqual(issue.workspace, self.project1.workspace)


class IssueAPITests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        self.client = APIClient()
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.dev = User.objects.create_user(email='dev@test.com', username='dev', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='outsider', password='Password123!')

        self.workspace = Workspace.objects.create(name='SprintSync Org', slug='sprintsync', owner=self.owner)
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.owner, role=WorkspaceMembership.Role.OWNER, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.dev, role=WorkspaceMembership.Role.MEMBER, status=WorkspaceMembership.Status.ACTIVE)

        self.project = Project.objects.create(
            workspace=self.workspace,
            name='Acme Web',
            slug='acme-web',
            key='WEB',
            owner=self.owner
        )
        self.board = Board.objects.create(
            workspace=self.workspace,
            project=self.project,
            name='Web Board'
        )

    def auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_create_issue_with_auto_key(self):
        self.auth(self.dev)
        payload = {
            'title': 'Build Login Page',
            'description': 'React and Tailwind implementation',
            'status': 'TODO',
            'priority': 'HIGH',
            'board_id': str(self.board.id),
        }
        res = self.client.post(f'/api/projects/{self.project.id}/issues/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['title'], 'Build Login Page')
        self.assertTrue(res.data['issue_key'].startswith('WEB-'))
        self.assertEqual(res.data['reporter']['email'], self.dev.email)

    def test_move_issue_kanban(self):
        self.auth(self.dev)
        issue = Issue.objects.create(
            workspace=self.workspace,
            project=self.project,
            board=self.board,
            title='Task To Move',
            issue_key='WEB-99',
            status='TODO',
            reporter=self.dev,
            position=0
        )

        # Move to IN_PROGRESS position 1
        res = self.client.post(
            f'/api/issues/{issue.id}/move/',
            {'status': 'IN_PROGRESS', 'position': 1},
            format='json'
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'IN_PROGRESS')
        self.assertEqual(res.data['position'], 1)

    def test_assign_outsider_rejected(self):
        self.auth(self.owner)
        payload = {
            'title': 'Test Assign Outsider',
            'assignee_id': str(self.outsider.id),
        }
        res = self.client.post(f'/api/projects/{self.project.id}/issues/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('assignee_id', res.data)


class CollaborationAndAttachmentAPITests(TestCase):
    def setUp(self):
        import os
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.test import APIClient
        from apps.issues.models import Issue, Comment, IssueAttachment, IssueActivity

        self.client = APIClient()
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.dev = User.objects.create_user(email='dev@test.com', username='dev', password='Password123!')
        self.viewer = User.objects.create_user(email='viewer@test.com', username='viewer', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='outsider', password='Password123!')

        self.workspace1 = Workspace.objects.create(name='SprintSync Org', slug='sprintsync', owner=self.owner)
        self.workspace2 = Workspace.objects.create(name='Other Org', slug='other', owner=self.outsider)

        WorkspaceMembership.objects.create(workspace=self.workspace1, user=self.owner, role=WorkspaceMembership.Role.OWNER, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace1, user=self.dev, role=WorkspaceMembership.Role.MEMBER, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace1, user=self.viewer, role=WorkspaceMembership.Role.VIEWER, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace2, user=self.outsider, role=WorkspaceMembership.Role.OWNER, status=WorkspaceMembership.Status.ACTIVE)

        self.project = Project.objects.create(workspace=self.workspace1, name='Web Platform', slug='web', key='WEB', owner=self.owner)
        self.issue = Issue.objects.create(workspace=self.workspace1, project=self.project, title='Task for testing', reporter=self.dev)

    def auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_create_and_edit_and_delete_comment(self):
        # Dev creates comment
        self.auth(self.dev)
        create_res = self.client.post(
            f'/api/issues/{self.issue.id}/comments/',
            {'content': 'Looks good, starting development now.'},
            format='json'
        )
        self.assertEqual(create_res.status_code, 201)
        comment_id = create_res.data['id']
        self.assertEqual(create_res.data['content'], 'Looks good, starting development now.')

        # Dev edits comment
        edit_res = self.client.patch(
            f'/api/comments/{comment_id}/',
            {'content': 'Updated: Finished initial implementation.'},
            format='json'
        )
        self.assertEqual(edit_res.status_code, 200)
        self.assertEqual(edit_res.data['content'], 'Updated: Finished initial implementation.')
        self.assertTrue(edit_res.data['is_edited'])

        # Viewer cannot edit or delete comment
        self.auth(self.viewer)
        viewer_edit_res = self.client.patch(
            f'/api/comments/{comment_id}/',
            {'content': 'Viewer trying to edit.'},
            format='json'
        )
        self.assertEqual(viewer_edit_res.status_code, 403)

        # Outsider from workspace2 cannot access comment
        self.auth(self.outsider)
        outsider_res = self.client.get(f'/api/issues/{self.issue.id}/comments/')
        self.assertEqual(outsider_res.status_code, 403)

        # Owner can moderate/delete comment
        self.auth(self.owner)
        del_res = self.client.delete(f'/api/comments/{comment_id}/')
        self.assertEqual(del_res.status_code, 200)

    def test_viewer_cannot_post_comment(self):
        self.auth(self.viewer)
        res = self.client.post(
            f'/api/issues/{self.issue.id}/comments/',
            {'content': 'Viewer attempting comment'},
            format='json'
        )
        self.assertEqual(res.status_code, 403)

    def test_attachment_upload_download_and_deletion(self):
        import os
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.auth(self.dev)
        file_content = b'Sample file attachment content'
        upload_file = SimpleUploadedFile('document.pdf', file_content, content_type='application/pdf')

        # Upload
        res = self.client.post(
            f'/api/issues/{self.issue.id}/attachments/',
            {'file': upload_file},
            format='multipart'
        )
        self.assertEqual(res.status_code, 201)
        attach_id = res.data['id']
        self.assertEqual(res.data['original_filename'], 'document.pdf')

        # Download authorized
        dl_res = self.client.get(f'/api/attachments/{attach_id}/download/')
        self.assertEqual(dl_res.status_code, 200)
        _ = b''.join(dl_res.streaming_content)

        # Download cross-tenant unauthorized
        self.auth(self.outsider)
        cross_res = self.client.get(f'/api/attachments/{attach_id}/download/')
        self.assertEqual(cross_res.status_code, 403)

        # Delete attachment
        self.auth(self.dev)
        del_res = self.client.delete(f'/api/attachments/{attach_id}/')
        self.assertEqual(del_res.status_code, 200)

    def test_unsupported_file_extension_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.auth(self.dev)
        bad_file = SimpleUploadedFile('script.exe', b'malicious payload', content_type='application/x-dosexec')
        res = self.client.post(
            f'/api/issues/{self.issue.id}/attachments/',
            {'file': bad_file},
            format='multipart'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('Unsupported file extension', res.data['error'])

    def test_activity_timeline_recorded(self):
        self.auth(self.dev)
        # Create comment generates activity
        self.client.post(
            f'/api/issues/{self.issue.id}/comments/',
            {'content': 'Activity tracking comment'},
            format='json'
        )

        # Update status generates activity
        self.client.patch(
            f'/api/issues/{self.issue.id}/',
            {'status': 'IN_PROGRESS'},
            format='json'
        )

        # Query activities
        act_res = self.client.get(f'/api/issues/{self.issue.id}/activities/')
        self.assertEqual(act_res.status_code, 200)
        act_types = [a['activity_type'] for a in act_res.data]
        self.assertIn('STATUS_CHANGED', act_types)
        self.assertIn('COMMENT_ADDED', act_types)


