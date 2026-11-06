import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TaskCard = ({ task, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'LOW':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'BUG':
        return 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
      case 'STORY':
        return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
      case 'EPIC':
        return 'text-purple-400 bg-purple-500/10 border border-purple-500/20';
      default:
        return 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className="bg-slate-800/90 hover:bg-slate-800 text-slate-100 rounded-xl border border-white/10 p-3.5 shadow-md hover:border-indigo-400/50 hover:shadow-indigo-500/10 transition-all cursor-grab active:cursor-grabbing group select-none space-y-2.5"
    >
      {/* Top Header: Key, Type, Priority */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-3xs font-bold text-slate-400">
            {task.key || `#${task.id.slice(0, 4)}`}
          </span>
          <span className={`text-3xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${getTypeBadge(task.issue_type)}`}>
            {task.issue_type || 'TASK'}
          </span>
        </div>

        <span
          className={`text-3xs px-1.5 py-0.5 rounded-full font-semibold border ${getPriorityBadge(
            task.priority
          )}`}
        >
          {task.priority || 'MEDIUM'}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-xs font-bold text-white leading-snug line-clamp-2 group-hover:text-indigo-300 transition-colors">
        {task.title}
      </h4>

      {/* Task Description Preview */}
      {task.description && (
        <p className="text-3xs text-slate-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Bottom Footer: Sprint, Attachments, Comments & Assignee */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 text-3xs text-slate-400">
        <div className="flex items-center gap-2">
          {task.sprint_name && (
            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/30 truncate max-w-[90px]">
              {task.sprint_name}
            </span>
          )}

          {task.attachment_count > 0 && (
            <span className="flex items-center gap-1" title={`${task.attachment_count} attachments`}>
              📎 {task.attachment_count}
            </span>
          )}

          {task.comment_count > 0 && (
            <span className="flex items-center gap-1" title={`${task.comment_count} comments`}>
              💬 {task.comment_count}
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        {task.assignee ? (
          <div
            className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 text-white flex items-center justify-center font-bold text-3xs shrink-0 shadow-xs"
            title={`Assigned to ${task.assignee.first_name || task.assignee.username || task.assignee.email}`}
          >
            {(task.assignee.first_name || task.assignee.username || 'U')[0].toUpperCase()}
          </div>
        ) : (
          <span className="text-slate-500 text-3xs">Unassigned</span>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
