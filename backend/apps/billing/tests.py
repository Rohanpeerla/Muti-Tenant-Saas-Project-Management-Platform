import json
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.models import (
    SubscriptionPlan,
    WorkspaceSubscription,
    WorkspaceUsage,
    BillingInvoice,
    StripeWebhookEvent,
)
from apps.billing.tasks import process_stripe_webhook_event_task
from apps.billing.usage_service import (
    check_workspace_limits,
    get_or_create_workspace_subscription,
    PlanLimitExceeded,
    FeatureNotAllowed,
)
from apps.boards.models import Board, BoardColumn, WorkflowTransition
from apps.issues.models import Issue, IssueAttachment
from apps.projects.models import Project
from apps.webhooks.models import Webhook
from apps.workspaces.models import Workspace, WorkspaceMembership

UserModel = get_user_model()


class BillingBaseTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed Plans
        self.free_plan, _ = SubscriptionPlan.objects.get_or_create(
            slug='free',
            defaults={
                'name': 'Free',
                'description': 'Free starter plan.',
                'monthly_price': 0,
                'yearly_price': 0,
                'max_members': 5,
                'max_projects': 3,
                'max_tasks': 100,
                'max_storage_bytes': 100 * 1024 * 1024,
                'max_webhooks': 0,
                'features': {'custom_workflows': False, 'webhooks': False},
            }
        )

        self.pro_plan, _ = SubscriptionPlan.objects.get_or_create(
            slug='pro',
            defaults={
                'name': 'Pro',
                'description': 'Professional plan.',
                'monthly_price': 29,
                'yearly_price': 290,
                'max_members': 25,
                'max_projects': 15,
                'max_tasks': 1000,
                'max_storage_bytes': 1024 * 1024 * 1024,
                'max_webhooks': 5,
                'features': {'custom_workflows': True, 'webhooks': True},
            }
        )

        self.business_plan, _ = SubscriptionPlan.objects.get_or_create(
            slug='business',
            defaults={
                'name': 'Business',
                'description': 'Enterprise scale plan.',
                'monthly_price': 79,
                'yearly_price': 790,
                'max_members': 100,
                'max_projects': 50,
                'max_tasks': 10000,
                'max_storage_bytes': 10 * 1024 * 1024 * 1024,
                'max_webhooks': 25,
                'features': {'custom_workflows': True, 'webhooks': True},
            }
        )

        # Users
        self.owner = UserModel.objects.create_user(
            username='owner_user',
            email='owner@test.com',
            password='Password123!'
        )
        self.member = UserModel.objects.create_user(
            username='member_user',
            email='member@test.com',
            password='Password123!'
        )
        self.outsider = UserModel.objects.create_user(
            username='outsider_user',
            email='outsider@test.com',
            password='Password123!'
        )

        # Workspace
        self.workspace = Workspace.objects.create(
            name='Billing Test Workspace',
            slug='billing-test-workspace',
            owner=self.owner
        )
        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.owner,
            role=WorkspaceMembership.Role.OWNER,
            status=WorkspaceMembership.Status.ACTIVE
        )
        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.member,
            role=WorkspaceMembership.Role.MEMBER,
            status=WorkspaceMembership.Status.ACTIVE
        )

        # Default subscription
        self.subscription = get_or_create_workspace_subscription(self.workspace)


