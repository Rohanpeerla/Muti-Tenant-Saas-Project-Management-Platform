# SprintSync API Reference

## Base URL
`/api`

All endpoints except authentication registration/login require JWT Bearer authentication:
```http
Authorization: Bearer <access_token>
```

---

## 1. Authentication (`apps.accounts`)
- `POST /api/auth/register/`: Register a new user account.
- `POST /api/auth/login/`: Authenticate with email/password; returns access & refresh tokens.
- `POST /api/auth/token/refresh/`: Rotate refresh token and get a new access token.
- `POST /api/auth/logout/`: Invalidate and blacklist the current refresh token.
- `GET /api/auth/profile/`: Fetch the authenticated user profile.
- `PATCH /api/auth/profile/`: Update profile details.
- `POST /api/auth/change-password/`: Change current password.

---

## 2. Workspaces (`apps.workspaces`)
- `GET /api/workspaces/`: List workspaces where the user is an active member.
- `POST /api/workspaces/`: Create a new organization workspace (assigns creator as OWNER).
- `GET /api/workspaces/{id}/`: Get workspace details and current user role.
- `PATCH /api/workspaces/{id}/`: Update workspace settings (name, slug).
- `DELETE /api/workspaces/{id}/`: Delete workspace (OWNER only).
- `GET /api/workspaces/invitations/`: List pending invitations for the current user.
- `POST /api/workspaces/invitations/{id}/accept/`: Accept a workspace invitation.
- `POST /api/workspaces/invitations/{id}/decline/`: Decline a workspace invitation.
- `GET /api/workspaces/{id}/members/`: List workspace members.
- `POST /api/workspaces/{id}/members/`: Invite a user to the workspace.
- `PATCH /api/workspaces/{id}/members/{membership_id}/`: Update a member's role or status.
- `DELETE /api/workspaces/{id}/members/{membership_id}/`: Remove a member from the workspace.

---

## 3. Projects (`apps.projects`)
- `GET /api/workspaces/{workspace_id}/projects/?search=&status=`: List projects in workspace with progress and task metrics.
- `POST /api/workspaces/{workspace_id}/projects/`: Create a project in the workspace.
- `GET /api/projects/{id}/`: Retrieve project details and aggregated metrics.
- `PATCH /api/projects/{id}/`: Update project name, status, or schedule.
- `DELETE /api/projects/{id}/`: Cascade delete project.
- `GET /api/projects/{id}/members/`: List project members and their assigned roles.
- `POST /api/projects/{id}/members/`: Assign a workspace user to the project.
- `DELETE /api/projects/{id}/members/{membership_id}/`: Remove a member from the project.

---

## 4. Boards & Columns (`apps.boards`)
- `GET /api/projects/{project_id}/boards/`: List boards for a project.
- `POST /api/projects/{project_id}/boards/`: Create a new board (auto-seeds default columns).
- `GET /api/boards/{id}/`: Retrieve board details and ordered columns.
- `PATCH /api/boards/{id}/`: Update board name or description.
- `DELETE /api/boards/{id}/`: Delete board.
- `POST /api/boards/{id}/columns/`: Add a workflow column to the board.
- `PATCH /api/boards/{id}/columns/{column_id}/`: Update column label, color, default, or completion flags.
- `DELETE /api/boards/{id}/columns/{column_id}/`: Delete column (safeguard blocks deletion if active tasks exist).
- `POST /api/boards/{id}/columns/reorder/`: Atomically reorder workflow columns.
- `GET /api/boards/{id}/transitions/`: List allowed workflow transition rules.
- `POST /api/boards/{id}/transitions/`: Define an allowed workflow transition between columns.
- `DELETE /api/boards/{id}/transitions/{transition_id}/`: Delete a workflow transition rule.

---

