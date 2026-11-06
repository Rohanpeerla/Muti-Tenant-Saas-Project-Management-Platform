import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await login(formData.email, formData.password);
      navigate(from, { replace: true });
    } catch (err) {
      const serverError =
        err.response?.data?.non_field_errors ||
        err.response?.data?.detail ||
        'Unable to log in. Please check your credentials.';
      setErrorMessage(typeof serverError === 'string' ? serverError : serverError[0] || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand header */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-extrabold shadow-xl shadow-indigo-500/25">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <h2 className="mt-5 text-center text-3xl font-black text-white tracking-tight">
          Sign in to SprintSync
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Or{' '}
          <Link to="/register" className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
            create a new organization workspace
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/90 py-8 px-6 shadow-2xl border border-white/10 sm:rounded-3xl sm:px-10 backdrop-blur-xl">
          {errorMessage && (
            <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2.5">
              <span className="text-rose-400">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-3xs font-bold uppercase tracking-wider text-slate-300">
                Email address
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@company.com"
                  className="block w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-3xs font-bold uppercase tracking-wider text-slate-300">
                  Password
                </label>
              </div>
              <div className="mt-1.5 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="block w-full px-3.5 py-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white focus:outline-hidden"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 focus:outline-hidden transition-all duration-150 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <span className="text-3xs text-slate-500 uppercase tracking-widest block font-bold">
              Multi-Tenant Architecture
            </span>
            <p className="text-3xs text-slate-400 mt-1">
              Supports JWT authentication with automatic refresh token rotation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
