import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { billingService } from '../services/api';

const PricingPage = () => {
  const { isAuthenticated } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [billingInterval, setBillingInterval] = useState('monthly'); // 'monthly' or 'yearly'
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPricingData();
  }, [currentWorkspace]);

  const fetchPricingData = async () => {
    try {
      setLoading(true);
      setError(null);
      const plansData = await billingService.getPlans();
      setPlans(plansData);

      if (currentWorkspace?.id) {
        try {
          const subData = await billingService.getSubscription(currentWorkspace.id);
          setSubscription(subData);
        } catch {
          // May not have permission or subscription yet
        }
      }
    } catch (err) {
      setError('Failed to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan) => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }

    if (!currentWorkspace?.id) {
      alert('Please select or create an active workspace first to upgrade its subscription.');
      navigate('/workspaces');
      return;
    }

    // Check if user is owner/admin
    const isOwnerOrAdmin =
      currentWorkspace.current_user_role === 'OWNER' ||
      currentWorkspace.current_user_role === 'ADMIN';

    if (!isOwnerOrAdmin) {
      alert('Only workspace Owners and Administrators can manage subscription plans.');
      return;
    }

    try {
      setActionLoading(plan.id);
      const response = await billingService.createCheckoutSession({
        workspace_id: currentWorkspace.id,
        plan_id: plan.id,
        billing_interval: billingInterval,
      });

      if (response?.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to start Stripe checkout session.';
      alert(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const isCurrentPlan = (planSlug) => {
    if (!subscription) return planSlug === 'free';
    return subscription.plan?.slug === planSlug;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 py-16 px-4 sm:px-6 lg:px-8">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 mb-5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Stripe Payments Engine • Test Mode Simulation</span>
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Transparent Pricing Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400">Scaling Teams</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-300/80 leading-relaxed">
            Scale seamlessly from agile startups to enterprise teams. Unlock unlimited tasks, custom Kanban workflows, real-time webhooks, and expanded cloud storage.
          </p>

          {/* Billing Interval Toggle */}
          <div className="mt-8 flex justify-center items-center gap-3">
            <span className={`text-xs font-bold ${billingInterval === 'monthly' ? 'text-white' : 'text-slate-400'}`}>
              Monthly billing
            </span>
            <button
              type="button"
              onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                billingInterval === 'yearly' ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  billingInterval === 'yearly' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-bold flex items-center gap-1.5 ${billingInterval === 'yearly' ? 'text-white' : 'text-slate-400'}`}>
              <span>Annual billing</span>
              <span className="px-2 py-0.5 text-3xs font-extrabold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-stretch">
          {loading ? (
            <div className="col-span-3 text-center py-20 text-slate-400 font-medium text-xs">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading available subscription tiers...
            </div>
          ) : (
            plans.map((plan) => {
              const isCurrent = isCurrentPlan(plan.slug);
              const price = billingInterval === 'yearly' ? plan.yearly_price : plan.monthly_price;
              const isPro = plan.slug === 'pro';

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl p-8 transition-all duration-300 backdrop-blur-xl ${
                    isPro
                      ? 'bg-gradient-to-b from-indigo-900/60 via-slate-900/90 to-purple-900/60 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 ring-2 ring-indigo-400/20'
                      : 'bg-slate-900/80 border border-white/10 shadow-xl hover:border-white/20'
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 text-3xs font-black uppercase tracking-widest shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="mt-2 text-xs text-slate-400 min-h-[40px] leading-relaxed">{plan.description}</p>

                    <div className="mt-6 flex items-baseline">
                      <span className="text-5xl font-black tracking-tight text-white">
                        ${price}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        {plan.slug === 'free' ? 'forever' : `/${billingInterval === 'yearly' ? 'yr' : 'mo'}`}
                      </span>
                    </div>

                    {/* Features List */}
                    <div className="mt-8 border-t border-white/10 pt-6">
                      <h4 className="text-3xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Plan Features & Quotas
                      </h4>
                      <ul className="space-y-3.5 text-xs text-slate-300">
                        <li className="flex items-center gap-3">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>{plan.max_members}</strong> Workspace Collaborators</span>
                        </li>
                        <li className="flex items-center gap-3">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>{plan.max_projects}</strong> Active Projects</span>
                        </li>
                        <li className="flex items-center gap-3">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>{plan.max_tasks.toLocaleString()}</strong> Tasks & Issues</span>
                        </li>
                        <li className="flex items-center gap-3">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>{Math.round(plan.max_storage_bytes / (1024 * 1024))} MB</strong> Storage Capacity</span>
                        </li>
                        <li className="flex items-center gap-3">
                          {plan.max_webhooks > 0 ? (
                            <span className="text-emerald-400 font-bold">✓</span>
                          ) : (
                            <span className="text-slate-600 font-bold">✕</span>
                          )}
                          <span className={plan.max_webhooks === 0 ? 'text-slate-500' : ''}>
                            {plan.max_webhooks > 0 ? `${plan.max_webhooks} Outbound Webhooks` : 'No Webhook Integrations'}
                          </span>
                        </li>
                        <li className="flex items-center gap-3">
                          {plan.features?.custom_workflows ? (
                            <span className="text-emerald-400 font-bold">✓</span>
                          ) : (
                            <span className="text-slate-600 font-bold">✕</span>
                          )}
                          <span className={!plan.features?.custom_workflows ? 'text-slate-500' : ''}>
                            Custom Kanban Workflows
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="mt-8">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-white/10 text-slate-400 cursor-default border border-white/10 text-center"
                      >
                        Active Workspace Plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan)}
                        disabled={actionLoading === plan.id}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all duration-150 shadow-md cursor-pointer ${
                          isPro
                            ? 'bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 shadow-indigo-500/25'
                            : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                        }`}
                      >
                        {actionLoading === plan.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Connecting to Stripe...
                          </span>
                        ) : plan.slug === 'free' ? (
                          'Get Started Free'
                        ) : (
                          `Upgrade to ${plan.name}`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Feature Comparison Matrix */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-8 shadow-xl overflow-x-auto backdrop-blur-md">
          <h2 className="text-xl font-extrabold text-white mb-6 text-center">Feature Comparison Matrix</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-300">Feature</th>
                <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Free</th>
                <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-indigo-400 text-center">Pro</th>
                <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-fuchsia-400 text-center">Business</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              <tr>
                <td className="py-4 px-6 font-semibold text-white">Team Collaborators</td>
                <td className="py-4 px-6 text-center text-slate-400">5</td>
                <td className="py-4 px-6 text-center font-bold text-indigo-400">25</td>
                <td className="py-4 px-6 text-center font-bold text-fuchsia-400">100</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold text-white">Active Projects</td>
                <td className="py-4 px-6 text-center text-slate-400">3</td>
                <td className="py-4 px-6 text-center font-bold text-indigo-400">15</td>
                <td className="py-4 px-6 text-center font-bold text-fuchsia-400">50</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold text-white">Tasks & Issues</td>
                <td className="py-4 px-6 text-center text-slate-400">100</td>
                <td className="py-4 px-6 text-center font-bold text-indigo-400">1,000</td>
                <td className="py-4 px-6 text-center font-bold text-fuchsia-400">10,000</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold text-white">Cloud Storage</td>
                <td className="py-4 px-6 text-center text-slate-400">100 MB</td>
                <td className="py-4 px-6 text-center font-bold text-indigo-400">1 GB</td>
                <td className="py-4 px-6 text-center font-bold text-fuchsia-400">10 GB</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold text-white">Webhook Integrations</td>
                <td className="py-4 px-6 text-center text-slate-600">—</td>
                <td className="py-4 px-6 text-center font-bold text-indigo-400">5 webhooks</td>
                <td className="py-4 px-6 text-center font-bold text-fuchsia-400">25 webhooks</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold text-white">Custom Kanban Workflows</td>
                <td className="py-4 px-6 text-center text-slate-600">—</td>
                <td className="py-4 px-6 text-center font-bold text-emerald-400">Included</td>
                <td className="py-4 px-6 text-center font-bold text-emerald-400">Included</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold text-white">Stripe Customer Portal</td>
                <td className="py-4 px-6 text-center text-slate-600">—</td>
                <td className="py-4 px-6 text-center font-bold text-emerald-400">Included</td>
                <td className="py-4 px-6 text-center font-bold text-emerald-400">Included</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Test Mode Notice */}
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
          <span className="text-amber-400 text-base">⚠️</span>
          <div>
            <p className="font-bold text-amber-200">SprintSync Stripe Test Mode</p>
            <p className="mt-0.5 text-amber-300/80">
              Checkout sessions use Stripe Test Mode with test card numbers (e.g. <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono text-2xs text-amber-200">4242 4242 4242 4242</code>). No real credit card is ever billed or charged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
