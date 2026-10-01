"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Activity, Calendar } from "lucide-react";
import { NotificationCenter } from "@/components/layout/notification-center";
import { formatReadableDate } from "@/lib/date-helpers";
import { useAuth } from "@/components/providers/auth-provider";

interface AppNavbarProps {
  onQuickAdd?: (type: "routine" | "task" | "transaction") => void;
}

export function AppNavbar({ onQuickAdd }: AppNavbarProps) {
  const { user } = useAuth();
  const [currentDateText, setCurrentDateText] = React.useState("");

  React.useEffect(() => {
    setCurrentDateText(formatReadableDate(new Date()));
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 sm:px-8 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {/* Mobile Logo Brand */}
        <Link href="/dashboard" className="md:hidden flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-base font-extrabold text-white">DayPulse</span>
        </Link>

        {/* Date on Tablet/Desktop */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>{currentDateText || "Today"}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onQuickAdd && (
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-950/40 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Quick Log</span>
            </button>
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col w-40 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-xl z-50">
              <button
                type="button"
                onClick={() => onQuickAdd("routine")}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                + New Routine
              </button>
              <button
                type="button"
                onClick={() => onQuickAdd("task")}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                + Task / Event
              </button>
              <button
                type="button"
                onClick={() => onQuickAdd("transaction")}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                + Spend / Earning
              </button>
            </div>
          </div>
        )}

        <NotificationCenter />
      </div>
    </header>
  );
}
