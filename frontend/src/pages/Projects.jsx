import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { projectService } from '../services/api';

const Projects = () => {
  const { currentWorkspace } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    key: '',
    description: '',
    status: 'ACTIVE',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadProjects();
    } else {
      setProjects([]);
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await projectService.getProjects(currentWorkspace.id);
      setProjects(data.results || data);
    } catch (err) {
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createFormData.name.trim()) {
      setCreateError('Project name is required.');
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      await projectService.createProject(currentWorkspace.id, createFormData);
      setIsCreateModalOpen(false);
      setCreateFormData({
        name: '',
        key: '',
        description: '',
        status: 'ACTIVE',
      });
      loadProjects();
    } catch (err) {
      const errorDetail =
        err.response?.data?.key?.[0] ||
        err.response?.data?.name?.[0] ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to create project. Please verify inputs.';
      setCreateError(errorDetail);
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.key && project.key.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = !statusFilter || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'PLANNING':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'ON_HOLD':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'COMPLETED':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'ARCHIVED':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-slate-900/90 border border-white/10 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 text-2xl">
            🏢
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">No Workspace Selected</h2>
          <p className="text-xs text-slate-400 mb-6">
            Please select or create an organization workspace to view and manage projects.
          </p>
          <Link
            to="/workspaces"
            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-90 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-all"
          >
            Go to Workspaces
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-16">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 via-indigo-900/80 to-purple-900/70 border border-white/10 shadow-2xl backdrop-blur-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {currentWorkspace.name}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1.5">
              Projects & Initiatives
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/80 mt-1">
              Organize work, manage sprints, and track delivery progress across teams.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-2 hover:scale-105 self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Project</span>
          </button>
        </div>

        {/* Quick KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 shadow-xl">
            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">Total Projects</p>
            <p className="text-2xl font-black text-white mt-1">{projects.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/20 p-4 shadow-xl">
            <p className="text-3xs font-bold uppercase tracking-wider text-emerald-400">Active</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {projects.filter((p) => p.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-sky-500/20 p-4 shadow-xl">
            <p className="text-3xs font-bold uppercase tracking-wider text-sky-400">Planning</p>
            <p className="text-2xl font-black text-sky-400 mt-1">
              {projects.filter((p) => p.status === 'PLANNING').length}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-purple-500/20 p-4 shadow-xl">
            <p className="text-3xs font-bold uppercase tracking-wider text-purple-400">Completed</p>
            <p className="text-2xl font-black text-purple-400 mt-1">
              {projects.filter((p) => p.status === 'COMPLETED').length}
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <svg
              className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search projects by name, key, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3.5 py-2.5 text-xs rounded-xl border border-white/10 font-semibold text-slate-200 bg-slate-900/80 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PLANNING">Planning</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-indigo-500 border-t-transparent" />
            <p className="mt-3 text-xs text-slate-400">Loading projects...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-12 text-center max-w-md mx-auto shadow-xl">
            <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
              📁
            </div>
            <h3 className="text-base font-bold text-white mb-1">No Projects Found</h3>
            <p className="text-xs text-slate-400 mb-6">
              {searchTerm || statusFilter
                ? 'Try adjusting your search query or status filter.'
                : 'Get started by creating your team\'s first project in this workspace.'}
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-sky-500 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              Create First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-3xl bg-slate-900/80 border border-white/10 hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all flex flex-col justify-between overflow-hidden group p-6 backdrop-blur-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                        {project.key || 'PRJ'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold border ${getStatusBadge(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    <span className="text-3xs text-slate-400">
                      {project.member_count || 1} {project.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </div>

                  <Link
                    to={`/projects/${project.id}`}
                    className="block group-hover:text-indigo-400 transition-colors"
                  >
                    <h3 className="text-base font-bold text-white leading-snug">
                      {project.name}
                    </h3>
                  </Link>

                  <p className="text-xs text-slate-400 line-clamp-2 min-h-8">
                    {project.description || 'No project description provided.'}
                  </p>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-3xs font-semibold text-slate-400">
                      <span>Completion Velocity</span>
                      <span className="text-indigo-300 font-bold">{project.progress_percentage || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress_percentage || 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-3xs text-slate-500">
                      <span>{project.completed_task_count || 0} of {project.task_count || 0} tasks done</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Quick Links */}
                <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold">
                  <Link
                    to={`/projects/${project.id}/board`}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <span>Kanban Board →</span>
                  </Link>

                  <div className="flex items-center gap-3">
                    <Link
                      to={`/projects/${project.id}/sprints`}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      Sprints
                    </Link>
                    <Link
                      to={`/projects/${project.id}/settings`}
                      className="text-slate-500 hover:text-slate-300 transition-colors"
                      title="Project Settings"
                    >
                      ⚙️
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl shadow-2xl border border-white/15 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Create New Project</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Project Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Next-Gen Mobile App"
                    value={createFormData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const autoKey = name
                        .replace(/[^a-zA-Z]/g, '')
                        .substring(0, 3)
                        .toUpperCase();
                      setCreateFormData((prev) => ({
                        ...prev,
                        name,
                        key: prev.key ? prev.key : autoKey,
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Project Key (Prefix, max 10 chars)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="e.g. MOB"
                    value={createFormData.key}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, key: e.target.value.toUpperCase() }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-mono text-white uppercase placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe the purpose of this project..."
                    value={createFormData.description}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Initial Status
                  </label>
                  <select
                    value={createFormData.status}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PLANNING">Planning</option>
                    <option value="ON_HOLD">On Hold</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {createLoading ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
