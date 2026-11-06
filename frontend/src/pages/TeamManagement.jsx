import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/api';

const TeamManagement = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Role edit modal state
  const [editingMember, setEditingMember] = useState(null);
  const [newRole, setNewRole] = useState('MEMBER');
  const [updatingRole, setUpdatingRole] = useState(false);
  const [roleError, setRoleError] = useState('');

  // Remove member modal state
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const isOwner = currentWorkspace?.current_user_role === 'OWNER';
  const isAdminOrOwner = isOwner || currentWorkspace?.current_user_role === 'ADMIN';

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    try {
      setLoading(true);
      setError('');
      const data = await workspaceService.getWorkspaceMembers(currentWorkspace.id);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load team members:', err);
      setError(err.response?.data?.error || 'Failed to load team members.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setInviteError('Please provide an email address.');
      return;
    }

    try {
      setInviting(true);
      setInviteError('');
      await workspaceService.inviteWorkspaceMember(currentWorkspace.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
        status: 'INVITED',
      });
      setInviteSuccess(`Invitation sent to ${inviteEmail}.`);
      setInviteEmail('');
      setShowInviteModal(false);
      fetchMembers();
      setTimeout(() => setInviteSuccess(''), 4000);
    } catch (err) {
      const msg =
        err.response?.data?.email?.[0] ||
        err.response?.data?.role?.[0] ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.error ||
        'Failed to invite member.';
      setInviteError(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editingMember) return;

    try {
      setUpdatingRole(true);
      setRoleError('');
      await workspaceService.updateWorkspaceMember(currentWorkspace.id, editingMember.id, {
        role: newRole,
      });
      setEditingMember(null);
      fetchMembers();
    } catch (err) {
      const msg =
        err.response?.data?.role?.[0] ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.error ||
        'Failed to update member role.';
      setRoleError(msg);
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleToggleStatus = async (member) => {
    const targetStatus = member.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await workspaceService.updateWorkspaceMember(currentWorkspace.id, member.id, {
        status: targetStatus,
      });
      fetchMembers();
    } catch (err) {
      alert(
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.error ||
        'Failed to change member status.'
      );
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      setRemoving(true);
      setRemoveError('');
      await workspaceService.removeWorkspaceMember(currentWorkspace.id, memberToRemove.id);
      setMemberToRemove(null);
      fetchMembers();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to remove member.';
      setRemoveError(msg);
    } finally {
      setRemoving(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${m.user.first_name} ${m.user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role) => {
    const map = {
      OWNER: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      ADMIN: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      PROJECT_MANAGER: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      MEMBER: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      VIEWER: 'bg-slate-800 text-slate-400 border-white/10',
    };
    return map[role] || 'bg-slate-800 text-slate-400 border-white/10';
  };

  const getStatusBadge = (status) => {
    const map = {
      ACTIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      INVITED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      SUSPENDED: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    };
    return map[status] || 'bg-slate-800 text-slate-400 border-white/10';
  };

  if (!currentWorkspace) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-slate-100">
        <h2 className="text-xl font-bold text-white">No Workspace Selected</h2>
        <p className="text-sm text-slate-400 mt-1 mb-4">Please select a workspace to manage its team.</p>
        <Link
          to="/workspaces"
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg"
        >
          View Workspaces
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Link to="/workspaces" className="hover:text-cyan-400 transition-colors">Workspaces</Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-semibold">{currentWorkspace.name}</span>
          <span className="text-slate-600">/</span>
          <span className="text-indigo-400 font-bold">Team Members</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Team Members & Permissions
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage member roles, invitations, and access to this organization's workspace.
            </p>
          </div>
          {isAdminOrOwner && (
            <button
              type="button"
              onClick={() => {
                setInviteError('');
                setShowInviteModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer self-start sm:self-auto"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Invite Team Member</span>
            </button>
          )}
        </div>

        {inviteSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{inviteSuccess}</span>
          </div>
        )}

        {/* Filters & Search */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-80 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, username..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-400">Role:</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 bg-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="ALL">All Roles</option>
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-400">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 bg-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INVITED">Invited</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Member Table */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 overflow-hidden shadow-xl backdrop-blur-md">
          {loading ? (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Loading members...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-400 text-sm font-semibold">{error}</div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No team members match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6">Member</th>
                    <th className="py-4 px-6">Role</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Joined Date</th>
                    {isAdminOrOwner && <th className="py-4 px-6 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredMembers.map((m) => {
                    const isSelf = m.user.id === user?.id;
                    const isMemberOwner = m.role === 'OWNER';
                    const canEditThisMember = isAdminOrOwner && !isSelf && (!isMemberOwner || isOwner);

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-extrabold flex items-center justify-center text-sm shadow-md">
                              {m.user.first_name?.[0]?.toUpperCase() || m.user.username[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                <span>{m.user.first_name ? `${m.user.first_name} ${m.user.last_name}` : m.user.username}</span>
                                {isSelf && (
                                  <span className="text-2xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold">You</span>
                                )}
                              </div>
                              <div className="text-slate-400 text-2xs mt-0.5">{m.user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleBadge(m.role)}`}>
                            {m.role}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(m.status)}`}>
                            {m.status}
                          </span>
                        </td>

                        <td className="py-4 px-6 text-slate-400">
                          {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'Pending'}
                        </td>

                        {isAdminOrOwner && (
                          <td className="py-4 px-6 text-right">
                            {canEditThisMember ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMember(m);
                                    setNewRole(m.role);
                                    setRoleError('');
                                  }}
                                  className="px-3 py-1 text-xs font-semibold text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                                >
                                  Edit Role
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(m)}
                                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                                    m.status === 'SUSPENDED'
                                      ? 'text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30'
                                      : 'text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30'
                                  }`}
                                >
                                  {m.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMemberToRemove(m);
                                    setRemoveError('');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Remove Member"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <span className="text-2xs text-slate-500 italic">No actions available</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">Invite Team Member</h2>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {inviteError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  User Email Address <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@company.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="mt-1.5 text-2xs text-slate-400">
                  User must already have a registered SprintSync account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Workspace Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 text-xs text-white bg-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="MEMBER">Member (Create and manage tasks)</option>
                  <option value="PROJECT_MANAGER">Project Manager (Manage projects and sprints)</option>
                  <option value="VIEWER">Viewer (Read-only access)</option>
                  <option value="ADMIN">Admin (Manage members and workspace settings)</option>
                  {isOwner && <option value="OWNER">Owner (Full organization ownership)</option>}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {inviting && <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />}
                  <span>Send Invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-white">
              Update Role: {editingMember.user.email}
            </h3>

            {roleError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {roleError}
              </div>
            )}

            <form onSubmit={handleUpdateRole} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Select New Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 text-xs text-white bg-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="MEMBER">Member</option>
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="ADMIN">Admin</option>
                  {isOwner && <option value="OWNER">Owner</option>}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRole}
                  className="px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 rounded-xl disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {updatingRole && <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />}
                  <span>Save Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white">Remove Member?</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-cyan-400">{memberToRemove.user.email}</span> from this workspace? They will lose access immediately.
            </p>

            {removeError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {removeError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={handleRemoveMember}
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                {removing && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
