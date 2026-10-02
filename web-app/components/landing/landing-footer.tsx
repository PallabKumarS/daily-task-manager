"use client";

import * as React from "react";
import Link from "next/link";
import { Activity } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">DayPulse</span>
            <p className="text-[11px] text-slate-500">Daily Activity Flow & Wealth Mastery</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-emerald-400 transition">
            Dashboard
          </Link>
          <Link href="/routines" className="hover:text-emerald-400 transition">
            Routines
          </Link>
          <Link href="/tasks" className="hover:text-emerald-400 transition">
            Tasks & Events
          </Link>
          <Link href="/finances" className="hover:text-emerald-400 transition">
            Finances
          </Link>
          <Link href="/settings" className="hover:text-emerald-400 transition">
            Sync & Backup
          </Link>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} DayPulse. Engineered for cross-device productivity.
        </p>
      </div>
    </footer>
  );
}
