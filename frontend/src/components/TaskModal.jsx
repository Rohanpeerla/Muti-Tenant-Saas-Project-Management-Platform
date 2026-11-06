import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { issueService } from '../services/api';
import CommentSection from './CommentSection';

const TaskModal = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  members = [],
  sprints = [],
  columns = [],
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    issue_type: 'TASK',
    assignee_id: '',
    sprint_id: '',
    due_date: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'TODO',
        priority: task.priority || 'MEDIUM',
        issue_type: task.issue_type || 'TASK',
        assignee_id: task.assignee?.id || '',
        sprint_id: task.sprint || '',
        due_date: task.due_date ? task.due_date.substring(0, 10) : '',
      });
      setError('');
      setDeleteConfirm(false);
      setIsEditing(false);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusQuickChange = async (newStatus) => {
    setLoading(true);
    setError('');
    try {
      const updated = await issueService.updateIssue(task.id, { status: newStatus });
      setFormData((prev) => ({ ...prev, status: newStatus }));
      onTaskUpdated(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title cannot be empty');
      return;
    }
    setLoading(true);
    setError('');

    const payload = {
      title: formData.title.trim(),
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      issue_type: formData.issue_type,
      assignee_id: formData.assignee_id || null,
      sprint_id: formData.sprint_id || null,
      due_date: formData.due_date || null,
    };

    try {
      const updated = await issueService.updateIssue(task.id, payload);
      setIsEditing(false);
      onTaskUpdated(updated);
    } catch (err) {
      const resp = err.response?.data;
      if (resp) {
        const firstErr = Object.values(resp).flat()[0];
        setError(typeof firstErr === 'string' ? firstErr : 'Failed to update task.');
      } else {
        setError('Network error updating task.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await issueService.deleteIssue(task.id);
      onTaskDeleted(task.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete task.');
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'LOW':
        return 'bg-slate-800 text-slate-400 border-white/10';
      default:
        return 'bg-slate-800 text-slate-400 border-white/10';
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'BUG':
        return 'text-rose-300 bg-rose-500/20 border border-rose-500/30';
      case 'STORY':
        return 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30';
      case 'EPIC':
        return 'text-purple-300 bg-purple-500/20 border border-purple-500/30';
      default:
        return 'text-cyan-300 bg-cyan-500/20 border border-cyan-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl shadow-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider ${getTypeBadge(formData.issue_type)}`}>
              {formData.issue_type}
            </span>
            <span className="font-mono text-sm font-bold text-cyan-400">
              {task.issue_key}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/projects/${task.project}/issues/${task.id}`}
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mr-2"
              title="Open full page view"
            >
              <span>Full Page</span>
              <span>&rarr;</span>
            </Link>

            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl border border-white/10 transition-colors cursor-pointer"
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isEditing ? (
            <form id="task-edit-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Add a more detailed description..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                  >
                    {columns && columns.length > 0 ? (
                      columns.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="DONE">Done</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Issue Type
                  </label>
                  <select
                    name="issue_type"
                    value={formData.issue_type}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                    <option value="EPIC">Epic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Assignee
                  </label>
                  <select
                    name="assignee_id"
                    value={formData.assignee_id}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => {
                      const u = m.user || m;
                      return (
                        <option key={u.id} value={u.id}>
                          {u.first_name || u.username} ({u.email})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Sprint
                  </label>
                  <select
                    name="sprint_id"
                    value={formData.sprint_id}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Backlog (No Sprint)</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Title & Status Quick Selector */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  {task.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="text-slate-400 font-semibold">Status:</span>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusQuickChange(e.target.value)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 font-bold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {columns && columns.length > 0 ? (
                      columns.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="DONE">Done</option>
                      </>
                    )}
                  </select>

                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getPriorityBadge(task.priority)}`}>
                    {task.priority} Priority
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Description
                </h4>
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/5 text-xs text-slate-200 whitespace-pre-wrap min-h-20 leading-relaxed">
                  {task.description || (
                    <span className="text-slate-500 italic">No description provided.</span>
                  )}
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs">
                <div>
                  <span className="block text-slate-400 font-medium mb-1">Assignee</span>
                  {task.assignee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-400 to-indigo-600 text-slate-950 font-bold flex items-center justify-center text-3xs">
                        {task.assignee.first_name?.[0]?.toUpperCase() || task.assignee.username?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-semibold text-white">
                        {task.assignee.first_name || task.assignee.username}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">Unassigned</span>
                  )}
                </div>

                <div>
                  <span className="block text-slate-400 font-medium mb-1">Reporter</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      {task.reporter?.first_name || task.reporter?.username || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-slate-400 font-medium mb-1">Sprint</span>
                  <span className="font-semibold text-cyan-400">
                    {task.sprint_details?.name || 'Backlog'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-400 font-medium mb-1">Due Date</span>
                  <span className="font-semibold text-slate-200">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'None'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-400 font-medium mb-1">Created</span>
                  <span className="text-slate-400">
                    {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-400 font-medium mb-1">Last Updated</span>
                  <span className="text-slate-400">
                    {task.updated_at ? new Date(task.updated_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Collaboration: Discussion Comments */}
              <div className="pt-6 border-t border-white/10">
                <CommentSection issueId={task.id} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-800/40 flex items-center justify-between">
          <div>
            {!deleteConfirm ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Delete task
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300 font-medium">Delete permanently?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-md transition-colors cursor-pointer"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="task-edit-form"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default TaskModal;
