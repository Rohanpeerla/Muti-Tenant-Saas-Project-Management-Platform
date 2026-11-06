import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

const Onboarding = () => {
  const { user } = useAuth();
  const { createWorkspace, workspaces } = useWorkspace();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a workspace name.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await createWorkspace({
        name: name.trim(),
        description: description.trim(),
      });
      navigate('/dashboard');
    } catch (err) {
      console.error('Workspace creation error:', err);
      const msg =
        err.response?.data?.name?.[0] ||
        err.response?.data?.error ||
        'Failed to create workspace. Please check your inputs.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 flex items-center justify-center px-4 py-16 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 text-slate-950 shadow-xl shadow-indigo-500/25 mb-4">
            <svg className="w-8 h-8 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Create Your First Workspace
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Welcome to SprintSync, <span className="font-bold text-cyan-400">{user?.first_name || user?.username}</span>! Workspaces isolate your organization's projects, boards, and team members.
          </p>
        </div>

        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-8 sm:p-10 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="workspace-name" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Workspace Name <span className="text-cyan-400">*</span>
              </label>
              <input
                id="workspace-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Acme Engineering, Product Guild"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all"
              />
              <p className="mt-1.5 text-2xs text-slate-400">
                A URL slug will be automatically generated from this name.
              </p>
            </div>

            <div>
              <label htmlFor="workspace-desc" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Description <span className="text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                id="workspace-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your team, department, or company goals..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl text-slate-950 font-extrabold bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Creating Workspace...</span>
                  </>
                ) : (
                  <span>Launch Workspace &rarr;</span>
                )}
              </button>
            </div>
          </form>

          {workspaces.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <Link
                to="/dashboard"
                className="text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors"
              >
                &larr; Back to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
