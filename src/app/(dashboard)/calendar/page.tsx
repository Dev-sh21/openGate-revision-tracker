'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CalendarView() {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateRevisions, setSelectedDateRevisions] = useState<any[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
      } else {
        toast.error('Failed to load calendar data');
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
      toast.error('Network error. Failed to load calendar data.');
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
    setSelectedDateRevisions([]);
    setSelectedDateStr('');
  };

  const getRevisionStatusColor = (rev: any) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const schedStr = new Date(rev.scheduledDate).toISOString().split('T')[0];
    const schedDate = new Date(rev.scheduledDate);
    
    if (rev.status === 'COMPLETED') {
      return 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20';
    }
    if (rev.status === 'SKIPPED') {
      return 'bg-zinc-800 text-zinc-400 border-zinc-700/60 hover:bg-zinc-750';
    }
    
    // Pending cases
    if (schedStr === todayStr) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20';
    }
    if (schedDate < new Date()) {
      return 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'; // Missed
    }
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'; // Upcoming
  };

  const getRevisionStatusLabel = (rev: any) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const schedStr = new Date(rev.scheduledDate).toISOString().split('T')[0];
    const schedDate = new Date(rev.scheduledDate);
    
    if (rev.status === 'COMPLETED') return 'Completed';
    if (rev.status === 'SKIPPED') return 'Skipped';
    if (schedStr === todayStr) return 'Due Today';
    if (schedDate < new Date()) return 'Missed';
    return 'Upcoming';
  };

  // Compile calendar cells
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);
  
  const totalSlots = 42; // 6 rows of 7 days
  const calendarCells = [];

  // Previous month filler days
  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = new Date(prevMonthYear, prevMonth, day);
    calendarCells.push({ day, date, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    calendarCells.push({ day: i, date, isCurrentMonth: true });
  }

  // Next month filler days
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const remainingSlots = totalSlots - calendarCells.length;

  for (let i = 1; i <= remainingSlots; i++) {
    const date = new Date(nextMonthYear, nextMonth, i);
    calendarCells.push({ day: i, date, isCurrentMonth: false });
  }

  // Collect all revisions and match them to cell dates
  const getRevisionsForDate = (date: Date) => {
    const targetStr = date.toISOString().split('T')[0];
    const list: any[] = [];
    
    topics.forEach((topic) => {
      topic.revisions.forEach((rev: any) => {
        const revStr = new Date(rev.scheduledDate).toISOString().split('T')[0];
        if (revStr === targetStr) {
          list.push({ ...rev, topic });
        }
      });
    });

    return list;
  };

  const handleDayClick = (date: Date, cellRevisions: any[]) => {
    setSelectedDateRevisions(cellRevisions);
    setSelectedDateStr(
      date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Calendar View</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Visual representation of your revisions. Select a cell to view task details.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2.5 text-3xs font-semibold uppercase tracking-wider bg-zinc-900/40 border border-zinc-850 p-2.5 rounded-lg w-fit">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
            <span className="text-amber-400">Due Today</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500/20 border border-blue-500/40" />
            <span className="text-blue-400">Upcoming</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
            <span className="text-green-400">Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
            <span className="text-red-400">Missed</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 border border-zinc-850 bg-zinc-900/10 rounded-xl p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-zinc-200">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigateMonth('next')}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 border-b border-zinc-800/60 pb-2">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-center text-4xs font-bold text-zinc-500 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 aspect-[7/5]">
            {calendarCells.map(({ day, date, isCurrentMonth }, idx) => {
              const cellRevisions = getRevisionsForDate(date);
              const isToday =
                new Date().toISOString().split('T')[0] === date.toISOString().split('T')[0];

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(date, cellRevisions)}
                  className={`min-h-[60px] p-1.5 border rounded-lg flex flex-col justify-between cursor-pointer transition-all ${
                    isCurrentMonth ? 'bg-zinc-900/30' : 'bg-zinc-950/20 opacity-40'
                  } ${
                    isToday
                      ? 'border-blue-500/50 shadow-md shadow-blue-500/5'
                      : 'border-zinc-900 hover:border-zinc-850 hover:bg-zinc-900/50'
                  }`}
                >
                  <span
                    className={`text-2xs font-semibold ${
                      isToday
                        ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold'
                        : isCurrentMonth
                        ? 'text-zinc-300'
                        : 'text-zinc-600'
                    }`}
                  >
                    {day}
                  </span>

                  <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-16">
                    {cellRevisions.slice(0, 2).map((rev) => (
                      <div
                        key={rev.id}
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded border leading-tight truncate ${getRevisionStatusColor(
                          rev
                        )}`}
                      >
                        {rev.topic.name}
                      </div>
                    ))}
                    {cellRevisions.length > 2 && (
                      <div className="text-[7px] text-zinc-500 font-semibold pl-1.5">
                        +{cellRevisions.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Panel */}
        <div className="border border-zinc-850 bg-zinc-900/10 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-zinc-500" />
            Revision Details
          </h3>

          {selectedDateStr ? (
            <div className="space-y-4">
              <div>
                <p className="text-3xs text-zinc-500 font-bold uppercase tracking-wider">Selected Date</p>
                <p className="text-xs font-bold text-zinc-200 mt-0.5">{selectedDateStr}</p>
              </div>

              <div className="space-y-3">
                <p className="text-3xs text-zinc-500 font-bold uppercase tracking-wider">
                  Tasks ({selectedDateRevisions.length})
                </p>
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {selectedDateRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 rounded-lg border border-zinc-850 bg-zinc-900/30 flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wider bg-zinc-800 text-zinc-300 uppercase">
                          {rev.topic.subject.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wider border uppercase ${getRevisionStatusColor(
                            rev
                          )}`}
                        >
                          {getRevisionStatusLabel(rev)}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-200 leading-snug">{rev.topic.name}</p>
                      <p className="text-4xs text-zinc-500">
                        Revision Stage {rev.revisionNumber} of 4
                      </p>
                    </div>
                  ))}

                  {selectedDateRevisions.length === 0 && (
                    <p className="text-zinc-600 text-xs py-4 text-center">No tasks scheduled for this day.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <CalendarIcon className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-zinc-500 text-xs font-semibold">Select a date to view scheduled tasks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
