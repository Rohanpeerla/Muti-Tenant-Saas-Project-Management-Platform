import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  projectService,
  billingService,
  auditLogService,
  workspaceService,
  issueService
} from '../services/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    invitations,
    switchWorkspace,
    acceptInvitation,
    declineInvitation,
    loading: workspaceLoading,
  } = useWorkspace();
  const navigate = useNavigate();

  // State for workspace dashboard data
  const [projects, setProjects] = useState([]);
  const [recentIssues, setRecentIssues] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'projects', 'tasks', 'activity'

  // Fetch real data when active workspace changes
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    let isMounted = true;
    setLoadingMetrics(true);

    const fetchDashboardData = async () => {
      try {
        const [projectsRes, subRes, logsRes, membersRes] = await Promise.allSettled([
          projectService.getProjects(currentWorkspace.id),
          billingService.getSubscription(currentWorkspace.id),
          auditLogService.getWorkspaceAuditLogs(currentWorkspace.id, { page_size: 5 }),
          workspaceService.getWorkspaceMembers(currentWorkspace.id),
        ]);

        if (!isMounted) return;

        let fetchedProjects = [];
        if (projectsRes.status === 'fulfilled') {
          fetchedProjects = projectsRes.value?.results || projectsRes.value || [];
          setProjects(fetchedProjects);
        }

        if (subRes.status === 'fulfilled') {
          setSubscription(subRes.value);
        }

        if (logsRes.status === 'fulfilled') {
          setAuditLogs(logsRes.value?.results || logsRes.value || []);
        }

        if (membersRes.status === 'fulfilled') {
          setMembers(membersRes.value?.results || membersRes.value || []);
        }

        // If there are projects, fetch recent issues from the first 2 projects
        if (fetchedProjects.length > 0) {
          try {
            const firstProj = fetchedProjects[0];
            const issuesRes = await issueService.getIssues(firstProj.id, { page_size: 6 });
            if (isMounted) {
              setRecentIssues(issuesRes?.results || issuesRes || []);
            }
          } catch (e) {
            // Ignore issue fetch error
          }
        } else {
          setRecentIssues([]);
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        if (isMounted) setLoadingMetrics(false);
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [currentWorkspace?.id]);

  // Aggregate project and task metrics
  const metrics = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status !== 'COMPLETED' && p.status !== 'ARCHIVED').length;
    
    let totalTasks = 0;
    let completedTasks = 0;
    projects.forEach(p => {
      totalTasks += (p.task_count || p.total_issues || 0);
      completedTasks += (p.completed_task_count || p.completed_issues || 0);
    });

    // Fallback if recentIssues are loaded
    if (totalTasks === 0 && recentIssues.length > 0) {
      totalTasks = recentIssues.length;
      completedTasks = recentIssues.filter(i => i.status === 'DONE').length;
    }

    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const teamCount = members.length || currentWorkspace?.member_count || 1;

    return {
      totalProjects,
      activeProjects,
      totalTasks,
      completedTasks,
      taskCompletionRate,
      teamCount,
    };
  }, [projects, recentIssues, members, currentWorkspace]);

  const isOwnerOrAdmin =
    currentWorkspace?.current_user_role === 'OWNER' ||
    currentWorkspace?.current_user_role === 'ADMIN';

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DONE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Done</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">⚡ In Progress</span>;
      case 'IN_REVIEW':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">🔍 In Review</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">📋 Backlog</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-16">
      {/* Top Ambient Glow Effects */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* =========================================================================
            1. COMMAND HERO BAR: Workspace Context, User Identity & Fast Actions
        ========================================================================= */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 via-indigo-900/80 to-purple-900/70 border border-white/10 shadow-2xl backdrop-blur-xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* User Avatar & Greeting */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 p-0.5 shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-300">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center font-extrabold text-2xl sm:text-3xl text-white">
                    {user?.first_name ? user.first_name[0].toUpperCase() : user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 ring-2 ring-emerald-400/50" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Welcome back, {user?.first_name || user?.username}!
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    Pro Workspace
                  </span>
                </div>
                
                <p className="text-xs sm:text-sm text-slate-300/80 mt-1 flex items-center gap-2">
                  <span>Signed in as <strong className="text-white font-medium">{user?.email}</strong></span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Multi-Tenant Active
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Action Hub */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/projects"
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center gap-2 hover:scale-[1.02] cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Project</span>
              </Link>

              {currentWorkspace && (
                <Link
                  to="/settings/team"
                  className="px-4 py-2.5 rounded-xl font-semibold text-xs bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span>Invite Team</span>
                </Link>
              )}

              <Link
                to="/workspaces"
                className="px-3.5 py-2.5 rounded-xl font-medium text-xs bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Switch Workspace"
              >
                Organizations
              </Link>
            </div>
          </div>

          {/* Pending Invitations Alert */}
          {invitations && invitations.length > 0 && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-200">
                    You have {invitations.length} pending workspace {invitations.length === 1 ? 'invitation' : 'invitations'}!
                  </h4>
                  <p className="text-xs text-amber-300/80">
                    Join "{invitations[0].workspace?.name}" as <span className="font-semibold text-white">{invitations[0].role}</span>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => acceptInvitation(invitations[0].id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-xs"
                >
                  Accept & Join
                </button>
                <button
                  type="button"
                  onClick={() => declineInvitation(invitations[0].id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>


        {/* =========================================================================
            2. VIBRANT KPI METRIC TILES: High-Energy Neon / Modern Color Mix
        ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Active Projects (Royal Indigo & Sky) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900/60 via-slate-900/80 to-slate-900/90 border border-indigo-500/20 p-5 shadow-xl hover:border-indigo-500/40 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Active Projects</p>
                <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight">
                  {metrics.totalProjects}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 p-0.5 shadow-md shadow-indigo-500/30">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-sky-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">{metrics.activeProjects} in development</span>
              <Link to="/projects" className="font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                View all →
              </Link>
            </div>
          </div>

          {/* Card 2: Sprint Velocity & Tasks (Purple & Fuchsia) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/60 via-slate-900/80 to-slate-900/90 border border-purple-500/20 p-5 shadow-xl hover:border-purple-500/40 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-purple-300">Sprint Workload</p>
                <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight">
                  {metrics.totalTasks} <span className="text-sm font-medium text-slate-400">Tasks</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-500 to-fuchsia-400 p-0.5 shadow-md shadow-purple-500/30">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-fuchsia-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Progress: {metrics.completedTasks} completed</span>
                <span className="font-bold text-fuchsia-400">{metrics.taskCompletionRate}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.taskCompletionRate || 5}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Team Members & Roles (Emerald & Teal) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/60 via-slate-900/80 to-slate-900/90 border border-emerald-500/20 p-5 shadow-xl hover:border-emerald-500/40 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Active Team</p>
                <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight">
                  {metrics.teamCount} <span className="text-sm font-medium text-slate-400">Collaborators</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-500/30">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-teal-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-medium">Role: {currentWorkspace?.current_user_role || 'OWNER'}</span>
              <Link to="/settings/team" className="font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                Manage →
              </Link>
            </div>
          </div>

          {/* Card 4: SaaS Plan Quota (Sunset Amber & Rose) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-900/60 via-slate-900/80 to-slate-900/90 border border-amber-500/20 p-5 shadow-xl hover:border-amber-500/40 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Subscription Tier</p>
                <h3 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight">
                  {subscription?.plan?.tier || 'PRO'}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-400 p-0.5 shadow-md shadow-amber-500/30">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-amber-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Status: <strong className="text-emerald-400">Active</strong></span>
              <Link to="/pricing" className="font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1">
                Upgrade →
              </Link>
            </div>
          </div>
        </div>


        {/* =========================================================================
            3. QUICK NAVIGATION COMMAND STRIP
        ========================================================================= */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          <Link
            to="/projects"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold text-xs shrink-0 transition-all shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>Kanban Boards</span>
          </Link>
          <Link
            to="/pricing"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold text-xs shrink-0 transition-all shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Pricing & Tiers</span>
          </Link>
          <Link
            to="/notifications"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-bold text-xs shrink-0 transition-all shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>Notification Center</span>
          </Link>
          <Link
            to="/webhooks"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs shrink-0 transition-all shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Developer Webhooks</span>
          </Link>
          {isOwnerOrAdmin && (
            <Link
              to="/settings/audit-logs"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs shrink-0 transition-all shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Security Audit Logs</span>
            </Link>
          )}
        </div>


        {/* =========================================================================
            4. MAIN WORKSPACE CONTENT: Projects Grid, Recent Tasks & Activity
        ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2 COLUMNS: Projects Showcase & Active Sprint Tasks */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Active Projects Showcase */}
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                    📁
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white tracking-tight">Current Projects</h2>
                    <p className="text-xs text-slate-400">Projects tracked within {currentWorkspace?.name || 'this workspace'}</p>
                  </div>
                </div>
                <Link
                  to="/projects"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                >
                  + Add Project
                </Link>
              </div>

              {loadingMetrics ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs">Loading projects & Kanban boards...</p>
                </div>
              ) : projects.length === 0 ? (
                <div className="py-12 px-6 rounded-2xl border border-dashed border-slate-700 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto text-xl">
                    🚀
                  </div>
                  <h3 className="font-bold text-white text-sm">No Projects Created Yet</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Create your first agile project to unlock Kanban boards, sprint backlogs, and issue assignments.
                  </p>
                  <Link
                    to="/projects"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md"
                  >
                    Create First Project
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.slice(0, 4).map((proj) => (
                    <div
                      key={proj.id}
                      className="group relative rounded-2xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/60 hover:border-indigo-500/40 p-5 transition-all duration-200 shadow-md flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-2xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                            {proj.key || 'PROJ'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            {proj.status || 'Active'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white mt-2.5 group-hover:text-indigo-300 transition-colors">
                          {proj.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {proj.description || 'Dedicated development project with agile sprint cycles and workflow columns.'}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {proj.task_count ?? proj.total_issues ?? 0} issues
                        </span>
                        <Link
                          to={`/projects/${proj.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                        >
                          <span>Open Board</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent High-Priority Tasks / Workload */}
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center font-bold">
                    ⚡
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white tracking-tight">Active Sprint Tasks</h2>
                    <p className="text-xs text-slate-400">High priority items requiring team attention</p>
                  </div>
                </div>
              </div>

              {recentIssues.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No open issues in current sprint. Create issues on the Kanban board to track progress.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {recentIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`px-2 py-0.5 rounded text-2xs font-mono font-bold border ${getPriorityColor(issue.priority)}`}>
                          {issue.priority || 'MEDIUM'}
                        </span>
                        <span className="text-xs font-mono text-slate-400 shrink-0">
                          {issue.key || `#${issue.id.slice(0, 4)}`}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-200 truncate">
                          {issue.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {getStatusBadge(issue.status)}
                        {issue.assignee && (
                          <div
                            className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold"
                            title={`Assigned to ${issue.assignee.email || issue.assignee.username}`}
                          >
                            {(issue.assignee.first_name || issue.assignee.username || 'A')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* RIGHT COLUMN: Real-Time Activity Feed & Workspace Organization Switcher */}
          <div className="space-y-8">
            
            {/* Live Audit & Collaboration Timeline */}
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                    ⏱️
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white tracking-tight">Live Activity</h2>
                    <p className="text-xs text-slate-400">Real-time workspace actions</p>
                  </div>
                </div>
                {isOwnerOrAdmin && (
                  <Link to="/settings/audit-logs" className="text-xs text-cyan-400 hover:underline">
                    View logs
                  </Link>
                )}
              </div>

              {auditLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No recent audit events logged yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 text-xs">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0 ring-4 ring-cyan-500/20" />
                      <div className="min-w-0">
                        <p className="text-slate-200 leading-snug">
                          <strong className="text-white font-semibold">{log.user?.username || 'Team member'}</strong>{' '}
                          <span className="text-slate-400">{log.action?.toLowerCase() || 'updated an entity'}</span>{' '}
                          <span className="text-cyan-300 font-medium truncate">{log.entity_name || log.entity_type}</span>
                        </p>
                        <span className="text-3xs text-slate-500 font-mono mt-0.5 block">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Organizations Switcher Card */}
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-white tracking-tight">Your Workspaces</h3>
                <Link to="/onboarding" className="text-xs font-bold text-indigo-400 hover:text-indigo-300">
                  + New
                </Link>
              </div>

              <div className="space-y-2.5">
                {workspaces.map((ws) => {
                  const isCurrent = ws.id === currentWorkspace?.id;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => !isCurrent && switchWorkspace(ws.id)}
                      className={`w-full p-3 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-gradient-to-r from-indigo-900/50 to-purple-900/40 border-indigo-500/50 shadow-md ring-1 ring-indigo-400/30'
                          : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/60 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {ws.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{ws.name}</h4>
                          <span className="text-3xs text-slate-400 font-mono">/{ws.slug}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isCurrent ? (
                          <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        ) : (
                          <span className="text-3xs text-slate-400 group-hover:text-white">
                            Switch →
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Architecture Badge */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-white/5 p-4 text-center">
              <p className="text-3xs uppercase tracking-widest text-indigo-400 font-bold">
                SprintSync v1.0.0
              </p>
              <p className="text-2xs text-slate-400 mt-1">
                PostgreSQL Shared-Schema Multi-Tenancy • Celery 5.4 • React 18 • Stripe
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
