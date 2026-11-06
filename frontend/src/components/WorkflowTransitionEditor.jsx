import React, { useState, useEffect } from 'react';
import { boardService } from '../services/api';

const WorkflowTransitionEditor = ({ board }) => {
  const [transitions, setTransitions] = useState([]);
  const [columns, setColumns] = useState(board.columns || []);
  const [fromColumnId, setFromColumnId] = useState('');
  const [toColumnId, setToColumnId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (board?.id) {
      loadTransitions();
      setColumns(board.columns || []);
    }
  }, [board?.id, board?.columns]);

  const loadTransitions = async () => {
    setLoading(true);
    try {
      const data = await boardService.getTransitions(board.id);
      setTransitions(data);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransition = async (e) => {
    e.preventDefault();
    if (!fromColumnId || !toColumnId) {
      setError('Please select both source and destination columns.');
      return;
    }
    if (fromColumnId === toColumnId) {
      setError('Source and destination columns must be different.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const created = await boardService.createTransition(board.id, {
        from_column: fromColumnId,
        to_column: toColumnId,
      });
      setTransitions((prev) => [...prev, created]);
      setFromColumnId('');
      setToColumnId('');
    } catch (err) {
      setError(
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.to_column?.[0] ||
        'Failed to add transition rule.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransition = async (transId) => {
    try {
      await boardService.deleteTransition(board.id, transId);
      setTransitions((prev) => prev.filter((t) => t.id !== transId));
    } catch (err) {
      alert('Failed to delete transition.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-white">Workflow Transition Rules</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Enforce rigid status pathways. If no rules are defined, any column transition is allowed by default.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Add Transition Form */}
      <form onSubmit={handleAddTransition} className="p-5 rounded-2xl bg-slate-800/60 border border-white/10 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              From Column (Source)
            </label>
            <select
              value={fromColumnId}
              onChange={(e) => setFromColumnId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select source column...</option>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              To Column (Allowed Destination)
            </label>
            <select
              value={toColumnId}
              onChange={(e) => setToColumnId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select destination column...</option>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.key})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting || !fromColumnId || !toColumnId}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-40 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer transition-all"
          >
            {submitting ? 'Adding...' : 'Allow Transition'}
          </button>
        </div>
      </form>

      {/* Transition Rules List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading transition rules...</div>
      ) : transitions.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-400 space-y-1 bg-slate-800/30">
          <p className="font-bold text-white">Free-flow mode active</p>
          <p className="text-3xs text-slate-400">
            No specific transition constraints defined. Team members can move tasks between any columns.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 rounded-2xl border border-white/10 overflow-hidden bg-slate-900/60">
          {transitions.map((t) => (
            <div
              key={t.id}
              className="p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-white">{t.from_column_name}</span>
                <span className="text-cyan-400 font-extrabold">&rarr;</span>
                <span className="font-bold text-emerald-400">{t.to_column_name}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteTransition(t.id)}
                className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 cursor-pointer transition-colors"
                title="Remove transition rule"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowTransitionEditor;
