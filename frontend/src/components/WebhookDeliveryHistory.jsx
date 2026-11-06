import React, { useState, useEffect } from 'react';
import { webhookService } from '../services/api';

const getStatusBadge = (status) => {
  switch (status) {
    case 'SUCCESS':
      return <span className="px-2 py-0.5 text-3xs font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">SUCCESS</span>;
    case 'FAILED':
      return <span className="px-2 py-0.5 text-3xs font-extrabold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">FAILED</span>;
    case 'RETRYING':
      return <span className="px-2 py-0.5 text-3xs font-extrabold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">RETRYING</span>;
    default:
      return <span className="px-2 py-0.5 text-3xs font-extrabold rounded-full bg-slate-800 text-slate-300 border border-white/10">PENDING</span>;
  }
};

export default function WebhookDeliveryHistory({ webhook, onClose }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [message, setMessage] = useState('');

  const fetchDeliveries = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await webhookService.getDeliveries(webhook.id);
      setDeliveries(data.results || data || []);
    } catch (err) {
      setError('Failed to fetch delivery logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [webhook.id]);

  const handleRetry = async (deliveryId) => {
    setRetryingId(deliveryId);
    try {
      await webhookService.retryDelivery(deliveryId);
      setMessage('Delivery re-enqueued for retry.');
      setTimeout(() => setMessage(''), 3000);
      fetchDeliveries();
    } catch (err) {
      setMessage('Failed to retry delivery.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl border border-white/10 shadow-2xl max-w-4xl w-full p-6 sm:p-7 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">
              Delivery Logs: {webhook.name}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{webhook.target_url}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchDeliveries}
              className="px-3 py-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Refresh logs"
            >
              🔄 Refresh
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-xl p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer">
              &times;
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-xl">
            {message}
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-4 border border-white/10 rounded-2xl bg-slate-900/50">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div>
              <p>Loading deliveries...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-400 text-xs">{error}</div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No delivery attempts recorded yet.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-white/5 text-left text-xs">
              <thead className="bg-slate-800/50 font-bold uppercase tracking-wider text-3xs text-slate-400">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">HTTP Code</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono text-cyan-300 text-3xs font-semibold">{del.event}</td>
                    <td className="px-4 py-3">{getStatusBadge(del.status)}</td>
                    <td className="px-4 py-3 font-mono text-3xs text-slate-300">{del.response_status_code || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-3xs">{del.duration_ms ? `${del.duration_ms} ms` : '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-3xs">{new Date(del.delivered_at || del.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {del.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(del.id)}
                          disabled={retryingId === del.id}
                          className="px-2.5 py-1 text-3xs font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-lg transition disabled:opacity-50 cursor-pointer"
                        >
                          {retryingId === del.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
