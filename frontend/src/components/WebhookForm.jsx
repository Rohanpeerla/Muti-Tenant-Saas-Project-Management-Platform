import React, { useState } from 'react';

const AVAILABLE_EVENTS = [
  { id: 'task.created', label: 'Task Created', desc: 'Triggered when a new task is created.' },
  { id: 'task.updated', label: 'Task Updated', desc: 'Triggered when task fields are modified.' },
  { id: 'task.assigned', label: 'Task Assigned', desc: 'Triggered when assignee is changed.' },
  { id: 'task.status_changed', label: 'Task Status Changed', desc: 'Triggered when task moves columns.' },
  { id: 'task.completed', label: 'Task Completed', desc: 'Triggered when task reaches Done.' },
  { id: 'comment.created', label: 'Comment Added', desc: 'Triggered when a comment is posted.' },
  { id: 'project.created', label: 'Project Created', desc: 'Triggered when a project is added.' },
  { id: 'sprint.started', label: 'Sprint Started', desc: 'Triggered when a sprint activates.' },
  { id: 'sprint.completed', label: 'Sprint Completed', desc: 'Triggered when a sprint finishes.' },
  { id: 'member.invited', label: 'Member Invited', desc: 'Triggered when a user is invited.' },
];

export default function WebhookForm({ webhook, onSubmit, onClose }) {
  const [name, setName] = useState(webhook ? webhook.name : '');
  const [targetUrl, setTargetUrl] = useState(webhook ? webhook.target_url : '');
  const [subscribedEvents, setSubscribedEvents] = useState(
    webhook ? webhook.subscribed_events : ['task.created', 'task.status_changed']
  );
  const [isActive, setIsActive] = useState(webhook ? webhook.is_active : true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleEvent = (eventId) => {
    if (subscribedEvents.includes(eventId)) {
      setSubscribedEvents(subscribedEvents.filter((e) => e !== eventId));
    } else {
      setSubscribedEvents([...subscribedEvents, eventId]);
    }
  };

  const selectAll = () => {
    setSubscribedEvents(AVAILABLE_EVENTS.map((e) => e.id));
  };

  const deselectAll = () => {
    setSubscribedEvents([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a webhook name.');
      return;
    }
    if (!targetUrl.trim()) {
      setError('Target destination URL is required.');
      return;
    }
    if (subscribedEvents.length === 0) {
      setError('Select at least one subscribed event.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        target_url: targetUrl.trim(),
        subscribed_events: subscribedEvents,
        is_active: isActive,
      });
      onClose();
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.target_url) {
        setError(Array.isArray(resp.target_url) ? resp.target_url[0] : resp.target_url);
      } else if (resp?.error) {
        setError(resp.error);
      } else {
        setError('Failed to save webhook.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl border border-white/10 shadow-2xl max-w-lg w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">
            {webhook ? 'Edit Webhook' : 'Configure New Webhook'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-xl p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer">
            &times;
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Webhook Name <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Slack Integration, CI/CD Trigger"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Payload Target URL <span className="text-cyan-400">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://api.yourdomain.com/webhooks"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-2xs text-slate-400 mt-1">
              Must be HTTPS in production. Loopback, private networks, and internal cloud metadata IPs are strictly blocked.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Subscribed Events</label>
              <div className="space-x-2 text-2xs">
                <button type="button" onClick={selectAll} className="text-cyan-400 hover:underline font-semibold cursor-pointer">
                  Select All
                </button>
                <span className="text-slate-600">·</span>
                <button type="button" onClick={deselectAll} className="text-slate-400 hover:underline font-semibold cursor-pointer">
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-800/60 rounded-2xl border border-white/5 max-h-48 overflow-y-auto">
              {AVAILABLE_EVENTS.map((ev) => (
                <label
                  key={ev.id}
                  className="flex items-start space-x-2 text-xs text-slate-300 cursor-pointer p-2 rounded-xl hover:bg-slate-800 transition"
                >
                  <input
                    type="checkbox"
                    checked={subscribedEvents.includes(ev.id)}
                    onChange={() => toggleEvent(ev.id)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-semibold text-white block">{ev.label}</span>
                    <span className="text-3xs text-cyan-400 font-mono">{ev.id}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="webhook-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
            />
            <label htmlFor="webhook-active" className="text-xs font-semibold text-slate-300 cursor-pointer">
              Webhook Active (deliveries enabled)
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-white/10 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : webhook ? 'Update Webhook' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
