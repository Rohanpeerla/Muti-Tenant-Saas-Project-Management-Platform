import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  issueService,
  projectService,
  sprintService,
  boardService,
  attachmentService,
} from '../services/api';
import CommentSection from '../components/CommentSection';
import AttachmentList from '../components/AttachmentList';
import AttachmentUploader from '../components/AttachmentUploader';
import ActivityTimeline from '../components/ActivityTimeline';

const TaskDetails = () => {
  const { projectId, issueId } = useParams();
  const navigate = useNavigate();

  const [issue, setIssue] = useState(null);
  const [project, setProject] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [members, setMembers] = useState([]);
  const [columns, setColumns] = useState([]);

  const [activeTab, setActiveTab] = useState('comments'); // 'comments' | 'attachments' | 'activity'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllTaskData();
  }, [projectId, issueId]);

  const loadAllTaskData = async () => {
    setLoading(true);
    setError('');
    try {
      const [issueData, projData, membersData, boardsData] = await Promise.all([
        issueService.getIssueDetails(issueId),
        projectService.getProjectDetails(projectId),
        projectService.getProjectMembers(projectId),
        boardService.getBoards(projectId),
      ]);

      setIssue(issueData);
      setProject(projData);
      setMembers(membersData);

      setFormData({
        title: issueData.title,
        description: issueData.description || '',
        status: issueData.status,
        priority: issueData.priority,
        issue_type: issueData.issue_type,
        assignee_id: issueData.assignee?.id || '',
        due_date: issueData.due_date ? issueData.due_date.substring(0, 10) : '',
      });

      // Load board columns if board exists
      if (issueData.board || boardsData.length > 0) {
        const boardId = issueData.board || boardsData[0]?.id;
        if (boardId) {
          const boardDetail = await boardService.getBoardDetails(boardId);
          setColumns(boardDetail.columns || []);
        }
      }

      // Load attachments
      const attachData = await fetchAttachments();
      setAttachments(attachData);
    } catch (err) {
      setError('Failed to load task details. Please verify your permissions.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async () => {
    try {
      const data = await attachmentService.getAttachments(issueId);
      return data.results || data;
    } catch (err) {
      return [];
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await issueService.moveIssue(issue.id, {
        status: newStatus,
        position: issue.position || 0,
        board_id: issue.board || undefined,
      });
      setIssue(updated);
      setFormData((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update task status.');
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        issue_type: formData.issue_type,
        assignee_id: formData.assignee_id || null,
        due_date: formData.due_date || null,
      };
      const updated = await issueService.updateIssue(issue.id, payload);
      setIssue(updated);
      setIsEditing(false);
    } catch (err) {
      alert('Failed to update task details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Delete this task permanently?')) return;
    try {
      await issueService.deleteIssue(issue.id);
      navigate(`/projects/${projectId}/board`);
    } catch (err) {
      alert('Failed to delete task.');
    }
  };

  const handleAttachmentUploaded = (newAttach) => {
    setAttachments((prev) => [newAttach, ...prev]);
  };

  const handleAttachmentDeleted = async (attachId) => {
    if (!window.confirm('Delete this attachment?')) return;
    try {
      await attachmentService.deleteAttachment(attachId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachId));
    } catch (err) {
      alert('Failed to delete attachment.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20" />
        <p className="mt-4 text-sm font-medium text-slate-400">Loading task details...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error || 'Task not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
              <Link to="/projects" className="hover:text-cyan-400 transition-colors">Projects</Link>
              <span className="text-slate-600">/</span>
              <Link to={`/projects/${projectId}`} className="hover:text-cyan-400 font-semibold">{project?.name}</Link>
              <span className="text-slate-600">/</span>
              <Link to={`/projects/${projectId}/board`} className="hover:text-cyan-400">Board</Link>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400 font-mono font-bold">{issue.issue_key}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {issue.issue_key}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{issue.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/projects/${projectId}/board`}
              className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-white/10 rounded-xl shadow-lg backdrop-blur-md transition-all hover:border-white/20"
            >
              &larr; Back to Kanban Board
            </Link>
            <button
              type="button"
              onClick={handleDeleteTask}
              className="px-4 py-2 text-xs font-bold text-rose-400 hover:text-white hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
            >
              Delete Task
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Task Info, Description, and Tabbed Collaboration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Info Card */}
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  <select
                    value={issue.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold bg-slate-800 text-slate-200 cursor-pointer focus:outline-none focus:border-indigo-500"
                  >
                    {columns.length > 0 ? (
                      columns.map((col) => (
                        <option key={col.key} value={col.key}>
                          {col.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="DONE">Done</option>
                      </>
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-3.5 py-1.5 text-xs font-bold text-cyan-400 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl cursor-pointer transition-colors"
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Details'}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveDetails} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Description</label>
                    <textarea
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Description
                  </h4>
                  <div className="p-5 rounded-2xl bg-slate-800/60 border border-white/5 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed min-h-24">
                    {issue.description || <span className="italic text-slate-500">No description provided.</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Collaboration Tabs (Comments, Attachments, Activity) */}
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl backdrop-blur-md overflow-hidden">
              <div className="flex items-center border-b border-white/10 bg-slate-800/40 px-6 pt-3 gap-8 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`pb-3.5 border-b-2 transition-colors cursor-pointer ${activeTab === 'comments' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  Comments
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('attachments')}
                  className={`pb-3.5 border-b-2 transition-colors cursor-pointer ${activeTab === 'attachments' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  Attachments ({attachments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`pb-3.5 border-b-2 transition-colors cursor-pointer ${activeTab === 'activity' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  Activity Timeline
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'comments' && <CommentSection issueId={issue.id} />}
                {activeTab === 'attachments' && (
                  <div className="space-y-6">
                    <AttachmentUploader issueId={issue.id} onUploaded={handleAttachmentUploaded} />
                    <AttachmentList
                      attachments={attachments}
                      onDelete={handleAttachmentDeleted}
                    />
                  </div>
                )}
                {activeTab === 'activity' && <ActivityTimeline issueId={issue.id} />}
              </div>
            </div>
          </div>

          {/* Right Column: Metadata Sidebar */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-7 shadow-xl backdrop-blur-md space-y-4 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-3">
                Task Details
              </h3>

              <div>
                <span className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border border-indigo-500/30 bg-indigo-500/20 text-indigo-300">
                  {issue.priority}
                </span>
              </div>

              <div>
                <span className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">Issue Type</span>
                <span className="font-semibold text-slate-200">{issue.issue_type}</span>
              </div>

              <div>
                <span className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">Assignee</span>
                {issue.assignee ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-400 to-indigo-600 text-slate-950 font-bold flex items-center justify-center text-3xs shadow-sm">
                      {issue.assignee.first_name?.[0]?.toUpperCase() || issue.assignee.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-200">
                      {issue.assignee.first_name || issue.assignee.username}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">Unassigned</span>
                )}
              </div>

              <div>
                <span className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">Reporter</span>
                <span className="font-semibold text-slate-200">
                  {issue.reporter?.first_name || issue.reporter?.username}
                </span>
              </div>

              <div>
                <span className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sprint</span>
                <span className="font-semibold text-cyan-400">
                  {issue.sprint_name || 'Backlog (No active sprint)'}
                </span>
              </div>

              <div>
                <span className="block text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</span>
                <span className="font-semibold text-slate-200">
                  {issue.due_date ? new Date(issue.due_date).toLocaleDateString() : 'None specified'}
                </span>
              </div>

              <div className="pt-3 border-t border-white/10 text-3xs text-slate-400 space-y-1">
                <p>Created: {new Date(issue.created_at).toLocaleString()}</p>
                <p>Updated: {new Date(issue.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetails;
