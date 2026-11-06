import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { checkHealth } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    data: null,
    error: null,
    timestamp: null,
  });

  const fetchHealth = async () => {
    setHealthStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await checkHealth();
      setHealthStatus({
        loading: false,
        data,
        error: null,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      setHealthStatus({
        loading: false,
        data: null,
        error: err.message || 'Unable to reach Django API',
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background Ambient Lighting */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-indigo-900/30 via-purple-900/20 to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-28 lg:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Release Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 mb-8 shadow-lg shadow-indigo-500/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>SprintSync 1.0 Production Platform • Multi-Tenant SaaS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.1] max-w-5xl mx-auto">
            The Modern <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400">Multi-Tenant</span> SaaS Project Suite
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300/90 max-w-3xl mx-auto leading-relaxed font-normal">
            High-performance agile issue tracking, interactive drag-and-drop Kanban boards, sprint lifecycle management, team collaboration, and Stripe billing built on PostgreSQL & Django 6.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 hover:opacity-95 rounded-2xl shadow-xl shadow-indigo-500/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:scale-105"
              >
                <span>Open Project Dashboard</span>
                <span>→</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 hover:opacity-95 rounded-2xl shadow-xl shadow-indigo-500/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:scale-105"
                >
                  <span>Start Free Workspace</span>
                  <span>→</span>
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-8 py-4 text-sm font-semibold text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800/80 rounded-2xl border border-white/10 shadow-lg transition-all cursor-pointer"
                >
                  Sign In
                </Link>
              </>
            )}
            <Link
              to="/pricing"
              className="w-full sm:w-auto px-6 py-4 text-sm font-medium text-slate-400 hover:text-indigo-300 transition-colors"
            >
              View Plans & Limits
            </Link>
          </div>

          {/* Live API Health Diagnostic Card */}
          <div className="mt-14 max-w-lg mx-auto">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-md text-left transition-all">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="text-3xs font-bold uppercase tracking-wider text-slate-400">Live API Health Engine</span>
                <button
                  type="button"
                  onClick={fetchHealth}
                  disabled={healthStatus.loading}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
                >
                  {healthStatus.loading ? 'Pinging...' : 'Ping Diagnostic'}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    healthStatus.loading
                      ? 'bg-amber-400 animate-spin'
                      : healthStatus.data
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : 'bg-rose-500'
                  }`} />
                  <div>
                    <div className="text-xs font-bold text-white">
                      {healthStatus.loading
                        ? 'Verifying Django REST connection...'
                        : healthStatus.data
                        ? 'Django 6 Backend Connected'
                        : 'Cannot reach Django API'}
                    </div>
                    <div className="text-3xs text-slate-400 font-mono mt-0.5">
                      GET /api/health/?detailed=true
                      {healthStatus.timestamp && ` • ${healthStatus.timestamp}`}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-3xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                    healthStatus.loading
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : healthStatus.data
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {healthStatus.loading ? 'Checking' : healthStatus.data ? 'Healthy' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section id="features" className="py-20 bg-slate-900/50 border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Engineered Architecture</h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Enterprise Project Management Capabilities
            </p>
            <p className="mt-4 text-sm sm:text-base text-slate-400">
              Purpose-built for agile software engineering teams demanding velocity and security.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Tile 1 */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 shadow-xl hover:border-indigo-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center text-white text-xl mb-5 shadow-md shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                🏢
              </div>
              <h3 className="text-base font-bold text-white">Multi-Tenant Workspaces</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Shared-schema PostgreSQL data isolation scoping every model to `workspace_id`. Dedicated tenant URLs, invitations, and hierarchical RBAC.
              </p>
            </div>

            {/* Tile 2 */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 shadow-xl hover:border-purple-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-fuchsia-400 flex items-center justify-center text-white text-xl mb-5 shadow-md shadow-purple-500/20 group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="text-base font-bold text-white">Interactive Kanban & Sprints</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Smooth drag-and-drop powered by `@dnd-kit`, custom workflow column transitions, sprint burndown velocity, and backlog planning.
              </p>
            </div>

            {/* Tile 3 */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 shadow-xl hover:border-cyan-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center text-white text-xl mb-5 shadow-md shadow-cyan-500/20 group-hover:scale-110 transition-transform">
                💳
              </div>
              <h3 className="text-base font-bold text-white">Stripe Billing & Quotas</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Stripe Checkout sessions, Customer Portals, idempotent webhook handling, and server-side plan limit enforcement across Free, Pro, and Business tiers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Strip */}
      <section className="py-16 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-3xs uppercase tracking-widest text-slate-500 font-bold mb-6">
            Core Technology Architecture
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono">
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400">React 18</span>
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-sky-400">Vite 6</span>
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">Django 6.0</span>
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400">PostgreSQL 16</span>
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-rose-400">Celery 5.4</span>
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-purple-400">Redis 7</span>
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400">Stripe Test Mode</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 bg-slate-950 border-t border-white/5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>SprintSync SaaS Platform • All 9 Development Stages Completed</span>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="hover:text-slate-300">Pricing</Link>
            <Link to="/login" className="hover:text-slate-300">Sign In</Link>
            <Link to="/register" className="hover:text-slate-300">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
