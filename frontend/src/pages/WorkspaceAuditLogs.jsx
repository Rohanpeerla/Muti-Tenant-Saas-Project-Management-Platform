import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { auditLogService } from '../services/api';
import AuditLogTable from '../components/AuditLogTable';

const WorkspaceAuditLogs = () => {
  const { workspaceId } = useParams();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isOwnerOrAdmin =
    currentWorkspace?.current_user_role === 'OWNER' ||
    currentWorkspace?.current_user_role === 'ADMIN';

  useEffect(() => {
    if (workspaceId) {
      loadLogs();
    }
  }, [workspaceId, page, actionFilter, startDate, endDate]);

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page };
      if (actionFilter) params.action = actionFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const data = await auditLogService.getWorkspaceAuditLogs(workspaceId, params);
      if (data.results) {
        setLogs(data.results);
        setHasNext(!!data.next);
        setHasPrev(!!data.previous);
      } else {
        setLogs(data);
        setHasNext(false);
        setHasPrev(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load workspace audit records.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (delta) => {
    setPage((prev) => Math.max(1, prev + delta));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
              <Link to="/workspaces" className="hover:text-cyan-400 transition-colors">Workspaces</Link>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300 font-semibold">{currentWorkspace?.name || 'Workspace'}</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400 font-bold">Audit Logs</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Workspace Audit Logs</h1>
            <p className="text-sm text-slate-400 mt-1">
              Immutable administrative and security event trail for this organization tenant.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-white/10 rounded-xl shadow-lg backdrop-blur-md transition-all hover:border-white/20"
            >
              &larr; Dashboard
            </Link>
          </div>
        </div>

        {!isOwnerOrAdmin && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
            Notice: Administrative permission (Owner or Admin role) is required to view audit logs.
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-slate-900/80 p-5 border border-white/10 shadow-xl backdrop-blur-md">
          <div>
            <label className="block text-3xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Actions</option>
              <option value="WORKSPACE_CREATED">Workspace Created</option>
              <option value="WORKSPACE_UPDATED">Workspace Updated</option>
              <option value="MEMBER_INVITED">Member Invited</option>
              <option value="MEMBER_ADDED">Member Added</option>
              <option value="MEMBER_UPDATED">Member Updated</option>
              <option value="MEMBER_REMOVED">Member Removed</option>
              <option value="TASK_CREATED">Task Created</option>
              <option value="TASK_DELETED">Task Deleted</option>
            </select>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {(actionFilter || startDate || endDate) && (
            <div className="self-end pb-1">
              <button
                type="button"
                onClick={() => {
                  setActionFilter('');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-md overflow-hidden">
          <AuditLogTable
            logs={logs}
            loading={loading}
            onPageChange={handlePageChange}
            hasNext={hasNext}
            hasPrev={hasPrev}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkspaceAuditLogs;
