import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { webhookService } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import WebhookForm from '../components/WebhookForm';
import WebhookDeliveryHistory from '../components/WebhookDeliveryHistory';

export default function WebhookManagement() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { currentWorkspace, userRole } = useWorkspace();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [historyWebhook, setHistoryWebhook] = useState(null);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

  const fetchWebhooks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await webhookService.getWorkspaceWebhooks(workspaceId);
      setWebhooks(data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Only workspace owners and administrators can manage webhooks.');
      } else {
        setError('Failed to load workspace webhooks.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchWebhooks();
    }
  }, [workspaceId]);

  const showToast = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleCreateOrUpdate = async (formData) => {
    if (editingWebhook) {
      const updated = await webhookService.updateWebhook(editingWebhook.id, formData);
      setWebhooks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      showToast('Webhook updated successfully.');
    } else {
      const created = await webhookService.createWebhook(workspaceId, formData);
      setWebhooks((prev) => [created, ...prev]);
      if (created.secret) {
        setNewlyCreatedSecret({ name: created.name, secret: created.secret });
      }
      showToast('Webhook created successfully.');
    }
  };

  const handleDelete = async (webhook) => {
    if (!window.confirm(`Are you sure you want to delete webhook "${webhook.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await webhookService.deleteWebhook(webhook.id);
      setWebhooks((prev) => prev.filter((w) => w.id !== webhook.id));
      showToast(`Webhook "${webhook.name}" deleted.`);
    } catch (err) {
      showToast('Failed to delete webhook.');
    }
  };

  const handleTestEvent = async (webhook) => {
    setTestingId(webhook.id);
    try {
      const res = await webhookService.testWebhook(webhook.id);
      showToast(res.message || 'Test event dispatched.');
    } catch (err) {
      showToast('Failed to dispatch test event.');
    } finally {
      setTestingId(null);
    }
  };

  const handleRotateSecret = async (webhook) => {
    if (!window.confirm(`Rotate signing secret for "${webhook.name}"? External consumers will need to update their verification signature.`)) {
      return;
    }
    try {
      const res = await webhookService.rotateSecret(webhook.id);
      setNewlyCreatedSecret({ name: webhook.name, secret: res.new_secret });
      showToast('Secret rotated. Please copy the new signing secret now.');
      fetchWebhooks();
    } catch (err) {
      showToast('Failed to rotate secret.');
    }
  };

  const handleToggleActive = async (webhook) => {
    try {
      const updated = await webhookService.updateWebhook(webhook.id, {
        is_active: !webhook.is_active,
      });
      setWebhooks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      showToast(`Webhook is now ${updated.is_active ? 'active' : 'inactive'}.`);
    } catch (err) {
      showToast('Failed to toggle webhook state.');
    }
  };

  if (!isOwnerOrAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-slate-100">
        <span className="text-4xl block mb-2">🔒</span>
        <h2 className="text-xl font-bold text-white">Access Restricted</h2>
        <p className="text-sm text-slate-400 mt-1 max-w-md">
          Only workspace owners and administrators have permissions to configure external webhooks.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 text-slate-950 rounded-xl text-xs font-bold cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-white/10 gap-4">
          <div>
            <button
              onClick={() => navigate(`/settings/workspace`)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold mb-2 inline-block cursor-pointer"
            >
              &larr; Workspace Settings
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Workspace Webhooks</h1>
            <p className="text-sm text-slate-400 mt-1">
              Publish real-time events to external endpoints with HMAC-SHA256 signatures.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingWebhook(null);
              setFormOpen(true);
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-500/20 transition flex items-center space-x-2 self-start sm:self-auto cursor-pointer"
          >
            <span className="text-sm font-black">+</span>
            <span>Add Webhook</span>
          </button>
        </div>

        {message && (
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-2xl flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="font-bold text-slate-400 hover:text-white cursor-pointer">&times;</button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Secret Reveal Modal */}
        {newlyCreatedSecret && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
              <h3 className="text-base font-bold text-white">Save Your Webhook Secret</h3>
              <p className="text-xs text-slate-400 mt-1">
                This secret is used to sign requests sent to <strong className="text-cyan-400">{newlyCreatedSecret.name}</strong>. For security reasons, it will never be displayed in full again.
              </p>
              <div className="mt-4 p-3.5 bg-slate-950 border border-white/10 text-cyan-300 rounded-xl font-mono text-xs break-all select-all flex items-center justify-between">
                <span>{newlyCreatedSecret.secret}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newlyCreatedSecret.secret);
                    alert('Secret copied to clipboard!');
                  }}
                  className="ml-3 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-3xs font-extrabold rounded-lg shrink-0 cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <div className="mt-6 text-right">
                <button
                  onClick={() => setNewlyCreatedSecret(null)}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 text-slate-950 rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  I have saved this secret
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Webhooks List */}
        <div className="space-y-4">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-sm">
              <div className="animate-spin inline-block w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
              <p>Loading webhooks...</p>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-12 text-center shadow-xl backdrop-blur-md">
              <span className="text-4xl block mb-2">⚡</span>
              <h3 className="text-base font-bold text-white">No webhooks configured</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Connect external services like CI/CD runners, Slack, or monitoring platforms by adding a webhook.
              </p>
              <button
                onClick={() => {
                  setEditingWebhook(null);
                  setFormOpen(true);
                }}
                className="mt-5 px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 text-slate-950 rounded-xl text-xs font-extrabold cursor-pointer"
              >
                Configure First Webhook
              </button>
            </div>
          ) : (
            webhooks.map((wh) => (
              <div
                key={wh.id}
                className={`rounded-3xl shadow-xl backdrop-blur-md border p-6 transition ${
                  wh.is_active ? 'bg-slate-900/80 border-white/10' : 'bg-slate-900/50 border-white/5 opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${wh.is_active ? 'bg-emerald-400 shadow-md shadow-emerald-400/50 animate-pulse' : 'bg-slate-600'}`} />
                    <div>
                      <h3 className="text-base font-bold text-white">{wh.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{wh.target_url}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(wh)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        wh.is_active
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                      }`}
                    >
                      {wh.is_active ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleTestEvent(wh)}
                      disabled={testingId === wh.id}
                      className="px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      {testingId === wh.id ? 'Sending...' : '⚡ Test Ping'}
                    </button>
                    <button
                      onClick={() => setHistoryWebhook(wh)}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/30 transition cursor-pointer"
                    >
                      📜 Logs
                    </button>
                    <button
                      onClick={() => {
                        setEditingWebhook(wh);
                        setFormOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(wh)}
                      className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition cursor-pointer"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Event Tags & Secret */}
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-400 text-3xs font-bold uppercase tracking-wider">Events:</span>
                    {wh.subscribed_events?.map((ev) => (
                      <span
                        key={ev}
                        className="px-2.5 py-0.5 bg-slate-800 border border-white/10 text-cyan-300 rounded-md text-3xs font-mono font-bold"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center space-x-3 text-slate-400 text-3xs">
                    <span>Secret: <strong className="font-mono text-slate-300">{wh.secret_preview || '••••••••'}</strong></span>
                    <button
                      onClick={() => handleRotateSecret(wh)}
                      className="text-cyan-400 hover:underline font-bold cursor-pointer"
                    >
                      Rotate Secret
                    </button>
                    {wh.last_delivery_at && (
                      <span className="text-slate-500">Last delivery: {new Date(wh.last_delivery_at).toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Form Modal */}
        {formOpen && (
          <WebhookForm
            webhook={editingWebhook}
            onSubmit={handleCreateOrUpdate}
            onClose={() => {
              setFormOpen(false);
              setEditingWebhook(null);
            }}
          />
        )}

        {/* Delivery Logs Modal */}
        {historyWebhook && (
          <WebhookDeliveryHistory
            webhook={historyWebhook}
            onClose={() => setHistoryWebhook(null)}
          />
        )}
      </div>
    </div>
  );
}
