import React from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';

const BillingCancel = () => {
  const { currentWorkspace } = useWorkspace();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 flex items-center justify-center p-4 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-md w-full rounded-3xl bg-slate-900/80 border border-white/10 p-8 sm:p-10 shadow-2xl backdrop-blur-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Checkout Canceled</h1>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed">
          Your checkout session was canceled and no payment was processed. Your workspace remains on its current plan.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            to="/pricing"
            className="w-full inline-flex justify-center items-center py-3.5 px-4 rounded-xl font-extrabold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            Review Subscription Plans &rarr;
          </Link>
          <Link
            to={currentWorkspace ? `/workspaces/${currentWorkspace.id}/settings/billing` : '/dashboard'}
            className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl font-bold text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            Back to Workspace Billing
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BillingCancel;
