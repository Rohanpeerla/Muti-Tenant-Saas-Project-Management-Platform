# Project Management Module

## 1. Overview
The Project Management module in **SprintSync** provides organizations with the ability to define, organize, and monitor software initiatives within a strictly isolated multi-tenant architecture.

Each project belongs to a `Workspace` and serves as the operational parent for:
- Project Members and Roles
- Kanban Boards and Columns
- Issues and Tasks
- Agile Sprints

---

## 2. Data Model Architecture

### `Project`
- **Fields**:
  - `id`: UUID primary key.
  - `workspace`: Foreign key to `Workspace` (on_delete=CASCADE).
  - `name`: Human-readable project name (max 200 chars).
  - `slug`: URL-friendly identifier, unique per workspace.
  - `key`: Uppercase alphanumeric key (e.g. `DEV`, `CLD`, max 10 chars), unique per workspace. Auto-generated from project name if omitted.
  - `description`: Text overview of project goals.
  - `status`: `PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `ARCHIVED`.
  - `owner`: Foreign key to `User`.
  - `start_date` / `end_date`: Date fields with check constraint (`end_date >= start_date`).
  - `created_at` / `updated_at`: Timestamps.
- **Computed Metrics**:
  - `task_count`: Total issues in project.
  - `completed_task_count`: Issues with status `DONE`.
  - `progress_percentage`: `(completed / total) * 100` (0 if no tasks).
  - `member_count`: Count of active assigned project members.

### `ProjectMember`
- **Fields**:
  - `id`: UUID primary key.
  - `project`: Foreign key to `Project`.
  - `user`: Foreign key to `User`.
  - `role`: `PROJECT_MANAGER`, `MEMBER`, `VIEWER`.
  - `joined_at`: Timestamp.
- **Constraints**:
  - Unique constraint on `(project, user)`.
  - `clean()` enforces that the user must be an active member of the project's parent workspace.

---

## 3. REST API Endpoints

| Method | Endpoint | Description | Role / Permissions |
|---|---|---|---|
| `GET` | `/api/workspaces/{workspace_id}/projects/` | List all projects in workspace with metrics & search/status filter | Workspace Member |
| `POST` | `/api/workspaces/{workspace_id}/projects/` | Create a new project (auto-creates default board & columns) | Workspace Member |
| `GET` | `/api/projects/{project_id}/` | Get detailed project metrics, progress, and team count | Project / Workspace Member |
| `PATCH` | `/api/projects/{project_id}/` | Update project settings, dates, or status | Owner / Admin / Project Manager |
| `DELETE` | `/api/projects/{project_id}/` | Cascade delete project and associated resources | Owner / Admin |
| `GET` | `/api/projects/{project_id}/members/` | List project team members | Project / Workspace Member |
| `POST` | `/api/projects/{project_id}/members/` | Assign a workspace member to project | Project Manager / Workspace Admin |
| `DELETE` | `/api/projects/{project_id}/members/{id}/` | Remove member from project | Project Manager / Workspace Admin |

---

## 4. Frontend Integration
- **Route**: `/projects` (`Projects.jsx`)
  - Workspace-scoped listing, status tabs, search filter, and "New Project" modal.
- **Route**: `/projects/:projectId` (`ProjectOverview.jsx`)
  - Executive dashboard with completion metrics, active sprint widget, team roster, and direct navigation into Boards and Sprints.
- **Route**: `/projects/:projectId/settings` (`ProjectSettings.jsx`)
  - General settings editor and safeguarded Danger Zone deletion.

