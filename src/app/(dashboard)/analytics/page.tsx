'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { TrendingUp, Award, CheckCircle, Flame, BarChart3, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Analytics() {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Computed Metrics
  const [stats, setStats] = useState({
    totalTopics: 0,
    completedRevisions: 0,
    masteredTopics: 0,
    completionRate: 0,
    streak: 0,
  });

  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [lineData, setLineData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
        processAnalytics(data);
      } else {
        toast.error('Failed to load analytics data');
      }
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      toast.error('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  const processAnalytics = (allTopics: any[]) => {
    let completed = 0;
    let skipped = 0;
    let mastered = 0;

    const subjectCounts: { [key: string]: number } = {};
    const dateCounts: { [key: string]: number } = {};

    // Get current/yesterday dates for streak
    const completionDates = new Set<string>();
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    allTopics.forEach((topic) => {
      // Count mastered
      if (topic.stage === 5 || topic.status === 'MASTERED') {
        mastered++;
      }

      // Count subject topics
      const subName = topic.subject.name;
      subjectCounts[subName] = (subjectCounts[subName] || 0) + 1;

      // Count studies by date (last 7 days for consistency)
      const studyDateStr = new Date(topic.studyDate).toISOString().split('T')[0];
      dateCounts[studyDateStr] = (dateCounts[studyDateStr] || 0) + 1;

      topic.revisions.forEach((rev: any) => {
        if (rev.status === 'COMPLETED') {
          completed++;
          if (rev.completedDate) {
            const cDateStr = new Date(rev.completedDate).toISOString().split('T')[0];
            completionDates.add(cDateStr);
          }
        } else if (rev.status === 'SKIPPED') {
          skipped++;
        }
      });
    });

    // Calculate Streak
    let currentStreak = 0;
    let checkDate = new Date();
    if (completionDates.has(todayStr) || completionDates.has(yesterdayStr)) {
      if (completionDates.has(yesterdayStr) && !completionDates.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (true) {
        const fDate = checkDate.toISOString().split('T')[0];
        if (completionDates.has(fDate)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Set stats
    const totalRevisionsPossible = allTopics.length * 4;
    const rate = totalRevisionsPossible > 0 ? Math.round((completed / totalRevisionsPossible) * 100) : 0;

    setStats({
      totalTopics: allTopics.length,
      completedRevisions: completed,
      masteredTopics: mastered,
      completionRate: rate,
      streak: currentStreak,
    });

    // Format subject data
    const formattedSubjects = Object.keys(subjectCounts).map((key) => ({
      name: key,
      topics: subjectCounts[key],
    }));
    setSubjectData(formattedSubjects);

    // Format pie data
    setPieData([
      { name: 'Completed', value: completed, color: '#10b981' }, // green-500
      { name: 'Skipped', value: skipped, color: '#f59e0b' }, // amber-500
      { name: 'Pending', value: totalRevisionsPossible - (completed + skipped), color: '#3b82f6' }, // blue-500
    ]);

    // Format line chart data (last 7 days consistency)
    const formattedLine = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      formattedLine.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        studied: dateCounts[dStr] || 0,
      });
    }
    setLineData(formattedLine);
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
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Analytics</h2>
        <p className="text-zinc-400 text-sm mt-1">
          Monitor your consistency, subject progress, and spaced repetition habits.
        </p>
      </div>

      {/* Grid Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 flex flex-col items-center justify-center text-center">
          <Activity className="w-5 h-5 text-purple-500 mb-2" />
          <span className="text-zinc-400 text-2xs uppercase font-semibold">Total Topics</span>
          <span className="text-xl md:text-2xl font-extrabold text-zinc-100 mt-1">{stats.totalTopics}</span>
        </div>

        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 flex flex-col items-center justify-center text-center">
          <Flame className="w-5 h-5 text-amber-500 mb-2" />
          <span className="text-zinc-400 text-2xs uppercase font-semibold">Streak</span>
          <span className="text-xl md:text-2xl font-extrabold text-zinc-100 mt-1">{stats.streak} Days</span>
        </div>

        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 flex flex-col items-center justify-center text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
          <span className="text-zinc-400 text-2xs uppercase font-semibold">Revisions Done</span>
          <span className="text-xl md:text-2xl font-extrabold text-zinc-100 mt-1">{stats.completedRevisions}</span>
        </div>

        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 flex flex-col items-center justify-center text-center">
          <Award className="w-5 h-5 text-blue-500 mb-2" />
          <span className="text-zinc-400 text-2xs uppercase font-semibold">Mastered Topics</span>
          <span className="text-xl md:text-2xl font-extrabold text-zinc-100 mt-1">{stats.masteredTopics}</span>
        </div>

        <div className="p-5 rounded-xl border border-zinc-850 bg-zinc-900/20 flex flex-col items-center justify-center text-center col-span-2 lg:col-span-1">
          <TrendingUp className="w-5 h-5 text-indigo-500 mb-2" />
          <span className="text-zinc-400 text-2xs uppercase font-semibold">Completion Rate</span>
          <span className="text-xl md:text-2xl font-extrabold text-zinc-100 mt-1">{stats.completionRate}%</span>
        </div>
      </div>

      {/* Charts Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject wise Distribution (Bar Chart) */}
        <div className="lg:col-span-2 p-6 rounded-xl border border-zinc-850 bg-zinc-900/10 space-y-4 flex flex-col">
          <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800/60 pb-3">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Subject-wise Progress
          </h3>
          <div className="h-72 w-full flex-1 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ color: '#f4f4f5', fontSize: '12px' }}
                  labelStyle={{ color: '#a1a1aa', fontSize: '10px', fontWeight: 'bold' }}
                />
                <Bar dataKey="topics" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revision Performance (Pie Chart) */}
        <div className="p-6 rounded-xl border border-zinc-850 bg-zinc-900/10 space-y-4 flex flex-col">
          <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800/60 pb-3">
            <Activity className="w-4 h-4 text-green-400" />
            Revision Performance
          </h3>
          <div className="h-72 w-full flex-1 mt-4 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Label */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xs font-semibold text-zinc-400">Total Done</span>
              <span className="text-xl font-extrabold text-zinc-100">{stats.completedRevisions}</span>
            </div>
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-4 text-3xs font-bold uppercase tracking-wider">
            {pieData.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span style={{ color: entry.color }}>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Consistency Line Chart */}
      <div className="p-6 rounded-xl border border-zinc-850 bg-zinc-900/10 space-y-4">
        <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800/60 pb-3">
          <Activity className="w-4 h-4 text-blue-400" />
          Study Consistency (Last 7 Days)
        </h3>
        <div className="h-60 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} />
              <YAxis stroke="#52525b" fontSize={10} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  borderColor: '#27272a',
                  borderRadius: '8px',
                }}
                itemStyle={{ color: '#f4f4f5', fontSize: '12px' }}
                labelStyle={{ color: '#a1a1aa', fontSize: '10px', fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="studied" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
