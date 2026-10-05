"use client";

import confetti from "canvas-confetti";
import {
	ArrowDownRight,
	ArrowUpRight,
	Ban,
	Bell,
	Calculator,
	CalendarCheck,
	Check,
	CheckSquare,
	ChevronRight,
	Clock,
	Flame,
	Minus,
	Plus,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { useAuth } from "@/components/providers/auth-provider";
import type { RoutineItem } from "@/components/routines/routine-list";
import type { TaskItem } from "@/components/tasks/task-list";
import type { DailyTrackerItem } from "@/components/trackers/tracker-types";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";

interface DashboardViewProps {
	onOpenRoutineModal: () => void;
	onOpenTaskModal: () => void;
	onOpenTransactionModal: () => void;
	onOpenTrackerModal?: () => void;
}

export function DashboardView({
	onOpenRoutineModal,
	onOpenTaskModal,
	onOpenTransactionModal,
	onOpenTrackerModal,
}: DashboardViewProps) {
	const { user } = useAuth();
	const [routines, setRoutines] = React.useState<RoutineItem[]>([]);
	const [tasks, setTasks] = React.useState<TaskItem[]>([]);
	const [transactions, setTransactions] = React.useState<TransactionItem[]>([]);
	const [trackers, setTrackers] = React.useState<DailyTrackerItem[]>([]);
	const [loading, setLoading] = React.useState(true);

	const fetchData = React.useCallback(async () => {
		try {
			const [rRes, tRes, trRes, trkRes] = await Promise.all([
				api.get<RoutineItem[]>("/routines"),
				api.get<TaskItem[]>("/tasks?upcoming=true"),
				api.get<TransactionItem[]>("/finances?limit=10"),
				api.get<DailyTrackerItem[]>("/trackers"),
			]);

			if (rRes.success && rRes.data) setRoutines(rRes.data);
			if (tRes.success && tRes.data) setTasks(tRes.data);
			if (trRes.success && trRes.data) setTransactions(trRes.data);
			if (trkRes.success && trkRes.data) setTrackers(trkRes.data);
		} catch {
			// Network load error
		} finally {
			setLoading(false);
		}
	}, []);

	const handleAdjustTracker = async (trackerId: string, delta: number) => {
		const tracker = trackers.find((t) => t.id === trackerId);
		if (!tracker) return;
		const currentVal = tracker.todayLog ? tracker.todayLog.value : 0;
		const newVal = Math.max(0, currentVal + delta);
		const todayStr = new Date().toISOString().slice(0, 10);

		setTrackers((prev) =>
			prev.map((t) =>
				t.id === trackerId
					? {
							...t,
							todayValue: newVal,
							todayLog: t.todayLog
								? { ...t.todayLog, value: newVal, status: "LOGGED" }
								: {
										id: "temp",
										date: todayStr,
										value: newVal,
										status: "LOGGED",
										isSettled: false,
									},
						}
					: t,
			),
		);

		try {
			await api.post(`/trackers/${trackerId}/log`, {
				date: todayStr,
				value: newVal,
				status: "LOGGED",
			});
			fetchData();
		} catch {
			fetchData();
		}
	};

	const handleCancelTrackerToday = async (trackerId: string) => {
		const tracker = trackers.find((t) => t.id === trackerId);
		if (!tracker) return;
		const isCurrentlyCancelled =
			tracker.todayLog?.status === "CANCELLED" && tracker.todayLog?.value === 0;
		const newVal = isCurrentlyCancelled ? tracker.defaultTarget : 0;
		const newStatus = isCurrentlyCancelled ? "LOGGED" : "CANCELLED";
		const note = isCurrentlyCancelled ? "" : "Cancelled with provider";
		const todayStr = new Date().toISOString().slice(0, 10);

		try {
			await api.post(`/trackers/${trackerId}/log`, {
				date: todayStr,
				value: newVal,
				status: newStatus,
				notes: note,
			});
			fetchData();
		} catch {
			fetchData();
		}
	};

	React.useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleToggleRoutine = async (
		id: string,
		currentlyCompleted: boolean,
	) => {
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
							streakCount: currentlyCompleted
								? Math.max(0, r.streakCount - 1)
								: r.streakCount + 1,
						}
					: r,
			),
		);

		try {
			await api.post(`/routines/${id}/toggle`, {});
			fetchData();
		} catch {
			fetchData();
		}
	};

	const handleToggleTask = async (task: TaskItem) => {
		const todayStr = new Date().toLocaleDateString("en-CA");

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

		if (task.isRecurring) {
			setTasks((prev) =>
				prev.map((t) =>
					t.id === task.id
						? { ...t, lastCompletedDate: todayStr, status: "PENDING" }
						: t,
				),
			);

			try {
				await api.patch(`/tasks/${task.id}`, {
					lastCompletedDate: todayStr,
					status: "PENDING",
				});
				fetchData();
			} catch {
				fetchData();
			}
		} else {
			const nextStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";

			setTasks((prev) =>
				prev.map((t) =>
					t.id === task.id
						? { ...t, status: nextStatus as TaskItem["status"] }
						: t,
				),
			);

			try {
				await api.patch(`/tasks/${task.id}`, { status: nextStatus });
				fetchData();
			} catch {
				fetchData();
			}
		}
	};

	const completedRoutines = routines.filter((r) => r.isCompletedToday).length;
	const routinePercent =
		routines.length > 0
			? Math.round((completedRoutines / routines.length) * 100)
			: 0;

	const todayIncome = transactions
		.filter((t) => t.type === "INCOME")
		.reduce((sum, t) => sum + t.amount, 0);

	const todayExpense = transactions
		.filter((t) => t.type === "EXPENSE")
		.reduce((sum, t) => sum + t.amount, 0);

	const todayStr = new Date().toLocaleDateString("en-CA");
	const pendingTasks = tasks
		.filter(
			(t) =>
				t.status !== "COMPLETED" &&
				(!t.isRecurring || t.lastCompletedDate !== todayStr),
		)
		.slice(0, 5);

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
						Track daily activities, sustain habit streaks, and keep a clear
						cumulative pulse over your daily spendings and earnings.
					</p>

					<div className="flex flex-wrap items-center gap-3 mt-5">
						<Button
							variant="emerald"
							size="sm"
							onClick={onOpenTaskModal}
							className="gap-1.5"
						>
							<Plus className="w-4 h-4" />
							<span>Log Task / Event</span>
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onClick={onOpenRoutineModal}
							className="gap-1.5"
						>
							<Plus className="w-4 h-4" />
							<span>New Routine</span>
						</Button>
						{onOpenTrackerModal && (
							<Button
								variant="secondary"
								size="sm"
								onClick={onOpenTrackerModal}
								className="gap-1.5"
							>
								<Plus className="w-4 h-4" />
								<span>New Tracker</span>
							</Button>
						)}
						<Button
							variant="secondary"
							size="sm"
							onClick={onOpenTransactionModal}
							className="gap-1.5"
						>
							<Plus className="w-4 h-4" />
							<span>Record Spending / Earning</span>
						</Button>
					</div>
				</div>
			</div>

			{/* 4 Overview Stat Widgets */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Routines Card */}
				<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between text-slate-400">
							<span className="text-xs font-bold uppercase tracking-wider">
								Today Routines
							</span>
							<div className="rounded-xl bg-teal-500/10 p-2 text-teal-400 border border-teal-500/20">
								<CalendarCheck className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-3 flex items-baseline gap-2">
							<span className="text-2xl font-black text-white">
								{completedRoutines}/{routines.length}
							</span>
							<span className="text-xs font-semibold text-emerald-400">
								({routinePercent}%)
							</span>
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

				{/* Daily Trackers Card */}
				<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between text-slate-400">
							<span className="text-xs font-bold uppercase tracking-wider">
								Daily Trackers
							</span>
							<div className="rounded-xl bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20">
								<Calculator className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-3 flex items-baseline gap-2">
							<span className="text-2xl font-black text-white">
								{trackers.length}
							</span>
							<span className="text-xs text-slate-400">active monitors</span>
						</div>
						<p className="text-[11px] text-slate-400 mt-2">
							{trackers.reduce((s, t) => s + (t.todayValue || 0), 0)} units
							logged today.
						</p>
					</div>
					<Link
						href="/trackers"
						className="mt-4 flex items-center justify-between text-xs text-slate-400 hover:text-purple-400 transition"
					>
						<span>Trackers & Deliveries</span>
						<ChevronRight className="w-3.5 h-3.5" />
					</Link>
				</div>

				{/* Tasks Card */}
				<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between text-slate-400">
							<span className="text-xs font-bold uppercase tracking-wider">
								Scheduled Tasks
							</span>
							<div className="rounded-xl bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
								<CheckSquare className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-3 flex items-baseline gap-2">
							<span className="text-2xl font-black text-white">
								{pendingTasks.length}
							</span>
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
							<span className="text-xs font-bold uppercase tracking-wider">
								Recent Cashflow
							</span>
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

			{/* Three Column Grid: Today's Habits, Daily Trackers & Upcoming Tasks */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
								No routines configured. Create your first morning or evening
								routine.
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
											onClick={() =>
												handleToggleRoutine(
													routine.id,
													routine.isCompletedToday,
												)
											}
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
													routine.isCompletedToday
														? "line-through text-slate-400"
														: "text-slate-100"
												}`}
											>
												{routine.title}
											</p>
											<p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
												<span className="capitalize">{routine.timeSlot}</span>
												{routine.targetTime && (
													<span>• {routine.targetTime}</span>
												)}
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

				{/* Daily Trackers & Deliveries (Interactive Quick Stepper) */}
				<div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
					<div className="flex items-center justify-between pb-3 border-b border-slate-800">
						<h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
							<Calculator className="w-4 h-4 text-purple-400" />
							<span>Daily Trackers & Meals</span>
						</h3>
						{onOpenTrackerModal ? (
							<button
								type="button"
								onClick={onOpenTrackerModal}
								className="text-xs text-purple-400 hover:underline"
							>
								+ Add
							</button>
						) : (
							<Link
								href="/trackers"
								className="text-xs text-purple-400 hover:underline"
							>
								View
							</Link>
						)}
					</div>

					<div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
						{trackers.length === 0 ? (
							<div className="py-8 text-center text-xs text-slate-500">
								<p>No trackers configured.</p>
								<Link
									href="/trackers"
									className="mt-2 inline-block text-xs font-semibold text-purple-400 hover:underline"
								>
									Set up Meals or Deliveries →
								</Link>
							</div>
						) : (
							trackers.map((t) => {
								const currentVal = t.todayLog ? t.todayLog.value : 0;
								const isCancelled =
									t.todayLog?.status === "CANCELLED" && currentVal === 0;
								const hasUnitPrice =
									typeof t.unitPrice === "number" && t.unitPrice > 0;
								const costToday = hasUnitPrice
									? currentVal * (t.unitPrice || 0)
									: 0;

								return (
									<div
										key={t.id}
										className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-900/80 hover:border-slate-700 transition"
									>
										<div className="min-w-0 pr-2">
											<div className="flex items-center gap-1.5">
												<p className="text-xs font-semibold text-slate-100 truncate">
													{t.name}
												</p>
												{isCancelled && (
													<span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
														Cancelled
													</span>
												)}
											</div>
											<p className="text-[10px] text-slate-400 mt-0.5 truncate">
												{hasUnitPrice ? (
													isCancelled ? (
														<span className="line-through text-rose-400">
															{formatCurrency(costToday, t.currency)}
														</span>
													) : (
														`${formatCurrency(costToday, t.currency)} today`
													)
												) : (
													`${t.category}`
												)}
												{t.todayLog?.notes ? ` • "${t.todayLog.notes}"` : ""}
											</p>
										</div>

										<div className="flex items-center gap-1.5 shrink-0">
											<button
												type="button"
												onClick={() => handleAdjustTracker(t.id, -1)}
												disabled={currentVal <= 0}
												className="h-6 w-6 rounded-lg bg-slate-950 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center disabled:opacity-30 cursor-pointer"
												title="Minus 1"
											>
												<Minus className="w-3 h-3" />
											</button>

											<span className="w-7 text-center font-bold text-xs text-white">
												{currentVal}
											</span>

											<button
												type="button"
												onClick={() => handleAdjustTracker(t.id, 1)}
												className="h-6 w-6 rounded-lg bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500 flex items-center justify-center cursor-pointer shadow-sm"
												title="Plus 1"
											>
												<Plus className="w-3 h-3" />
											</button>

											<button
												type="button"
												onClick={() => handleCancelTrackerToday(t.id)}
												title={
													isCancelled
														? "Restore normal meal count"
														: "Cancel for today"
												}
												className={`ml-1 h-6 w-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
													isCancelled
														? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
														: "bg-slate-950 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-slate-800"
												}`}
											>
												<Ban className="w-3 h-3" />
											</button>
										</div>
									</div>
								);
							})
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
											onClick={() => handleToggleTask(task)}
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
											<span>
												{new Date(task.dueDate).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})}
											</span>
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
