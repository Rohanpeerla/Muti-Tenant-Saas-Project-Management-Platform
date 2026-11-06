import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService, boardService } from '../services/api';
import WorkflowColumnEditor from '../components/WorkflowColumnEditor';
import WorkflowTransitionEditor from '../components/WorkflowTransitionEditor';

const WorkflowSettings = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWorkflow();
  }, [projectId]);

  const loadWorkflow = async () => {
    setLoading(true);
    setError('');
    try {
      const [projData, boardsData] = await Promise.all([
        projectService.getProjectDetails(projectId),
        boardService.getBoards(projectId),
      ]);

      setProject(projData);

      let targetBoard = boardsData[0];
      if (targetBoard) {
        const boardDetail = await boardService.getBoardDetails(targetBoard.id);
        setBoard(boardDetail);
      }
    } catch (err) {
      setError('Failed to load project workflow settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleColumnsUpdated = (newCols) => {
    setBoard((prev) => ({ ...prev, columns: newCols }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20" />
        <p className="mt-4 text-sm font-medium text-slate-400">Loading workflow configuration...</p>
      </div>
    );
  }

  if (error || !project || !board) {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error || 'Project or board not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-slate-100 pb-20 relative">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Breadcrumb Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
              <Link to="/projects" className="hover:text-cyan-400 transition-colors">Projects</Link>
              <span className="text-slate-600">/</span>
              <Link to={`/projects/${projectId}`} className="hover:text-cyan-400 font-semibold">{project.name}</Link>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400 font-bold">Workflow Settings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Custom Workflow Settings</h1>
            <p className="text-sm text-slate-400 mt-1">
              Customize Kanban columns, default statuses, and transition pathways.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/projects/${projectId}/board`}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:opacity-95 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              Kanban Board &rarr;
            </Link>
          </div>
        </div>

        {/* 1. Workflow Column Editor */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md">
          <WorkflowColumnEditor board={board} onColumnsUpdated={handleColumnsUpdated} />
        </div>

        {/* 2. Workflow Transition Editor */}
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 sm:p-8 shadow-xl backdrop-blur-md">
          <WorkflowTransitionEditor board={board} />
        </div>
      </div>
    </div>
  );
};

export default WorkflowSettings;
