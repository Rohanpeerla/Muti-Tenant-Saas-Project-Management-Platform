import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const { register, login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (errorMessage) setErrorMessage('');
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: null });
    }
  };

  const validateClientSide = () => {
    const errors = {};
    if (!formData.email.trim()) errors.email = 'Email address is required.';
    if (!formData.username.trim()) errors.username = 'Username is required.';
    if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters long.';
    if (formData.password !== formData.password_confirm) errors.password_confirm = 'Passwords do not match.';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clientErrors = validateClientSide();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setFieldErrors({});

    try {
      await register(formData);
      // Auto login user after successful registration
      await login(formData.email, formData.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'object') {
          const formatted = {};
          for (const key of Object.keys(data)) {
            formatted[key] = Array.isArray(data[key]) ? data[key][0] : data[key];
          }
          setFieldErrors(formatted);
          if (data.detail || data.non_field_errors) {
            setErrorMessage(data.detail || data.non_field_errors[0]);
          }
        } else {
          setErrorMessage('Registration failed. Please review your details.');
        }
      } else {
        setErrorMessage('Cannot communicate with backend server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-extrabold shadow-xl shadow-indigo-500/25">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <h2 className="mt-5 text-center text-3xl font-black text-white tracking-tight">
          Create SprintSync Account
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
            Sign in to existing account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-slate-900/90 py-8 px-6 shadow-2xl border border-white/10 sm:rounded-3xl sm:px-10 backdrop-blur-xl">
          {errorMessage && (
            <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2.5">
              <span className="text-rose-400">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-3xs font-bold uppercase tracking-wider text-slate-300">
                  First name
                </label>
                <div className="mt-1">
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="Alex"
                    className="block w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="last_name" className="block text-3xs font-bold uppercase tracking-wider text-slate-300">
                  Last name
                </label>
                <div className="mt-1">
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Taylor"
                    className="block w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-3xs font-bold uppercase tracking-wider text-slate-300">
                Username <span className="text-rose-400">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="alextaylor"
                  className={`block w-full px-3.5 py-2.5 bg-slate-800 border rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs transition-all ${
                    fieldErrors.username ? 'border-rose-400' : 'border-slate-700'
                  }`}
                />
                {fieldErrors.username && (
                  <p className="mt-1 text-2xs text-rose-400">{fieldErrors.username}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-3xs font-bold uppercase tracking-wider text-slate-300">
                Email address <span className="text-rose-400">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="alex@company.com"
                  className={`block w-full px-3.5 py-2.5 bg-slate-800 border rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs transition-all ${
                    fieldErrors.email ? 'border-rose-400' : 'border-slate-700'
                  }`}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-2xs text-rose-400">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-3xs font-bold uppercase tracking-wider text-slate-300">
                Password <span className="text-rose-400">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  className={`block w-full px-3.5 py-2.5 pr-10 bg-slate-800 border rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs transition-all ${
                    fieldErrors.password ? 'border-rose-400' : 'border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-2xs text-rose-400">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="password_confirm" className="block text-3xs font-bold uppercase tracking-wider text-slate-300">
                Confirm Password <span className="text-rose-400">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="password_confirm"
                  name="password_confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password_confirm}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  className={`block w-full px-3.5 py-2.5 bg-slate-800 border rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-xs transition-all ${
                    fieldErrors.password_confirm ? 'border-rose-400' : 'border-slate-700'
                  }`}
                />
                {fieldErrors.password_confirm && (
                  <p className="mt-1 text-2xs text-rose-400">{fieldErrors.password_confirm}</p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 focus:outline-hidden transition-all duration-150 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  'Create Free Account'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
