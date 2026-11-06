import React from 'react';

const AuditLogTable = ({ logs = [], loading, onPageChange, hasNext, hasPrev }) => {
  const getActionBadge = (action) => {
    if (action.includes('CREATED') || action.includes('ADDED') || action.includes('ACCEPTED')) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
    if (action.includes('DELETED') || action.includes('REMOVED') || action.includes('DECLINED')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
    if (action.includes('UPDATED')) {
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-white/10';
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-indigo-500 border-t-transparent" />
        <p className="mt-3 text-xs">Loading audit records...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        No audit log records match the current criteria.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/50 border-b border-white/10 text-3xs font-extrabold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Timestamp</th>
              <th className="px-5 py-3.5">Actor</th>
              <th className="px-5 py-3.5">Action</th>
              <th className="px-5 py-3.5">Entity</th>
              <th className="px-5 py-3.5">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3.5 font-mono text-3xs text-slate-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      {log.actor?.first_name || log.actor?.username || 'System'}
                    </span>
                    {log.actor?.email && (
                      <span className="text-3xs text-slate-400">({log.actor.email})</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-3xs font-bold border ${getActionBadge(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono text-3xs text-cyan-400 whitespace-nowrap">
                  {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ''}
                </td>
                <td className="px-5 py-3.5 text-slate-300 max-w-md truncate" title={log.description}>
                  {log.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {(hasNext || hasPrev) && (
        <div className="flex items-center justify-between text-xs p-4 border-t border-white/10">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(-1)}
            className="px-4 py-2 rounded-xl border border-white/10 bg-slate-800 font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-colors"
          >
            &larr; Previous Page
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(1)}
            className="px-4 py-2 rounded-xl border border-white/10 bg-slate-800 font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-colors"
          >
            Next Page &rarr;
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogTable;
