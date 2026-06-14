'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  RefreshCw,
  BookOpen,
  Menu,
  X,
  Bell,
  BellOff,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  isBrowserNotificationSupported,
  requestNotificationPermission,
  scheduleDailyNotificationCheck,
} from '@/lib/notifications';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Auto Planner', path: '/planner', icon: ListTodo },
  { name: 'Calendar', path: '/calendar', icon: CalendarDays },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Quick Add form state
  const [topicName, setTopicName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studyDate, setStudyDate] = useState(new Date().toISOString().split('T')[0]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Set notification status
  useEffect(() => {
    if (!isBrowserNotificationSupported()) {
      setNotifPermission('unsupported');
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Schedule daily notification check
  useEffect(() => {
    if (status !== 'authenticated') return;
    const cleanup = scheduleDailyNotificationCheck(async () => {
      const res = await fetch('/api/revisions?filter=today');
      return res.ok ? res.json() : [];
    });
    return cleanup;
  }, [status]);

  // Fetch subjects for Quick Add
  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
        if (data.length > 0) setSubjectId((prev) => prev || data[0].id);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchSubjects();
  }, [status, fetchSubjects]);

  const handleRequestNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      toast.success('Browser notifications enabled! You\'ll get daily reminders at 8 AM.');
    } else {
      toast.error('Notification permission denied. Enable in browser settings.');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Syncing with connected platforms…');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Sync completed!', { id: toastId });
        router.refresh();
      } else {
        toast.error(data.error || 'Sync failed', { id: toastId });
      }
    } catch {
      toast.error('Network error during sync', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setIsCreatingSubject(true);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubjectName }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Subject "${data.name}" created!`);
        setNewSubjectName('');
        setShowAddSubject(false);
        await fetchSubjects();
        setSubjectId(data.id);
      } else {
        toast.error(data.error || 'Failed to create subject');
      }
    } catch {
      toast.error('Error creating subject');
    } finally {
      setIsCreatingSubject(false);
    }
  };

  const handleQuickAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim() || !subjectId) return;
    setIsCreatingTopic(true);
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: topicName, subjectId, studyDate }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`"${data.name}" added! Revisions scheduled for Day 1, 2, 4 & 8.`);
        setTopicName('');
        setIsQuickAddOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || 'Failed to create topic');
      }
    } catch {
      toast.error('Error adding topic');
    } finally {
      setIsCreatingTopic(false);
    }
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  const userInitial = session?.user?.name?.[0]?.toUpperCase() || 'U';
  const pageTitle = NAV_ITEMS.find((n) => n.path === pathname)?.name || '';

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-zinc-800/60">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-blue-400" />
        </div>
        <span className="font-bold text-base tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Revision Tracker
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        {NAV_ITEMS.map(({ name, path, icon: Icon }) => {
          const isActive = pathname === path;
          return (
            <Link
              key={path}
              href={path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              <span className="flex-1">{name}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-500/50" />}
            </Link>
          );
        })}
      </nav>

      {/* Notification Bell */}
      {notifPermission !== 'unsupported' && notifPermission !== 'granted' && (
        <div className="mx-3 mb-3 p-3 rounded-xl border border-amber-500/15 bg-amber-500/5">
          <p className="text-amber-400 text-2xs font-semibold mb-2">Enable daily reminders</p>
          <button
            onClick={handleRequestNotifications}
            className="flex items-center gap-1.5 text-3xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Bell className="w-3 h-3" /> Allow Notifications
          </button>
        </div>
      )}
      {notifPermission === 'granted' && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-xl border border-green-500/10 bg-green-500/5 flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400 text-3xs font-semibold">Notifications active</span>
        </div>
      )}

      {/* User + Logout */}
      <div className="px-3 pb-4 pt-2 border-t border-zinc-800/60 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/30">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-200 truncate">{session?.user?.name}</p>
            <p className="text-3xs text-zinc-500 truncate">{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400/80 hover:bg-red-500/10 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-zinc-800/60 bg-zinc-900/40 backdrop-blur-xl shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 flex flex-col border-r border-zinc-800 bg-zinc-900 transition-transform duration-300 ease-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between h-14 px-4 md:px-6 border-b border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-zinc-500 text-sm">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-300 font-semibold">{pageTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification indicator */}
            {notifPermission === 'granted' ? (
              <div className="p-1.5 rounded-lg text-green-500/60" title="Notifications active">
                <Bell className="w-4 h-4" />
              </div>
            ) : notifPermission !== 'unsupported' ? (
              <button
                onClick={handleRequestNotifications}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors border border-zinc-800/50"
                title="Enable notifications"
              >
                <BellOff className="w-4 h-4" />
              </button>
            ) : null}

            {/* Sync button */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="Sync integrations"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors border border-zinc-800/50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            {/* Quick Add */}
            <button
              onClick={() => { fetchSubjects(); setIsQuickAddOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quick Add</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsQuickAddOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden fade-in-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
              <div>
                <h3 className="font-bold text-base text-zinc-100">Add Study Topic</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Revisions will be scheduled for Day 1, 2, 4 &amp; 8</p>
              </div>
              <button
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleQuickAddTopic} className="p-6 space-y-4">
              {/* Topic Name */}
              <div className="space-y-1.5">
                <label className="block text-3xs font-bold uppercase tracking-wider text-zinc-400">
                  Topic Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g., Binary Trees Traversal"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-3xs font-bold uppercase tracking-wider text-zinc-400">
                    Subject <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddSubject(!showAddSubject)}
                    className="text-3xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {showAddSubject ? '← Select existing' : '+ New subject'}
                  </button>
                </div>

                {showAddSubject ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Subject name (e.g., Algorithms)"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubject}
                      disabled={isCreatingSubject || !newSubjectName.trim()}
                      className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {isCreatingSubject ? '…' : 'Add'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="">Select a subject…</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Study Date */}
              <div className="space-y-1.5">
                <label className="block text-3xs font-bold uppercase tracking-wider text-zinc-400">
                  Study Date
                </label>
                <input
                  type="date"
                  value={studyDate}
                  onChange={(e) => setStudyDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Revision preview */}
              {studyDate && (
                <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-800 space-y-1">
                  <p className="text-3xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Revisions will be scheduled on:</p>
                  {[1, 2, 4, 8].map((days, i) => {
                    const d = new Date(studyDate);
                    d.setDate(d.getDate() + days);
                    return (
                      <div key={days} className="flex items-center justify-between text-2xs">
                        <span className="text-zinc-400">Revision {i + 1}</span>
                        <span className="font-semibold text-zinc-300">
                          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          <span className="text-zinc-600 ml-1">(Day +{days})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTopic || !topicName.trim() || !subjectId}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingTopic ? 'Adding…' : 'Add Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
