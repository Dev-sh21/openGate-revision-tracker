'use client';

import React, { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import {
  Settings, CalendarDays, Layers, Database, Bell, Save,
  CheckCircle, Globe, Clock, Key, RefreshCw, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  isBrowserNotificationSupported,
  requestNotificationPermission,
} from '@/lib/notifications';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  // Integration status
  const [integrations, setIntegrations] = useState({ google: false, notion: false, sheets: false });

  // Preferences
  const [timezone, setTimezone] = useState('UTC');
  const [reminderOffset, setReminderOffset] = useState('0');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [browserEnabled, setBrowserEnabled] = useState(true);
  const [dailyTime, setDailyTime] = useState('08:00');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Notion developer token
  const [notionToken, setNotionToken] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [savingNotion, setSavingNotion] = useState(false);

  // Notification permission
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    fetchSettings();
    if (!isBrowserNotificationSupported()) {
      setNotifPermission('unsupported');
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/settings');
      if (res.ok) {
        const data = await res.json();
        setTimezone(data.settings.timezone);
        setReminderOffset(String(data.settings.reminderOffsetMinutes));
        setEmailEnabled(data.settings.emailRemindersEnabled);
        setBrowserEnabled(data.settings.browserRemindersEnabled);
        setDailyTime(data.settings.dailyReminderTime);
        setNotionDbId(data.settings.notionDatabaseId || '');
        setIntegrations(data.integrations);
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          reminderOffsetMinutes: parseInt(reminderOffset),
          emailRemindersEnabled: emailEnabled,
          browserRemindersEnabled: browserEnabled,
          dailyReminderTime: dailyTime,
        }),
      });
      if (res.ok) toast.success('Preferences saved!');
      else toast.error('Failed to save preferences');
    } catch {
      toast.error('Error saving preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSaveNotion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotion(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notionAccessToken: notionToken || undefined,
          notionDatabaseId: notionDbId || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Notion credentials saved!');
        setNotionToken('');
        fetchSettings();
      } else {
        toast.error('Failed to save Notion settings');
      }
    } catch {
      toast.error('Error saving Notion settings');
    } finally {
      setSavingNotion(false);
    }
  };

  const handleNotificationPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') toast.success('Browser notifications enabled!');
    else toast.error('Permission denied. Check browser settings.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in-up">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Settings</h2>
        <p className="text-zinc-400 text-sm mt-1">
          Manage integrations, notifications, and study preferences.
        </p>
      </div>

      {/* ── Integrations ── */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-wider">Connected Integrations</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Google */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-bold text-zinc-200">Google</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-3xs font-bold uppercase border ${
                integrations.google
                  ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : 'text-zinc-500 bg-zinc-800 border-zinc-700'
              }`}>
                {integrations.google ? '✓ Connected' : 'Not connected'}
              </span>
            </div>
            <p className="text-zinc-500 text-2xs leading-relaxed">
              Auto-creates Calendar events and syncs to Google Sheets. Requires calendar + spreadsheet OAuth scopes.
            </p>
            <button
              onClick={() => signIn('google')}
              className="mt-auto text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg py-2 transition-colors"
            >
              {integrations.google ? 'Reconnect Google' : 'Connect Google Account'}
            </button>
          </div>

          {/* Notion */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-bold text-zinc-200">Notion</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-3xs font-bold uppercase border ${
                integrations.notion
                  ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : 'text-zinc-500 bg-zinc-800 border-zinc-700'
              }`}>
                {integrations.notion ? '✓ Connected' : 'Not connected'}
              </span>
            </div>
            <p className="text-zinc-500 text-2xs leading-relaxed">
              Mirrors topics and revision status bidirectionally to a Notion database.
            </p>
            <a
              href="/api/auth/notion/connect"
              className="mt-auto text-xs font-semibold text-center text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg py-2 transition-colors block"
            >
              {integrations.notion ? 'Reconnect Notion' : 'Connect via Notion OAuth'}
            </a>
          </div>
        </div>
      </section>

      {/* ── Notion Developer Token ── */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-2">
          <Key className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-wider">Notion Developer Token</h3>
          <span className="ml-auto px-2 py-0.5 rounded text-3xs font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 uppercase">Optional</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-zinc-500 text-xs leading-relaxed">
            Skip OAuth setup — use a Notion <strong className="text-zinc-300">Internal Integration Token</strong> (starts with <code className="text-purple-400">secret_</code>) to connect directly. Get one from{' '}
            <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-0.5">
              notion.so/my-integrations <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <form onSubmit={handleSaveNotion} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-3xs font-bold uppercase tracking-wider text-zinc-500">Integration Token</label>
                <input
                  type="password"
                  placeholder="secret_xxxxxxxxxxxx"
                  value={notionToken}
                  onChange={(e) => setNotionToken(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-3xs font-bold uppercase tracking-wider text-zinc-500">Target Database ID <span className="text-zinc-600 normal-case font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="4a5c9f53e6b5413…"
                  value={notionDbId}
                  onChange={(e) => setNotionDbId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingNotion || (!notionToken.trim() && !notionDbId.trim())}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {savingNotion ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Notion Credentials
            </button>
          </form>
        </div>
      </section>

      {/* ── Browser Notifications ── */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-wider">Browser Notifications</h3>
        </div>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            {notifPermission === 'granted' && (
              <p className="text-green-400 text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Notifications are active
              </p>
            )}
            {notifPermission === 'default' && (
              <p className="text-zinc-300 text-sm font-semibold">Enable push notifications</p>
            )}
            {notifPermission === 'denied' && (
              <p className="text-red-400 text-sm font-semibold">Notifications blocked by browser</p>
            )}
            {notifPermission === 'unsupported' && (
              <p className="text-zinc-500 text-sm">Not supported in this browser</p>
            )}
            <p className="text-zinc-500 text-xs mt-1">
              Get a daily summary at 8:00 AM with your due revisions.
            </p>
          </div>
          {(notifPermission === 'default' || notifPermission === 'denied') && (
            <button
              onClick={handleNotificationPermission}
              className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </section>

      {/* ── Preferences ── */}
      <form onSubmit={handleSavePrefs} className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-400" />
          <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-wider">Study Preferences</h3>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Timezone */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-zinc-500">
                <Globe className="w-3 h-3" /> Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {[
                  ['UTC', 'UTC (GMT+0)'],
                  ['Asia/Kolkata', 'India (IST, GMT+5:30)'],
                  ['US/Eastern', 'US Eastern (GMT-5)'],
                  ['US/Pacific', 'US Pacific (GMT-8)'],
                  ['Europe/London', 'London (GMT+0/BST)'],
                  ['Asia/Singapore', 'Singapore (SGT, GMT+8)'],
                  ['Asia/Tokyo', 'Japan (JST, GMT+9)'],
                  ['Australia/Sydney', 'Sydney (AEST, GMT+10)'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Calendar Reminder Offset */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-zinc-500">
                <Clock className="w-3 h-3" /> Calendar Reminder
              </label>
              <select
                value={reminderOffset}
                onChange={(e) => setReminderOffset(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="0">At scheduled time</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
            </div>

            {/* Daily reminder time */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-zinc-500">
                <Bell className="w-3 h-3" /> Daily Reminder Time
              </label>
              <input
                type="time"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/50">
            {[
              { label: 'Email Reminders', desc: 'Daily summary email at your reminder time', value: emailEnabled, set: setEmailEnabled },
              { label: 'Browser Notifications', desc: 'In-browser push at 8:00 AM local time', value: browserEnabled, set: setBrowserEnabled },
            ].map(({ label, desc, value, set }) => (
              <label key={label} className="flex items-center justify-between gap-4 cursor-pointer group">
                <div>
                  <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100">{label}</p>
                  <p className="text-2xs text-zinc-500">{desc}</p>
                </div>
                <div
                  onClick={() => set(!value)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer shrink-0 ${value ? 'bg-blue-600' : 'bg-zinc-700'}`}
                  style={{ height: '22px', width: '40px' }}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </div>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={savingPrefs}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            {savingPrefs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
