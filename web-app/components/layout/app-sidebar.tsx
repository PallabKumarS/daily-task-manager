"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarCheck,
  TrendingUp,
  Settings,
  LogOut,
  Sparkles,
  Activity,
  Calculator,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/routines", label: "Daily Routines", icon: CalendarCheck },
  { href: "/trackers", label: "Daily Trackers", icon: Calculator },
  { href: "/tasks", label: "Tasks & Events", icon: CheckSquare },
  { href: "/finances", label: "Finances & Ledger", icon: TrendingUp },
  { href: "/settings", label: "Sync & Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-950/70 p-5 shrink-0 select-none">
      <div className="flex items-center gap-3 px-2 py-1 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20">
          <Activity className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-extrabold tracking-tight text-white">DayPulse</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Routines & Wealth Flow</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/80"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-emerald-400" : "text-slate-400")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-slate-800/80 space-y-3">
        {user && (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
