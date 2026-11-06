import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';

const WorkspaceSettings = () => {
  const { currentWorkspace, updateCurrentWorkspace, deleteCurrentWorkspace, loading: wsLoading } = useWorkspace();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isOwner = currentWorkspace?.current_user_role === 'OWNER';
  const isAdminOrOwner = isOwner || currentWorkspace?.current_user_role === 'ADMIN';

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name || '');
      setDescription(currentWorkspace.description || '');
    }
  }, [currentWorkspace]);

  if (wsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-slate-100">
        <h2 className="text-xl font-bold text-white">No Workspace Selected</h2>
        <p className="text-sm text-slate-400 mt-1 mb-4">Please select or create a workspace first.</p>
        <Link
          to="/workspaces"
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg"
        >
          View Workspaces
        </Link>
      </div>
    );
  }

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!isAdminOrOwner) {
      setErrorMsg('You do not have administrative privileges to update workspace settings.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      setSuccessMsg('');
      await updateCurrentWorkspace({
        name: name.trim(),
        description: description.trim(),
      });
      setSuccessMsg('Workspace settings saved successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      const msg =
        err.response?.data?.name?.[0] ||
        err.response?.data?.error ||
        'Failed to save settings. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) {
      setDeleteError('Only the organization Owner can delete this workspace.');
      return;
    }

    if (confirmName !== currentWorkspace.name) {
      setDeleteError('Workspace name does not match confirmation.');
      return;
    }

    try {
      setDeleting(true);
      setDeleteError('');
      await deleteCurrentWorkspace();
      navigate('/workspaces');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete workspace.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Link to="/workspaces" className="hover:text-cyan-400 transition-colors">Workspaces</Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-semibold">{currentWorkspace.name}</span>
          <span className="text-slate-600">/</span>
          <span className="text-indigo-400 font-bold">Settings</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Workspace Settings
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage organization details, profile attributes, and workspace policies.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/settings/team"
              className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-900/80 border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-lg backdrop-blur-md"
            >
              Manage Team Members &rarr;
            </Link>
          </div>
        </div>

        {/* General Settings Card */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-bold text-white">General Information</h2>
              <p className="text-xs text-slate-400 mt-0.5">Workspace name, identifier slug, and description.</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Role: {currentWorkspace.current_user_role}
            </span>
          </div>

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Workspace Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdminOrOwner || saving}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Workspace Slug
                </label>
                <div className="flex items-center">
                  <span className="px-3.5 py-2.5 bg-slate-800 border border-r-0 border-slate-700 rounded-l-xl text-xs text-slate-400 font-mono">
                    /
                  </span>
                  <input
                    type="text"
                    disabled
                    value={currentWorkspace.slug}
                    className="w-full px-4 py-2.5 rounded-r-xl border border-slate-700 text-sm font-mono text-slate-400 bg-slate-800/60 cursor-not-allowed"
                  />
                </div>
                <p className="mt-1.5 text-2xs text-slate-400">Unique immutable workspace identifier.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                rows={3}
                disabled={!isAdminOrOwner || saving}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for your workspace..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 pb-2 text-xs text-slate-400 border-t border-white/5">
              <div>
                <span className="font-semibold text-slate-300">Created:</span>{' '}
                {new Date(currentWorkspace.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </div>
              <div>
                <span className="font-semibold text-slate-300">Primary Owner:</span>{' '}
                <span className="text-cyan-400">{currentWorkspace.owner?.email || 'N/A'}</span>
              </div>
            </div>

            {isAdminOrOwner && (
              <div className="pt-4 border-t border-white/10 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Danger Zone */}
        <div className="rounded-3xl bg-slate-900/80 border border-rose-500/30 p-6 sm:p-8 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-rose-400 mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-base font-bold">Danger Zone</h2>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            Deleting this workspace will permanently erase all associated projects, sprints, boards, tasks, and memberships. This action cannot be reversed.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <div>
              <p className="text-sm font-bold text-white">Delete this workspace</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {isOwner
                  ? 'Permanently delete this organization and its data.'
                  : 'Only the organization Owner can delete this workspace.'}
              </p>
            </div>
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => {
                setConfirmName('');
                setDeleteError('');
                setShowDeleteModal(true);
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              Delete Workspace
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-500/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-500/30">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Workspace?</h3>
                <p className="text-xs text-slate-400">This action is irreversible.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Please enter the workspace name <span className="font-bold text-cyan-400 font-mono">"{currentWorkspace.name}"</span> below to confirm deletion.
            </p>

            {deleteError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="mt-4">
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={currentWorkspace.name}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmName !== currentWorkspace.name || deleting}
                onClick={handleDelete}
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
              >
                {deleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSettings;
