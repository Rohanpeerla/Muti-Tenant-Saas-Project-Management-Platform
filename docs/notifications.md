# In-App Notifications & Preference Management

## 1. Overview
SprintSync provides a notification engine delivering real-time in-app alerts and asynchronous email digests for important project, task, and workspace lifecycle events.

---

## 2. Data Models

### `Notification`
- **Fields**:
  - `id`: UUID primary key.
  - `recipient`: ForeignKey to User (CASCADE).
  - `workspace`: ForeignKey to `Workspace` (CASCADE).
  - `notification_type`: One of:
    - `TASK_ASSIGNED`
    - `TASK_STATUS_CHANGED`
    - `TASK_COMMENTED`
    - `TASK_MENTIONED`
    - `TASK_DUE_SOON`
    - `TASK_OVERDUE`
    - `PROJECT_CREATED`
    - `PROJECT_UPDATED`
    - `SPRINT_STARTED`
    - `SPRINT_COMPLETED`
    - `WORKSPACE_INVITATION`
    - `WEBHOOK_FAILURE`
  - `title`: String summary.
  - `message`: Text content with event context.
  - `related_entity_type`: Target entity type (`issue`, `project`, `sprint`, `workspace`).
  - `related_entity_id`: Target entity UUID or identifier.
  - `is_read`: Boolean flag (default `False`).
  - `created_at` / `read_at`: ISO timestamps.
- **Indexes**:
  - `[recipient, is_read, created_at]`
  - `[workspace, recipient]`
  - `[recipient, created_at]`

### `NotificationPreference`
- **Fields**:
  - `user`: OneToOneField to User (CASCADE).
  - `email_enabled`: Master switch for email delivery (default `True`).
  - `in_app_enabled`: Master switch for navbar bell notifications (default `True`).
  - `task_assignment`: When tasks are assigned/reassigned (default `True`).
  - `comment_notifications`: Comments & task status changes (default `True`).
  - `mention_notifications`: Direct `@username` mentions (default `True`).
  - `due_date_reminders`: Upcoming & overdue task alerts (default `True`).
  - `project_sprint_notifications`: Project and sprint updates (default `True`).

---

## 3. REST API Reference

| Method | Endpoint | Description | Permissions |
|---|---|---|---|
| `GET` | `/api/notifications/` | Paginated notifications list (`?is_read=&workspace_id=`) | Authenticated |
| `GET` | `/api/notifications/unread-count/` | Returns `{ "unread_count": N }` | Authenticated |
| `PATCH` | `/api/notifications/{id}/read/` | Marks notification as read | Recipient only |
| `POST` | `/api/notifications/mark-all-read/` | Marks all unread notifications as read | Recipient only |
| `DELETE` | `/api/notifications/{id}/` | Deletes an individual notification | Recipient only |
| `DELETE` | `/api/notifications/clear-read/` | Deletes all read notifications | Recipient only |
| `GET` | `/api/notifications/preferences/` | Get current user's notification preferences | Authenticated |
| `PATCH` | `/api/notifications/preferences/` | Update delivery channels and category preferences | Authenticated |

---

## 4. Multi-Tenant & Privacy Safeguards
1. **User Isolation**: A user can only view, mark, or delete their own notification records. Attempting to access another user's notification returns `HTTP 404 Not Found`.
2. **Actor Self-Suppression**: When a user assigns a task to themselves, moves their own task, or posts a comment, they are never notified of their own actions.
3. **Suspended Member Suppression**: Notifications are suppressed if the recipient is suspended or no longer an active member of the workspace.
4. **Channel Independence**: In-app notifications and email notifications can be enabled or disabled independently per user.

