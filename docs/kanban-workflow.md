# Kanban Workflow & Drag-and-Drop Architecture

## 1. Overview
The Kanban Board module in **SprintSync** provides a visual workflow system modeled after modern agile tools like Jira and Trello.

It combines:
- Dynamic boards with customizable workflow columns (`BoardColumn`).
- Automatic column seeding for new boards (`To Do`, `In Progress`, `In Review`, `Done`).
- Smooth drag-and-drop task movements powered by `@dnd-kit/core` and `@dnd-kit/sortable`.
- Atomic backend status and position recalculation.
- Optimistic frontend updates with automated rollback on API failure.

---

## 2. Models & Schema

### `Board`
- `id`: UUID primary key.
- `workspace`: Foreign key to `Workspace`.
- `project`: Foreign key to `Project`.
- `name`: Board name (e.g. `Engineering Board`).
- `description`: Board purpose.
- `is_default`: Boolean indicating whether this is the primary project board.
- `position`: Integer ordering for project boards.

### `BoardColumn`
- `id`: UUID primary key.
- `board`: Foreign key to `Board` (on_delete=CASCADE).
- `name`: Human-friendly label (e.g. `In Review`).
- `key`: Uppercase status identifier (e.g. `IN_REVIEW`), unique per board.
- `position`: Positive integer ordering columns from left to right.
- `color`: Hex color code string for column styling (e.g. `#3B82F6`).
- `is_default`: Boolean indicating whether this column is the default for new tasks.
- `is_completion`: Boolean designating columns that mark tasks as completed.
- `wip_limit`: Optional work-in-progress limit integer.
- **Safeguard**:
  - `BoardColumn` deletion is blocked (HTTP 400 Bad Request) if any active issues currently reside in that column.

### `WorkflowTransition` (Stage 6)
- `id`: UUID primary key.
- `board`: Foreign key to `Board` (CASCADE).
- `workspace`: Foreign key to `Workspace` (CASCADE).
- `from_column`: Foreign key to `BoardColumn` (source status).
- `to_column`: Foreign key to `BoardColumn` (destination status).
- **Rule Enforcement**:
  - If a board has no transition rules defined, movement is unconstrained (free-flow).
  - Once transition rules exist for a board, any task movement must adhere to an existing `WorkflowTransition` rule. Unpermitted transitions are rejected with HTTP 400.

---

## 3. Drag-and-Drop Architecture

### Frontend Layer (`KanbanBoard.jsx`)
- Built with `@dnd-kit/core` using `closestCorners` collision detection.
- `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })` allows natural clicking for modals without accidentally initiating drags.
- `DragOverlay` provides a rotated, shadowed preview during active drags.
- **Optimistic State Transition**:
  1. User drops a task in a destination column or between existing cards.
  2. Local state immediately places the card at the destination index.
  3. `issueService.moveIssue(taskId, { status: newStatus, position: newPosition, board_id })` is fired.
  4. If the network or backend returns an error, the local task list automatically reverts to the previous snapshot.

### Backend Atomic Movement (`IssueMoveView`)
- Endpoint: `POST /api/issues/{issue_id}/move/`
- Payload:
  ```json
  {
    "status": "IN_PROGRESS",
    "position": 2,
    "board_id": "optional-uuid"
  }
  ```
- Operations inside an atomic transaction:
  1. Shifting subsequent tasks forward: `Issue.objects.filter(..., position__gte=target_position).update(position=F('position') + 1)`.
  2. Saving new `status` and `position` on the active issue.
  3. Auto-updating timestamps and returning serialized issue data.

---

## 4. Column & Task Management APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects/{project_id}/boards/` | List boards in project |
| `POST` | `/api/projects/{project_id}/boards/` | Create board (auto-seeds 4 default columns) |
| `GET` | `/api/boards/{board_id}/` | Get board details with nested columns |
| `POST` | `/api/boards/{board_id}/columns/` | Add custom workflow column |
| `PATCH` | `/api/boards/{board_id}/columns/{id}/` | Rename column, update color or completion flags |
| `DELETE` | `/api/boards/{board_id}/columns/{id}/` | Delete column (fails if tasks exist) |
| `POST` | `/api/boards/{board_id}/columns/reorder/` | Reorder columns atomically |
| `GET` | `/api/boards/{board_id}/transitions/` | List allowed workflow transitions |
| `POST` | `/api/boards/{board_id}/transitions/` | Define an allowed workflow transition rule |
| `DELETE` | `/api/boards/{board_id}/transitions/{id}/` | Delete a workflow transition rule |
| `POST` | `/api/issues/{issue_id}/move/` | Move task across columns with transition validation |

