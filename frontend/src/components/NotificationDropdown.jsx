import React from 'react';
import { useNavigate } from 'react-router-dom';

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

const formatTimeAgo = (isoString) => {
  if (!isoString) return '';
  const now = new Date();
  const past = new Date(isoString);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

export default function NotificationDropdown({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClose,
}) {
  const navigate = useNavigate();

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      await onMarkRead(notif.id);
    }
    onClose();

    if (notif.related_entity_type === 'issue' && notif.related_entity_id) {
      navigate('/projects');
    } else if (notif.related_entity_type === 'workspace') {
      navigate('/workspaces');
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 text-slate-100">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-white text-xs uppercase tracking-wider">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-3xs px-2 py-0.5 rounded-full font-extrabold">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition cursor-pointer"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              navigate('/settings/notifications');
            }}
            title="Notification Preferences"
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <p className="text-2xl mb-1">📭</p>
            No notifications yet
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleItemClick(notif)}
              className={`px-4 py-3 cursor-pointer transition flex items-start space-x-3 ${
                notif.is_read ? 'hover:bg-slate-800/40' : 'bg-indigo-500/10 hover:bg-indigo-500/20'
              }`}
            >
              <span className="text-xl mt-0.5 select-none">{getNotificationIcon(notif.notification_type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white truncate">{notif.title}</p>
                  <span className="text-3xs text-slate-400 whitespace-nowrap ml-2">
                    {formatTimeAgo(notif.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">{notif.message}</p>
              </div>
              {!notif.is_read && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 mt-2 shrink-0 animate-pulse" />
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2.5 bg-slate-800/40 border-t border-white/10 text-center">
        <button
          onClick={() => {
            onClose();
            navigate('/notifications');
          }}
          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
        >
          View All Notifications &rarr;
        </button>
      </div>
    </div>
  );
}
