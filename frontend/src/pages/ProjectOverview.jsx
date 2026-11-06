import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService, sprintService, issueService, workspaceService } from '../services/api';

const ProjectOverview = () => {
  const { projectId } = useParams();
  const { currentWorkspace } = useAuth();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [issues, setIssues] = useState([]);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Member Modal State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('MEMBER');
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState('');

  useEffect(() => {
    loadAllData();
  }, [projectId]);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [projData, membersData, sprintsData, issuesData] = await Promise.all([
        projectService.getProjectDetails(projectId),
        projectService.getProjectMembers(projectId),
        sprintService.getSprints(projectId),
        issueService.getIssues(projectId),
      ]);

      setProject(projData);
      setMembers(membersData);
      setSprints(sprintsData);
      setIssues(issuesData.results || issuesData);

      if (currentWorkspace?.id) {
        const wsMems = await workspaceService.getWorkspaceMembers(currentWorkspace.id);
        setWorkspaceMembers(wsMems);
      }
    } catch (err) {
      setError('Failed to load project details. Please check the URL or your permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setMemberError('Please select a user to add.');
      return;
    }
    setMemberLoading(true);
    setMemberError('');

    try {
      const added = await projectService.addProjectMember(projectId, {
        user_id: selectedUserId,
        role: selectedRole,
      });
      setMembers((prev) => [...prev, added]);
      setIsAddMemberOpen(false);
      setSelectedUserId('');
      setSelectedRole('MEMBER');
    } catch (err) {
      const resp = err.response?.data;
      if (resp) {
        const firstErr = Object.values(resp).flat()[0];
        setMemberError(typeof firstErr === 'string' ? firstErr : 'Failed to add member.');
      } else {
        setMemberError('Error adding member.');
      }
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the project?')) return;
    try {
      await projectService.removeProjectMember(projectId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20"></div>
        <p className="mt-4 text-sm font-medium text-slate-400">Loading project overview...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error || 'Project not found.'}
        </div>
        <div className="max-w-4xl mx-auto mt-4">
          <Link to="/projects" className="text-xs font-bold text-cyan-400 hover:text-cyan-300">
            &larr; Back to all projects
          </Link>
        </div>
      </div>
    );
  }

  const activeSprint = sprints.find((s) => s.status === 'ACTIVE');
  const todoCount = issues.filter((i) => i.status === 'TODO').length;
  const inProgressCount = issues.filter((i) => i.status === 'IN_PROGRESS').length;
  const inReviewCount = issues.filter((i) => i.status === 'IN_REVIEW').length;
  const doneCount = issues.filter((i) => i.status === 'DONE').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
              <Link to="/projects" className="hover:text-cyan-400 transition-colors">
                Projects
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-slate-200 font-semibold">{project.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{project.name}</h1>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {project.key}
              </span>
            </div>
          </div>

          {/* Quick Tabs / Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to={`/projects/${project.id}/board`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Kanban Board
            </Link>
            <Link
              to={`/projects/${project.id}/sprints`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-bold rounded-xl shadow-lg backdrop-blur-md transition-all hover:border-white/20"
            >
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Sprints ({sprints.length})
            </Link>
            <Link
              to={`/projects/${project.id}/settings/workflow`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-bold rounded-xl shadow-lg backdrop-blur-md transition-all hover:border-white/20"
              title="Configure Custom Workflow Columns and Transitions"
            >
              <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Workflow
            </Link>
            <Link
              to={`/projects/${project.id}/settings`}
              className="p-2.5 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/10 rounded-xl transition-all shadow-lg backdrop-blur-md hover:border-white/20"
              title="Project Settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Overview Top Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 shadow-xl backdrop-blur-md">
            <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Total Tasks</p>
            <p className="text-2xl font-black text-white mt-1.5">{issues.length}</p>
          </div>
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 shadow-xl backdrop-blur-md">
            <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">To Do</p>
            <p className="text-2xl font-black text-slate-300 mt-1.5">{todoCount}</p>
          </div>
          <div className="rounded-3xl bg-slate-900/80 border border-cyan-500/20 p-5 shadow-xl backdrop-blur-md">
            <p className="text-3xs font-extrabold uppercase tracking-wider text-cyan-400">In Progress</p>
            <p className="text-2xl font-black text-cyan-300 mt-1.5">{inProgressCount}</p>
          </div>
          <div className="rounded-3xl bg-slate-900/80 border border-amber-500/20 p-5 shadow-xl backdrop-blur-md">
            <p className="text-3xs font-extrabold uppercase tracking-wider text-amber-400">In Review</p>
            <p className="text-2xl font-black text-amber-300 mt-1.5">{inReviewCount}</p>
          </div>
          <div className="rounded-3xl bg-slate-900/80 border border-emerald-500/20 p-5 shadow-xl backdrop-blur-md">
            <p className="text-3xs font-extrabold uppercase tracking-wider text-emerald-400">Done</p>
            <p className="text-2xl font-black text-emerald-300 mt-1.5">{doneCount}</p>
          </div>
        </div>

        {/* Progress & Sprint Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project Progress */}
          <div className="lg:col-span-2 rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Project Completion
              </h3>
              <span className="text-sm font-black text-cyan-400">
                {project.progress_percentage || 0}% Complete
              </span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-white/5">
              <div
                className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-emerald-400 h-3 rounded-full transition-all duration-500 shadow-md"
                style={{ width: `${project.progress_percentage || 0}%` }}
              ></div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {project.description || 'No detailed description set for this project.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs">
              <div>
                <span className="block text-slate-400 font-medium">Status</span>
                <span className="font-bold text-white mt-0.5 inline-block">{project.status}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-medium">Start Date</span>
                <span className="font-semibold text-slate-200 mt-0.5 inline-block">
                  {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'Not set'}
                </span>
              </div>
              <div>
                <span className="block text-slate-400 font-medium">Target Deadline</span>
                <span className="font-semibold text-slate-200 mt-0.5 inline-block">
                  {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'Not set'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Sprint Widget */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xs font-extrabold uppercase tracking-wider text-cyan-400 bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-1 rounded-full">
                  Current Sprint
                </span>
                {activeSprint ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-500">None Active</span>
                )}
              </div>

              {activeSprint ? (
                <div className="space-y-2">
                  <h4 className="text-lg font-bold text-white">{activeSprint.name}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {activeSprint.goal || 'No sprint goal specified.'}
                  </p>
                  <div className="text-2xs text-slate-400 pt-2 font-mono">
                    {activeSprint.start_date || 'N/A'} &rarr; {activeSprint.end_date || 'N/A'}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-slate-400">No active sprint is running right now.</p>
                </div>
              )}
            </div>

            <div className="pt-4 mt-6 border-t border-white/10">
              <Link
                to={`/projects/${project.id}/sprints`}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition-colors"
              >
                {activeSprint ? 'Manage Active Sprint \u2192' : 'Go to Sprints & Plan \u2192'}
              </Link>
            </div>
          </div>
        </div>

        {/* Team Members Section */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Project Members ({members.length})</h3>
              <p className="text-xs text-slate-400 mt-0.5">Team members assigned to this specific project.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddMemberOpen(true)}
              className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              + Add Member
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map((m) => {
              const u = m.user;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-slate-800/50 hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-extrabold flex items-center justify-center text-xs shrink-0 shadow-md">
                      {u.first_name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {u.first_name || u.username}
                      </p>
                      <p className="text-3xs text-slate-400 truncate">{u.email}</p>
                      <span className="inline-block mt-0.5 text-3xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                        {m.role}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove from project"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Member Modal */}
        {isAddMemberOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl shadow-2xl border border-white/10 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-800/40">
                <h3 className="text-sm font-bold text-white">Add Member to Project</h3>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {memberError && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {memberError}
                </div>
              )}

              <form onSubmit={handleAddMember} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Workspace User
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select a team member...</option>
                    {workspaceMembers.map((wm) => {
                      const u = wm.user;
                      const alreadyInProject = members.some((m) => m.user.id === u.id);
                      if (alreadyInProject) return null;
                      return (
                        <option key={u.id} value={u.id}>
                          {u.first_name || u.username} ({u.email})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Project Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="PROJECT_MANAGER">Project Manager</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={memberLoading}
                    className="px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer"
                  >
                    {memberLoading ? 'Adding...' : 'Add to Project'}
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

export default ProjectOverview;
