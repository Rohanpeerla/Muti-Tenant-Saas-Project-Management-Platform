# Role-Based Access Control (RBAC) & Permissions

## 1. Role Hierarchy & Permissions Matrix

SprintSync implements role-based access control scoped strictly to an organization workspace via `WorkspaceMembership.Role`.

| Permission / Action | OWNER | ADMIN | PROJECT_MANAGER | MEMBER | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|
| **Workspace Settings & Deletion** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage Owners (Demote / Transfer)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Invite / Add Members (Admin & below)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Remove / Demote Members (Admin & below)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create & Configure Projects** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage Sprints & Boards** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Create / Update Assigned Issues** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View Workspace Data (Read-Only)** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 2. Membership Status Behavior

Every membership contains a `status` field (`WorkspaceMembership.Status`):

| Status | Access Effect |
|---|---|
| **`ACTIVE`** | Full access to workspace resources corresponding to the assigned role. |
| **`INVITED`** | Blocked from accessing workspace endpoints and resources until the invitation is accepted. |
| **`SUSPENDED`** | Immediately revoked from all workspace access; querysets exclude suspended users. |

---

## 3. Reusable DRF Permission Classes

Defined in `apps.workspaces.permissions`:

### `IsWorkspaceMember`
- Verifies that `request.user` possesses an `ACTIVE` `WorkspaceMembership` in the workspace identified by the URL parameter `workspace_id`.
- Rejects unauthenticated callers (`401`) and non-members/suspended members (`403`).

### `IsWorkspaceAdmin`
- Restricts access to members with `role in [OWNER, ADMIN]`.
- Used to guard member management endpoints (`POST /members/`, `PATCH /members/{id}/`, `DELETE /members/{id}/`).

### `IsWorkspaceOwner`
- Restricts access exclusively to workspace `OWNER`.
- Guarantees that only owners can assign or transfer the `OWNER` role, and non-owners cannot demote an owner.

### `IsProjectManagerOrAbove`
- Grants access to members with `role in [OWNER, ADMIN, PROJECT_MANAGER]`.
- Will govern sprint planning and project lifecycle modifications in future stages.

### `IsWorkspaceMemberOrReadOnly`
- Allows safe HTTP methods (`GET`, `HEAD`, `OPTIONS`) to all active members including `VIEWER`.
- Restricts write HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) to active members with `role != VIEWER`.

---

## 4. Privilege Escalation & Protection Safeguards

1. **Last Owner Protection**:
   - The last active `OWNER` of a workspace cannot be demoted or deleted.
   - The primary organization owner cannot be removed.
2. **Self-Escalation Lockout**:
   - Members cannot modify their own role (e.g., an `ADMIN` cannot promote themselves to `OWNER`).
3. **Admin Ceiling**:
   - Users with the `ADMIN` role cannot grant the `OWNER` role to anyone.
   - Users with the `ADMIN` role cannot demote or remove an `OWNER`.