class SubscriptionPlanAPITests(BillingBaseTestCase):
    def test_list_plans_public(self):
        """Plans list is publicly accessible without authentication."""
        response = self.client.get('/api/billing/plans/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p['slug'] for p in response.data]
        self.assertIn('free', slugs)
        self.assertIn('pro', slugs)
        self.assertIn('business', slugs)


class WorkspaceSubscriptionAPITests(BillingBaseTestCase):
    def test_get_subscription_as_owner(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f'/api/billing/subscription/?workspace_id={self.workspace.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['plan']['slug'], 'free')
        self.assertEqual(response.data['status'], 'FREE')
        self.assertIn('usage', response.data)

    def test_get_subscription_as_member_forbidden(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f'/api/billing/subscription/?workspace_id={self.workspace.id}')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_subscription_as_outsider_forbidden(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f'/api/billing/subscription/?workspace_id={self.workspace.id}')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class StripeCheckoutAPITests(BillingBaseTestCase):
    @patch('apps.billing.stripe_service.stripe.checkout.Session.create')
    @patch('apps.billing.stripe_service.stripe.Customer.create')
    def test_create_checkout_session(self, mock_customer_create, mock_session_create):
        mock_customer_create.return_value = MagicMock(id='cus_test123')
        mock_session_create.return_value = MagicMock(
            id='cs_test456',
            url='https://checkout.stripe.com/pay/cs_test456'
        )

        self.client.force_authenticate(user=self.owner)
        data = {
            'workspace_id': str(self.workspace.id),
            'plan_id': str(self.pro_plan.id),
            'billing_interval': 'monthly',
        }
        response = self.client.post('/api/billing/checkout/', data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['checkout_url'], 'https://checkout.stripe.com/pay/cs_test456')
        self.assertEqual(response.data['session_id'], 'cs_test456')

    def test_checkout_as_member_rejected(self):
        self.client.force_authenticate(user=self.member)
        data = {
            'workspace_id': str(self.workspace.id),
            'plan_id': str(self.pro_plan.id),
        }
        response = self.client.post('/api/billing/checkout/', data=data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CustomerPortalAPITests(BillingBaseTestCase):
    @patch('apps.billing.stripe_service.stripe.billing_portal.Session.create')
    def test_create_portal_session(self, mock_portal_create):
        mock_portal_create.return_value = MagicMock(url='https://billing.stripe.com/p/session_test789')

        self.subscription.stripe_customer_id = 'cus_test123'
        self.subscription.save()

        self.client.force_authenticate(user=self.owner)
        data = {
            'workspace_id': str(self.workspace.id),
            'return_url': 'http://localhost:5173/billing',
        }
        response = self.client.post('/api/billing/customer-portal/', data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['portal_url'], 'https://billing.stripe.com/p/session_test789')


class CancellationAndReactivationAPITests(BillingBaseTestCase):
    @patch('apps.billing.stripe_service.stripe.Subscription.modify')
    def test_cancel_subscription_at_period_end(self, mock_sub_modify):
        mock_sub_modify.return_value = MagicMock(cancel_at_period_end=True)

        self.subscription.plan = self.pro_plan
        self.subscription.status = WorkspaceSubscription.SubscriptionStatus.ACTIVE
        self.subscription.stripe_subscription_id = 'sub_test_active'
        self.subscription.save()

        self.client.force_authenticate(user=self.owner)
        data = {
            'workspace_id': str(self.workspace.id),
            'cancel_at_period_end': True,
        }
        response = self.client.post('/api/billing/cancel-subscription/', data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.cancel_at_period_end)

    @patch('apps.billing.stripe_service.stripe.Subscription.modify')
    def test_reactivate_subscription(self, mock_sub_modify):
        mock_sub_modify.return_value = MagicMock(cancel_at_period_end=False)

        self.subscription.plan = self.pro_plan
        self.subscription.status = WorkspaceSubscription.SubscriptionStatus.ACTIVE
        self.subscription.stripe_subscription_id = 'sub_test_active'
        self.subscription.cancel_at_period_end = True
        self.subscription.save()

        self.client.force_authenticate(user=self.owner)
        data = {'workspace_id': str(self.workspace.id)}
        response = self.client.post('/api/billing/reactivate-subscription/', data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.subscription.refresh_from_db()
        self.assertFalse(self.subscription.cancel_at_period_end)


class PlanLimitEnforcementTests(BillingBaseTestCase):
    def test_member_limit_enforcement(self):
        """Free plan limit is 5 members."""
        # Workspace already has owner and 1 member = 2 members
        # Add 3 more members = 5 members
        for i in range(3):
            u = UserModel.objects.create_user(username=f'm_{i}', email=f'm_{i}@test.com')
            WorkspaceMembership.objects.create(
                workspace=self.workspace,
                user=u,
                role=WorkspaceMembership.Role.MEMBER,
                status=WorkspaceMembership.Status.ACTIVE
            )

        # Attempting to add 6th member via API should fail with PlanLimitExceeded
        self.client.force_authenticate(user=self.owner)
        new_user = UserModel.objects.create_user(username='extra', email='extra@test.com')
        response = self.client.post(
            f'/api/workspaces/{self.workspace.id}/members/',
            data={'email': new_user.email, 'role': 'MEMBER'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('limit_type', response.data)
        self.assertEqual(response.data['limit_type'], 'max_members')

    def test_project_limit_enforcement(self):
        """Free plan limit is 3 projects."""
        for i in range(3):
            Project.objects.create(
                workspace=self.workspace,
                name=f'Project {i}',
                slug=f'project-{i}',
                key=f'PR{i}',
                owner=self.owner
            )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/api/workspaces/{self.workspace.id}/projects/',
            data={'name': 'Excess Project', 'key': 'EXC'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('limit_type', response.data)
        self.assertEqual(response.data['limit_type'], 'max_projects')

    def test_task_limit_enforcement(self):
        """Free plan limit is 100 tasks."""
        project = Project.objects.create(
            workspace=self.workspace,
            name='Tasks Project',
            slug='tasks-project',
            key='TSK',
            owner=self.owner
        )
        self.free_plan.max_tasks = 2
        self.free_plan.save()

        Issue.objects.create(workspace=self.workspace, project=project, title='T1', reporter=self.owner)
        Issue.objects.create(workspace=self.workspace, project=project, title='T2', reporter=self.owner)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/api/projects/{project.id}/issues/',
            data={'title': 'Excess Task'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('limit_type'), 'max_tasks')

    def test_attachment_storage_limit_enforcement(self):
        """Storage limit enforcement rejects upload when plan limit is exceeded."""
        project = Project.objects.create(
            workspace=self.workspace,
            name='Attach Project',
            slug='attach-project',
            key='ATT',
            owner=self.owner
        )
        issue = Issue.objects.create(
            workspace=self.workspace,
            project=project,
            title='Issue with attachment',
            reporter=self.owner
        )

        self.client.force_authenticate(user=self.owner)
        self.free_plan.max_storage_bytes = 100
        self.free_plan.save()

        test_file = SimpleUploadedFile("big_file.txt", b"x" * 200, content_type="text/plain")
        response = self.client.post(
            f'/api/issues/{issue.id}/attachments/',
            data={'file': test_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('limit_type'), 'max_storage_bytes')

    def test_webhook_feature_gate(self):
        """Webhooks are blocked on Free tier."""
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/api/workspaces/{self.workspace.id}/webhooks/',
            data={'name': 'Discord', 'target_url': 'https://discord.com/api/webhooks/123', 'subscribed_events': ['task.created']}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('feature_name'), 'webhooks')

    def test_custom_workflow_feature_gate(self):
        """Custom Kanban workflow transitions are blocked on Free plan."""
        project = Project.objects.create(
            workspace=self.workspace,
            name='WF Project',
            slug='wf-project',
            key='WFP',
            owner=self.owner
        )
        board = Board.objects.create(workspace=self.workspace, project=project, name='Main Board')
        col1 = board.columns.first()
        col2 = board.columns.last()

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/api/boards/{board.id}/transitions/',
            data={'from_column': str(col1.id), 'to_column': str(col2.id), 'name': 'Fast Complete'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('feature_name'), 'custom_workflows')

        # Upgrade to Pro
        self.subscription.plan = self.pro_plan
        self.subscription.status = WorkspaceSubscription.SubscriptionStatus.ACTIVE
        self.subscription.save()

        response = self.client.post(
            f'/api/boards/{board.id}/transitions/',
            data={'from_column': str(col1.id), 'to_column': str(col2.id), 'name': 'Fast Complete'}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class StripeWebhookProcessingTests(BillingBaseTestCase):
    def test_webhook_checkout_session_completed(self):
        mock_event = {
            'id': 'evt_checkout_123',
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'id': 'cs_test_success',
                    'customer': 'cus_test123',
                    'subscription': 'sub_test_pro',
                    'client_reference_id': str(self.workspace.id),
                    'metadata': {
                        'workspace_id': str(self.workspace.id),
                        'plan_id': str(self.pro_plan.id),
                        'billing_interval': 'monthly',
                    }
                }
            }
        }

        response = self.client.post(
            '/api/billing/stripe/webhook/',
            data=json.dumps(mock_event),
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=123,v1=test_sig'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan.slug, 'pro')
        self.assertEqual(self.subscription.status, WorkspaceSubscription.SubscriptionStatus.ACTIVE)
        self.assertEqual(self.subscription.stripe_customer_id, 'cus_test123')
        self.assertEqual(self.subscription.stripe_subscription_id, 'sub_test_pro')

    def test_webhook_invoice_payment_succeeded(self):
        self.subscription.stripe_customer_id = 'cus_test123'
        self.subscription.stripe_subscription_id = 'sub_test_pro'
        self.subscription.plan = self.pro_plan
        self.subscription.save()

        mock_event = {
            'id': 'evt_inv_123',
            'type': 'invoice.payment_succeeded',
            'data': {
                'object': {
                    'id': 'in_test_invoice123',
                    'number': 'INV-2026-0001',
                    'customer': 'cus_test123',
                    'subscription': 'sub_test_pro',
                    'amount_paid': 2900,
                    'currency': 'usd',
                    'status': 'paid',
                    'hosted_invoice_url': 'https://invoice.stripe.com/inv_123',
                    'invoice_pdf': 'https://invoice.stripe.com/inv_123/pdf',
                }
            }
        }

        response = self.client.post(
            '/api/billing/stripe/webhook/',
            data=json.dumps(mock_event),
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=123,v1=test_sig'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        invoice = BillingInvoice.objects.filter(stripe_invoice_id='in_test_invoice123').first()
        self.assertIsNotNone(invoice)
        self.assertEqual(invoice.workspace, self.workspace)
        self.assertEqual(invoice.amount_paid, 2900)
        self.assertEqual(invoice.status, 'paid')

    def test_webhook_idempotency(self):
        """Duplicate webhook event delivery should be skipped."""
        mock_event = {
            'id': 'evt_duplicate_123',
            'type': 'customer.subscription.updated',
            'data': {'object': {'id': 'sub_test_dup', 'status': 'active'}}
        }

        # First request
        resp1 = self.client.post(
            '/api/billing/stripe/webhook/',
            data=json.dumps(mock_event),
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=123,v1=test_sig'
        )
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)

        # Second identical request
        resp2 = self.client.post(
            '/api/billing/stripe/webhook/',
            data=json.dumps(mock_event),
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=123,v1=test_sig'
        )
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertTrue(resp2.data.get('duplicate', False))
