import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { billingService } from '../services/api';

const WorkspaceBilling = () => {
  const { workspaceId } = useParams();
  const { currentWorkspace, workspaces } = useWorkspace();
  const navigate = useNavigate();

  const activeWsId = workspaceId || currentWorkspace?.id;

  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelActionLoading, setCancelActionLoading] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);

  useEffect(() => {
    if (activeWsId) {
      fetchBillingOverview();
    }
  }, [activeWsId]);

  const fetchBillingOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const [subData, invData] = await Promise.all([
        billingService.getSubscription(activeWsId),
        billingService.getInvoices(activeWsId),
      ]);
      setSubscription(subData);
      setInvoices(invData?.results || invData || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load workspace billing details.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    try {
      setPortalLoading(true);
      const res = await billingService.createCustomerPortalSession({
        workspace_id: activeWsId,
        return_url: window.location.href,
      });
      if (res?.portal_url) {
        window.location.href = res.portal_url;
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to open Stripe Customer Portal.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelActionLoading(true);
      await billingService.cancelSubscription(activeWsId, cancelAtPeriodEnd);
      setCancelModalOpen(false);
      setActionSuccessMessage(
        cancelAtPeriodEnd
          ? 'Subscription set to cancel at end of current billing period.'
          : 'Subscription has been canceled immediately.'
      );
      await fetchBillingOverview();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel subscription.');
    } finally {
      setCancelActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setReactivateLoading(true);
      await billingService.reactivateSubscription(activeWsId);
      setActionSuccessMessage('Subscription successfully reactivated!');
      await fetchBillingOverview();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reactivate subscription.');
    } finally {
      setReactivateLoading(false);
    }
  };

  // Helper for progress bar
  const renderProgressBar = (label, current, max, unit = '') => {
    const percentage = max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0;
    let colorClass = 'bg-gradient-to-r from-cyan-400 to-indigo-500';
    if (percentage >= 90) colorClass = 'bg-gradient-to-r from-rose-500 to-red-600';
    else if (percentage >= 75) colorClass = 'bg-gradient-to-r from-amber-400 to-orange-500';

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-slate-300">{label}</span>
          <span className="text-slate-400 font-mono">
            {current.toLocaleString()} {unit} / {max.toLocaleString()} {unit} ({percentage}%)
          </span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
          <div
            className={`h-full ${colorClass} transition-all duration-300 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 flex items-center justify-center text-slate-100">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold text-slate-400">Loading billing overview...</p>
        </div>
      </div>
    );
  }

  const plan = subscription?.plan;
  const usage = subscription?.usage;
  const status = subscription?.status || 'FREE';
  const isPaidPlan = plan?.slug && plan.slug !== 'free';

  const formatMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <Link to="/workspaces" className="hover:text-indigo-400">Workspaces</Link>
          <span>/</span>
          <Link to={`/settings/workspace`} className="hover:text-indigo-400">
            {currentWorkspace?.name || 'Workspace'}
          </Link>
          <span>/</span>
          <span className="text-white font-bold">Billing & Quotas</span>
        </div>

        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 via-indigo-900/80 to-purple-900/70 border border-white/10 shadow-2xl backdrop-blur-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Subscription & Plan Limits
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300/80">
              Manage workspace plan tier, track live usage limits, view Stripe invoices, and upgrade features.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/pricing"
              className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 rounded-xl shadow-lg transition-all"
            >
              Change Plan
            </Link>
            {isPaidPlan && subscription?.stripe_customer_id && (
              <button
                type="button"
                onClick={handleOpenCustomerPortal}
                disabled={portalLoading}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-colors cursor-pointer"
              >
                {portalLoading ? 'Opening Portal...' : 'Customer Portal ↗'}
              </button>
            )}
          </div>
        </div>

        {actionSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <span>✓ {actionSuccessMessage}</span>
            <button
              onClick={() => setActionSuccessMessage(null)}
              className="text-emerald-400 hover:text-white text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Current Plan Card */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-white">{plan?.name || 'Free'} Plan</span>
                <span
                  className={`px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider ${
                    status === 'ACTIVE' || status === 'TRIALING'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : status === 'PAST_DUE'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : status === 'CANCELED'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                  }`}
                >
                  {status}
                </span>
                {subscription?.cancel_at_period_end && (
                  <span className="px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Cancels at end of cycle
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                {plan?.description || 'Basic collaboration tools for small starter projects.'}
              </p>
              {isPaidPlan && (
                <div className="text-xs text-slate-400 flex flex-wrap gap-4 pt-2">
                  <span>Billing Interval: <strong className="text-white capitalize">{subscription?.billing_interval || 'monthly'}</strong></span>
                  {subscription?.current_period_end && (
                    <span>
                      Renews on: <strong className="text-white">{new Date(subscription.current_period_end).toLocaleDateString()}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Price & Plan Status Actions */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-white/5">
              <div className="text-right">
                <span className="text-3xl font-black text-white">
                  ${subscription?.billing_interval === 'yearly' ? plan?.yearly_price : plan?.monthly_price}
                </span>
                <span className="text-xs text-slate-400 ml-1">
                  /{plan?.slug === 'free' ? 'forever' : subscription?.billing_interval === 'yearly' ? 'year' : 'month'}
                </span>
              </div>

              {isPaidPlan && (
                <div className="flex items-center gap-2">
                  {subscription?.cancel_at_period_end ? (
                    <button
                      type="button"
                      onClick={handleReactivateSubscription}
                      disabled={reactivateLoading}
                      className="px-3.5 py-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-colors cursor-pointer"
                    >
                      {reactivateLoading ? 'Reactivating...' : 'Reactivate Subscription'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCancelModalOpen(true)}
                      className="px-3.5 py-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel Subscription
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Usage Progress Metrics */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">Workspace Usage Metrics</h2>
              <p className="text-xs text-slate-400">Live resource allocations vs. your tier allowances.</p>
            </div>
            <button
              type="button"
              onClick={fetchBillingOverview}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold"
            >
              Refresh Metrics ⟳
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderProgressBar(
              'Team Members',
              usage?.active_members || 1,
              plan?.max_members || 5
            )}
            {renderProgressBar(
              'Active Projects',
              usage?.active_projects || 0,
              plan?.max_projects || 3
            )}
            {renderProgressBar(
              'Tasks & Issues',
              usage?.total_tasks || 0,
              plan?.max_tasks || 100
            )}
            {renderProgressBar(
              'Attachment Storage',
              parseFloat(formatMB(usage?.storage_bytes || 0)),
              parseFloat(formatMB(plan?.max_storage_bytes || 104857600)),
              'MB'
            )}
            <div className="md:col-span-2">
              {renderProgressBar(
                'Outbound Webhook Endpoints',
                usage?.active_webhooks || 0,
                plan?.max_webhooks || 0
              )}
            </div>
          </div>
        </div>

        {/* Invoices and Billing History */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 overflow-hidden shadow-xl backdrop-blur-md">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-base font-bold text-white">Payment & Invoice History</h2>
            <p className="text-xs text-slate-400">Download itemized receipts and PDF statements from Stripe.</p>
          </div>

          {invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No billing invoices on record for this workspace.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-white/10 text-3xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-6">Invoice #</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6">Amount</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02]">
                      <td className="py-3.5 px-6 font-mono font-medium text-white">
                        {inv.invoice_number || inv.stripe_invoice_id.slice(-8)}
                      </td>
                      <td className="py-3.5 px-6">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-6 font-bold text-white">
                        ${(inv.amount_paid / 100).toFixed(2)} {inv.currency.toUpperCase()}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase ${
                            inv.status.toUpperCase() === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : inv.status.toUpperCase() === 'OPEN'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {inv.hosted_invoice_url ? (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 font-bold"
                          >
                            View Invoice ↗
                          </a>
                        ) : inv.invoice_pdf_url ? (
                          <a
                            href={inv.invoice_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 font-bold"
                          >
                            PDF ↗
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/15">
            <h3 className="text-base font-bold text-white">Cancel Subscription?</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Are you sure you want to cancel your {plan?.name} plan? You will retain access until the end of your billing cycle.
            </p>

            <div className="mt-4 space-y-2 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cancel_timing"
                  checked={cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(true)}
                  className="text-indigo-500 focus:ring-indigo-500"
                />
                <span className="text-slate-200 font-semibold text-xs">
                  Cancel at period end (Recommended – retain features)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cancel_timing"
                  checked={!cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(false)}
                  className="text-rose-500 focus:ring-rose-500"
                />
                <span className="text-rose-400 font-semibold text-xs">
                  Cancel immediately (Revert workspace to Free plan now)
                </span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                Keep Plan
              </button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelActionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer"
              >
                {cancelActionLoading ? 'Canceling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceBilling;
