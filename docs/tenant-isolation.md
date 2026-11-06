# Tenant Isolation & Data Integrity Strategy

## 1. Strategy Overview

**SprintSync** implements a shared-schema multi-tenant architecture with tenant isolation anchored around the `Workspace` entity.

Tenant separation relies on a **three-tier defensive barrier**:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Database Tier: Foreign Keys, Unique & Check Constraints  │
├─────────────────────────────────────────────────────────────┤
│ 2. Model Tier: clean() validation & full_clean() hooks      │
├─────────────────────────────────────────────────────────────┤
│ 3. API Tier: Workspace Context Middleware & Scoped QuerySets│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tier 1: Database Constraints

The following rules are guaranteed by PostgreSQL database constraints:

1. **Workspace Boundary**:
   - `Project`, `Board`, `Issue`, and `Sprint` all store a foreign key `workspace_id`.
   - Cascade deletions: When an organization workspace is deleted, all projects, boards, sprints, and issues under that workspace are cascade-cleaned.
2. **Per-Tenant Uniqueness**:
   - `unique_project_slug_per_workspace`: Different workspaces can use the same project slug (`web-app`), but duplicates within the same workspace are forbidden.
   - `unique_issue_key_per_workspace`: Issue keys (`DEV-12`) are strictly unique per workspace.
   - `unique_board_name_per_project`: Board names are unique within their parent project.
   - `unique_workspace_user_membership`: A user cannot possess duplicate membership records in a single workspace.
3. **Temporal Invariants**:
   - `project_due_date_gte_start_date`: Check constraint ensures project `due_date >= start_date`.
   - `sprint_end_date_gte_start_date`: Check constraint ensures sprint `end_date >= start_date`.

---

## 3. Tier 2: Model & Service-Level Tenant Validation

Cross-table tenant boundaries that cannot be enforced via standard SQL constraints without complex database triggers are enforced in model `clean()` and `full_clean()` methods:

1. **Project Ownership**:
   - A project owner must be an active member of the workspace (or the workspace owner).
2. **Board Workspace Consistency**:
   - A board's `workspace_id` must match its parent project's `workspace_id`.
3. **Issue Relationship Consistency**:
   - An issue's project must belong to the issue's workspace.
   - If an issue is assigned to a board, that board must belong to the same project and workspace.
4. **Issue Reporter & Assignee Consistency**:
   - The issue reporter must be an active workspace member (or workspace owner).
   - If an assignee is designated, the assignee must be an active workspace member (or workspace owner). Users outside the organization cannot be assigned tasks.
5. **Sprint Workspace Consistency**:
   - A sprint's `workspace_id` must match its project's `workspace_id`.
6. **Project Member Tenant Scoping**:
   - `ProjectMember` assignment mandates that the user must already hold an active `WorkspaceMembership` in the parent organization workspace.
7. **Cross-Project Issue-Sprint Tenant Guard**:
   - When an issue is linked to a sprint, both the issue and the sprint must belong to the exact same `Project` and `Workspace`. Cross-project sprint assignment is rejected with a `ValidationError`.

---

## 4. Tier 3: API-Level Authorization & QuerySet Isolation (Implemented in Stage 3)

Model-level checks provide integrity, while API-level security prevents unauthorized tenant data access:

1. **Workspace Context & Permission Guards**:
   - Every workspace endpoint (`/api/workspaces/{workspace_id}/...`) uses `get_active_workspace_membership()` to authenticate the caller against `WorkspaceMembership`.
   - If the caller does not belong to the workspace, or if their membership status is `INVITED` or `SUSPENDED`, the API returns `HTTP 403 Forbidden`.
   - Modifying request UUIDs in the URL or payload to point to another tenant's workspace fails authorization immediately.
2. **Tenant Scoped QuerySets**:
   - `GET /api/workspaces/` filters strictly by:
     ```python
     active_ws_ids = WorkspaceMembership.objects.filter(
         user=request.user,
         status=WorkspaceMembership.Status.ACTIVE
     ).values_list('workspace_id', flat=True)
     ```
   - Unauthenticated or non-member users never receive another tenant's workspace data.
3. **Cross-Tenant Mutation Prevention**:
   - Member addition, modification, and deletion endpoints (`/members/`, `/members/{id}/`) strictly require that the target membership belongs to the specified `workspace_id`.
   - Cross-tenant injection attempts (e.g., specifying Workspace A in the URL but a member ID from Workspace B) return `HTTP 404 Not Found`.

---

## 5. Security Test Scenarios Verified

The automated test suite (`apps.workspaces.tests.WorkspaceRBACAndTenantIsolationAPITests`) exercises the following critical attack and isolation scenarios:

1. **Tenant Cross-Read**: User A (Acme) attempts to list members of Workspace B (Beta) -> **HTTP 403 Forbidden**.
2. **Tenant Cross-Write**: User B attempts to invite/add a member to Workspace A -> **HTTP 403 Forbidden**.
3. **Tenant Cross-Delete**: User B attempts to delete an active member of Workspace A -> **HTTP 403 Forbidden**.
4. **Inactive Membership Revocation**: A suspended user attempts to list their workspaces -> **Excluded from results**.
5. **Invited Status Isolation**: An invited user attempts to list their workspaces -> **Excluded from results**.
6. **Self-Escalation**: An Admin attempts to promote themselves to Owner -> **HTTP 400 Bad Request**.
7. **Admin Privilege Ceiling**: An Admin attempts to promote another user to Owner -> **HTTP 400 Bad Request**.
8. **Admin Modifying Owner**: An Admin attempts to demote or remove an Owner -> **HTTP 400/403**.
9. **Last Owner Protection**: An Owner attempts to demote or remove the last active Owner -> **HTTP 400 Bad Request**.
10. **Workspace Creation Autonomy**: Any authenticated user can create an independent workspace tenant and is automatically established as `OWNER`.
11. **Workspace Deletion Safeguards**: Only the workspace `OWNER` can permanently delete the workspace and cascade all its tenant data. Admins, members, and viewers receive **HTTP 403 Forbidden**.
12. **Member Suspension Cutoff**: Suspending a member immediately invalidates their access to workspace details and member directories (**HTTP 403 Forbidden**), while reactivation restores their access.

---

## 6. Tier 4: Stage 6 Collaboration & Media Tenant Isolation

1. **Comment Scoping**:
   - Every `Comment` is bound to both `issue_id` and `workspace_id`.
   - APIs ensure comments cannot be posted, read, updated, or deleted cross-tenant.
   - Non-active or cross-tenant users receive `HTTP 403 Forbidden`.
2. **File Storage & Download Isolation**:
   - Files are stored on disk in subdirectories partitioned by workspace: `media/attachments/{workspace_id}/{issue_id}/...`.
   - Downloads via `GET /api/attachments/{id}/download/` require active workspace membership for the parent workspace; foreign tenants receive `HTTP 403 Forbidden`.
3. **Audit Log RBAC & Isolation**:
   - `AuditLog` records administrative events strictly within their tenant workspace.
   - Reading audit logs is restricted to `OWNER` and `ADMIN` roles. Non-admins (`MEMBER`, `VIEWER`) and outsiders receive `HTTP 403 Forbidden`.
4. **Custom Workflow State Invariants**:
   - `WorkflowTransition` records are constrained per-board and per-workspace.
   - Tasks cannot be transitioned using rules configured on a different board or belonging to another workspace.


