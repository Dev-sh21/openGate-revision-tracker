'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function AutoPlanner() {
  const [loading, setLoading] = useState(true);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<any[]>([]);
  const [thisWeekTasks, setThisWeekTasks] = useState<any[]>([]);

  useEffect(() => {
    fetchPlannerData();
  }, []);

  const fetchPlannerData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        categorizeTasks(data);
      } else {
        toast.error('Failed to load planner data');
      }
    } catch (err) {
      console.error('Error fetching planner data:', err);
      toast.error('Network error. Failed to load planner data.');
    } finally {
      setLoading(false);
    }
  };

  const categorizeTasks = (topics: any[]) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const todayList: any[] = [];
    const tomorrowList: any[] = [];
    const thisWeekList: any[] = [];

    topics.forEach((topic) => {
      topic.revisions.forEach((rev: any) => {
        if (rev.status === 'PENDING') {
          const revDate = new Date(rev.scheduledDate);
          const revDateStr = revDate.toISOString().split('T')[0];

          if (revDateStr === todayStr || revDate < new Date()) {
            // Revisions due today or overdue go to Today
            todayList.push({ ...rev, topic });
          } else if (revDateStr === tomorrowStr) {
            tomorrowList.push({ ...rev, topic });
          } else if (revDate > tomorrow && revDate <= endOfWeek) {
            thisWeekList.push({ ...rev, topic });
          }
        }
      });
    });

    setTodayTasks(todayList);
    setTomorrowTasks(tomorrowList);
    setThisWeekTasks(
      thisWeekList.sort(
        (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      )
    );
  };

  const handleRevisionAction = async (
    revisionId: string,
    action: 'complete' | 'skip',
    revisionNumber: number,
    topicName: string
  ) => {
    const loadingToast = toast.loading(`Marking revision as ${action}...`);
    try {
      const res = await fetch(`/api/revisions/${revisionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Marked as ${action}d!`, { id: loadingToast });

        if (action === 'complete' && revisionNumber === 4) {
          toast(`Mastered! You completed all revisions for "${topicName}"!`, {
            icon: '🏆',
            duration: 5000,
          });
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
          });
        }

        // Refresh planner data
        fetchPlannerData();
      } else {
        toast.error(data.error || 'Failed to update revision', { id: loadingToast });
      }
    } catch (err) {
      toast.error('Network error', { id: loadingToast });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const renderColumn = (title: string, count: number, tasks: any[], showActions: boolean = false) => {
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)] min-w-[280px] bg-zinc-900/10 border border-zinc-850 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
          <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-wider">{title}</h3>
          <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-zinc-850 text-zinc-400">
            {count}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {tasks.map((task) => {
            const isOverdue = new Date(task.scheduledDate) < new Date() && task.status === 'PENDING' && title === 'Today';
            return (
              <div
                key={task.id}
                className={`p-4 rounded-lg border transition-all ${
                  isOverdue
                    ? 'border-red-500/20 bg-red-950/5 hover:bg-red-950/10 hover:border-red-500/30'
                    : 'border-zinc-850 bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-zinc-800'
                } group`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-zinc-800 text-zinc-300 uppercase">
                    {task.topic.subject.name}
                  </span>
                  <span className="text-4xs font-semibold text-zinc-500">
                    Stage {task.revisionNumber}
                  </span>
                </div>

                <h4 className="font-semibold text-sm text-zinc-200 group-hover:text-blue-400 transition-colors line-clamp-2">
                  {task.topic.name}
                </h4>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/40">
                  <div className="flex items-center gap-1 text-zinc-500 text-4xs">
                    <Calendar className="w-3 h-3 text-zinc-600" />
                    <span>
                      {new Date(task.scheduledDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {isOverdue && (
                      <span className="flex items-center gap-0.5 text-red-400 font-semibold ml-1.5">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Overdue
                      </span>
                    )}
                  </div>

                  {showActions && (
                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          handleRevisionAction(task.id, 'skip', task.revisionNumber, task.topic.name)
                        }
                        title="Skip"
                        className="p-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          handleRevisionAction(
                            task.id,
                            'complete',
                            task.revisionNumber,
                            task.topic.name
                          )
                        }
                        title="Complete"
                        className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="h-28 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg bg-zinc-900/5">
              <p className="text-zinc-600 text-xs font-semibold">No tasks scheduled</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Auto Planner</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Organize and plan your spaced repetition study load.
          </p>
        </div>
        <button
          onClick={fetchPlannerData}
          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-x-auto pb-4">
        {renderColumn('Today', todayTasks.length, todayTasks, true)}
        {renderColumn('Tomorrow', tomorrowTasks.length, tomorrowTasks, false)}
        {renderColumn("This Week's Tasks", thisWeekTasks.length, thisWeekTasks, false)}
      </div>
    </div>
  );
}
