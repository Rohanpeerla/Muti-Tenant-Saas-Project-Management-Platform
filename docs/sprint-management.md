# Sprint Management & Agile Iterations

## 1. Overview
SprintSync offers structured Scrum sprint workflows with strict enforcement of Agile lifecycle rules:
- **Sprint States**: `PLANNED` &rarr; `ACTIVE` &rarr; `COMPLETED`.
- **Single Active Sprint Rule**: A project may possess only **one** `ACTIVE` sprint at any point in time. Attempting to start a second active sprint is rejected with HTTP 400 Bad Request.
- **Sprint Isolation**: Sprints and their assigned issues must strictly belong to the same project and parent workspace.
- **Progress Tracking**: Real-time computation of `total_tasks`, `completed_tasks`, `remaining_tasks`, and `progress_percentage`.

---

## 2. Sprint Lifecycle

```text
 ┌─────────────┐       POST /api/sprints/{id}/start/        ┌────────────┐
 │   PLANNED   │ ─────────────────────────────────────────> │   ACTIVE   │
 └─────────────┘                                            └────────────┘
        │                                                         │
        │ DELETE                                                  │ POST /api/sprints/{id}/complete/
        v                                                         v
 ┌─────────────┐                                            ┌────────────┐
 │   DELETED   │                                            │ COMPLETED  │
 └─────────────┘                                            └────────────┘
```

1. **Planning**: Sprints are created in `PLANNED` status with start and end dates and an overarching goal.
2. **Backlog Planning**: Unscheduled tasks from the project backlog are assigned to the planned sprint.
3. **Execution**: Team starts the sprint. Backend checks that no other sprint in the project is currently `ACTIVE`.
4. **Completion**: Upon finishing the iteration, the sprint status transitions to `COMPLETED`. Incomplete tasks can be carried over or returned to the project backlog.

---

## 3. Sprint REST APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects/{project_id}/sprints/` | List all sprints in project with real-time progress metrics |
| `POST` | `/api/projects/{project_id}/sprints/` | Create a new sprint |
| `GET` | `/api/sprints/{sprint_id}/` | Get sprint details, metrics, and associated issues |
| `PATCH` | `/api/sprints/{sprint_id}/` | Update sprint name, goal, or date range |
| `DELETE` | `/api/sprints/{sprint_id}/` | Delete sprint (unassigns tasks back to backlog) |
| `POST` | `/api/sprints/{sprint_id}/start/` | Start sprint (enforces single active sprint per project) |
| `POST` | `/api/sprints/{sprint_id}/complete/` | Complete sprint and close iteration |

---

## 4. Frontend Integration (`SprintManagement.jsx`)
- **Route**: `/projects/:projectId/sprints`
- **Sections**:
  1. **Active Sprint Widget**: Displays the running sprint, dates, completion progress bar, and "Complete Sprint" action.
  2. **Planned Sprints Queue**: Sprints queued up for upcoming cycles with a "Start Sprint" action and assigned task previews.
  3. **Project Backlog**: Visual pool of unassigned tasks with one-click dropdown to assign into any planned sprint.
  4. **Completed History**: Archived list of previous sprints.

