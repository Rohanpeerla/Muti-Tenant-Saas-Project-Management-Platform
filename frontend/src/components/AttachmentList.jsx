import React from 'react';
import { attachmentService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const AttachmentList = ({ attachments = [], onDelete, loading }) => {
  const { user } = useAuth();

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) {
      return (
        <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-3xs uppercase">
          IMG
        </span>
      );
    }
    if (ext === 'pdf') {
      return (
        <span className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-3xs uppercase">
          PDF
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-3xs uppercase">
        DOC
      </span>
    );
  };

  const handleDownload = async (attachment) => {
    try {
      await attachmentService.downloadAttachment(attachment.id, attachment.original_filename);
    } catch (err) {
      alert('Failed to download file.');
    }
  };

  if (loading) {
    return <div className="py-4 text-center text-xs text-slate-400">Loading attachments...</div>;
  }

  if (attachments.length === 0) {
    return (
      <div className="p-5 rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-500">
        No files attached to this task.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attach) => {
        const canDelete = user?.id === attach.uploaded_by?.id;
        return (
          <div
            key={attach.id}
            className="flex items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-slate-800/50 hover:bg-slate-800/80 transition-colors gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {getFileIcon(attach.original_filename)}
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate" title={attach.original_filename}>
                  {attach.original_filename}
                </p>
                <div className="flex items-center gap-2 text-3xs text-slate-400 mt-0.5">
                  <span>{formatFileSize(attach.file_size)}</span>
                  <span>&bull;</span>
                  <span>{attach.uploaded_by?.first_name || attach.uploaded_by?.username}</span>
                  <span>&bull;</span>
                  <span>{new Date(attach.uploaded_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownload(attach)}
                className="px-3 py-1 text-xs font-bold text-cyan-400 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors cursor-pointer"
                title="Download file"
              >
                Download
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(attach.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Delete file"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AttachmentList;
