'use strict';
'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Calendar, Flame, Layers, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full h-20 px-6 md:px-8 flex items-center justify-between border-b border-zinc-900/60 sticky top-0 bg-zinc-950/70 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-500" />
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Revision Tracker
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold transition-colors">
            Login
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-600/15"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 md:px-8 flex flex-col items-center justify-center text-center py-20 md:py-32 gap-6 relative overflow-hidden">
        {/* Decorative background grids */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <span className="px-3 py-1 rounded-full text-4xs font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/15">
          Spaced Repetition Scheduler
        </span>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
          Master Your Studies with Scientific Spaced Repetition
        </h1>
        
        <p className="text-zinc-400 text-sm md:text-base max-w-xl leading-relaxed">
          Schedule topics and automate your revisions at Day 1, Day 2, Day 4, and Day 8. Synchronize seamlessly across Google Calendar, Notion, and Google Sheets.
        </p>

        <div className="flex gap-4 mt-4">
          <Link
            href="/signup"
            className="flex items-center gap-1.5 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-24 border-t border-zinc-900 pt-16">
          <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-900/10 hover:border-zinc-800 hover:bg-zinc-900/30 transition-all flex flex-col gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/10">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-zinc-100">Automated Spaced Intervals</h3>
            <p className="text-zinc-400 text-2xs leading-relaxed">
              Input once, schedule forever. Automatically flags revisions on Day 1, 2, 4, and 8 until topic mastery.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-900/10 hover:border-zinc-800 hover:bg-zinc-900/30 transition-all flex flex-col gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/10">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-zinc-100">Multi-Platform Sync Engine</h3>
            <p className="text-zinc-400 text-2xs leading-relaxed">
              Two-way sync updates everywhere. Create in Notion, modify in Sheets, schedule on Calendar, and run locally.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-900/10 hover:border-zinc-800 hover:bg-zinc-900/30 transition-all flex flex-col gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/10">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-zinc-100">Consistency Streaks</h3>
            <p className="text-zinc-400 text-2xs leading-relaxed">
              Gamify your study schedule. Keep track of daily streaks, completion rates, and subject analytics.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 text-center text-zinc-600 text-4xs">
        <p>© 2026 Revision Tracker. All rights reserved. Powered by Spaced Repetition.</p>
      </footer>
    </div>
  );
}
