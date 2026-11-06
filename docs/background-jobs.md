# Scheduled Tasks and Periodic Background Jobs

## 1. Overview
SprintSync uses **Celery Beat** to orchestrate periodic background maintenance jobs, automated due-date reminders, overdue task escalations, and webhook retry processing.

---

## 2. Celery Beat Periodic Schedule

Configured inside `backend/config/settings.py` via `CELERY_BEAT_SCHEDULE`:

```python
CELERY_BEAT_SCHEDULE = {
    'check-due-date-reminders': {
        'task': 'apps.notifications.tasks.check_due_date_reminders_task',
        'schedule': 3600.0,  # Every hour
    },
    'check-overdue-tasks': {
        'task': 'apps.notifications.tasks.check_overdue_tasks_task',
        'schedule': 3600.0,  # Every hour
    },
    'retry-failed-webhooks': {
        'task': 'apps.webhooks.tasks.retry_failed_webhooks_task',
        'schedule': 300.0,  # Every 5 minutes
    },
    'cleanup-old-notifications': {
        'task': 'apps.notifications.tasks.cleanup_old_notifications_task',
        'schedule': 86400.0,  # Once every 24 hours
    },
}
```

---

## 3. Implemented Periodic Jobs

### 1. `check_due_date_reminders_task`
- **Schedule**: Hourly.
- **Logic**: Queries all incomplete issues (`status != 'DONE'`) with an assigned user whose `due_date` is between today and tomorrow.
- **De-duplication**: Checks `Notification` history to ensure an alert has not already been sent to that user for the same issue in the last 24 hours.
- **Action**: Generates a `TASK_DUE_SOON` in-app notification and dispatches an asynchronous reminder email if enabled by user preferences.

### 2. `check_overdue_tasks_task`
- **Schedule**: Hourly.
- **Logic**: Queries all incomplete issues (`status != 'DONE'`) with an assigned user whose `due_date` is strictly before today.
- **De-duplication**: Enforces a 24-hour cool-down period to prevent notification spamming.
- **Action**: Generates a `TASK_OVERDUE` in-app notification and dispatches an overdue warning email.

### 3. `retry_failed_webhooks_task`
- **Schedule**: Every 5 minutes.
- **Logic**: Scans `WebhookDelivery` records where `status = 'RETRYING'` and `next_retry_at <= now()`.
- **Action**: Enqueues `deliver_webhook_task.delay(delivery.id)` for automatic re-delivery.

### 4. `cleanup_old_notifications_task`
- **Schedule**: Daily (24 hours).
- **Logic**: Identifies and deletes read notifications (`is_read = True`) where `created_at` is older than 30 days (`now() - timedelta(days=30)`).
- **Purpose**: Prevents unbounded table growth while preserving unread notifications.

---

## 4. Running Celery Beat in Development

In Windows PowerShell:
```powershell
cd backend
.\venv\Scripts\celery.exe -A config beat -l info
```

