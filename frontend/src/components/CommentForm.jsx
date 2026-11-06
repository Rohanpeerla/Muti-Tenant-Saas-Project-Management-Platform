import React, { useState } from 'react';

const CommentForm = ({ onSubmit, loading }) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please enter a comment.');
      return;
    }
    setError('');
    try {
      await onSubmit(content.trim());
      setContent('');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.content?.[0] || 'Failed to post comment.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          rows={3}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError('');
          }}
          placeholder="Write a comment or update on this task..."
          className="w-full px-4 py-3 rounded-2xl border border-slate-700 bg-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {error && <p className="text-3xs text-rose-400 font-semibold">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-3xs text-slate-500">
          Markdown supported. Comments are audit-logged.
        </span>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="px-5 py-2 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 disabled:opacity-40 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
        >
          {loading ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </form>
  );
};

export default CommentForm;
