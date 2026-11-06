import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';

const KanbanColumn = ({
  column,
  tasks,
  onTaskClick,
  onAddTaskClick,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.key,
    data: { column },
  });

  const taskIds = tasks.map((t) => t.id);

  const getHeaderAccent = (key) => {
    switch (key) {
      case 'TODO':
        return 'border-t-slate-400 text-slate-300';
      case 'IN_PROGRESS':
        return 'border-t-indigo-500 text-indigo-400';
      case 'IN_REVIEW':
        return 'border-t-purple-500 text-purple-400';
      case 'DONE':
        return 'border-t-emerald-500 text-emerald-400';
      default:
        return 'border-t-cyan-500 text-cyan-400';
    }
  };

  return (
    <div
      className={`w-80 shrink-0 flex flex-col bg-slate-900/85 backdrop-blur-md rounded-2xl border border-white/10 max-h-[calc(100vh-14rem)] border-t-4 ${getHeaderAccent(
        column.key
      )} transition-all shadow-xl ${isOver ? 'ring-2 ring-indigo-500/50 bg-indigo-950/40' : ''}`}
    >
      {/* Column Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            {column.name}
          </h3>
          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-3xs font-bold flex items-center justify-center border border-white/5">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAddTaskClick(column.key)}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={`Add task to ${column.name}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Droppable Task Area */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[120px]"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="h-24 border border-dashed border-slate-700/60 rounded-xl flex items-center justify-center text-3xs text-slate-500">
            Drop tasks here
          </div>
        )}
      </div>

      {/* Add Task Quick Action Footer */}
      <div className="p-2 border-t border-white/5">
        <button
          type="button"
          onClick={() => onAddTaskClick(column.key)}
          className="w-full py-1.5 px-3 rounded-xl text-3xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>+ Add Task</span>
        </button>
      </div>
    </div>
  );
};

export default KanbanColumn;
