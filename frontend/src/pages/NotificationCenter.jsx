import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'TASK_ASSIGNED':
      return '👤';
    case 'TASK_STATUS_CHANGED':
      return '🔄';
    case 'TASK_COMMENTED':
      return '💬';
    case 'TASK_MENTIONED':
      return '🔔';
    case 'TASK_DUE_SOON':
      return '⏳';
    case 'TASK_OVERDUE':
      return '⚠️';
    case 'PROJECT_CREATED':
      return '📁';
    case 'SPRINT_STARTED':
    case 'SPRINT_COMPLETED':
      return '🚀';
    case 'WORKSPACE_INVITATION':
      return '✉️';
    case 'WEBHOOK_FAILURE':
      return '❌';
    default:
      return '📌';
  }
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [filter, setFilter] = useState('ALL'); // ALL, UNREAD, READ
  const [filterByWorkspace, setFilterByWorkspace] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filter === 'UNREAD') params.is_read = false;
      if (filter === 'READ') params.is_read = true;
      if (filterByWorkspace && currentWorkspace) {
        params.workspace_id = currentWorkspace.id;
      }

      const data = await notificationService.getNotifications(params);
      setNotifications(data.results || data || []);
    } catch (err) {
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter, filterByWorkspace, currentWorkspace]);

  const showToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3000);
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      showToast('Notification marked as read.');
    } catch (err) {
      showToast('Failed to update notification.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const wsId = filterByWorkspace && currentWorkspace ? currentWorkspace.id : null;
      const res = await notificationService.markAllAsRead(wsId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast(res.message || 'All notifications marked as read.');
    } catch (err) {
      showToast('Failed to mark all as read.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      showToast('Notification deleted.');
    } catch (err) {
      showToast('Failed to delete notification.');
    }
  };

  const handleClearRead = async () => {
    if (!window.confirm('Are you sure you want to delete all read notifications?')) return;
    try {
      const wsId = filterByWorkspace && currentWorkspace ? currentWorkspace.id : null;
      const res = await notificationService.clearRead(wsId);
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      showToast(res.message || 'Cleared read notifications.');
    } catch (err) {
      showToast('Failed to clear read notifications.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-white/10 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Notification Center</h1>
            <p className="text-sm text-slate-400 mt-1">
              Stay informed about task assignments, comments, due dates, and workspace events.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate('/settings/notifications')}
              className="px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-white/10 rounded-xl shadow-lg backdrop-blur-md transition-all cursor-pointer"
            >
              ⚙️ Preferences
            </button>
            <button
              onClick={handleMarkAllRead}
              className="px-3.5 py-2 text-xs font-bold text-cyan-300 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Mark all read
            </button>
            <button
              onClick={handleClearRead}
              className="px-3.5 py-2 text-xs font-bold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Clear read
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-2xl flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage('')} className="font-bold text-slate-400 hover:text-white cursor-pointer">&times;</button>
          </div>
        )}

        {/* Filter Tabs & Scope */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex space-x-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            {['ALL', 'UNREAD', 'READ'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                  filter === tab
                    ? 'bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {currentWorkspace && (
            <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filterByWorkspace}
                onChange={(e) => setFilterByWorkspace(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Filter to current workspace (<strong className="text-cyan-400">{currentWorkspace.name}</strong>)</span>
            </label>
          )}
        </div>

        {/* Notifications List */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-md divide-y divide-white/5 overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-sm">
              <div className="animate-spin inline-block w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
              <p>Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-400 text-sm font-semibold">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-2">
              <span className="text-4xl block">📭</span>
              <p className="text-base font-bold text-white">No notifications found</p>
              <p className="text-xs text-slate-500">You are all caught up!</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-5 transition flex items-start space-x-4 ${
                  notif.is_read ? 'bg-transparent hover:bg-slate-800/40' : 'bg-indigo-500/10 hover:bg-indigo-500/15'
                }`}
              >
                <div className="text-2xl mt-0.5 select-none">{getNotificationIcon(notif.notification_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-white truncate">{notif.title}</h4>
                    {!notif.is_read && (
                      <span className="px-2 py-0.5 text-3xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-extrabold rounded-full">
                        New
                      </span>
                    )}
                    {notif.workspace_name && (
                      <span className="px-2 py-0.5 text-3xs bg-slate-800 text-slate-400 border border-white/10 rounded-md">
                        {notif.workspace_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                  <span className="text-2xs text-slate-500 mt-2 block font-medium">
                    {new Date(notif.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      title="Mark as read"
                      className="px-2.5 py-1 text-xs font-semibold text-cyan-400 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors cursor-pointer"
                    >
                      ✓ Mark Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    title="Delete"
                    className="p-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
