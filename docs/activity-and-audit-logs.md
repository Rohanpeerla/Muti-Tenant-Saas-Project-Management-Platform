# Activity Tracking and Audit Logging

## 1. Overview
SprintSync provides two levels of historical audit tracking:
1. **Task Activity Timeline (`IssueActivity`)**: High-granularity event history detailing status changes, priority edits, reassignments, sprint moves, comments, and attachments on individual tasks.
2. **Workspace Audit Logs (`AuditLog`)**: Administrative and security tracking for workspace-wide events such as member invitations, role changes, removals, and setting updates.

---

## 2. Task Activity Timeline (`IssueActivity`)

### Tracked Events
- `CREATED`: Task was created.
- `UPDATED`: Task title or description updated.
- `STATUS_CHANGED`: Status transitioned (e.g., TODO -> IN_PROGRESS).
- `PRIORITY_CHANGED`: Priority changed (e.g., MEDIUM -> HIGH).
- `ASSIGNEE_CHANGED`: Assigned or unassigned team member.
- `SPRINT_CHANGED`: Moved into or removed from a sprint.
- `COMMENT_ADDED`: Comment added to task.
- `COMMENT_DELETED`: Comment removed from task.
- `ATTACHMENT_ADDED`: File attachment uploaded.
- `ATTACHMENT_DELETED`: File attachment deleted.

### Model Schema
- `issue`: ForeignKey to `Issue` (CASCADE).
- `workspace`: ForeignKey to `Workspace` (CASCADE).
- `actor`: ForeignKey to User model (SET_NULL, nullable for system actions).
- `activity_type`: One of the enumerated types above.
- `description`: Human-readable summary (e.g. `Status changed from "To Do" to "In Progress"`).
- `metadata`: JSONField storing before/after state (e.g. `{"old_status": "TODO", "new_status": "IN_PROGRESS"}`).
- `created_at`: Timestamp indexed with issue for chronological ordering.

### API Endpoint
- `GET /api/issues/{issue_id}/activities/`:
  - Returns chronological list of activity events for the task.
  - Requires active workspace membership.

---

## 3. Workspace Audit Logs (`AuditLog`)

### Tracked Administrative Events
- `WORKSPACE_CREATED`: Workspace provisioned.
- `WORKSPACE_UPDATED`: Workspace name or settings modified.
- `MEMBER_INVITED`: Member invitation issued.
- `MEMBER_JOINED`: Member accepted invitation.
- `MEMBER_ROLE_CHANGED`: Member role elevated or demoted.
- `MEMBER_SUSPENDED`: Member access suspended.
- `MEMBER_REACTIVATED`: Member reinstated.
- `MEMBER_REMOVED`: Member removed from workspace.

### Model Schema
- `workspace`: ForeignKey to `Workspace` (CASCADE).
- `actor`: ForeignKey to User model (SET_NULL, null if system action).
- `event_type`: Event identifier string (e.g. `MEMBER_ROLE_CHANGED`).
- `description`: Human-readable description of the administrative action.
- `ip_address`: Optional IP address recorded at request time.
- `metadata`: JSONField with structured context (e.g. `{"user_id": "...", "old_role": "MEMBER", "new_role": "ADMIN"}`).
- `created_at`: Timestamp indexed with workspace.

### API Endpoint & RBAC Enforcement
- `GET /api/workspaces/{workspace_id}/audit-logs/`:
  - Strictly restricted to workspace `OWNER` and `ADMIN`.
  - Calling this endpoint with role `MEMBER` or `VIEWER` immediately returns `HTTP 403 Forbidden`.
  - Outside users with no active membership are rejected with `HTTP 403 Forbidden`.
- **Immutability**: Audit logs cannot be updated or deleted via REST APIs (read-only endpoint).

