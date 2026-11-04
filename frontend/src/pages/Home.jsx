import React, { useState, useEffect } from 'react';
import { checkHealth } from '../services/api';

const Home = () => {
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
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-indigo-500 selection:text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-500 to-sky-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            Stage 1: Production Foundation Active
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
            The Enterprise <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-600">Multi-Tenant</span> SaaS Project Platform
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Manage organizations, projects, agile sprints, and cross-functional teams in an isolated, high-performance architecture built for scale.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              className="w-full sm:w-auto px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-lg shadow-indigo-200 transition-all cursor-pointer"
            >
              Get Started Free
            </button>
            <button
              type="button"
              className="w-full sm:w-auto px-6 py-3.5 text-base font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer"
            >
              Platform Overview
            </button>
          </div>

          {/* Live Backend Connection Status Card */}
          <div id="status" className="mt-12 max-w-xl mx-auto">
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-md text-left transition-all">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Backend API Connection</span>
                </div>
                <button
                  type="button"
                  onClick={fetchHealth}
                  disabled={healthStatus.loading}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {healthStatus.loading ? 'Pinging...' : 'Ping Again'}
                </button>
              </div>

              <div className="mt-3 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {healthStatus.loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                  ) : healthStatus.data ? (
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-300"></div>
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm shadow-rose-300"></div>
                  )}

                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {healthStatus.loading
                        ? 'Verifying API connectivity...'
                        : healthStatus.data
                        ? healthStatus.data.message || 'API is online'
                        : 'Cannot reach Django backend'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Endpoint: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">GET /api/health/</code>
                      {healthStatus.timestamp && ` • Last ping: ${healthStatus.timestamp}`}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${
                    healthStatus.loading
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : healthStatus.data
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {healthStatus.loading ? 'Connecting' : healthStatus.data ? 'Connected' : 'Offline'}
                </span>
              </div>

              {healthStatus.error && (
                <div className="mt-3 text-xs bg-rose-50 text-rose-700 p-2.5 rounded-lg border border-rose-200">
                  <p className="font-semibold">Connection Note:</p>
                  <p className="mt-0.5">Ensure the Django development server is running at <code className="font-mono">http://localhost:8000</code>.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section id="features" className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Core Capabilities</h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
              Engineered for Modern Engineering & Product Teams
            </p>
            <p className="mt-4 text-base text-slate-600">
              A comprehensive multi-tenant architecture designed to scale seamlessly from seed-stage teams to global enterprises.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-200 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Multi-Tenant Isolation</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Clean workspace boundaries with tenant-scoped data segmentation, organization hierarchies, and role-based access controls.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-200 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Agile Sprints & Kanban</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Interactive drag-and-drop task boards, backlog refinement, sprint burndown tracking, and customizable workflow states.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-200 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">High-Performance APIs</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Powered by Django REST Framework and PostgreSQL with SimpleJWT token authentication, Redis caching, and Celery tasks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack & Architecture Overview */}
      <section id="architecture" className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">System Architecture</h2>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Production-Grade Technology Stack
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="font-bold text-indigo-600 text-lg">React 18 + Vite</div>
              <div className="text-xs text-slate-500 mt-1">SPA Client</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="font-bold text-indigo-600 text-lg">Django 6 + DRF</div>
              <div className="text-xs text-slate-500 mt-1">REST API Backend</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="font-bold text-indigo-600 text-lg">PostgreSQL 16</div>
              <div className="text-xs text-slate-500 mt-1">Relational Database</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="font-bold text-indigo-600 text-lg">Tailwind CSS</div>
              <div className="text-xs text-slate-500 mt-1">Modern Design System</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 bg-white border-t border-slate-200 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          Multi-Tenant SaaS Project Management Platform • Stage 1 Foundation Completed
        </div>
      </footer>
    </div>
  );
};

export default Home;
