# Task Comments and Team Collaboration

## 1. Overview
The Comments module provides real-time team discussion on individual tasks while enforcing multi-tenant isolation, role-based access control, and content sanitization.

---

## 2. Data Model

### `Comment`
- **Fields**:
  - `id`: UUID primary key.
  - `issue`: ForeignKey to `Issue` (CASCADE).
  - `workspace`: ForeignKey to `Workspace` (CASCADE).
  - `author`: ForeignKey to User model (CASCADE).
  - `content`: Non-empty text content (max 10,000 characters).
  - `is_edited`: Boolean indicating whether the comment has been modified.
  - `created_at` / `updated_at`: Timestamps.
- **Constraints & Indexes**:
  - Index on `[issue, created_at]`.
  - Index on `[workspace, created_at]`.
- **Integrity Validation**:
  - `author` must possess an `ACTIVE` membership in `workspace` (or be workspace owner).
  - `workspace` must strictly align with `issue.workspace`.

---

## 3. RBAC Permissions Matrix

| Role | Read Comments | Add Comment | Edit Own Comment | Delete Own Comment | Delete Member Comment (Moderation) |
|---|---|---|---|---|---|
| **OWNER** | Yes | Yes | Yes | Yes | Yes |
| **ADMIN** | Yes | Yes | Yes | Yes | Yes |
| **PROJECT_MANAGER** | Yes | Yes | Yes | Yes | Yes (if authorized) |
| **MEMBER** | Yes | Yes | Yes | Yes | No |
| **VIEWER** | Yes | No (403) | No (403) | No (403) | No (403) |
| **SUSPENDED / OUTSIDER**| No (403) | No (403) | No (403) | No (403) | No (403) |

---

## 4. REST APIs

### `GET /api/issues/{issue_id}/comments/`
- Lists all comments for an issue in chronological order.
- Requires active workspace membership.

### `POST /api/issues/{issue_id}/comments/`
- Request:
  ```json
  {
    "content": "Finished implementing JWT token refresh."
  }
  ```
- Creates comment, automatically generating an `IssueActivity` event (`COMMENT_ADDED`).

### `PATCH /api/comments/{comment_id}/`
- Author edits their own comment. Marks `is_edited = true`.

### `DELETE /api/comments/{comment_id}/`
- Deletes comment and generates an `IssueActivity` event (`COMMENT_DELETED`). Allowed for author or workspace OWNER/ADMIN.

---

## 5. Security Safeguards
- **XSS & Injection Protection**: Comments are treated as plain text strings, safely rendered in React without `dangerouslySetInnerHTML`.
- **Tenant Scoping**: Queries verify that `issue.workspace` matches the authenticated caller's active tenant membership. Cross-tenant access is rejected with `HTTP 403 Forbidden`.

