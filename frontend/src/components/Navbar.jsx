import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { workspaces, currentWorkspace, invitations, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isOwnerOrAdmin =
    currentWorkspace?.current_user_role === 'OWNER' ||
    currentWorkspace?.current_user_role === 'ADMIN';

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-200">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                  Sprint<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Sync</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  SaaS Suite
                </span>
              </div>
            </Link>

            {/* Workspace Switcher in Navbar */}
            {isAuthenticated && (
              <div className="relative hidden md:block" ref={dropdownRef}>
                {currentWorkspace ? (
                  <button
                    type="button"
                    onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors cursor-pointer shadow-xs"
                  >
                    <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-indigo-500 to-sky-400 text-white flex items-center justify-center text-2xs font-bold shadow-xs">
                      {currentWorkspace.name[0]?.toUpperCase()}
                    </div>
                    <span className="max-w-[130px] truncate text-white">{currentWorkspace.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-3xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {currentWorkspace.current_user_role || 'MEMBER'}
                    </span>
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <Link
                    to="/onboarding"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-indigo-400/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-semibold text-indigo-300 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Workspace</span>
                  </Link>
                )}

                {/* Workspace Switcher Popover */}
                {workspaceMenuOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-slate-900 shadow-2xl border border-white/15 py-2 z-50 backdrop-blur-xl">
                    <div className="px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-slate-400">
                      Active Organizations
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                      {workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => {
                            switchWorkspace(ws.id);
                            setWorkspaceMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-white/5 transition-colors cursor-pointer ${
                            ws.id === currentWorkspace?.id ? 'bg-indigo-600/20 font-bold text-indigo-300' : 'text-slate-300'
                          }`}
                        >
                          <span className="truncate pr-2">{ws.name}</span>
                          <span className="text-3xs text-slate-500">{ws.current_user_role}</span>
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-white/10 mt-2 pt-2 px-1">
                      {invitations && invitations.length > 0 && (
                        <Link
                          to="/workspaces"
                          onClick={() => setWorkspaceMenuOpen(false)}
                          className="flex items-center justify-between px-3 py-1.5 text-xs text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg font-semibold transition-colors mb-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span>Invitations</span>
                          </div>
                          <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-3xs font-bold">
                            {invitations.length}
                          </span>
                        </Link>
                      )}

                      <Link
                        to="/workspaces"
                        onClick={() => setWorkspaceMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <span>All Workspaces</span>
                      </Link>

                      <Link
                        to="/onboarding"
                        onClick={() => setWorkspaceMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded-lg font-medium transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>New Workspace</span>
                      </Link>

                      {currentWorkspace && (
                        <>
                          <div className="border-t border-white/10 my-1" />
                          <Link
                            to="/settings/team"
                            onClick={() => setWorkspaceMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span>Team Members</span>
                          </Link>

                          {isOwnerOrAdmin && (
                            <>
                              <Link
                                to="/settings/workspace"
                                onClick={() => setWorkspaceMenuOpen(false)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Workspace Settings</span>
                              </Link>
                              <Link
                                to={`/workspaces/${currentWorkspace.id}/settings/billing`}
                                onClick={() => setWorkspaceMenuOpen(false)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <span>Billing & Quotas</span>
                              </Link>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-300">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            {isAuthenticated && (
              <>
                <Link to="/dashboard" className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Dashboard</span>
                </Link>
                <Link to="/projects" className="hover:text-white transition-colors">
                  Projects & Boards
                </Link>
                <Link to="/workspaces" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span>Workspaces</span>
                  {invitations && invitations.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-3xs font-black leading-none">
                      {invitations.length}
                    </span>
                  )}
                </Link>
                {currentWorkspace && (
                  <Link to="/settings/team" className="hover:text-white transition-colors">
                    Team
                  </Link>
                )}
              </>
            )}
            <Link to="/pricing" className="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
              <span>Pricing</span>
              <span className="text-3xs px-1 rounded bg-purple-500/20 border border-purple-400/30">PRO</span>
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <NotificationBell currentWorkspaceId={currentWorkspace?.id} />
                <Link
                  to="/dashboard"
                  className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 border border-white/10 hover:border-white/20 rounded-xl transition-colors flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{user?.first_name || user?.username}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 hover:opacity-95 rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900"
              aria-label="Toggle Navigation Menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-slate-900 px-4 pt-2 pb-4 space-y-2">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5"
          >
            Home
          </Link>
          {isAuthenticated && (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-bold text-cyan-400 bg-cyan-500/10"
              >
                Dashboard
              </Link>
              <Link
                to="/projects"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5"
              >
                Projects & Boards
              </Link>
              <Link
                to="/workspaces"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5"
              >
                Workspaces
              </Link>
              <Link
                to="/settings/team"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5"
              >
                Team Members
              </Link>
              {currentWorkspace && (
                <Link
                  to={`/workspaces/${currentWorkspace.id}/settings/billing`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5"
                >
                  Billing & Quotas
                </Link>
              )}
            </>
          )}
          <Link
            to="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-purple-300 hover:bg-white/5"
          >
            Pricing
          </Link>
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-center py-2 text-xs font-bold text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/30"
              >
                Sign Out
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 text-xs font-semibold text-slate-300 bg-slate-800 rounded-xl"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-xl"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
