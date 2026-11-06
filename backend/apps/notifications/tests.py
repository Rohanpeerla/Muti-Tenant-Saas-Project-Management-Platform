import uuid
from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.projects.models import Project
from apps.issues.models import Issue
from apps.notifications.models import Notification, NotificationPreference
from apps.notifications.services import create_notification
from apps.notifications.tasks import (
    send_notification_email_task,
    check_due_date_reminders_task,
    check_overdue_tasks_task,
    cleanup_old_notifications_task
)

User = get_user_model()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class NotificationModelAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.member = User.objects.create_user(email='member@test.com', username='member', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='outsider', password='Password123!')

        self.workspace1 = Workspace.objects.create(name='Acme Corp', slug='acme', owner=self.owner)
        self.workspace2 = Workspace.objects.create(name='Beta Inc', slug='beta', owner=self.outsider)

        WorkspaceMembership.objects.create(
            workspace=self.workspace1,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
            status=WorkspaceMembership.Status.ACTIVE
        )

        self.project = Project.objects.create(
            workspace=self.workspace1,
            name='Acme Web',
            slug='acme-web',
            key='ACM',
            owner=self.owner
        )

    def auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_notification_creation_and_isolation(self):
        # Create notification for member in workspace1
        notif = Notification.objects.create(
            recipient=self.member,
            workspace=self.workspace1,
            notification_type=Notification.NotificationType.TASK_ASSIGNED,
            title='Task Assigned',
            message='You have been assigned to ACM-101.'
        )

        # Member sees their notification
        self.auth(self.member)
        res = self.client.get('/api/notifications/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['results'][0]['title'], 'Task Assigned')

        # Outsider does NOT see member's notification
        self.auth(self.outsider)
        res_out = self.client.get('/api/notifications/')
        self.assertEqual(res_out.status_code, 200)
        self.assertEqual(res_out.data['count'], 0)

    def test_unread_count_and_mark_as_read(self):
        self.auth(self.member)
        notif1 = Notification.objects.create(
            recipient=self.member,
            workspace=self.workspace1,
            notification_type=Notification.NotificationType.TASK_ASSIGNED,
            title='Task 1',
            message='Msg 1'
        )
        notif2 = Notification.objects.create(
            recipient=self.member,
            workspace=self.workspace1,
            notification_type=Notification.NotificationType.TASK_COMMENTED,
            title='Task 2',
            message='Msg 2'
        )

        # Unread count should be 2
        res = self.client.get('/api/notifications/unread-count/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['unread_count'], 2)

        # Mark notif1 as read
        patch_res = self.client.patch(f'/api/notifications/{notif1.id}/read/')
        self.assertEqual(patch_res.status_code, 200)
        self.assertTrue(patch_res.data['is_read'])

        # Unread count should now be 1
        res2 = self.client.get('/api/notifications/unread-count/')
        self.assertEqual(res2.data['unread_count'], 1)

        # Mark all read
        mark_all_res = self.client.post('/api/notifications/mark-all-read/')
        self.assertEqual(mark_all_res.status_code, 200)
        self.assertEqual(mark_all_res.data['marked_read'], 1)

        res3 = self.client.get('/api/notifications/unread-count/')
        self.assertEqual(res3.data['unread_count'], 0)

    def test_user_cannot_mark_or_delete_other_user_notification(self):
        notif = Notification.objects.create(
            recipient=self.member,
            workspace=self.workspace1,
            notification_type=Notification.NotificationType.TASK_ASSIGNED,
            title='Secret alert',
            message='For member only'
        )

        # Outsider attempts to mark as read or delete
        self.auth(self.outsider)
        patch_res = self.client.patch(f'/api/notifications/{notif.id}/read/')
        self.assertEqual(patch_res.status_code, 404)

        del_res = self.client.delete(f'/api/notifications/{notif.id}/')
        self.assertEqual(del_res.status_code, 404)

    def test_clear_read_notifications(self):
        self.auth(self.member)
        Notification.objects.create(
            recipient=self.member,
            workspace=self.workspace1,
            title='Unread 1',
            message='msg',
            is_read=False
        )
        Notification.objects.create(
            recipient=self.member,
            workspace=self.workspace1,
            title='Read 1',
            message='msg',
            is_read=True
        )

        del_res = self.client.delete('/api/notifications/clear-read/')
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.data['cleared_count'], 1)

        # Only unread remains
        remaining = Notification.objects.filter(recipient=self.member)
        self.assertEqual(remaining.count(), 1)
        self.assertFalse(remaining.first().is_read)

    def test_notification_preferences_get_and_update(self):
        self.auth(self.member)
        # Defaults
        res = self.client.get('/api/notifications/preferences/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['email_enabled'])
        self.assertTrue(res.data['in_app_enabled'])

        # Update
        patch_res = self.client.patch(
            '/api/notifications/preferences/',
            {'email_enabled': False, 'due_date_reminders': False},
            format='json'
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertFalse(patch_res.data['email_enabled'])
        self.assertFalse(patch_res.data['due_date_reminders'])
        self.assertTrue(patch_res.data['in_app_enabled'])


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class NotificationServiceAndBackgroundJobsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.dev = User.objects.create_user(email='dev@test.com', username='dev', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='outsider', password='Password123!')

        self.workspace = Workspace.objects.create(name='SprintSync Org', slug='sprintsync', owner=self.owner)
        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.dev,
            role=WorkspaceMembership.Role.MEMBER,
            status=WorkspaceMembership.Status.ACTIVE
        )

        self.project = Project.objects.create(
            workspace=self.workspace,
            name='Web Platform',
            slug='web',
            key='WEB',
            owner=self.owner
        )

    def test_create_notification_actor_self_suppression(self):
        # When actor is the same as recipient, notification should not be created
        notif = create_notification(
            recipient=self.dev,
            workspace=self.workspace,
            notification_type=Notification.NotificationType.TASK_ASSIGNED,
            title='Self-assigned',
            message='You assigned yourself',
            actor=self.dev
        )
        self.assertIsNone(notif)
        self.assertEqual(Notification.objects.filter(recipient=self.dev).count(), 0)

    def test_create_notification_respects_user_preferences(self):
        pref = NotificationPreference.get_or_create_for_user(self.dev)
        pref.in_app_enabled = False
        pref.save()

        notif = create_notification(
            recipient=self.dev,
            workspace=self.workspace,
            notification_type=Notification.NotificationType.TASK_ASSIGNED,
            title='Task Assigned',
            message='New task',
            actor=self.owner
        )
        self.assertIsNone(notif)
        self.assertEqual(Notification.objects.filter(recipient=self.dev).count(), 0)

    def test_send_notification_email_task(self):
        mail.outbox = []
        result = send_notification_email_task(
            user_id=self.dev.id,
            subject='Task Assigned: [WEB-1] Setup DB',
            template_name='task_assignment.html',
            context={
                'issue_key': 'WEB-1',
                'issue_title': 'Setup DB',
                'project_name': 'Web Platform',
                'assigner_name': 'Owner User',
                'priority': 'HIGH',
                'due_date': '2026-12-01',
                'action_url': '/projects/1'
            }
        )
        self.assertEqual(result, 'sent')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['dev@test.com'])
        self.assertIn('Setup DB', mail.outbox[0].subject)

    def test_due_date_reminders_periodic_task(self):
        now = timezone.now()
        # Create task due today
        Issue.objects.create(
            workspace=self.workspace,
            project=self.project,
            title='Urgent Release Task',
            reporter=self.owner,
            assignee=self.dev,
            due_date=now.date(),
            status='IN_PROGRESS'
        )

        sent_count = check_due_date_reminders_task()
        self.assertGreaterEqual(sent_count, 1)

        dev_notifs = Notification.objects.filter(
            recipient=self.dev,
            notification_type=Notification.NotificationType.TASK_DUE_SOON
        )
        self.assertTrue(dev_notifs.exists())

    def test_overdue_tasks_periodic_task(self):
        now = timezone.now()
        # Create task overdue by 2 days
        Issue.objects.create(
            workspace=self.workspace,
            project=self.project,
            title='Past Due Task',
            reporter=self.owner,
            assignee=self.dev,
            due_date=now.date() - timedelta(days=2),
            status='TODO'
        )

        sent_count = check_overdue_tasks_task()
        self.assertGreaterEqual(sent_count, 1)

        overdue_notifs = Notification.objects.filter(
            recipient=self.dev,
            notification_type=Notification.NotificationType.TASK_OVERDUE
        )
        self.assertTrue(overdue_notifs.exists())

    def test_cleanup_old_notifications_task(self):
        old_date = timezone.now() - timedelta(days=35)
        recent_date = timezone.now() - timedelta(days=5)

        n1 = Notification.objects.create(
            recipient=self.dev,
            workspace=self.workspace,
            title='Old Read Notif',
            message='Old',
            is_read=True
        )
        Notification.objects.filter(id=n1.id).update(created_at=old_date)

        n2 = Notification.objects.create(
            recipient=self.dev,
            workspace=self.workspace,
            title='Recent Read Notif',
            message='Recent',
            is_read=True
        )
        Notification.objects.filter(id=n2.id).update(created_at=recent_date)

        deleted = cleanup_old_notifications_task()
        self.assertGreaterEqual(deleted, 1)
        self.assertFalse(Notification.objects.filter(id=n1.id).exists())
        self.assertTrue(Notification.objects.filter(id=n2.id).exists())
