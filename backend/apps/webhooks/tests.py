import hashlib
import hmac
import json
import uuid
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.webhooks.models import Webhook, WebhookDelivery
from apps.webhooks.security import validate_webhook_url
from apps.webhooks.tasks import deliver_webhook_task, retry_failed_webhooks_task
from apps.webhooks.services import trigger_workspace_webhooks

User = get_user_model()


class WebhookSecurityTests(TestCase):
    def test_ssrf_rejects_localhost_and_loopback(self):
        with self.assertRaises(ValidationError):
            validate_webhook_url('http://localhost:8000/webhook')

        with self.assertRaises(ValidationError):
            validate_webhook_url('http://127.0.0.1/webhook')

    def test_ssrf_rejects_cloud_metadata(self):
        with self.assertRaises(ValidationError):
            validate_webhook_url('http://169.254.169.254/latest/meta-data')

    def test_ssrf_rejects_disallowed_ports(self):
        with self.assertRaises(ValidationError):
            # Port 5432 is PostgreSQL
            validate_webhook_url('https://example.com:5432/webhook')

        with self.assertRaises(ValidationError):
            # Port 6379 is Redis
            validate_webhook_url('https://example.com:6379/webhook')

    def test_ssrf_rejects_invalid_scheme(self):
        with self.assertRaises(ValidationError):
            validate_webhook_url('ftp://example.com/webhook')

        with self.assertRaises(ValidationError):
            validate_webhook_url('file:///etc/passwd')


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True, WEBHOOK_ALLOW_LOCAL_DESTINATIONS=True)
class WebhookModelAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.admin = User.objects.create_user(email='admin@test.com', username='admin', password='Password123!')
        self.member = User.objects.create_user(email='member@test.com', username='member', password='Password123!')
        self.viewer = User.objects.create_user(email='viewer@test.com', username='viewer', password='Password123!')
        self.outsider = User.objects.create_user(email='outsider@other.com', username='outsider', password='Password123!')

        self.workspace1 = Workspace.objects.create(name='Acme Corp', slug='acme', owner=self.owner)
        self.workspace2 = Workspace.objects.create(name='Beta Inc', slug='beta', owner=self.outsider)

        WorkspaceMembership.objects.create(workspace=self.workspace1, user=self.admin, role=WorkspaceMembership.Role.ADMIN, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace1, user=self.member, role=WorkspaceMembership.Role.MEMBER, status=WorkspaceMembership.Status.ACTIVE)
        WorkspaceMembership.objects.create(workspace=self.workspace1, user=self.viewer, role=WorkspaceMembership.Role.VIEWER, status=WorkspaceMembership.Status.ACTIVE)

    def auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_owner_and_admin_can_create_webhook(self):
        self.auth(self.owner)
        payload = {
            'name': 'Production CI Trigger',
            'target_url': 'https://httpbin.org/post',
            'subscribed_events': ['task.created', 'task.status_changed']
        }
        res = self.client.post(f'/api/workspaces/{self.workspace1.id}/webhooks/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['name'], 'Production CI Trigger')
        # Secret is returned once on creation
        self.assertTrue(len(res.data['secret']) > 20)

    def test_member_and_viewer_cannot_manage_webhooks(self):
        self.auth(self.member)
        payload = {
            'name': 'Member Attempt',
            'target_url': 'https://httpbin.org/post',
            'subscribed_events': ['task.created']
        }
        res = self.client.post(f'/api/workspaces/{self.workspace1.id}/webhooks/', payload, format='json')
        self.assertEqual(res.status_code, 403)

        self.auth(self.viewer)
        res_view = self.client.get(f'/api/workspaces/{self.workspace1.id}/webhooks/')
        self.assertEqual(res_view.status_code, 403)

    def test_cross_tenant_webhook_isolation(self):
        wh = Webhook.objects.create(
            workspace=self.workspace1,
            name='Acme Webhook',
            target_url='https://httpbin.org/post',
            subscribed_events=['task.created']
        )

        # Outsider from workspace2 cannot access
        self.auth(self.outsider)
        res = self.client.get(f'/api/workspaces/{self.workspace1.id}/webhooks/')
        self.assertEqual(res.status_code, 403)

        res_patch = self.client.patch(f'/api/webhooks/{wh.id}/', {'name': 'Hacked'})
        self.assertEqual(res_patch.status_code, 403)

    def test_secret_is_masked_in_listing(self):
        wh = Webhook.objects.create(
            workspace=self.workspace1,
            name='Test Wh',
            target_url='https://httpbin.org/post',
            subscribed_events=['task.created']
        )
        self.auth(self.owner)
        res = self.client.get(f'/api/workspaces/{self.workspace1.id}/webhooks/')
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('secret', res.data[0])
        self.assertIn('secret_preview', res.data[0])
        self.assertTrue(res.data[0]['secret_preview'].startswith('••••••••'))

    def test_rotate_secret(self):
        wh = Webhook.objects.create(
            workspace=self.workspace1,
            name='Rotate Test',
            target_url='https://httpbin.org/post',
            subscribed_events=['task.created']
        )
        old_secret = wh.secret

        self.auth(self.owner)
        res = self.client.post(f'/api/webhooks/{wh.id}/rotate-secret/')
        self.assertEqual(res.status_code, 200)
        new_secret = res.data['new_secret']
        self.assertNotEqual(old_secret, new_secret)

        wh.refresh_from_db()
        self.assertEqual(wh.secret, new_secret)

    @patch('apps.webhooks.tasks.requests.post')
    def test_webhook_test_event_and_deliveries_log(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"status": "ok"}'
        mock_post.return_value = mock_resp

        wh = Webhook.objects.create(
            workspace=self.workspace1,
            name='Test Ping WH',
            target_url='https://httpbin.org/post',
            subscribed_events=['*']
        )

        self.auth(self.owner)
        res = self.client.post(f'/api/webhooks/{wh.id}/test/')
        self.assertEqual(res.status_code, 200)

        # Check delivery history
        del_res = self.client.get(f'/api/webhooks/{wh.id}/deliveries/')
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.data['count'], 1)
        self.assertEqual(del_res.data['results'][0]['event_type'], 'test.ping')


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True, WEBHOOK_ALLOW_LOCAL_DESTINATIONS=True)
class WebhookDeliveryExecutionTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@test.com', username='owner', password='Password123!')
        self.workspace = Workspace.objects.create(name='Org', slug='org', owner=self.owner)
        self.webhook = Webhook.objects.create(
            workspace=self.workspace,
            name='Live Webhook',
            target_url='https://httpbin.org/post',
            secret='my-super-secret-key-12345',
            subscribed_events=['task.created', 'task.status_changed']
        )

    @patch('apps.webhooks.tasks.requests.post')
    def test_delivery_calculates_valid_hmac_signature(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = 'Received'
        mock_post.return_value = mock_resp

        payload = {'task_id': '123', 'status': 'IN_PROGRESS'}
        delivery = WebhookDelivery.objects.create(
            webhook=self.webhook,
            event_type='task.status_changed',
            request_payload=payload
        )

        result = deliver_webhook_task(delivery.id)
        self.assertEqual(result, 'success')

        delivery.refresh_from_db()
        self.assertEqual(delivery.status, WebhookDelivery.DeliveryStatus.SUCCESS)
        self.assertEqual(delivery.response_status, 200)

        # Verify HMAC signature in call headers
        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        headers = kwargs['headers']
        self.assertIn('X-SprintSync-Signature', headers)

        expected_sig = hmac.new(
            self.webhook.secret.encode('utf-8'),
            json.dumps(payload, sort_keys=True).encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        self.assertEqual(headers['X-SprintSync-Signature'], f'sha256={expected_sig}')
        self.assertEqual(headers['X-SprintSync-Event'], 'task.status_changed')

    @patch('apps.webhooks.tasks.requests.post')
    def test_delivery_failure_handles_retrying_status(self, mock_post):
        mock_post.side_effect = Exception('Connection timed out')

        delivery = WebhookDelivery.objects.create(
            webhook=self.webhook,
            event_type='task.created',
            request_payload={'id': 'abc'}
        )

        with self.assertRaises(Exception):
            deliver_webhook_task(delivery.id)

        delivery.refresh_from_db()
        self.assertEqual(delivery.status, WebhookDelivery.DeliveryStatus.RETRYING)
        self.assertEqual(delivery.attempt_count, 1)
        self.assertIsNotNone(delivery.next_retry_at)