## 5. Issues, Comments, Attachments & Timeline (`apps.issues`)
- `GET /api/projects/{project_id}/issues/?status=&priority=&sprint=&assignee=`: List tasks for a project with optional filters.
- `POST /api/projects/{project_id}/issues/`: Create a new task (auto-generates unique `issue_key`).
- `GET /api/issues/{id}/`: Retrieve task details.
- `PATCH /api/issues/{id}/`: Update task fields (status, priority, assignee, sprint, due date).
- `DELETE /api/issues/{id}/`: Delete task.
- `POST /api/issues/{id}/move/`: Atomically move task to a new column and position with workflow transition validation.
- `GET /api/issues/{id}/comments/`: List comments for a task in chronological order.
- `POST /api/issues/{id}/comments/`: Add a comment to a task.
- `PATCH /api/comments/{comment_id}/`: Edit a comment (author only).
- `DELETE /api/comments/{comment_id}/`: Delete a comment (author or workspace OWNER/ADMIN).
- `GET /api/issues/{id}/attachments/`: List file attachments for a task.
- `POST /api/issues/{id}/attachments/`: Upload an attachment (multipart/form-data, max 10MB).
- `GET /api/attachments/{attachment_id}/download/`: Download attachment file securely.
- `DELETE /api/attachments/{attachment_id}/`: Delete attachment file and record.
- `GET /api/issues/{id}/activities/`: Retrieve chronological activity history for a task.

---

## 6. Sprints (`apps.sprints`)
- `GET /api/projects/{project_id}/sprints/`: List sprints in project with real-time progress metrics.
- `POST /api/projects/{project_id}/sprints/`: Create a sprint.
- `GET /api/sprints/{id}/`: Retrieve sprint details and metrics.
- `PATCH /api/sprints/{id}/`: Update sprint details.
- `DELETE /api/sprints/{id}/`: Delete sprint.
- `POST /api/sprints/{id}/start/`: Start sprint (enforces single active sprint per project).
- `POST /api/sprints/{id}/complete/`: Complete active sprint.

---

## 7. Audit Logs (`apps.workspaces`)
- `GET /api/workspaces/{workspace_id}/audit-logs/`: List workspace security and administrative audit events. Restricted to OWNER and ADMIN roles (VIEWER and MEMBER return HTTP 403 Forbidden).

---

## 8. Notifications (`apps.notifications`)
- `GET /api/notifications/?is_read=&workspace_id=`: List current user's notifications.
- `GET /api/notifications/unread-count/`: Get unread notifications count for the authenticated user.
- `PATCH /api/notifications/{notification_id}/read/`: Mark individual notification as read.
- `POST /api/notifications/mark-all-read/`: Mark all user notifications as read.
- `DELETE /api/notifications/{notification_id}/`: Delete individual notification.
- `DELETE /api/notifications/clear-read/`: Clear all read notifications for current user.
- `GET /api/notifications/preferences/`: Get current user's notification preferences.
- `PATCH /api/notifications/preferences/`: Update email, in-app, and category notification preferences.

---

## 9. Webhooks (`apps.webhooks`)
- `GET /api/workspaces/{workspace_id}/webhooks/`: List webhooks configured for workspace (OWNER/ADMIN only, secrets masked).
- `POST /api/workspaces/{workspace_id}/webhooks/`: Create a new webhook subscription (returns secret once).
- `PATCH /api/webhooks/{webhook_id}/`: Update webhook configuration or active status.
- `DELETE /api/webhooks/{webhook_id}/`: Delete webhook and cascade its delivery logs.
- `POST /api/webhooks/{webhook_id}/test/`: Dispatch an immediate `test.ping` event.
- `POST /api/webhooks/{webhook_id}/rotate-secret/`: Rotate signing secret and return the new secret once.
- `GET /api/webhooks/{webhook_id}/deliveries/`: List delivery attempt history for the webhook.
- `POST /api/webhook-deliveries/{delivery_id}/retry/`: Re-queue a failed or retrying webhook delivery.


