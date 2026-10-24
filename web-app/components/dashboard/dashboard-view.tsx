"use client";

import confetti from "canvas-confetti";
import {
	ArrowDownRight,
	ArrowUpRight,
	Ban,
	Calculator,
	CalendarCheck,
	Check,
	CheckSquare,
	ChevronRight,
	Clock,
	Cloud,
	FileArchive,
	Flame,
	LayoutGrid,
	ListFilter,
	Minus,
	Pencil,
	Plus,
	Sparkles,
	Trash2,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { GoogleRestoreModal } from "@/components/auth/google-restore-modal";
import { RestoreBackupModal } from "@/components/auth/restore-backup-modal";
import { DailyStreamView } from "@/components/dashboard/daily-stream-view";
import { RecentlyAddedBanner } from "@/components/dashboard/recently-added-banner";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { useContextDock } from "@/components/layout/context-dock";
import { useAuth } from "@/components/providers/auth-provider";
import type { RoutineItem } from "@/components/routines/routine-list";
import type { TaskItem } from "@/components/tasks/task-list";
import type { DailyTrackerItem } from "@/components/trackers/tracker-types";
import { Button } from "@/components/ui/button";
import { CardDeck } from "@/components/ui/card-deck";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";
import { useTodayDate } from "@/lib/date-helpers";

interface DashboardViewProps {
	onOpenRoutineModal: (routine?: RoutineItem | null) => void;
	onOpenTaskModal: (task?: TaskItem | null) => void;
	onOpenTransactionModal: (tx?: TransactionItem | null) => void;
	onOpenTrackerModal?: (tracker?: DailyTrackerItem | null) => void;
}

export function DashboardView({
	onOpenRoutineModal,
	onOpenTaskModal,
	onOpenTransactionModal,
	onOpenTrackerModal,
}: DashboardViewProps) {
	const { user } = useAuth();
	const confirm = useConfirm();
	const { todayDateString: todayStr } = useTodayDate();

	const [routines, setRoutines] = React.useState<RoutineItem[]>([]);
	const [tasks, setTasks] = React.useState<TaskItem[]>([]);
	const [transactions, setTransactions] = React.useState<TransactionItem[]>([]);
	const [trackers, setTrackers] = React.useState<DailyTrackerItem[]>([]);
	const [viewMode, setViewMode] = React.useState<"OVERVIEW" | "STREAM">("STREAM");
	const [isRestoreModalOpen, setIsRestoreModalOpen] = React.useState(false);
	const [isGoogleModalOpen, setIsGoogleModalOpen] = React.useState(false);

	const fetchData = React.useCallback(async () => {
		try {
			const [rRes, tRes, trRes, trkRes] = await Promise.allSettled([
				api.get<RoutineItem[]>("/routines"),
				api.get<TaskItem[]>("/tasks?upcoming=true"),
				api.get<TransactionItem[]>("/finances?limit=15"),
				api.get<DailyTrackerItem[]>("/trackers"),
			]);

			if (rRes.status === "fulfilled" && rRes.value.success && rRes.value.data) {
				setRoutines(rRes.value.data);
			}
			if (tRes.status === "fulfilled" && tRes.value.success && tRes.value.data) {
				setTasks(tRes.value.data);
			}
			if (trRes.status === "fulfilled" && trRes.value.success && trRes.value.data) {
				setTransactions(trRes.value.data);
			}
			if (trkRes.status === "fulfilled" && trkRes.value.success && trkRes.value.data) {
				setTrackers(trkRes.value.data);
			}
		} catch {
			// ignore
		}
	}, []);

	React.useEffect(() => {
		fetchData();

		const onGlobalRefresh = () => fetchData();
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		window.addEventListener("daypulse:date-changed", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
			window.removeEventListener("daypulse:date-changed", onGlobalRefresh);
		};
	}, [fetchData]);

	// Tracker handlers
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

	const handleDeleteTracker = async (id: string, name: string) => {
		const ok = await confirm({
			title: "Delete Tracker",
			description: `Are you sure you want to delete tracker "${name}"? This action cannot be undone.`,
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete(`/trackers/${id}`);
			if (res.success) {
				toast.success("Tracker deleted");
				fetchData();
			} else {
				toast.error(res.message || "Failed to delete tracker");
			}
		} catch {
			toast.error("Network error while deleting tracker");
		}
	};

	const handleClearAllTrackers = async () => {
		const ok = await confirm({
			title: "Delete All Trackers",
			description:
				"Are you sure you want to permanently delete all daily trackers and monitors? This action cannot be undone.",
			confirmText: "Delete All",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete("/trackers");
			if (res.success) {
				toast.success("All trackers deleted");
				fetchData();
			} else {
				toast.error(res.message || "Failed to delete trackers");
			}
		} catch {
			toast.error("Network error while deleting trackers");
		}
	};

	// Routine handlers
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

	const handleDeleteRoutine = async (id: string, title: string) => {
		const ok = await confirm({
			title: "Delete Routine",
			description: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete(`/routines/${id}`);
			if (res.success) {
				toast.success("Routine deleted");
				fetchData();
			} else {
				toast.error(res.message || "Failed to delete routine");
			}
		} catch {
			toast.error("Network error while deleting routine");
		}
	};

	const handleClearAllRoutines = async () => {
		const ok = await confirm({
			title: "Delete All Routines",
			description:
				"Are you sure you want to permanently delete all daily routines and habits? This action cannot be undone.",
			confirmText: "Delete All",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete("/routines");
			if (res.success) {
				toast.success("All routines deleted");
				fetchData();
			} else {
				toast.error(res.message || "Failed to delete routines");
			}
		} catch {
			toast.error("Network error while deleting routines");
		}
	};

	// Task handlers
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
					t.id === task.id ? { ...t, lastCompletedDate: todayStr, status: "PENDING" } : t,
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
					t.id === task.id ? { ...t, status: nextStatus as TaskItem["status"] } : t,
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

	const handleDeleteTask = async (id: string, title: string) => {
		const ok = await confirm({
			title: "Delete Task",
			description: `Are you sure you want to delete task "${title}"? This action cannot be undone.`,
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete(`/tasks/${id}`);
			if (res.success) {
				toast.success("Task deleted");
				fetchData();
			} else {
				toast.error(res.message || "Failed to delete task");
			}
		} catch {
			toast.error("Network error while deleting task");
		}
	};

	const handleClearAllTasks = async () => {
		const ok = await confirm({
			title: "Delete All Tasks",
			description:
				"Are you sure you want to permanently delete all tasks and calendar events? This action cannot be undone.",
			confirmText: "Delete All",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete("/tasks");
			if (res.success) {
				toast.success("All tasks deleted");
				fetchData();
			} else {
				toast.error(res.message || "Failed to delete tasks");
			}
		} catch {
			toast.error("Network error while deleting tasks");
		}
	};

	// Transaction handlers
	const handleDeleteTransaction = async (id: string, desc: string) => {
		const ok = await confirm({
			title: "Delete Transaction",
			description: `Are you sure you want to delete "${desc}"? This action cannot be undone.`,
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete(`/finances/${id}`);
			if (res.success) {
				toast.success("Transaction deleted");
				fetchData();
			} else {
				toast.error(res.message || "Failed to delete transaction");
			}
		} catch {
			toast.error("Network error while deleting transaction");
		}
	};

	const handleClearAllTransactions = async () => {
		const ok = await confirm({
			title: "Delete All Transactions",
			description:
				"Are you sure you want to permanently delete all financial ledger transactions? This action cannot be undone.",
			confirmText: "Delete All",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete("/finances");
			if (res.success) {
				toast.success("All transactions deleted");
				fetchData();
			} else {
				toast.error(res.message || "Failed to delete transactions");
			}
		} catch {
			toast.error("Network error while deleting transactions");
		}
	};

	const completedRoutines = routines.filter((r) => r.isCompletedToday).length;
	const routinePercent =
		routines.length > 0 ? Math.round((completedRoutines / routines.length) * 100) : 0;

	const todayIncome = transactions
		.filter((t) => t.type === "INCOME")
		.reduce((sum, t) => sum + t.amount, 0);

	const todayExpense = transactions
		.filter((t) => t.type === "EXPENSE")
		.reduce((sum, t) => sum + t.amount, 0);

	const pendingTasks = tasks.filter(
		(t) => t.status !== "COMPLETED" && (!t.isRecurring || t.lastCompletedDate !== todayStr),
	);

	const isWorkspaceEmpty =
		routines.length === 0 &&
		tasks.length === 0 &&
		transactions.length === 0 &&
		trackers.length === 0;

	const contextDockNode = React.useMemo(
		() => (
			<div className="flex items-center justify-between gap-2 w-full">
				<div className="flex items-center rounded-xl bg-surface-2 p-0.5 border border-border">
					<button
						type="button"
						onClick={() => setViewMode("STREAM")}
						className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
							viewMode === "STREAM"
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-foreground-muted hover:text-foreground"
						}`}
					>
						<ListFilter className="w-3.5 h-3.5" />
						<span>Stream</span>
					</button>
					<button
						type="button"
						onClick={() => setViewMode("OVERVIEW")}
						className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
							viewMode === "OVERVIEW"
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-foreground-muted hover:text-foreground"
						}`}
					>
						<LayoutGrid className="w-3.5 h-3.5" />
						<span>Hub Cards</span>
					</button>
				</div>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => onOpenTaskModal()}
						className="px-2.5 py-1.5 rounded-xl bg-primary/15 text-primary border border-primary/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
					>
						<Plus className="w-3.5 h-3.5" />
						<span>Task</span>
					</button>
					<button
						type="button"
						onClick={() => onOpenTransactionModal()}
						className="px-2.5 py-1.5 rounded-xl bg-surface-2 text-foreground border border-border text-xs font-bold flex items-center gap-1 cursor-pointer"
					>
						<Plus className="w-3.5 h-3.5 text-emerald-500" />
						<span>Spend</span>
					</button>
				</div>
			</div>
		),
		[viewMode, onOpenTaskModal, onOpenTransactionModal],
	);

	useContextDock(contextDockNode);

	return (
		<div className="space-y-6">
			<RecentlyAddedBanner />

			{/* Clean Header & Quick Actions */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">
						Welcome back, {user?.name || "Friend"}
					</h1>
					<p className="text-xs text-foreground-muted mt-1">
						Today&apos;s real-time pulse across habits, agenda, and cashflow
					</p>
				</div>

				<div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
					<Button
						variant="emerald"
						size="sm"
						onClick={() => onOpenTaskModal()}
						className="gap-1.5 shadow-sm"
					>
						<Plus className="w-4 h-4" />
						<span>Log Task</span>
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={() => onOpenRoutineModal()}
						className="gap-1.5"
					>
						<Plus className="w-4 h-4" />
						<span>New Routine</span>
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={() => onOpenTransactionModal()}
						className="gap-1.5"
					>
						<Plus className="w-4 h-4" />
						<span>Spend / Income</span>
					</Button>
				</div>
			</div>

			{/* Empty Workspace Welcome Card */}
			{isWorkspaceEmpty && (
				<div className="rounded-2xl border border-border bg-surface p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-5">
					<div className="flex items-start gap-3.5">
						<div className="p-2.5 rounded-xl bg-primary-soft text-primary border border-primary/20 shrink-0">
							<Sparkles className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-foreground">Your Workspace is Fresh & Ready</h3>
							<p className="text-xs text-foreground-muted mt-1 max-w-md leading-relaxed">
								Start logging your daily routines and expenses, or restore existing data from your
								Google Drive or local file backup.
							</p>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2 shrink-0">
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setIsRestoreModalOpen(true)}
							className="gap-1.5 text-xs"
						>
							<FileArchive className="w-3.5 h-3.5 text-teal-400" />
							<span>Restore File Backup</span>
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setIsGoogleModalOpen(true)}
							className="gap-1.5 text-xs"
						>
							<Cloud className="w-3.5 h-3.5 text-indigo-400" />
							<span>Google Drive Sync</span>
						</Button>
					</div>
				</div>
			)}

			{/* Overview Stat Widgets */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Routines Card */}
				<div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between text-foreground-muted">
							<span className="text-xs font-bold uppercase tracking-wider">Today Routines</span>
							<div className="rounded-xl bg-teal-500/10 p-2 text-teal-400 border border-teal-500/20">
								<CalendarCheck className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-3 flex items-baseline gap-2">
							<span className="text-2xl font-black text-foreground tabular-nums">
								{completedRoutines}/{routines.length}
							</span>
							<span className="text-xs font-semibold text-teal-400">({routinePercent}%)</span>
						</div>
						<div className="mt-3 h-2 w-full rounded-full bg-surface-2 overflow-hidden">
							<div
								className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-500"
								style={{ width: `${routinePercent}%` }}
							/>
						</div>
					</div>
					<Link
						href="/routines"
						className="mt-4 flex items-center justify-between text-xs text-foreground-muted hover:text-teal-400 transition"
					>
						<span>Manage Routines</span>
						<ChevronRight className="w-3.5 h-3.5" />
					</Link>
				</div>

				{/* Daily Trackers Card */}
				<div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between text-foreground-muted">
							<span className="text-xs font-bold uppercase tracking-wider">Daily Monitors</span>
							<div className="rounded-xl bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20">
								<Calculator className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-3 flex items-baseline gap-2">
							<span className="text-2xl font-black text-foreground tabular-nums">
								{trackers.length}
							</span>
							<span className="text-xs text-foreground-muted">active monitors</span>
						</div>
						<p className="text-xs text-foreground-muted mt-2">
							{trackers.reduce((s, t) => s + (t.todayValue || 0), 0)} units logged today.
						</p>
					</div>
					<Link
						href="/trackers"
						className="mt-4 flex items-center justify-between text-xs text-foreground-muted hover:text-purple-400 transition"
					>
						<span>Manage Trackers</span>
						<ChevronRight className="w-3.5 h-3.5" />
					</Link>
				</div>

				{/* Tasks Card */}
				<div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between text-foreground-muted">
							<span className="text-xs font-bold uppercase tracking-wider">Scheduled Tasks</span>
							<div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400 border border-indigo-500/20">
								<CheckSquare className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-3 flex items-baseline gap-2">
							<span className="text-2xl font-black text-foreground tabular-nums">
								{pendingTasks.length}
							</span>
							<span className="text-xs text-foreground-muted">pending actions</span>
						</div>
						<p className="text-xs text-foreground-muted mt-2">
							Advance alerts armed for scheduled due times.
						</p>
					</div>
					<Link
						href="/tasks"
						className="mt-4 flex items-center justify-between text-xs text-foreground-muted hover:text-indigo-400 transition"
					>
						<span>Manage Tasks</span>
						<ChevronRight className="w-3.5 h-3.5" />
					</Link>
				</div>

				{/* Financial Flow Card */}
				<div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between text-foreground-muted">
							<span className="text-xs font-bold uppercase tracking-wider">Recent Cashflow</span>
							<div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
								<TrendingUp className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-3 flex items-center justify-between">
							<div>
								<span className="text-xs text-foreground-muted">Earnings</span>
								<p className="text-sm font-bold text-emerald-400 tabular-nums">
									+{formatCurrency(todayIncome, user?.currency || "USD")}
								</p>
							</div>
							<div>
								<span className="text-xs text-foreground-muted">Spendings</span>
								<p className="text-sm font-bold text-rose-400 tabular-nums">
									-{formatCurrency(todayExpense, user?.currency || "USD")}
								</p>
							</div>
						</div>
					</div>
					<Link
						href="/finances"
						className="mt-4 flex items-center justify-between text-xs text-foreground-muted hover:text-emerald-400 transition"
					>
						<span>Cumulative Finances</span>
						<ChevronRight className="w-3.5 h-3.5" />
					</Link>
				</div>
			</div>

			{/* View Mode Switcher */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
				<div>
					<h3 className="text-base font-extrabold text-foreground">
						{viewMode === "STREAM" ? "Today's Agenda & Activity Stream" : "Overview Hub"}
					</h3>
					<p className="text-xs text-foreground-muted mt-0.5">
						{viewMode === "STREAM"
							? "Unified chronological stream of today's logged expenses, tasks, habits, and meters"
							: "Consolidated modular cards for habits, monitors, tasks, and financial flow"}
					</p>
				</div>
				<div className="flex items-center rounded-xl bg-surface-sunken p-1 border border-border self-start sm:self-auto">
					<button
						type="button"
						onClick={() => setViewMode("STREAM")}
						className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							viewMode === "STREAM"
								? "bg-surface text-primary shadow-sm border border-border"
								: "text-foreground-muted hover:text-foreground"
						}`}
					>
						<ListFilter className="w-3.5 h-3.5 text-primary" />
						<span>Today&apos;s Stream</span>
					</button>
					<button
						type="button"
						onClick={() => setViewMode("OVERVIEW")}
						className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							viewMode === "OVERVIEW"
								? "bg-surface text-foreground shadow-sm border border-border"
								: "text-foreground-muted hover:text-foreground"
						}`}
					>
						<LayoutGrid className="w-3.5 h-3.5 text-foreground-muted" />
						<span>Overview Hub</span>
					</button>
				</div>
			</div>

			{viewMode === "STREAM" ? (
				<DailyStreamView
					routines={routines}
					tasks={tasks}
					transactions={transactions}
					trackers={trackers}
					onOpenRoutineModal={onOpenRoutineModal}
					onOpenTaskModal={onOpenTaskModal}
					onOpenTransactionModal={onOpenTransactionModal}
					onOpenTrackerModal={onOpenTrackerModal}
					onToggleRoutine={handleToggleRoutine}
					onToggleTask={handleToggleTask}
					onAdjustTracker={handleAdjustTracker}
				/>
			) : (
				/* 4 Cards: Routines, Trackers, Tasks & Transactions in CardDeck */
				<CardDeck
					items={[
						{
							id: "routines_hub",
							title: "Today Habits & Routines",
							node: (
								<div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col justify-between">
									<div>
										<div className="flex items-center justify-between pb-3 border-b border-border">
											<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
												<CalendarCheck className="w-4 h-4 text-emerald-400" />
												<span>Today Habits & Routines</span>
											</h3>
											<div className="flex items-center gap-2">
												{routines.length > 0 && (
													<button
														type="button"
														onClick={handleClearAllRoutines}
														className="text-xs text-foreground-subtle hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
														title="Delete all routines"
													>
														<Trash2 className="w-3 h-3" />
														<span>Clear All</span>
													</button>
												)}
												<button
													type="button"
													onClick={() => onOpenRoutineModal()}
													className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
												>
													+ Add
												</button>
											</div>
										</div>

										<div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
											{routines.length === 0 ? (
												<div className="py-10 text-center text-xs text-foreground-muted">
													<p>No habits or routines created yet.</p>
													<Button
														variant="outline"
														size="sm"
														onClick={() => onOpenRoutineModal()}
														className="mt-3 text-xs"
													>
														<Plus className="w-3.5 h-3.5 mr-1" />
														<span>Add Your First Routine</span>
													</Button>
												</div>
											) : (
												routines.map((routine) => (
													<div
														key={routine.id}
														className={`group flex items-center justify-between p-3 rounded-xl border transition ${
															routine.isCompletedToday
																? "border-emerald-500/20 bg-emerald-500/5 text-foreground-muted"
																: "border-border bg-surface-2/60 text-foreground"
														}`}
													>
														<div className="flex items-center gap-3 min-w-0">
															<button
																type="button"
																onClick={() =>
																	handleToggleRoutine(routine.id, routine.isCompletedToday)
																}
																className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition cursor-pointer ${
																	routine.isCompletedToday
																		? "bg-emerald-500 border-emerald-400 text-white"
																		: "border-border-strong bg-surface text-transparent hover:border-emerald-400"
																}`}
															>
																<Check className="w-3.5 h-3.5 stroke-[3]" />
															</button>
															<div className="min-w-0">
																<p
																	className={`text-xs font-semibold truncate ${
																		routine.isCompletedToday
																			? "line-through text-foreground-muted"
																			: "text-foreground"
																	}`}
																>
																	{routine.title}
																</p>
																<p className="text-xs text-foreground-muted flex items-center gap-1.5 mt-0.5">
																	<span className="capitalize">{routine.timeSlot}</span>
																	{routine.targetTime && <span>• {routine.targetTime}</span>}
																</p>
															</div>
														</div>

														<div className="flex items-center gap-2 shrink-0">
															{routine.streakCount > 0 && (
																<div className="flex items-center gap-1 rounded-md bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-400">
																	<Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
																	<span>{routine.streakCount}d</span>
																</div>
															)}

															<div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
																<button
																	type="button"
																	onClick={() => onOpenRoutineModal(routine)}
																	className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
																	title="Edit Routine"
																>
																	<Pencil className="w-3.5 h-3.5" />
																</button>
																<button
																	type="button"
																	onClick={() => handleDeleteRoutine(routine.id, routine.title)}
																	className="p-1 rounded-lg text-foreground-muted hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
																	title="Delete Routine"
																>
																	<Trash2 className="w-3.5 h-3.5" />
																</button>
															</div>
														</div>
													</div>
												))
											)}
										</div>
									</div>
									<Link
										href="/routines"
										className="mt-3 pt-3 border-t border-border text-xs text-foreground-muted hover:text-emerald-400 flex items-center justify-between"
									>
										<span>View routine habits tracker</span>
										<ChevronRight className="w-3.5 h-3.5" />
									</Link>
								</div>
							),
						},
						{
							id: "trackers_hub",
							title: "Daily Trackers & Monitors",
							node: (
								<div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col justify-between">
									<div>
										<div className="flex items-center justify-between pb-3 border-b border-border">
											<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
												<Calculator className="w-4 h-4 text-purple-400" />
												<span>Daily Trackers & Monitors</span>
											</h3>
											<div className="flex items-center gap-2">
												{trackers.length > 0 && (
													<button
														type="button"
														onClick={handleClearAllTrackers}
														className="text-xs text-foreground-subtle hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
														title="Delete all trackers"
													>
														<Trash2 className="w-3 h-3" />
														<span>Clear All</span>
													</button>
												)}
												{onOpenTrackerModal && (
													<button
														type="button"
														onClick={() => onOpenTrackerModal()}
														className="text-xs text-purple-400 hover:underline font-semibold cursor-pointer"
													>
														+ Add
													</button>
												)}
											</div>
										</div>

										<div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
											{trackers.length === 0 ? (
												<div className="py-10 text-center text-xs text-foreground-muted">
													<p>No daily monitors configured yet.</p>
													{onOpenTrackerModal && (
														<Button
															variant="outline"
															size="sm"
															onClick={() => onOpenTrackerModal()}
															className="mt-3 text-xs"
														>
															<Plus className="w-3.5 h-3.5 mr-1" />
															<span>Create Your First Tracker</span>
														</Button>
													)}
												</div>
											) : (
												trackers.map((t) => {
													const currentVal = t.todayLog ? t.todayLog.value : 0;
													const isCancelled =
														t.todayLog?.status === "CANCELLED" && currentVal === 0;
													const hasUnitPrice = typeof t.unitPrice === "number" && t.unitPrice > 0;
													const costToday = hasUnitPrice ? currentVal * (t.unitPrice || 0) : 0;

													return (
														<div
															key={t.id}
															className="group flex items-center justify-between p-3 rounded-xl border border-border bg-surface-2/60 hover:border-border-strong transition"
														>
															<div className="min-w-0 pr-2">
																<div className="flex items-center gap-1.5">
																	<p className="text-xs font-semibold text-foreground truncate">
																		{t.name}
																	</p>
																	{isCancelled && (
																		<span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
																			Cancelled
																		</span>
																	)}
																</div>
																<p className="text-xs text-foreground-muted mt-0.5 truncate">
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

															<div className="flex items-center gap-2 shrink-0">
																<div className="flex items-center gap-1.5">
																	<button
																		type="button"
																		onClick={() => handleAdjustTracker(t.id, -1)}
																		disabled={currentVal <= 0}
																		className="h-6 w-6 rounded-lg bg-surface border border-border text-foreground-muted hover:text-foreground hover:bg-surface-2 flex items-center justify-center disabled:opacity-30 cursor-pointer"
																		title="Minus 1"
																	>
																		<Minus className="w-3 h-3" />
																	</button>

																	<span className="w-7 text-center font-bold text-xs text-foreground tabular-nums">
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
																			isCancelled ? "Restore normal count" : "Cancel for today"
																		}
																		className={`h-6 w-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
																			isCancelled
																				? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
																				: "bg-surface border border-border text-foreground-subtle hover:text-rose-400 hover:bg-surface-2"
																		}`}
																	>
																		<Ban className="w-3 h-3" />
																	</button>
																</div>

																<div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition pl-1 border-l border-border">
																	{onOpenTrackerModal && (
																		<button
																			type="button"
																			onClick={() => onOpenTrackerModal(t)}
																			className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
																			title="Edit Tracker"
																		>
																			<Pencil className="w-3.5 h-3.5" />
																		</button>
																	)}
																	<button
																		type="button"
																		onClick={() => handleDeleteTracker(t.id, t.name)}
																		className="p-1 rounded-lg text-foreground-muted hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
																		title="Delete Tracker"
																	>
																		<Trash2 className="w-3.5 h-3.5" />
																	</button>
																</div>
															</div>
														</div>
													);
												})
											)}
										</div>
									</div>
									<Link
										href="/trackers"
										className="mt-3 pt-3 border-t border-border text-xs text-foreground-muted hover:text-purple-400 flex items-center justify-between"
									>
										<span>View monthly tracker logs & settlements</span>
										<ChevronRight className="w-3.5 h-3.5" />
									</Link>
								</div>
							),
						},
						{
							id: "tasks_hub",
							title: "Tasks & Calendar Events",
							node: (
								<div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col justify-between">
									<div>
										<div className="flex items-center justify-between pb-3 border-b border-border">
											<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
												<CheckSquare className="w-4 h-4 text-blue-400" />
												<span>Tasks & Calendar Events</span>
											</h3>
											<div className="flex items-center gap-2">
												{tasks.length > 0 && (
													<button
														type="button"
														onClick={handleClearAllTasks}
														className="text-xs text-foreground-subtle hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
														title="Delete all tasks"
													>
														<Trash2 className="w-3 h-3" />
														<span>Clear All</span>
													</button>
												)}
												<button
													type="button"
													onClick={() => onOpenTaskModal()}
													className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
												>
													+ Add
												</button>
											</div>
										</div>

										<div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
											{pendingTasks.length === 0 ? (
												<div className="py-10 text-center text-xs text-foreground-muted">
													<p>No pending tasks scheduled right now.</p>
													<Button
														variant="outline"
														size="sm"
														onClick={() => onOpenTaskModal()}
														className="mt-3 text-xs"
													>
														<Plus className="w-3.5 h-3.5 mr-1" />
														<span>Add Priority Task / Event</span>
													</Button>
												</div>
											) : (
												pendingTasks.map((task) => (
													<div
														key={task.id}
														className="group flex items-center justify-between p-3 rounded-xl border border-border bg-surface-2/60 hover:border-border-strong transition"
													>
														<div className="flex items-center gap-3 min-w-0">
															<button
																type="button"
																onClick={() => handleToggleTask(task)}
																className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-transparent hover:border-emerald-400 transition cursor-pointer"
															>
																<Check className="w-3.5 h-3.5 stroke-[3]" />
															</button>
															<div className="min-w-0">
																<p className="text-xs font-semibold text-foreground truncate">
																	{task.title}
																</p>
																<p className="text-xs text-foreground-muted mt-0.5">
																	{task.category} • Priority: {task.priority}
																</p>
															</div>
														</div>

														<div className="flex items-center gap-2 shrink-0">
															{task.dueDate && (
																<div className="flex items-center gap-1 text-xs text-foreground-muted bg-surface-2 px-2 py-0.5 rounded-md border border-border">
																	<Clock className="w-3 h-3 text-emerald-400" />
																	<span>
																		{new Date(task.dueDate).toLocaleTimeString([], {
																			hour: "2-digit",
																			minute: "2-digit",
																		})}
																	</span>
																</div>
															)}

															<div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition pl-1 border-l border-border">
																<button
																	type="button"
																	onClick={() => onOpenTaskModal(task)}
																	className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
																	title="Edit Task"
																>
																	<Pencil className="w-3.5 h-3.5" />
																</button>
																<button
																	type="button"
																	onClick={() => handleDeleteTask(task.id, task.title)}
																	className="p-1 rounded-lg text-foreground-muted hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
																	title="Delete Task"
																>
																	<Trash2 className="w-3.5 h-3.5" />
																</button>
															</div>
														</div>
													</div>
												))
											)}
										</div>
									</div>
									<Link
										href="/tasks"
										className="mt-3 pt-3 border-t border-border text-xs text-foreground-muted hover:text-blue-400 flex items-center justify-between"
									>
										<span>View all tasks & calendar items</span>
										<ChevronRight className="w-3.5 h-3.5" />
									</Link>
								</div>
							),
						},
						{
							id: "finances_hub",
							title: "Recent Ledger & Transactions",
							node: (
								<div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col justify-between">
									<div>
										<div className="flex items-center justify-between pb-3 border-b border-border">
											<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
												<TrendingUp className="w-4 h-4 text-emerald-400" />
												<span>Recent Ledger & Transactions</span>
											</h3>
											<div className="flex items-center gap-2">
												{transactions.length > 0 && (
													<button
														type="button"
														onClick={handleClearAllTransactions}
														className="text-xs text-foreground-subtle hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
														title="Delete all transactions"
													>
														<Trash2 className="w-3 h-3" />
														<span>Clear All</span>
													</button>
												)}
												<button
													type="button"
													onClick={() => onOpenTransactionModal()}
													className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
												>
													+ Record
												</button>
											</div>
										</div>

										<div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
											{transactions.length === 0 ? (
												<div className="py-10 text-center text-xs text-foreground-muted">
													<p>No transactions logged yet.</p>
													<Button
														variant="outline"
														size="sm"
														onClick={() => onOpenTransactionModal()}
														className="mt-3 text-xs"
													>
														<Plus className="w-3.5 h-3.5 mr-1" />
														<span>Record First Transaction</span>
													</Button>
												</div>
											) : (
												transactions.slice(0, 8).map((tx) => {
													const isIncome = tx.type === "INCOME";
													const dateStr = new Date(tx.date).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
													});

													return (
														<div
															key={tx.id}
															className="group flex items-center justify-between p-3 rounded-xl border border-border bg-surface-2/60 hover:border-border-strong transition"
														>
															<div className="flex items-center gap-3 min-w-0 pr-2">
																<div
																	className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
																		isIncome
																			? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
																			: "bg-rose-500/10 text-rose-400 border border-rose-500/20"
																	}`}
																>
																	{isIncome ? (
																		<ArrowUpRight className="w-4 h-4" />
																	) : (
																		<ArrowDownRight className="w-4 h-4" />
																	)}
																</div>
																<div className="min-w-0">
																	<p className="text-xs font-semibold text-foreground truncate">
																		{tx.description || tx.category}
																	</p>
																	<p className="text-xs text-foreground-muted mt-0.5 truncate">
																		{dateStr} • {tx.category} • {tx.paymentMethod}
																	</p>
																</div>
															</div>

															<div className="flex items-center gap-3 shrink-0">
																<span
																	className={`text-xs font-bold tabular-nums ${
																		isIncome ? "text-emerald-400" : "text-rose-400"
																	}`}
																>
																	{isIncome ? "+" : "-"}
																	{formatCurrency(tx.amount, user?.currency || "USD")}
																</span>

																<div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition pl-1 border-l border-border">
																	<button
																		type="button"
																		onClick={() => onOpenTransactionModal(tx)}
																		className="p-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
																		title="Edit Transaction"
																	>
																		<Pencil className="w-3.5 h-3.5" />
																	</button>
																	<button
																		type="button"
																		onClick={() =>
																			handleDeleteTransaction(tx.id, tx.description || tx.category)
																		}
																		className="p-1 rounded-lg text-foreground-muted hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
																		title="Delete Transaction"
																	>
																		<Trash2 className="w-3.5 h-3.5" />
																	</button>
																</div>
															</div>
														</div>
													);
												})
											)}
										</div>
									</div>
									<Link
										href="/finances"
										className="mt-3 pt-3 border-t border-border text-xs text-foreground-muted hover:text-emerald-400 flex items-center justify-between"
									>
										<span>View full financial ledger & graphs</span>
										<ChevronRight className="w-3.5 h-3.5" />
									</Link>
								</div>
							),
						},
					]}
					getKey={(item) => item.id}
					getTitle={(item) => item.title}
					renderCard={(item) => item.node}
					storageKey="dashboard_hub"
					defaultMode="deck"
					desktopColumns={2}
					sectionLabel="Overview Hub Cards"
				/>
			)}

			{/* Restore Modals */}
			<RestoreBackupModal
				isOpen={isRestoreModalOpen}
				onClose={() => {
					setIsRestoreModalOpen(false);
					fetchData();
				}}
			/>

			<GoogleRestoreModal
				isOpen={isGoogleModalOpen}
				onClose={() => {
					setIsGoogleModalOpen(false);
					fetchData();
				}}
				onOpenFileRestore={() => {
					setIsGoogleModalOpen(false);
					setIsRestoreModalOpen(true);
				}}
			/>
		</div>
	);
}
