import React, { useState } from 'react';
import { boardService } from '../services/api';

const PRESET_COLORS = [
  '#94a3b8', // slate
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // rose
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

const WorkflowColumnEditor = ({ board, onColumnsUpdated }) => {
  const [columns, setColumns] = useState(board.columns || []);
  const [editingColId, setEditingColId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [newColData, setNewColData] = useState({ name: '', key: '', color: '#6366f1' });
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStartEdit = (col) => {
    setEditingColId(col.id);
    setEditFormData({
      name: col.name,
      color: col.color || '#6366f1',
      is_default: col.is_default || false,
      is_completion: col.is_completion || false,
    });
  };

  const handleSaveEdit = async (colId) => {
    setLoading(true);
    setError('');
    try {
      const updated = await boardService.updateColumn(board.id, colId, editFormData);
      const newCols = columns.map((c) => (c.id === colId ? updated : c));
      setColumns(newCols);
      setEditingColId(null);
      onColumnsUpdated(newCols);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update column.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteColumn = async (colId, colName) => {
    if (!window.confirm(`Delete column "${colName}"?`)) return;
    setLoading(true);
    setError('');
    try {
      await boardService.deleteColumn(board.id, colId);
      const newCols = columns.filter((c) => c.id !== colId);
      setColumns(newCols);
      onColumnsUpdated(newCols);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete column.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColData.name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const created = await boardService.addColumn(board.id, {
        name: newColData.name.trim(),
        key: newColData.key.trim().toUpperCase() || newColData.name.trim().toUpperCase().replace(/\s+/g, '_'),
        color: newColData.color,
        position: columns.length,
      });
      const newCols = [...columns, created];
      setColumns(newCols);
      setIsAdding(false);
      setNewColData({ name: '', key: '', color: '#6366f1' });
      onColumnsUpdated(newCols);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create column.');
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= columns.length) return;

    const reordered = [...columns];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    setColumns(reordered);
    try {
      const columnIds = reordered.map((c) => c.id);
      await boardService.reorderColumns(board.id, columnIds);
      onColumnsUpdated(reordered);
    } catch (err) {
      setColumns(board.columns || []);
      setError('Failed to reorder columns.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Workflow Columns</h3>
          <p className="text-xs text-slate-400 mt-0.5">Configure statuses, colors, and order for this board.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
        >
          {isAdding ? 'Cancel' : '+ Add Column'}
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Add Column Form */}
      {isAdding && (
        <form onSubmit={handleAddColumn} className="p-5 rounded-2xl bg-slate-800/60 border border-white/10 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Column Name</label>
              <input
                type="text"
                required
                placeholder="e.g. QA Review"
                value={newColData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewColData((prev) => ({
                    ...prev,
                    name: val,
                    key: prev.key ? prev.key : val.replace(/\s+/g, '_').toUpperCase(),
                  }));
                }}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Status Key</label>
              <input
                type="text"
                placeholder="e.g. QA"
                value={newColData.key}
                onChange={(e) => setNewColData((prev) => ({ ...prev, key: e.target.value.toUpperCase() }))}
                className="w-full px-3.5 py-2 text-xs font-mono uppercase rounded-xl border border-slate-700 bg-slate-800 text-cyan-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-3xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Color</label>
              <div className="flex items-center gap-2 pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColData((prev) => ({ ...prev, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${newColData.color === c ? 'scale-125 border-white shadow-md' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 text-slate-950 text-xs font-extrabold rounded-xl shadow-md cursor-pointer"
            >
              {loading ? 'Creating...' : 'Create Column'}
            </button>
          </div>
        </form>
      )}

      {/* Columns List */}
      <div className="divide-y divide-white/5 rounded-2xl border border-white/10 overflow-hidden bg-slate-900/60">
        {columns.map((col, idx) => (
          <div key={col.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
            {editingColId === col.id ? (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-800 text-white"
                />
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditFormData((prev) => ({ ...prev, color: c }))}
                      className={`w-5 h-5 rounded-full border cursor-pointer ${editFormData.color === c ? 'border-white scale-125' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 text-3xs font-bold text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.is_default}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, is_default: e.target.checked }))}
                    />
                    Default
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.is_completion}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, is_completion: e.target.checked }))}
                    />
                    Done
                  </label>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingColId(null)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(col.id)}
                    className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 rounded-lg cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shrink-0 shadow-md"
                    style={{ backgroundColor: col.color || '#6366f1' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{col.name}</span>
                      <span className="font-mono text-xs text-cyan-400 font-semibold">[{col.key}]</span>
                      {col.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Default
                        </span>
                      )}
                      {col.is_completion && (
                        <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Completion
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Reorder Arrows */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                    title="Move left/up"
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    disabled={idx === columns.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                    title="Move right/down"
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(col)}
                    className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteColumn(col.id, col.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer transition-colors"
                    title="Delete column"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowColumnEditor;
