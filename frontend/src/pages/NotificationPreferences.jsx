import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/api';

export default function NotificationPreferences() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState({
    email_enabled: true,
    in_app_enabled: true,
    task_assignment: true,
    comment_notifications: true,
    mention_notifications: true,
    due_date_reminders: true,
    project_sprint_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const data = await notificationService.getPreferences();
        setPrefs(data);
      } catch (err) {
        setError('Failed to load notification preferences.');
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const handleToggle = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setToast('');
    setError('');
    try {
      const updated = await notificationService.updatePreferences(prefs);
      setPrefs(updated);
      setToast('Preferences updated successfully.');
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setError('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="animate-spin inline-block w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mb-4 shadow-lg shadow-indigo-500/20"></div>
        <p className="text-sm font-medium">Loading notification preferences...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold mb-2 inline-block cursor-pointer"
            >
              &larr; Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Notification Preferences</h1>
            <p className="text-sm text-slate-400 mt-1">
              Choose what alerts you receive and how they are delivered to you.
            </p>
          </div>
        </div>

        {toast && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span>{toast}</span>
            <button onClick={() => setToast('')} className="font-bold text-slate-400 hover:text-white cursor-pointer">&times;</button>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Delivery Channels */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-md p-6 sm:p-8 space-y-4">
            <h3 className="text-base font-bold text-white mb-2">Delivery Channels</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm font-bold text-slate-200">In-App Notifications</p>
                  <p className="text-xs text-slate-400 mt-0.5">Receive alerts in the navbar notification bell while active in SprintSync.</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.in_app_enabled}
                  onChange={() => handleToggle('in_app_enabled')}
                  className="w-5 h-5 rounded-md border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-slate-200">Email Notifications</p>
                  <p className="text-xs text-slate-400 mt-0.5">Receive notification digests and alerts sent directly to your registered email.</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.email_enabled}
                  onChange={() => handleToggle('email_enabled')}
                  className="w-5 h-5 rounded-md border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-md p-6 sm:p-8 space-y-4">
            <h3 className="text-base font-bold text-white mb-2">Notification Categories</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm font-bold text-slate-200">Task Assignments</p>
                  <p className="text-xs text-slate-400 mt-0.5">When tasks are assigned or reassigned to you.</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.task_assignment}
                  onChange={() => handleToggle('task_assignment')}
                  className="w-5 h-5 rounded-md border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm font-bold text-slate-200">Comments & Discussions</p>
                  <p className="text-xs text-slate-400 mt-0.5">When comments or status updates occur on tasks you are assigned to or reported.</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.comment_notifications}
                  onChange={() => handleToggle('comment_notifications')}
                  className="w-5 h-5 rounded-md border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm font-bold text-slate-200">Direct Mentions (@username)</p>
                  <p className="text-xs text-slate-400 mt-0.5">When another team member explicitly tags you in task discussions.</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.mention_notifications}
                  onChange={() => handleToggle('mention_notifications')}
                  className="w-5 h-5 rounded-md border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-sm font-bold text-slate-200">Due Date & Overdue Reminders</p>
                  <p className="text-xs text-slate-400 mt-0.5">Periodic reminders for tasks approaching target dates or overdue.</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.due_date_reminders}
                  onChange={() => handleToggle('due_date_reminders')}
                  className="w-5 h-5 rounded-md border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-slate-200">Projects & Sprints</p>
                  <p className="text-xs text-slate-400 mt-0.5">When new projects are created or agile sprints are started/completed.</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.project_sprint_notifications}
                  onChange={() => handleToggle('project_sprint_notifications')}
                  className="w-5 h-5 rounded-md border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
