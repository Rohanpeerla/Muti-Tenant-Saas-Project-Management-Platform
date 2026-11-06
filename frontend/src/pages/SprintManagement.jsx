import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService, sprintService, issueService } from '../services/api';

const SprintManagement = () => {
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create Sprint Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    goal: '',
    start_date: '',
    end_date: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Action Loading states
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [projData, sprintsData, issuesData] = await Promise.all([
        projectService.getProjectDetails(projectId),
        sprintService.getSprints(projectId),
        issueService.getIssues(projectId),
      ]);

      setProject(projData);
      setSprints(sprintsData);
      setIssues(issuesData.results || issuesData);
    } catch (err) {
      setError('Failed to load sprints. Please check permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    if (!createFormData.name.trim()) {
      setCreateError('Sprint name is required.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');

    try {
      const payload = {
        name: createFormData.name.trim(),
        goal: createFormData.goal.trim(),
        start_date: createFormData.start_date || null,
        end_date: createFormData.end_date || null,
      };
      const created = await sprintService.createSprint(projectId, payload);
      setSprints((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setCreateFormData({ name: '', goal: '', start_date: '', end_date: '' });
    } catch (err) {
      const resp = err.response?.data;
      if (resp) {
        const firstErr = Object.values(resp).flat()[0];
        setCreateError(typeof firstErr === 'string' ? firstErr : 'Failed to create sprint.');
      } else {
        setCreateError('Network error while creating sprint.');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStartSprint = async (sprintId) => {
    setActionLoadingId(sprintId);
    try {
      const res = await sprintService.startSprint(sprintId);
      setSprints((prev) =>
        prev.map((s) => (s.id === sprintId ? res.sprint : s))
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start sprint.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteSprint = async (sprintId) => {
    if (!window.confirm('Are you sure you want to complete this sprint? Remaining unfinished tasks can be moved to the backlog or next sprint.')) {
      return;
    }
    setActionLoadingId(sprintId);
    try {
      const res = await sprintService.completeSprint(sprintId);
      setSprints((prev) =>
        prev.map((s) => (s.id === sprintId ? res.sprint : s))
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to complete sprint.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteSprint = async (sprintId) => {
    if (!window.confirm('Delete this sprint? Assigned tasks will not be deleted, but unassigned from this sprint.')) {
      return;
    }
    try {
      await sprintService.deleteSprint(sprintId);
      setSprints((prev) => prev.filter((s) => s.id !== sprintId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete sprint.');
    }
  };

  const handleAssignTaskToSprint = async (taskId, targetSprintId) => {
    try {
      const updated = await issueService.updateIssue(taskId, {
        sprint_id: targetSprintId || null,
      });
      setIssues((prev) => prev.map((i) => (i.id === taskId ? updated : i)));
    } catch (err) {
      alert('Failed to update task sprint.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20"></div>
        <p className="mt-4 text-sm font-medium text-slate-400">Loading sprint management...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error || 'Project not found.'}
        </div>
      </div>
    );
  }

  const activeSprint = sprints.find((s) => s.status === 'ACTIVE');
  const plannedSprints = sprints.filter((s) => s.status === 'PLANNED');
  const completedSprints = sprints.filter((s) => s.status === 'COMPLETED');
  const backlogIssues = issues.filter((i) => !i.sprint);

  const getSprintTasks = (sprintId) => issues.filter((i) => i.sprint === sprintId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
              <Link to="/projects" className="hover:text-cyan-400 transition-colors">Projects</Link>
              <span className="text-slate-600">/</span>
              <Link to={`/projects/${project.id}`} className="hover:text-cyan-400 transition-colors">{project.name}</Link>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400 font-bold">Sprints</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Sprint Management
              </h1>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {project.key}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/projects/${project.id}/board`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-bold rounded-xl shadow-lg backdrop-blur-md transition-all hover:border-white/20"
            >
              Kanban Board &rarr;
            </Link>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Sprint
            </button>
          </div>
        </div>

        {/* 1. ACTIVE SPRINT SECTION */}
        {activeSprint ? (
          <div className="rounded-3xl bg-slate-900/80 border-2 border-indigo-500/60 p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active Sprint
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {activeSprint.start_date || 'Start date not set'} &rarr; {activeSprint.end_date || 'End date not set'}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white mt-2">{activeSprint.name}</h2>
                {activeSprint.goal && (
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl">{activeSprint.goal}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={actionLoadingId === activeSprint.id}
                  onClick={() => handleCompleteSprint(activeSprint.id)}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoadingId === activeSprint.id ? 'Completing...' : 'Complete Sprint'}
                </button>
              </div>
            </div>

            {/* Active Sprint Tasks List */}
            <div className="pt-4 border-t border-white/10 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sprint Tasks ({getSprintTasks(activeSprint.id).length})
                </h4>
                <Link
                  to={`/projects/${project.id}/board`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  View on Board &rarr;
                </Link>
              </div>

              {getSprintTasks(activeSprint.id).length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-800/40 border border-dashed border-white/10 text-center text-xs text-slate-400">
                  No tasks assigned to this active sprint. Drag or move tasks from the backlog below.
                </div>
              ) : (
                <div className="divide-y divide-white/5 rounded-2xl border border-white/10 overflow-hidden bg-slate-900/60">
                  {getSprintTasks(activeSprint.id).map((task) => (
                    <div key={task.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {task.issue_key}
                        </span>
                        <span className="text-sm font-medium text-slate-200">
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 border border-white/10 text-slate-300">
                          {task.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAssignTaskToSprint(task.id, null)}
                          className="text-xs text-slate-400 hover:text-rose-400 font-medium transition-colors cursor-pointer"
                          title="Move to Backlog"
                        >
                          Remove to Backlog
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-10 text-center space-y-4 shadow-xl backdrop-blur-md">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white">No Active Sprint Running</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Select a planned sprint below and click "Start Sprint" to initiate your iteration cycle and Kanban workflow.
            </p>
          </div>
        )}

        {/* 2. PLANNED SPRINTS SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">
              Planned Sprints ({plannedSprints.length})
            </h3>
          </div>

          {plannedSprints.length === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-white/10 text-center text-sm text-slate-400 bg-slate-900/40">
              No planned sprints in queue. Create one using the button above to organize upcoming goals.
            </div>
          ) : (
            <div className="space-y-4">
              {plannedSprints.map((sprint) => {
                const sprintTasks = getSprintTasks(sprint.id);
                return (
                  <div
                    key={sprint.id}
                    className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 shadow-xl backdrop-blur-md space-y-4 hover:border-white/20 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-bold text-white">{sprint.name}</h4>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            PLANNED
                          </span>
                        </div>
                        {sprint.goal && (
                          <p className="text-xs text-slate-400 mt-1">{sprint.goal}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionLoadingId === sprint.id}
                          onClick={() => handleStartSprint(sprint.id)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === sprint.id ? 'Starting...' : 'Start Sprint'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSprint(sprint.id)}
                          className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete sprint"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Tasks inside planned sprint */}
                    <div className="pt-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Tasks ({sprintTasks.length})
                      </span>
                      {sprintTasks.length === 0 ? (
                        <p className="text-xs text-slate-500 italic mt-2">
                          No tasks in this sprint yet. Assign tasks from the backlog below.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {sprintTasks.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 text-xs border border-white/5"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-cyan-400">
                                  {t.issue_key}
                                </span>
                                <span className="font-semibold text-slate-200">{t.title}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAssignTaskToSprint(t.id, null)}
                                className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                              >
                                Remove to Backlog
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. PROJECT BACKLOG SECTION */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                Project Backlog ({backlogIssues.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tasks waiting to be planned or scheduled into an upcoming sprint.
              </p>
            </div>
          </div>

          {backlogIssues.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl bg-slate-800/20">
              Backlog is completely empty! All tasks have been scheduled into sprints.
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-2xl border border-white/10 overflow-hidden bg-slate-900/60">
              {backlogIssues.map((task) => (
                <div
                  key={task.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {task.issue_key}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">{task.title}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignTaskToSprint(task.id, e.target.value);
                        }
                      }}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-200 font-semibold focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Move to Sprint &darr;</option>
                      {sprints
                        .filter((s) => s.status !== 'COMPLETED')
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.status})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. COMPLETED SPRINTS ACCORDION / ARCHIVE */}
        {completedSprints.length > 0 && (
          <div className="rounded-3xl bg-slate-900/40 border border-white/5 p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Completed Sprints History ({completedSprints.length})
            </h3>
            <div className="space-y-2">
              {completedSprints.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-200">{s.name}</span>
                    {s.goal && <span className="text-slate-400 ml-2">&bull; {s.goal}</span>}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-3xs font-bold bg-slate-800 text-slate-400 border border-white/10">
                    COMPLETED
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Sprint Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl shadow-2xl border border-white/10 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-slate-800/40">
                <h3 className="text-base font-bold text-white">Create Sprint</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {createError && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateSprint} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Sprint Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sprint 1 - MVP Architecture"
                    value={createFormData.name}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Sprint Goal
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What is the key objective of this sprint?"
                    value={createFormData.goal}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, goal: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={createFormData.start_date}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({ ...prev, start_date: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={createFormData.end_date}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({ ...prev, end_date: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                  >
                    {createLoading ? 'Creating...' : 'Create Sprint'}
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

export default SprintManagement;
