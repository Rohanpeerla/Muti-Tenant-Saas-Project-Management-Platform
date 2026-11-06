import React, { useState, useRef } from 'react';
import { attachmentService } from '../services/api';

const ALLOWED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.csv', '.txt'];
const MAX_SIZE_MB = 10;

const AttachmentUploader = ({ issueId, onUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setError(`Unsupported file type. Allowed: ${ALLOWED_EXTS.join(', ')}`);
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setProgress(0);

    try {
      const uploaded = await attachmentService.uploadAttachment(
        issueId,
        formData,
        (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(pct);
          }
        }
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploaded(uploaded);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        className="p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-cyan-400/50 bg-slate-800/40 hover:bg-slate-800/70 text-center cursor-pointer transition-all"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
        />
        <svg
          className="w-7 h-7 mx-auto mb-2 text-cyan-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-xs font-bold text-white">
          {uploading ? 'Uploading...' : 'Click to upload task attachment'}
        </p>
        <p className="text-3xs text-slate-400 mt-1">
          PDF, PNG, JPG, DOCX, XLSX, CSV, TXT (Max 10 MB)
        </p>
      </div>

      {uploading && (
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-1.5 rounded-full transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && <p className="text-3xs text-rose-400 font-semibold">{error}</p>}
    </div>
  );
};

export default AttachmentUploader;
