import uuid
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from apps.workspaces.models import Workspace
from apps.projects.models import Project
from .models import Board

User = get_user_model()


class BoardModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.workspace1 = Workspace.objects.create(name='Workspace 1', slug='ws-1', owner=self.owner)
        self.workspace2 = Workspace.objects.create(name='Workspace 2', slug='ws-2', owner=self.owner)

        self.project1 = Project.objects.create(
            workspace=self.workspace1,
            name='Project 1',
            slug='proj-1',
            owner=self.owner
        )

    def test_board_creation(self):
        board = Board.objects.create(
            workspace=self.workspace1,
            project=self.project1,
            name='Kanban Board',
            description='Primary sprint board',
            is_default=True,
            position=1
        )
        self.assertIsInstance(board.id, uuid.UUID)
        self.assertEqual(board.workspace, self.workspace1)
        self.assertEqual(board.project, self.project1)
        self.assertEqual(board.name, 'Kanban Board')
        self.assertTrue(board.is_default)
        self.assertEqual(str(board), 'Kanban Board - Project 1')

    def test_board_auto_aligns_workspace(self):
        board = Board.objects.create(
            project=self.project1,
            name='Auto-aligned Board'
        )
        self.assertEqual(board.workspace, self.project1.workspace)

    def test_cross_workspace_board_association_rejected(self):
        # Attempt to link board to workspace2 while project belongs to workspace1
        with self.assertRaises(ValidationError):
            Board.objects.create(
                workspace=self.workspace2,
                project=self.project1,
                name='Mismatched Board'
            )

    def test_duplicate_board_name_in_same_project_prevented(self):
        Board.objects.create(
            workspace=self.workspace1,
            project=self.project1,
            name='Sprint Board'
        )
        with self.assertRaises((IntegrityError, ValidationError)):
            Board.objects.create(
                workspace=self.workspace1,
                project=self.project1,
                name='Sprint Board'
            )

    def test_multiple_boards_per_project_with_different_names(self):
        b1 = Board.objects.create(workspace=self.workspace1, project=self.project1, name='Backlog Board')
        b2 = Board.objects.create(workspace=self.workspace1, project=self.project1, name='QA Board')
        self.assertEqual(self.project1.boards.count(), 2)
        self.assertIn(b1, self.project1.boards.all())
        self.assertIn(b2, self.project1.boards.all())


class BoardAPITests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.workspaces.models import WorkspaceMembership

        self.client = APIClient()
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.workspace = Workspace.objects.create(name='SprintSync Org', slug='sprintsync', owner=self.owner)
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.owner, role=WorkspaceMembership.Role.OWNER, status=WorkspaceMembership.Status.ACTIVE)

        self.project = Project.objects.create(
            workspace=self.workspace,
            name='Project 1',
            slug='proj-1',
            owner=self.owner
        )
        self.board = Board.objects.create(
            workspace=self.workspace,
            project=self.project,
            name='Engineering Board'
        )

    def auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_board_creation_seeds_default_columns(self):
        self.auth(self.owner)
        res = self.client.post(
            f'/api/projects/{self.project.id}/boards/',
            {'name': 'Design Board'},
            format='json'
        )
        self.assertEqual(res.status_code, 201)
        board_id = res.data['id']

        detail_res = self.client.get(f'/api/boards/{board_id}/')
        self.assertEqual(detail_res.status_code, 200)
        col_keys = [c['key'] for c in detail_res.data['columns']]
        self.assertIn('TODO', col_keys)
        self.assertIn('IN_PROGRESS', col_keys)
        self.assertIn('IN_REVIEW', col_keys)
        self.assertIn('DONE', col_keys)

    def test_add_and_update_custom_column(self):
        self.auth(self.owner)
        # Add column
        add_res = self.client.post(
            f'/api/boards/{self.board.id}/columns/',
            {'name': 'QA Testing', 'key': 'QA'},
            format='json'
        )
        self.assertEqual(add_res.status_code, 201)
        col_id = add_res.data['id']

        # Update column
        patch_res = self.client.patch(
            f'/api/boards/{self.board.id}/columns/{col_id}/',
            {'name': 'QA & Staging', 'position': 5},
            format='json'
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.data['name'], 'QA & Staging')

    def test_delete_column_without_tasks(self):
        self.auth(self.owner)
        col = self.board.columns.first()
        del_res = self.client.delete(f'/api/boards/{self.board.id}/columns/{col.id}/')
        self.assertEqual(del_res.status_code, 200)

    def test_reorder_columns_endpoint(self):
        self.auth(self.owner)
        cols = list(self.board.columns.all())
        reversed_ids = [str(c.id) for c in reversed(cols)]
        res = self.client.post(
            f'/api/boards/{self.board.id}/columns/reorder/',
            {'column_ids': reversed_ids},
            format='json'
        )
        self.assertEqual(res.status_code, 200)

    def test_workflow_transition_rules_and_enforcement(self):
        from apps.issues.models import Issue
        from apps.boards.models import WorkflowTransition

        self.auth(self.owner)
        col_todo = self.board.columns.filter(key='TODO').first()
        col_prog = self.board.columns.filter(key='IN_PROGRESS').first()
        col_done = self.board.columns.filter(key='DONE').first()

        # Add allowed transition: TODO -> IN_PROGRESS only
        trans_res = self.client.post(
            f'/api/boards/{self.board.id}/transitions/',
            {'from_column': str(col_todo.id), 'to_column': str(col_prog.id)},
            format='json'
        )
        self.assertEqual(trans_res.status_code, 201)

        # Create task in TODO
        issue = Issue.objects.create(
            workspace=self.workspace,
            project=self.project,
            board=self.board,
            title='Kanban Task With Transition Rules',
            status='TODO',
            reporter=self.owner
        )

        # Move to DONE (prohibited: no transition rule for TODO -> DONE)
        bad_move = self.client.post(
            f'/api/issues/{issue.id}/move/',
            {'status': 'DONE', 'position': 0, 'board_id': str(self.board.id)},
            format='json'
        )
        self.assertEqual(bad_move.status_code, 400)
        self.assertIn('not permitted', bad_move.data['error'].lower())

        # Move to IN_PROGRESS (allowed by configured transition)
        good_move = self.client.post(
            f'/api/issues/{issue.id}/move/',
            {'status': 'IN_PROGRESS', 'position': 0, 'board_id': str(self.board.id)},
            format='json'
        )
        self.assertEqual(good_move.status_code, 200)
        self.assertEqual(good_move.data['status'], 'IN_PROGRESS')

