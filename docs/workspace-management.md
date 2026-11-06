# SprintSync — Workspace Management & Multi-Tenant Onboarding (Stage 4)

## Overview
Stage 4 introduces end-to-end workspace lifecycle management, multi-tenant onboarding, and tenant-aware role-based access control (RBAC) to **SprintSync**. Workspaces serve as independent tenant organizations within a shared PostgreSQL schema. All projects, boards, sprints, issues, and team memberships belong strictly to a single workspace.

---

## 1. Multi-Tenant Architecture & Workspace Model
Each tenant is represented by a `Workspace` entity:

```
Workspace
 ├── id (UUID, PK)
 ├── name (CharField)
 ├── slug (SlugField, unique, indexed)
 ├── description (TextField)
 ├── owner (FK -> User, on_delete=PROTECT)
 ├── logo (CharField URL/ref)
 ├── is_active (BooleanField, indexed)
 ├── created_at (DateTimeField)
 └── updated_at (DateTimeField)
```

### Automatic Tenant Creator Assignment
When a user registers or initiates workspace creation via `POST /api/workspaces/`:
1. The unique slug is auto-generated via Django `slugify()`. If a slug collision occurs, a random 6-character hex suffix is appended.
2. In a single atomic transaction (`transaction.atomic()`):
   - The `Workspace` is created with `owner = request.user`.
   - A `WorkspaceMembership` is created assigning the creator the role `OWNER` with status `ACTIVE`.
3. The response returns the workspace details along with `current_user_role: "OWNER"` and `member_count: 1`.

---

## 2. Workspace RBAC Permissions Matrix

| Capability / Action | OWNER | ADMIN | PROJECT_MANAGER | MEMBER | VIEWER |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Workspace Details** | Yes | Yes | Yes | Yes | Yes |
| **Update Workspace Settings** (name, description) | Yes | Yes | No | No | No |
| **Delete Workspace** (cascade delete) | Yes | No | No | No | No |
| **View Workspace Members** | Yes | Yes | Yes | Yes | Yes |
| **Invite Team Member** | Yes | Yes | No | No | No |
| **Assign OWNER Role** | Yes | No | No | No | No |
| **Modify Role / Status of Members** | Yes | Yes (non-owners) | No | No | No |
| **Suspend / Reactivate Member** | Yes | Yes (non-owners) | No | No | No |
| **Remove Member from Workspace** | Yes | Yes (non-owners) | No | No | No |
| **Self-Escalate Role** | No | No | No | No | No |
| **Remove / Demote Last Active Owner** | No | No | No | No | No |

---

## 3. Security Safeguards

### A. Last Owner Protection
A workspace must always maintain at least one active `OWNER`. If an administrator or owner attempts to demote, suspend, or delete the last active owner of a workspace, the request is rejected with HTTP `400 Bad Request`.

### B. Self-Escalation Lockout
Users are strictly prohibited from modifying their own membership role. Even an Admin cannot elevate their own role to Owner.

### C. Primary Owner Protection
The primary owner assigned at workspace creation (`workspace.owner_id`) cannot be removed from the workspace memberships table.

### D. Cross-Tenant Isolation
Every member and workspace query explicitly verifies that `request.user` has an `ACTIVE` membership in the targeted workspace. If a user belongs to Workspace A and attempts to view, modify, or delete resources in Workspace B, the API immediately responds with `403 Forbidden`. Suspended or invited users cannot access workspace endpoints.

---

## 4. API Endpoints Reference

### Workspaces
- `GET /api/workspaces/` — Lists all active workspaces for the authenticated user, annotated with `current_user_role` and `member_count`.
- `POST /api/workspaces/` — Creates a new workspace and assigns creator as OWNER.
- `GET /api/workspaces/{workspace_id}/` — Retrieves workspace details (Active members only).
- `PATCH /api/workspaces/{workspace_id}/` — Updates workspace name, description, or logo (Owner & Admin only).
- `DELETE /api/workspaces/{workspace_id}/` — Deletes workspace and cascades associated memberships (Owner only).

### Member Management & Invitations
- `GET /api/workspaces/{workspace_id}/members/` — Lists all members of the workspace.
- `POST /api/workspaces/{workspace_id}/members/` — Invites a registered user to the workspace with `INVITED` status (Owner & Admin only).
- `PATCH /api/workspaces/{workspace_id}/members/{membership_id}/` — Updates member role or status (`ACTIVE` <-> `SUSPENDED`).
- `DELETE /api/workspaces/{workspace_id}/members/{membership_id}/` — Removes a member from the workspace.
- `GET /api/workspaces/invitations/` — Lists pending workspace invitations for the authenticated user.
- `POST /api/workspaces/invitations/{membership_id}/accept/` — Accepts a pending invitation, transitioning status to `ACTIVE`.
- `POST /api/workspaces/invitations/{membership_id}/decline/` — Declines and removes a pending workspace invitation.


---

## 5. Frontend Multi-Tenant Architecture

### Context & State Management
- `WorkspaceContext` (`frontend/src/context/WorkspaceContext.jsx`): Centralizes workspace selection, cached in `localStorage` under `sprintsync_current_workspace_id`.
- Auto-syncs active workspace across navigation and components.

### UI Views & Pages
1. **Onboarding (`/onboarding`)**: Clean, step-by-step setup screen for newly registered users or users creating an organization.
2. **Workspace Switcher (`/workspaces`)**: Visual card directory showing user workspaces, member counts, role badges, active badges, and search filtering.
3. **Workspace Settings (`/settings/workspace`)**: Form for editing workspace metadata, alongside a protected Danger Zone for workspace deletion.
4. **Team Management (`/settings/team`)**: Filterable table of team members with invitation modal, role change modal, suspend/reactivate toggles, and removal safeguards.
5. **Navbar Switcher Dropdown**: Accessible workspace switcher on every page displaying active organization and quick access shortcuts.

