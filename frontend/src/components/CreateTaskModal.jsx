import React, { useState } from 'react';
import { issueService } from '../services/api';

const CreateTaskModal = ({
  projectId,
  boardId,
  initialStatus = 'TODO',
  isOpen,
  onClose,
  onTaskCreated,
  members = [],
  sprints = [],
  columns = [],
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: initialStatus,
    priority: 'MEDIUM',
    issue_type: 'TASK',
    assignee_id: '',
    sprint_id: '',
    due_date: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Task title is required.');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      status: formData.status || initialStatus || 'TODO',
      priority: formData.priority,
      issue_type: formData.issue_type,
      board_id: boardId || undefined,
      assignee_id: formData.assignee_id || null,
      sprint_id: formData.sprint_id || null,
      due_date: formData.due_date || null,
    };

    try {
      const newTask = await issueService.createIssue(projectId, payload);
      onTaskCreated(newTask);
      onClose();
    } catch (err) {
      const resp = err.response?.data;
      if (resp) {
        const firstErr = Object.values(resp).flat()[0];
        setError(typeof firstErr === 'string' ? firstErr : 'Failed to create task.');
      } else {
        setError('Network error while creating task.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl shadow-2xl border border-white/10 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <h3 className="text-base font-bold text-white">Create Task</h3>
          </div>
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

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Title <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder="e.g. Design authentication workflow"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Add details, acceptance criteria, or notes..."
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Status / Column
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
              >
                {columns && columns.length > 0 ? (
                  columns.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.name}
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
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          {/* Modal Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default CreateTaskModal;
