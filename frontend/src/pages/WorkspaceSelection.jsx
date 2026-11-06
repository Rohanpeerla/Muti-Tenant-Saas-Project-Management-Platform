import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';

const WorkspaceSelection = () => {
  const {
    workspaces,
    currentWorkspace,
    invitations,
    switchWorkspace,
    createWorkspace,
    acceptInvitation,
    declineInvitation,
    loading,
  } = useWorkspace();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const filteredWorkspaces = workspaces.filter(
    (ws) =>
      ws.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ws.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (ws) => {
    switchWorkspace(ws.id);
    navigate('/dashboard');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) {
      setModalError('Workspace name cannot be empty.');
      return;
    }

    try {
      setSubmitting(true);
      setModalError('');
      await createWorkspace({
        name: newWsName.trim(),
        description: newWsDesc.trim(),
      });
      setShowCreateModal(false);
      setNewWsName('');
      setNewWsDesc('');
      navigate('/dashboard');
    } catch (err) {
      const msg =
        err.response?.data?.name?.[0] ||
        err.response?.data?.error ||
        'Failed to create workspace.';
      setModalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role) => {
    const map = {
      OWNER: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      ADMIN: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      PROJECT_MANAGER: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      MEMBER: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      VIEWER: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    };
    return map[role] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 via-indigo-900/80 to-purple-900/70 border border-white/10 shadow-2xl backdrop-blur-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Organizations & Workspaces
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300/80">
              Select an isolated multi-tenant organization to manage its projects, boards, and team members.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-2 hover:scale-105 self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Workspace</span>
          </button>
        </div>

        {/* Pending Invitations Section */}
        {invitations && invitations.length > 0 && (
          <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3 text-amber-300 font-bold text-sm mb-4">
              <span className="text-xl">📬</span>
              <div>
                <h3 className="text-sm font-bold text-white">Pending Workspace Invitations ({invitations.length})</h3>
                <p className="text-xs text-amber-300/80 font-normal">You have been invited to collaborate in these workspaces:</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-2xl bg-slate-900/90 border border-amber-500/20 p-5 flex flex-col justify-between shadow-md gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-bold text-white">{inv.workspace?.name}</h4>
                      <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                        {inv.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {inv.workspace?.description || 'No organization description.'}
                    </p>
                    <p className="text-3xs text-slate-500 mt-2 font-mono">
                      Invited by: {inv.workspace?.owner?.email}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => acceptInvitation(inv.id)}
                      className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 transition-colors shadow-xs cursor-pointer text-center"
                    >
                      Accept & Join
                    </button>
                    <button
                      type="button"
                      onClick={() => declineInvitation(inv.id)}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        {workspaces.length > 0 && (
          <div className="max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search workspaces by name or slug..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Workspaces List / Grid */}
        {loading ? (
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-16 text-center shadow-xl">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading your workspaces...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-3xl bg-slate-900/80 border border-dashed border-slate-700 p-16 text-center shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 text-2xl">
              🏢
            </div>
            <h3 className="text-base font-bold text-white">No Workspaces Found</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              You are not a member of any workspaces yet. Create your first workspace to start organizing your SaaS projects.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg text-xs transition-all cursor-pointer"
              >
                Create First Workspace
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkspaces.map((ws) => {
              const isCurrent = currentWorkspace?.id === ws.id;
              const canManage = ws.current_user_role === 'OWNER' || ws.current_user_role === 'ADMIN';

              return (
                <div
                  key={ws.id}
                  className={`rounded-3xl border transition-all duration-300 p-6 flex flex-col justify-between backdrop-blur-xl ${
                    isCurrent
                      ? 'bg-gradient-to-br from-indigo-900/50 via-slate-900/90 to-purple-900/50 border-indigo-500/60 shadow-2xl ring-2 ring-indigo-500/20'
                      : 'bg-slate-900/80 border-white/10 hover:border-white/25 shadow-xl'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 text-white font-black flex items-center justify-center text-base shadow-sm">
                          {ws.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-white tracking-tight line-clamp-1">
                            {ws.name}
                          </h2>
                          <span className="text-xs font-mono text-slate-400">/{ws.slug}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-3xs font-semibold border ${getRoleBadge(ws.current_user_role)}`}>
                        {ws.current_user_role || 'MEMBER'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 min-h-8 mb-4 leading-relaxed">
                      {ws.description || 'Dedicated organization workspace.'}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-400 pb-4 border-t border-white/5 pt-3">
                      <span>{ws.member_count ?? 1} {ws.member_count === 1 ? 'member' : 'members'}</span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelect(ws)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 text-slate-950 shadow-md'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {isCurrent ? 'Enter Workspace →' : 'Switch & Open'}
                    </button>

                    {canManage && (
                      <Link
                        to="/settings/workspace"
                        onClick={() => switchWorkspace(ws.id)}
                        className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                        title="Workspace Settings"
                      >
                        ⚙️
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-white/15">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">Create New Workspace</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Workspace Name <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Acme Studio, Cloud Operations"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Description <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  placeholder="Workspace scope and team purpose..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {submitting && <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />}
                  <span>Create Workspace</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelection;
