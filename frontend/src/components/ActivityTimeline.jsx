import React, { useState, useEffect } from 'react';
import { activityService } from '../services/api';

const ActivityTimeline = ({ issueId }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (issueId) {
      loadActivities();
    }
  }, [issueId]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await activityService.getActivities(issueId);
      setActivities(data.results || data);
    } catch (err) {
      // Non-fatal timeline load error
    } finally {
      setLoading(false);
    }
  };

  const getActivityBadge = (type) => {
    switch (type) {
      case 'CREATED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'STATUS_CHANGED':
      case 'MOVED':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'PRIORITY_CHANGED':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'ASSIGNEE_CHANGED':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'COMMENT_ADDED':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'ATTACHMENT_UPLOADED':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-white/10';
    }
  };

  if (loading) {
    return <div className="py-4 text-center text-xs text-slate-400">Loading timeline...</div>;
  }

  if (activities.length === 0) {
    return (
      <div className="p-5 rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-500">
        No recorded activities on this task yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative pl-6 border-l-2 border-white/10 space-y-6">
        {activities.map((act) => (
          <div key={act.id} className="relative group">
            {/* Timeline bullet icon */}
            <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-cyan-400 shadow-md shadow-cyan-400/50" />

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white">
                  {act.actor?.first_name || act.actor?.username || 'System'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-3xs font-bold border ${getActivityBadge(act.activity_type)}`}>
                  {act.activity_type.replace('_', ' ')}
                </span>
                <span className="text-3xs text-slate-400">
                  {new Date(act.created_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {act.description}
              </p>

              {act.previous_value && act.new_value && (
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800 text-3xs text-slate-300 font-mono border border-white/5">
                  <span className="line-through text-slate-500">{act.previous_value}</span>
                  <span className="text-cyan-400">&rarr;</span>
                  <span className="font-bold text-white">{act.new_value}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityTimeline;
