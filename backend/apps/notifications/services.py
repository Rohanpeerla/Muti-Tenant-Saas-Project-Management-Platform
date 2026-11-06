import logging
from django.db import transaction
from apps.workspaces.models import WorkspaceMembership
from apps.notifications.models import Notification, NotificationPreference
from apps.notifications.tasks import send_notification_email_task

logger = logging.getLogger(__name__)


def is_category_enabled_for_pref(pref, notification_type):
    """
    Checks if a user's notification preference allows a given notification type.
    """
    nt = Notification.NotificationType
    if notification_type == nt.TASK_ASSIGNED:
        return pref.task_assignment
    elif notification_type in (nt.TASK_COMMENTED, nt.TASK_STATUS_CHANGED):
        return pref.comment_notifications
    elif notification_type == nt.TASK_MENTIONED:
        return pref.mention_notifications
    elif notification_type in (nt.TASK_DUE_SOON, nt.TASK_OVERDUE):
        return pref.due_date_reminders
    elif notification_type in (nt.PROJECT_CREATED, nt.PROJECT_UPDATED, nt.SPRINT_STARTED, nt.SPRINT_COMPLETED):
        return pref.project_sprint_notifications
    return True


def create_notification(
    recipient,
    workspace,
    notification_type,
    title,
    message,
    related_entity_type='',
    related_entity_id='',
    actor=None,
    email_template=None,
    email_context=None
):
    """
    Centralized service to create in-app notifications and trigger asynchronous email delivery.
    Enforces user preferences, workspace membership, and actor self-notification suppression.
    """
    # 1. Do not notify the actor of their own actions
    if actor and actor.id == recipient.id:
        return None

    # 2. Check that recipient is an active member or owner of the workspace
    if workspace:
        is_owner = workspace.owner_id == recipient.id
        is_active_member = WorkspaceMembership.objects.filter(
            workspace=workspace,
            user=recipient,
            status=WorkspaceMembership.Status.ACTIVE
        ).exists()

        if not (is_owner or is_active_member):
            logger.info(f'Skipping notification for {recipient.email}: not active in workspace {workspace.id}.')
            return None

    # 3. Retrieve user preferences
    pref = NotificationPreference.get_or_create_for_user(recipient)
    category_allowed = is_category_enabled_for_pref(pref, notification_type)

    notification = None

    # 4. In-App Notification
    if pref.in_app_enabled and category_allowed:
        notification = Notification.objects.create(
            recipient=recipient,
            workspace=workspace,
            notification_type=notification_type,
            title=title,
            message=message,
            related_entity_type=related_entity_type,
            related_entity_id=str(related_entity_id) if related_entity_id else ''
        )

    # 5. Email Notification
    if pref.email_enabled and category_allowed and email_template:
        context = email_context.copy() if email_context else {}
        context['workspace_name'] = workspace.name if workspace else 'SprintSync'
        
        # Schedule email outside the transaction
        transaction.on_commit(
            lambda: send_notification_email_task.delay(
                user_id=recipient.id,
                subject=title,
                template_name=email_template,
                context=context
            )
        )

    return notification

