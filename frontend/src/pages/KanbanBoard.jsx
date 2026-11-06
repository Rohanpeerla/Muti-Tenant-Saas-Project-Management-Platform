import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { projectService, boardService, issueService, sprintService } from '../services/api';
import KanbanColumn from '../components/KanbanColumn';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import CreateTaskModal from '../components/CreateTaskModal';

const KanbanBoard = () => {
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [sprints, setSprints] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [sprintFilter, setSprintFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  // Modals & Active Drag State
  const [activeTask, setActiveTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetColumnKey, setTargetColumnKey] = useState('TODO');

  // Add Column Modal State
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnKey, setNewColumnKey] = useState('');
  const [columnLoading, setColumnLoading] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadBoardData();
  }, [projectId]);

  const loadBoardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [projData, boardsList, membersList, sprintsList, issuesList] = await Promise.all([
        projectService.getProjectDetails(projectId),
        boardService.getBoards(projectId),
        projectService.getProjectMembers(projectId),
        sprintService.getSprints(projectId),
        issueService.getIssues(projectId),
      ]);

      setProject(projData);
      setMembers(membersList);
      setSprints(sprintsList);
      setTasks(issuesList.results || issuesList);

      let activeBoard = boardsList[0];
      if (!activeBoard) {
        // Create default board if none exists
        activeBoard = await boardService.createBoard(projectId, {
          name: `${projData.name} Board`,
          is_default: true,
        });
      }

      // Fetch full board with columns
      const boardDetail = await boardService.getBoardDetails(activeBoard.id);
      setBoard(boardDetail);
      setColumns(boardDetail.columns || []);
    } catch (err) {
      setError('Failed to load Kanban board. Please verify permissions.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.issue_key.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSprint = sprintFilter
        ? sprintFilter === 'backlog'
          ? !t.sprint
          : t.sprint === sprintFilter
        : true;
      const matchesPriority = priorityFilter ? t.priority === priorityFilter : true;
      const matchesAssignee = assigneeFilter ? t.assignee?.id === assigneeFilter : true;

      return matchesSearch && matchesSprint && matchesPriority && matchesAssignee;
    });
  }, [tasks, searchQuery, sprintFilter, priorityFilter, assigneeFilter]);

  // Group tasks by column key (or status)
  const tasksByColumn = useMemo(() => {
    const map = {};
    columns.forEach((c) => {
      map[c.key] = [];
    });

    filteredTasks.forEach((task) => {
      const colKey = task.status;
      if (!map[colKey]) {
        map[colKey] = [];
      }
      map[colKey].push(task);
    });

    // Sort each column by position
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => a.position - b.position);
    });

    return map;
  }, [columns, filteredTasks]);

  // DnD Handlers
  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find dragged task
    const currentTask = tasks.find((t) => t.id === activeId);
    if (!currentTask) return;

    // Check if dropped directly on a column or onto another task
    let destinationColumnKey = null;
    let newPosition = 0;

    // Is 'over' a column?
    const isOverColumn = columns.some((col) => col.key === overId);
    if (isOverColumn) {
      destinationColumnKey = overId;
      const colTasks = tasksByColumn[destinationColumnKey] || [];
      newPosition = colTasks.length;
    } else {
      // Over is another task card
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        destinationColumnKey = overTask.status;
        newPosition = overTask.position;
      }
    }

    if (!destinationColumnKey) return;

    // Don't do unnecessary calls if dropped in place
    if (currentTask.status === destinationColumnKey && currentTask.position === newPosition) {
      return;
    }

    // Optimistic Update
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === activeId) {
          return { ...t, status: destinationColumnKey, position: newPosition };
        }
        return t;
      })
    );

    try {
      await issueService.moveIssue(activeId, {
        status: destinationColumnKey,
        position: newPosition,
        board_id: board.id,
      });
    } catch (err) {
      // Rollback on failure
      setTasks(previousTasks);
      alert('Failed to update task position. Rolling back.');
    }
  };

  // Column Actions
  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumnName.trim() || !newColumnKey.trim()) return;

    setColumnLoading(true);
    try {
      const createdCol = await boardService.addColumn(board.id, {
        name: newColumnName.trim(),
        key: newColumnKey.trim().toUpperCase(),
        position: columns.length,
      });
      setColumns((prev) => [...prev, createdCol]);
      setIsAddColumnOpen(false);
      setNewColumnName('');
      setNewColumnKey('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add column.');
    } finally {
      setColumnLoading(false);
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleAddTaskClick = (colKey) => {
    setTargetColumnKey(colKey);
    setIsCreateModalOpen(true);
  };

  const handleTaskCreated = (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleTaskUpdated = (updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    setSelectedTask(updatedTask);
  };

  const handleTaskDeleted = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setIsTaskModalOpen(false);
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
        <p className="mt-3 text-xs text-slate-500">Loading Kanban board...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error || 'Project not found.'}
        </div>
        <div className="mt-4">
          <Link to="/projects" className="text-xs font-semibold text-indigo-600 hover:underline">
            &larr; Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100">
      {/* Board Top Header */}
      <div className="px-6 py-3.5 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-3xs text-slate-400 mb-0.5">
            <Link to="/projects" className="hover:text-indigo-400">Projects</Link>
            <span>/</span>
            <Link to={`/projects/${project.id}`} className="hover:text-indigo-400 font-semibold">{project.name}</Link>
            <span>/</span>
            <span className="text-white font-bold">Kanban Board</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black tracking-tight text-white">{project.name}</h1>
            <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              {project.key}
            </span>
          </div>
        </div>

        {/* Action Buttons & Filter Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-white/10 bg-slate-900 text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-36 sm:w-48"
            />
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Sprint Filter */}
          <select
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-slate-900 text-slate-200 font-semibold focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">All Sprints</option>
            <option value="backlog">Backlog only</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-slate-900 text-slate-200 font-semibold focus:outline-hidden focus:border-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Add Column Button */}
          <button
            type="button"
            onClick={() => setIsAddColumnOpen(true)}
            className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-colors cursor-pointer"
          >
            + Column
          </button>

          {/* New Task Button */}
          <button
            type="button"
            onClick={() => {
              setTargetColumnKey('TODO');
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Board Droppable Canvas */}
      <div className="flex-1 overflow-x-auto p-6 flex gap-5 items-start">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column.key}
              column={column}
              tasks={tasksByColumn[column.key] || []}
              onTaskClick={handleTaskClick}
              onAddTaskClick={handleAddTaskClick}
            />
          ))}

          {/* Drag Overlay for smooth preview */}
          <DragOverlay>
            {activeTask ? (
              <div className="rotate-2 scale-105 shadow-xl">
                <TaskCard task={activeTask} onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Details & Edit Modal */}
      <TaskModal
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
        members={members}
        sprints={sprints}
        columns={columns}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        projectId={project.id}
        boardId={board?.id}
        initialStatus={targetColumnKey}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTaskCreated={handleTaskCreated}
        members={members}
        sprints={sprints}
        columns={columns}
      />

      {/* Add Column Modal */}
      {isAddColumnOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">Add Board Column</h3>
            <form onSubmit={handleAddColumn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Column Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QA Testing"
                  value={newColumnName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewColumnName(val);
                    if (!newColumnKey || newColumnKey === newColumnName.replace(/\s+/g, '_').toUpperCase()) {
                      setNewColumnKey(val.replace(/\s+/g, '_').toUpperCase());
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Column Key / Status
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QA"
                  value={newColumnKey}
                  onChange={(e) => setNewColumnKey(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddColumnOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={columnLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  {columnLoading ? 'Adding...' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;

