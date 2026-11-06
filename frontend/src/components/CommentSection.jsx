import React, { useState, useEffect } from 'react';
import { commentService } from '../services/api';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';

const CommentSection = ({ issueId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (issueId) {
      loadComments();
    }
  }, [issueId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await commentService.getComments(issueId);
      setComments(data.results || data);
    } catch (err) {
      setError('Failed to load discussion comments.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (content) => {
    setSubmitting(true);
    try {
      const created = await commentService.createComment(issueId, { content });
      setComments((prev) => [...prev, created]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (commentId, content) => {
    const updated = await commentService.updateComment(commentId, { content });
    setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await commentService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      alert('Failed to delete comment.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Activity Discussion ({comments.length})
        </h4>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-2xs">
          {error}
        </div>
      )}

      {/* Comment Form */}
      <CommentForm onSubmit={handleCreate} loading={submitting} />

      {/* Comments List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
          No comments yet. Start the conversation!
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentSection;

