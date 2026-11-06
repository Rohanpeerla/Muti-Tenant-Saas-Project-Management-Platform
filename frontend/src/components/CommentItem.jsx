import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CommentItem = ({ comment, onUpdate, onDelete }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAuthor = user?.id === comment.author?.id;

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Comment cannot be empty.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onUpdate(comment.id, content.trim());
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.content?.[0] || 'Failed to update comment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3 text-xs group">
      {/* Author Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-600 text-slate-950 font-extrabold flex items-center justify-center shrink-0 shadow-md text-xs">
        {comment.author?.first_name?.[0]?.toUpperCase() || comment.author?.username?.[0]?.toUpperCase() || '?'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">
              {comment.author?.first_name || comment.author?.username}
            </span>
            <span className="text-3xs text-slate-400">
              {new Date(comment.created_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {comment.is_edited && (
              <span className="text-3xs text-slate-500 italic">(edited)</span>
            )}
          </div>

          {isAuthor && !isEditing && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2 mt-1">
            <textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
            {error && <p className="text-3xs text-rose-400">{error}</p>}
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setContent(comment.content);
                  setIsEditing(false);
                }}
                className="px-3 py-1 text-3xs font-semibold text-slate-400 hover:text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSave}
                className="px-3.5 py-1 text-3xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-white/5 text-slate-200 leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentItem;
