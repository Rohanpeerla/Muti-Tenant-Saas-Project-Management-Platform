import logging
from datetime import timedelta
from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_email_task(self, user_id, subject, template_name, context):
    """
    Asynchronous task to render and send notification emails with retries.
    """
    try:
        user = User.objects.get(id=user_id)
        from apps.notifications.models import NotificationPreference
        pref = NotificationPreference.get_or_create_for_user(user)

        if not pref.email_enabled:
            logger.info(f'Skipping email for user {user.email}: email notifications disabled.')
            return 'skipped_disabled'

        context['recipient_name'] = user.get_full_name() or user.username
        context['subject'] = subject

        html_content = render_to_string(f'emails/{template_name}', context)
        text_content = strip_tags(html_content)

        from_email = settings.DEFAULT_FROM_EMAIL
        send_mail(
            subject=subject,
            message=text_content,
            from_email=from_email,
            recipient_list=[user.email],
            html_message=html_content,
            fail_silently=False
        )
        logger.info(f'Successfully sent notification email "{subject}" to {user.email}.')
        return 'sent'
    except User.DoesNotExist:
        logger.warning(f'User {user_id} does not exist. Aborting email.')
        return 'user_not_found'
    except Exception as e:
        logger.error(f'Error sending notification email to user {user_id}: {e}')
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task
def check_due_date_reminders_task():
    """
    Periodic job to notify assignees of tasks due within the next 24 hours.
    """
    from apps.issues.models import Issue
    from apps.notifications.models import Notification
    from apps.notifications.services import create_notification

    now = timezone.now()
    tomorrow = now + timedelta(days=1)
    today = now.date()
    target_date = tomorrow.date()

    # Find tasks due today or tomorrow that have an assignee
    issues = Issue.objects.filter(
        due_date__gte=today,
        due_date__lte=target_date,
        assignee__isnull=False,
        workspace__is_active=True
    ).exclude(status__iexact='DONE')

    count = 0
    for issue in issues:
        # Avoid duplicate reminder within 24 hours
        already_sent = Notification.objects.filter(
            recipient=issue.assignee,
            related_entity_type='issue',
            related_entity_id=str(issue.id),
            notification_type=Notification.NotificationType.TASK_DUE_SOON,
            created_at__gte=now - timedelta(hours=24)
        ).exists()

        if not already_sent:
            create_notification(
                recipient=issue.assignee,
                workspace=issue.workspace,
                notification_type=Notification.NotificationType.TASK_DUE_SOON,
                title=f'Task Due Soon: [{issue.issue_key}] {issue.title}',
                message=f'Task [{issue.issue_key}] is due on {issue.due_date}.',
                related_entity_type='issue',
                related_entity_id=str(issue.id),
                email_template='task_due_reminder.html',
                email_context={
                    'issue_key': issue.issue_key,
                    'issue_title': issue.title,
                    'project_name': issue.project.name,
                    'due_date': str(issue.due_date),
                    'action_url': f'/projects/{issue.project_id}/issues/{issue.id}'
                }
            )
            count += 1

    logger.info(f'Processed due-date reminders: {count} notifications sent.')
    return count


@shared_task
def check_overdue_tasks_task():
    """
    Periodic job to alert assignees of tasks that are past their due date.
    """
    from apps.issues.models import Issue
    from apps.notifications.models import Notification
    from apps.notifications.services import create_notification

    now = timezone.now()
    today = now.date()

    issues = Issue.objects.filter(
        due_date__lt=today,
        assignee__isnull=False,
        workspace__is_active=True
    ).exclude(status__iexact='DONE')

    count = 0
    for issue in issues:
        # Avoid spamming: send once every 24h
        already_sent = Notification.objects.filter(
            recipient=issue.assignee,
            related_entity_type='issue',
            related_entity_id=str(issue.id),
            notification_type=Notification.NotificationType.TASK_OVERDUE,
            created_at__gte=now - timedelta(hours=24)
        ).exists()

        if not already_sent:
            create_notification(
                recipient=issue.assignee,
                workspace=issue.workspace,
                notification_type=Notification.NotificationType.TASK_OVERDUE,
                title=f'Overdue Task: [{issue.issue_key}] {issue.title}',
                message=f'Task [{issue.issue_key}] was due on {issue.due_date} and is overdue.',
                related_entity_type='issue',
                related_entity_id=str(issue.id),
                email_template='task_overdue_reminder.html',
                email_context={
                    'issue_key': issue.issue_key,
                    'issue_title': issue.title,
                    'project_name': issue.project.name,
                    'due_date': str(issue.due_date),
                    'action_url': f'/projects/{issue.project_id}/issues/{issue.id}'
                }
            )
            count += 1

    logger.info(f'Processed overdue task alerts: {count} notifications sent.')
    return count


@shared_task
def cleanup_old_notifications_task():
    """
    Periodic maintenance job to clean up read notifications older than 30 days.
    """
    from apps.notifications.models import Notification

    cutoff = timezone.now() - timedelta(days=30)
    deleted_count, _ = Notification.objects.filter(
        is_read=True,
        created_at__lt=cutoff
    ).delete()

    logger.info(f'Cleaned up {deleted_count} obsolete notifications.')
    return deleted_count

