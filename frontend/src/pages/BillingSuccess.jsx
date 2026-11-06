import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';

const BillingSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { currentWorkspace } = useWorkspace();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 flex items-center justify-center p-4 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-md w-full rounded-3xl bg-slate-900/80 border border-white/10 p-8 sm:p-10 shadow-2xl backdrop-blur-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
          <svg className="w-8 h-8 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Payment Successful!</h1>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed">
          Your workspace subscription has been upgraded successfully. All plan limits and features have been unlocked immediately.
        </p>

        {sessionId && (
          <div className="mt-5 p-3.5 rounded-xl bg-slate-800/60 border border-white/5 font-mono text-2xs text-slate-400 break-all text-left">
            <span className="font-bold text-cyan-400 block mb-1">Stripe Session:</span>
            {sessionId}
          </div>
        )}

        <div className="mt-8 space-y-3">
          <Link
            to={currentWorkspace ? `/workspaces/${currentWorkspace.id}/settings/billing` : '/dashboard'}
            className="w-full inline-flex justify-center items-center py-3.5 px-4 rounded-xl font-extrabold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            Go to Workspace Billing &rarr;
          </Link>
          <Link
            to="/dashboard"
            className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl font-bold text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BillingSuccess;
