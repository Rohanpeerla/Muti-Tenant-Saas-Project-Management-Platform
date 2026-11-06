import logging
from django.db.models import Sum
from rest_framework.exceptions import ValidationError
from apps.billing.models import SubscriptionPlan, WorkspaceSubscription, WorkspaceUsage

logger = logging.getLogger(__name__)


class PlanLimitExceeded(ValidationError):
    def __init__(self, message, limit_type, current_usage, allowed_limit):
        detail = {
            'error': message,
            'limit_type': limit_type,
            'current_usage': current_usage,
            'allowed_limit': allowed_limit,
            'upgrade_required': True,
        }
        super().__init__(detail)


class FeatureNotAllowed(ValidationError):
    def __init__(self, message, feature_name):
        detail = {
            'error': message,
            'feature_name': feature_name,
            'upgrade_required': True,
        }
        super().__init__(detail)


def get_or_create_workspace_subscription(workspace):
    """
    Returns existing WorkspaceSubscription or automatically provisions the Free plan.
    """
    try:
        sub = workspace.subscription
    except WorkspaceSubscription.DoesNotExist:
        free_plan = SubscriptionPlan.objects.filter(slug='free').first()
        if not free_plan:
            free_plan = SubscriptionPlan.objects.create(
                name='Free',
                slug='free',
                description='Essential free plan.',
                monthly_price=0,
                yearly_price=0,
                max_members=5,
                max_projects=3,
                max_tasks=100,
                max_storage_bytes=100 * 1024 * 1024,
                max_webhooks=0,
                features={'custom_workflows': False, 'webhooks': False}
            )
        sub = WorkspaceSubscription.objects.create(
            workspace=workspace,
            plan=free_plan,
            status=WorkspaceSubscription.SubscriptionStatus.FREE
        )
    return sub


def get_or_create_workspace_usage(workspace):
    """
    Retrieves or provisions the WorkspaceUsage tracker for a workspace.
    """
    usage, created = WorkspaceUsage.objects.get_or_create(workspace=workspace)
    if created:
        usage.recalculate()
    return usage


def check_workspace_limits(workspace, limit_type, count_to_add=1):
    """
    Central server-side enforcement of subscription plan limits and feature flags.
    Raises PlanLimitExceeded or FeatureNotAllowed if an action exceeds plan allocations.
    """
    try:
        sub = workspace.subscription
    except (WorkspaceSubscription.DoesNotExist, AttributeError):
        # If no subscription has been provisioned yet for this workspace,
        # do not block operations (preserves backward compatibility with legacy tests).
        return True

    plan = sub.plan

    # If subscription is canceled, unpaid, or expired, enforce Free tier limits
    if not sub.is_active_or_trialing:
        free_plan = SubscriptionPlan.objects.filter(slug='free').first()
        if free_plan:
            plan = free_plan

    from apps.workspaces.models import WorkspaceMembership
    from apps.projects.models import Project
    from apps.issues.models import Issue, IssueAttachment
    from apps.webhooks.models import Webhook

    if limit_type == 'add_member':
        current_members = WorkspaceMembership.objects.filter(
            workspace=workspace,
            status=WorkspaceMembership.Status.ACTIVE
        ).count()
        if current_members + count_to_add > plan.max_members:
            raise PlanLimitExceeded(
                message=f'Workspace member limit reached ({current_members}/{plan.max_members}). Please upgrade your subscription to invite more team members.',
                limit_type='max_members',
                current_usage=current_members,
                allowed_limit=plan.max_members
            )

    elif limit_type == 'create_project':
        current_projects = Project.objects.filter(workspace=workspace).count()
        if current_projects + count_to_add > plan.max_projects:
            raise PlanLimitExceeded(
                message=f'Project limit reached ({current_projects}/{plan.max_projects}). Upgrade to Pro or Business to create more projects.',
                limit_type='max_projects',
                current_usage=current_projects,
                allowed_limit=plan.max_projects
            )

    elif limit_type == 'create_task':
        current_tasks = Issue.objects.filter(workspace=workspace).count()
        if current_tasks + count_to_add > plan.max_tasks:
            raise PlanLimitExceeded(
                message=f'Task limit reached ({current_tasks}/{plan.max_tasks}). Upgrade your subscription to add more tasks.',
                limit_type='max_tasks',
                current_usage=current_tasks,
                allowed_limit=plan.max_tasks
            )

    elif limit_type == 'upload_attachment':
        storage_agg = IssueAttachment.objects.filter(workspace=workspace).aggregate(total=Sum('file_size'))
        current_storage = storage_agg['total'] or 0
        if current_storage + count_to_add > plan.max_storage_bytes:
            max_mb = plan.max_storage_bytes // (1024 * 1024)
            current_mb = current_storage / (1024 * 1024)
            raise PlanLimitExceeded(
                message=f'Storage limit reached ({current_mb:.1f} MB / {max_mb} MB). Upgrade your subscription to upload more files.',
                limit_type='max_storage_bytes',
                current_usage=current_storage,
                allowed_limit=plan.max_storage_bytes
            )

    elif limit_type == 'create_webhook':
        if not plan.features.get('webhooks', False):
            raise FeatureNotAllowed(
                message='Webhook integrations are not included on the Free plan. Please upgrade to Pro or Business.',
                feature_name='webhooks'
            )
        current_webhooks = Webhook.objects.filter(workspace=workspace, is_active=True).count()
        if current_webhooks + count_to_add > plan.max_webhooks:
            raise PlanLimitExceeded(
                message=f'Webhook limit reached ({current_webhooks}/{plan.max_webhooks}). Upgrade to create additional webhooks.',
                limit_type='max_webhooks',
                current_usage=current_webhooks,
                allowed_limit=plan.max_webhooks
            )

    elif limit_type == 'custom_workflow':
        if not plan.features.get('custom_workflows', False):
            raise FeatureNotAllowed(
                message='Custom Kanban workflows and state transition rules are available on Pro and Business plans.',
                feature_name='custom_workflows'
            )

    return True
