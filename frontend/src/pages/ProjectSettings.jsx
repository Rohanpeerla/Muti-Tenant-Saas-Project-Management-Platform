import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectService } from '../services/api';

const ProjectSettings = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    status: 'ACTIVE',
    start_date: '',
    end_date: '',
  });
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Delete Safeguard State
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await projectService.getProjectDetails(projectId);
      setProject(data);
      setFormData({
        name: data.name || '',
        key: data.key || '',
        description: data.description || '',
        status: data.status || 'ACTIVE',
        start_date: data.start_date ? data.start_date.substring(0, 10) : '',
        end_date: data.end_date ? data.end_date.substring(0, 10) : '',
      });
    } catch (err) {
      setError('Failed to load project settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Project name is required.');
      return;
    }

    setSaveLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };
      const updated = await projectService.updateProject(projectId, payload);
      setProject(updated);
      setSuccess('Project settings updated successfully.');
    } catch (err) {
      const resp = err.response?.data;
      if (resp) {
        const firstErr = Object.values(resp).flat()[0];
        setError(typeof firstErr === 'string' ? firstErr : 'Failed to update project settings.');
      } else {
        setError('Network error while saving settings.');
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmationText !== project.name) {
      setError('Confirmation name does not match project name.');
      return;
    }

    setIsDeleting(true);
    setError('');
    try {
      await projectService.deleteProject(projectId);
      navigate('/projects');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete project.');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20"></div>
        <p className="mt-4 text-sm font-medium text-slate-400">Loading project settings...</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
              <Link to="/projects" className="hover:text-cyan-400 transition-colors">Projects</Link>
              <span className="text-slate-600">/</span>
              <Link to={`/projects/${project.id}`} className="hover:text-cyan-400 transition-colors">{project.name}</Link>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400 font-bold">Settings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Project Settings</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/projects/${project.id}/settings/workflow`}
              className="px-4 py-2 text-xs font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all shadow-md"
            >
              Workflow Settings &rarr;
            </Link>
            <Link
              to={`/projects/${project.id}`}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              &larr; Back to Overview
            </Link>
          </div>
        </div>

        {success && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* General Settings Form */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">General Information</h2>
            <p className="text-xs text-slate-400 mt-0.5">Update project name, key, and schedule.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Project Key
                </label>
                <input
                  type="text"
                  name="key"
                  disabled
                  value={formData.key}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/50 font-mono text-sm text-slate-400 cursor-not-allowed"
                  title="Project key cannot be modified after creation."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-medium text-white bg-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PLANNING">Planning</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  End Date (Deadline)
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-end">
              <button
                type="submit"
                disabled={saveLoading}
                className="px-6 py-2.5 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                {saveLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Danger Zone: Project Deletion */}
        <div className="rounded-3xl bg-slate-900/80 border border-rose-500/30 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-4">
          <div>
            <h2 className="text-base font-bold text-rose-400">Danger Zone</h2>
            <p className="text-xs text-slate-400 mt-1">
              Permanently delete this project along with all associated boards, issues, and sprints.
            </p>
          </div>

          <div className="p-5 bg-rose-500/10 rounded-2xl border border-rose-500/20 space-y-4">
            <p className="text-xs text-slate-300">
              To confirm deletion, please type the project name <span className="font-bold text-cyan-400">"{project.name}"</span> below:
            </p>
            <input
              type="text"
              placeholder={project.name}
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />

            <button
              type="button"
              disabled={deleteConfirmationText !== project.name || isDeleting}
              onClick={handleDelete}
              className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 rounded-xl shadow-lg shadow-rose-600/30 transition-colors cursor-pointer"
            >
              {isDeleting ? 'Deleting project...' : 'Permanently Delete Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings;
