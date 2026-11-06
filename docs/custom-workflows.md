# Custom Kanban Workflows & Transition Validation

## 1. Overview
SprintSync allows teams to configure custom columns and workflow transition constraints for Kanban boards. Workflows can be operated in unrestricted mode (any move allowed) or constrained mode (strict finite-state machine enforcement).

---

## 2. Enhanced Board Columns (`BoardColumn`)

### Column Model Attributes
- `name`: Column name (e.g., "To Do", "In Code Review", "Ready for QA", "Done").
- `color`: Hex color string representing status visually (e.g. `#6366F1`, `#10B981`).
- `order`: Integer specifying left-to-right display order on Kanban boards.
- `is_default`: Boolean indicating the default column for newly created tasks.
- `is_completion`: Boolean designating columns that mark tasks as completed.
- `wip_limit`: Optional work-in-progress limit integer.

### Reordering Endpoint
`POST /api/boards/{board_id}/columns/reorder/`
- **Payload**:
  ```json
  {
    "order": [
      { "id": "uuid-col-1", "order": 0 },
      { "id": "uuid-col-2", "order": 1 },
      { "id": "uuid-col-3", "order": 2 }
    ]
  }
  ```
- Atomically updates column ordering within the board.
- Requires workspace `OWNER`, `ADMIN`, or `PROJECT_MANAGER` permission.

---

## 3. Workflow Transition Rules (`WorkflowTransition`)

### Model Schema
- `board`: ForeignKey to `Board` (CASCADE).
- `workspace`: ForeignKey to `Workspace` (CASCADE).
- `from_column`: ForeignKey to `BoardColumn` (source column).
- `to_column`: ForeignKey to `BoardColumn` (destination column).
- **Constraints**:
  - `UniqueConstraint` on `[board, from_column, to_column]`.
  - Both columns must belong to the exact same board.

### Workflow Enforcement Modes
1. **Unrestricted / Free-Flow Mode**:
   - If a board has **zero** `WorkflowTransition` records configured, any status transition is permitted.
   - Ensures backwards compatibility with default boards and standard agile workflows.
2. **Constrained / Governed Mode**:
   - As soon as **one or more** `WorkflowTransition` rules exist for a board, any task movement between columns is strictly validated on the backend.
   - Moving from `from_column` to `to_column` is permitted **only** if an explicit `WorkflowTransition` rule exists.
   - Disallowed transitions are immediately rejected by `IssueMoveView` with `HTTP 400 Bad Request` and detailed error message:
     ```json
     {
       "error": "Invalid workflow transition from \"In Review\" to \"Done\". This transition is not permitted by board workflow rules."
     }
     ```

### Transition Management APIs
- `GET /api/boards/{board_id}/transitions/`: Lists all allowed transitions for the board.
- `POST /api/boards/{board_id}/transitions/`: Defines an allowed transition rule (`from_column_id`, `to_column_id`).
- `DELETE /api/boards/{board_id}/transitions/{id}/`: Deletes an allowed transition rule.

---

## 4. Frontend Integration
- **Workflow Settings Page**: Located at `/projects/:projectId/settings/workflow`.
- **WorkflowColumnEditor**: Enables adding, editing column names, colors, and reordering columns.
- **WorkflowTransitionEditor**: Matrix / list view allowing managers to toggle permitted column transitions.
- **Kanban Board UX**: If an invalid drag-and-drop move is attempted on the Kanban board, the backend rejects it and the UI resets the task position while displaying the validation error toast.

