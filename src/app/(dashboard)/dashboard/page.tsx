'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Check,
  X,
  Flame,
  CheckCircle,
  Calendar,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // Data States
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [streak, setStreak] = useState(0);
  const [dueToday, setDueToday] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalTopics, setTotalTopics] = useState(0);
  const [overdue, setOverdue] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
        calculateMetrics(data);
      } else {
        toast.error('Failed to load dashboard data');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      toast.error('Network error. Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (allTopics: any[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    let dueList: any[] = [];
    let upcomingList: any[] = [];
    let overdueList: any[] = [];
    let completed = 0;
    
    // Calculate streak based on completion history dates
    const completionDates = new Set<string>();

    allTopics.forEach((topic) => {
      topic.revisions.forEach((rev: any) => {
        // Collect completed dates for streak calculation
        if (rev.status === 'COMPLETED') {
          completed++;
          if (rev.completedDate) {
            const dateStr = new Date(rev.completedDate).toISOString().split('T')[0];
            completionDates.add(dateStr);
          }
        }

        // Categorize pending revisions
        if (rev.status === 'PENDING') {
          const revDate = new Date(rev.scheduledDate);
          const revDateStr = revDate.toISOString().split('T')[0];

          if (revDateStr === todayStr) {
            dueList.push({ ...rev, topic });
          } else if (revDate < new Date()) {
            overdueList.push({ ...rev, topic });
          } else {
            upcomingList.push({ ...rev, topic });
          }
        }
      });
    });

    // Calculate Streak
    let currentStreak = 0;
    let checkDate = new Date(); // Start checking from today
    
    // If completed today or yesterday, continue checking backwards
    const checkDateStr = checkDate.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (completionDates.has(checkDateStr) || completionDates.has(yesterdayStr)) {
      if (completionDates.has(yesterdayStr) && !completionDates.has(checkDateStr)) {
        checkDate.setDate(checkDate.getDate() - 1); // Start from yesterday
      }

      while (true) {
        const formattedDate = checkDate.toISOString().split('T')[0];
        if (completionDates.has(formattedDate)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    setDueToday(dueList);
    setOverdue(overdueList);
    setUpcoming(upcomingList.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()));
    setCompletedCount(completed);
    setTotalTopics(allTopics.length);
    setStreak(currentStreak);
  };

  const handleRevisionAction = async (revisionId: string, action: 'complete' | 'skip', revisionNumber: number, topicName: string) => {
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
        
        // Final Revision Confetti Celebration
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
        
        // Refresh local dashboard data
        fetchDashboardData();
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

  return (
    <div className="space-y-8 fade-in-up">
      {/* Top Welcome Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl border border-zinc-850 bg-zinc-900/30 glass-panel">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
            Welcome back, {session?.user?.name || 'Student'}!
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            {dueToday.length === 0
              ? "All clear! You've finished today's scheduled revisions."
              : `You have ${dueToday.length} revision tasks due today. Keep the streak alive!`}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-sm font-semibold w-fit">
          <Flame className="w-5 h-5 fill-amber-500/20" />
          <span>{streak} Day Streak</span>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all flex flex-col gap-2">
          <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Due Today</span>
          <span className="text-2xl md:text-3xl font-extrabold text-blue-500">{dueToday.length}</span>
          <span className="text-zinc-500 text-2xs mt-auto">Revisions scheduled for today</span>
        </div>

        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all flex flex-col gap-2">
          <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Completed</span>
          <span className="text-2xl md:text-3xl font-extrabold text-green-500">{completedCount}</span>
          <span className="text-zinc-500 text-2xs mt-auto">Total sessions completed</span>
        </div>

        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all flex flex-col gap-2">
          <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Topics Studied</span>
          <span className="text-2xl md:text-3xl font-extrabold text-purple-500">{totalTopics}</span>
          <span className="text-zinc-500 text-2xs mt-auto">Topics cataloged in library</span>
        </div>

        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all flex flex-col gap-2">
          <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Completion Rate</span>
          <span className="text-2xl md:text-3xl font-extrabold text-indigo-500">
            {totalTopics > 0 ? Math.round((completedCount / (totalTopics * 4)) * 100) : 0}%
          </span>
          <span className="text-zinc-500 text-2xs mt-auto">Progress to mastering all topics</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Revision Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-500" />
              Today’s Revision Tasks
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300">
              {dueToday.length} Due
            </span>
          </div>

          <div className="space-y-3">
            {dueToday.map((rev) => (
              <div
                key={rev.id}
                className="flex items-center justify-between p-4 rounded-xl border border-zinc-850 bg-zinc-900/10 hover:bg-zinc-900/30 hover:border-zinc-800 transition-all group"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2 py-0.5 rounded text-3xs font-extrabold tracking-wider bg-blue-500/10 text-blue-400 uppercase border border-blue-500/10">
                      {rev.topic.subject.name}
                    </span>
                    <span className="text-3xs font-semibold text-zinc-500">
                      Revision {rev.revisionNumber} of 4
                    </span>
                  </div>
                  <h4 className="font-semibold text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
                    {rev.topic.name}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRevisionAction(rev.id, 'skip', rev.revisionNumber, rev.topic.name)}
                    title="Skip revision"
                    className="p-2 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRevisionAction(rev.id, 'complete', rev.revisionNumber, rev.topic.name)}
                    title="Complete revision"
                    className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/10 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {dueToday.length === 0 && (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/5">
                <CheckCircle className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm font-medium">All tasks completed for today!</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widget (Overdue & Upcoming) */}
        <div className="space-y-6">
          {/* Overdue Widget */}
          {overdue.length > 0 && (
            <div className="p-5 rounded-xl border border-red-500/10 bg-red-950/5 space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Overdue Tasks ({overdue.length})
              </h4>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {overdue.map((rev) => (
                  <div key={rev.id} className="flex justify-between items-center gap-2 py-1 border-b border-zinc-900 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{rev.topic.name}</p>
                      <p className="text-4xs text-red-400/80">
                        {rev.topic.subject.name} • Stage {rev.revisionNumber}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevisionAction(rev.id, 'complete', rev.revisionNumber, rev.topic.name)}
                      className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-3xs font-bold"
                    >
                      Solve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Revisions Widget */}
          <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/10 space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-zinc-500" />
              Upcoming Revisions
            </h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {upcoming.slice(0, 5).map((rev) => (
                <div key={rev.id} className="flex justify-between items-start gap-2 py-2 border-b border-zinc-850 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-200 truncate">{rev.topic.name}</p>
                    <p className="text-4xs text-zinc-500">
                      {rev.topic.subject.name} • Stage {rev.revisionNumber}
                    </p>
                  </div>
                  <span className="text-4xs font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded shrink-0">
                    {new Date(rev.scheduledDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))}

              {upcoming.length === 0 && (
                <p className="text-zinc-600 text-xs text-center py-4">No upcoming scheduled revisions.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
