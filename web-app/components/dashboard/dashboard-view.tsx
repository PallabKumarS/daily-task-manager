"use client";

import * as React from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  CalendarCheck,
  CheckSquare,
  TrendingUp,
  Plus,
  Flame,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  ChevronRight,
  Bell,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency-symbols";
import { useAuth } from "@/components/providers/auth-provider";
import { RoutineItem } from "@/components/routines/routine-list";
import { TaskItem } from "@/components/tasks/task-list";
import { TransactionItem } from "@/components/finances/transaction-list";

interface DashboardViewProps {
  onOpenRoutineModal: () => void;
  onOpenTaskModal: () => void;
  onOpenTransactionModal: () => void;
}

export function DashboardView({
  onOpenRoutineModal,
  onOpenTaskModal,
  onOpenTransactionModal,
}: DashboardViewProps) {
  const { user } = useAuth();
  const [routines, setRoutines] = React.useState<RoutineItem[]>([]);
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const [transactions, setTransactions] = React.useState<TransactionItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      const [rRes, tRes, trRes] = await Promise.all([
        fetch("/api/routines"),
        fetch("/api/tasks?upcoming=true"),
        fetch("/api/finances?limit=10"),
      ]);

      if (rRes.ok) {
        const rJson = await rRes.json();
        if (rJson.success) setRoutines(rJson.data);
      }
      if (tRes.ok) {
        const tJson = await tRes.json();
        if (tJson.success) setTasks(tJson.data);
      }
      if (trRes.ok) {
        const trJson = await trRes.json();
        if (trJson.success) setTransactions(trJson.data);
      }
    } catch {
      // Network load error
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleRoutine = async (id: string, currentlyCompleted: boolean) => {
    if (!currentlyCompleted) {
      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ["#10b981", "#14b8a6", "#34d399"],
        });
      } catch {
        // ignore
      }
    }

    setRoutines((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              isCompletedToday: !currentlyCompleted,
              streakCount: currentlyCompleted ? Math.max(0, r.streakCount - 1) : r.streakCount + 1,
            }
          : r
      )
    );

    try {
      await fetch(`/api/routines/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      fetchData();
    } catch {
      // revert on fail
      fetchData();
    }
  };

  const handleToggleTask = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";

    if (nextStatus === "COMPLETED") {
      try {
        confetti({
          particleCount: 35,
          spread: 45,
          origin: { y: 0.8 },
          colors: ["#10b981", "#3b82f6"],
        });
      } catch {
        // ignore
      }
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: nextStatus as TaskItem["status"] } : t))
    );

    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchData();
    } catch {
      fetchData();
    }
  };

  const completedRoutines = routines.filter((r) => r.isCompletedToday).length;
  const routinePercent = routines.length > 0 ? Math.round((completedRoutines / routines.length) * 100) : 0;

  const todayIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);

  const todayExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingTasks = tasks.filter((t) => t.status !== "COMPLETED").slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Banner with Quick Actions */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Optimal Rhythm Active</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Welcome back, {user?.name || "Friend"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            Track daily activities, sustain habit streaks, and keep a clear cumulative pulse over your daily spendings and earnings.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Button variant="emerald" size="sm" onClick={onOpenTaskModal} className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Log Task / Event</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenRoutineModal} className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span>New Routine</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenTransactionModal} className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Record Spending / Earning</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 3 Overview Stat Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Routines Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Today Routines</span>
              <div className="rounded-xl bg-teal-500/10 p-2 text-teal-400 border border-teal-500/20">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{completedRoutines}/{routines.length}</span>
              <span className="text-xs font-semibold text-emerald-400">({routinePercent}%)</span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${routinePercent}%` }}
              />
            </div>
          </div>
          <Link
            href="/routines"
            className="mt-4 flex items-center justify-between text-xs text-slate-400 hover:text-emerald-400 transition"
          >
            <span>View All Routines</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Tasks Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Scheduled Tasks</span>
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{pendingTasks.length}</span>
              <span className="text-xs text-slate-400">pending actions</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Advance alerts are actively armed for scheduled due times.
            </p>
          </div>
          <Link
            href="/tasks"
            className="mt-4 flex items-center justify-between text-xs text-slate-400 hover:text-blue-400 transition"
          >
            <span>Task Manager</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Financial Flow Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Recent Cashflow</span>
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400">Income</span>
                <p className="text-sm font-bold text-emerald-400">
                  +{formatCurrency(todayIncome, user?.currency || "USD")}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Spendings</span>
                <p className="text-sm font-bold text-red-400">
                  -{formatCurrency(todayExpense, user?.currency || "USD")}
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/finances"
            className="mt-4 flex items-center justify-between text-xs text-slate-400 hover:text-emerald-400 transition"
          >
            <span>Cumulative Analytics</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Two Column Grid: Today's Habits & Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Routines */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-400" />
              <span>Today Habits & Routines</span>
            </h3>
            <button
              type="button"
              onClick={onOpenRoutineModal}
              className="text-xs text-emerald-400 hover:underline"
            >
              + Add
            </button>
          </div>

          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {routines.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No routines configured. Create your first morning or evening routine.
              </p>
            ) : (
              routines.map((routine) => (
                <div
                  key={routine.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition ${
                    routine.isCompletedToday
                      ? "border-emerald-500/20 bg-emerald-950/10 text-slate-400"
                      : "border-slate-800/80 bg-slate-900/80 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRoutine(routine.id, routine.isCompletedToday)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition cursor-pointer ${
                        routine.isCompletedToday
                          ? "bg-emerald-500 border-emerald-400 text-slate-950"
                          : "border-slate-700 bg-slate-950 text-transparent hover:border-emerald-400"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          routine.isCompletedToday ? "line-through text-slate-400" : "text-slate-100"
                        }`}
                      >
                        {routine.title}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="capitalize">{routine.timeSlot}</span>
                        {routine.targetTime && <span>• {routine.targetTime}</span>}
                      </p>
                    </div>
                  </div>

                  {routine.streakCount > 0 && (
                    <div className="flex items-center gap-1 rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                      <Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
                      <span>{routine.streakCount}d</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Tasks & Events */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-400" />
              <span>Upcoming Focus & Events</span>
            </h3>
            <button
              type="button"
              onClick={onOpenTaskModal}
              className="text-xs text-blue-400 hover:underline"
            >
              + Add
            </button>
          </div>

          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {pendingTasks.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No pending tasks scheduled right now. Relax or plan ahead.
              </p>
            ) : (
              pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-900/80 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task.id, task.status)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-transparent hover:border-emerald-400 transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-100 truncate">
                        {task.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {task.category} • Priority: {task.priority}
                      </p>
                    </div>
                  </div>

                  {task.dueDate && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md shrink-0">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>{new Date(task.dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
