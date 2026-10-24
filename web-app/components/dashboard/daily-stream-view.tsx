"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
	Calculator,
	CalendarCheck,
	Check,
	Clock,
	Minus,
	Plus,
	Repeat,
	Sparkles,
} from "lucide-react";
import * as React from "react";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { useAuth } from "@/components/providers/auth-provider";
import type { RoutineItem } from "@/components/routines/routine-list";
import type { TaskItem } from "@/components/tasks/task-list";
import type { DailyTrackerItem } from "@/components/trackers/tracker-types";
import { Button } from "@/components/ui/button";
import { CardDeck } from "@/components/ui/card-deck";
import { formatCurrency } from "@/lib/currency-symbols";
import { useTodayDate } from "@/lib/date-helpers";
import { useRecentAdditions } from "@/lib/recent-activity-store";

interface DailyStreamViewProps {
	routines: RoutineItem[];
	tasks: TaskItem[];
	transactions: TransactionItem[];
	trackers: DailyTrackerItem[];
	onOpenRoutineModal: (routine?: RoutineItem | null) => void;
	onOpenTaskModal: (task?: TaskItem | null) => void;
	onOpenTransactionModal: (tx?: TransactionItem | null) => void;
	onOpenTrackerModal?: (tracker?: DailyTrackerItem | null) => void;
	onToggleRoutine: (id: string, currentlyCompleted: boolean) => Promise<void>;
	onToggleTask: (task: TaskItem) => Promise<void>;
	onAdjustTracker: (trackerId: string, delta: number) => Promise<void>;
}

type StreamFilter = "ALL" | "FINANCES" | "TASKS" | "HABITS";

interface StreamItem {
	id: string;
	streamType: "TRANSACTION" | "TASK" | "ROUTINE" | "TRACKER";
	title: string;
	subtitle?: string;
	timeLabel?: string;
	category?: string;
	amount?: number;
	isIncome?: boolean;
	priority?: string;
	isCompleted?: boolean;
	isRecurring?: boolean;
	original: TransactionItem | TaskItem | RoutineItem | DailyTrackerItem;
}

export function DailyStreamView({
	routines,
	tasks,
	transactions,
	trackers,
	onOpenRoutineModal,
	onOpenTaskModal,
	onOpenTransactionModal,
	onOpenTrackerModal,
	onToggleRoutine,
	onToggleTask,
	onAdjustTracker,
}: DailyStreamViewProps) {
	const { user } = useAuth();
	const { activeAdditionId } = useRecentAdditions();
	const [filter, setFilter] = React.useState<StreamFilter>("ALL");

	const { todayDateString: todayStr } = useTodayDate();

	// Unify today's items into stream
	const streamItems: StreamItem[] = React.useMemo(() => {
		const items: StreamItem[] = [];

		// 1. Transactions
		transactions.forEach((tx) => {
			const cleanDesc = tx.description
				? tx.description.replace(/\[Recurring:\s*[^\]]+\]/i, "").trim()
				: "";
			const timeLabel = new Date(tx.date).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			});

			items.push({
				id: tx.id,
				streamType: "TRANSACTION",
				title: cleanDesc || `${tx.category} Transaction`,
				subtitle: `${tx.paymentMethod} • ${tx.category}`,
				timeLabel,
				category: tx.category,
				amount: tx.amount,
				isIncome: tx.type === "INCOME",
				isRecurring: Boolean(tx.description?.includes("[Recurring:")),
				original: tx,
			});
		});

		// 2. Scheduled Tasks & Events
		tasks.forEach((t) => {
			const isDone = t.isRecurring ? t.lastCompletedDate === todayStr : t.status === "COMPLETED";

			let timeLabel = "Scheduled";
			if (t.repeatTime) {
				timeLabel = t.repeatTime.split(",")[0];
			} else if (t.dueDate) {
				const d = new Date(t.dueDate);
				timeLabel = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			}

			items.push({
				id: t.id,
				streamType: "TASK",
				title: t.title,
				subtitle: `${t.type === "EVENT" ? "Event" : "Task"} • ${t.category}`,
				timeLabel,
				category: t.category,
				priority: t.priority,
				isCompleted: isDone,
				isRecurring: t.isRecurring,
				original: t,
			});
		});

		// 3. Routines
		routines.forEach((r) => {
			items.push({
				id: r.id,
				streamType: "ROUTINE",
				title: r.title,
				subtitle: `${r.timeSlot.toUpperCase()} Habit • Streak: ${r.streakCount} days`,
				timeLabel: r.targetTime || r.timeSlot,
				category: r.timeSlot.toUpperCase(),
				isCompleted: r.isCompletedToday,
				original: r,
			});
		});

		// 4. Trackers
		trackers.forEach((trk) => {
			const loggedUnits = trk.todayLog?.value ?? trk.todayValue ?? 0;
			const target = trk.defaultTarget;
			const isDone = loggedUnits >= target && target > 0;

			items.push({
				id: trk.id,
				streamType: "TRACKER",
				title: trk.name,
				subtitle: `${loggedUnits} of ${target} ${trk.unitName} logged today`,
				timeLabel: `${loggedUnits}/${target} ${trk.unitName}`,
				category: trk.category,
				amount: trk.unitPrice ? trk.unitPrice * loggedUnits : undefined,
				isCompleted: isDone,
				original: trk,
			});
		});

		return items;
	}, [transactions, tasks, routines, trackers, todayStr]);

	const filteredItems = React.useMemo(() => {
		switch (filter) {
			case "FINANCES":
				return streamItems.filter((i) => i.streamType === "TRANSACTION");
			case "TASKS":
				return streamItems.filter((i) => i.streamType === "TASK");
			case "HABITS":
				return streamItems.filter((i) => i.streamType === "ROUTINE" || i.streamType === "TRACKER");
			default:
				return streamItems;
		}
	}, [streamItems, filter]);

	const totalIncome = transactions
		.filter((t) => t.type === "INCOME")
		.reduce((sum, t) => sum + t.amount, 0);

	const totalExpense = transactions
		.filter((t) => t.type === "EXPENSE")
		.reduce((sum, t) => sum + t.amount, 0);

	return (
		<div className="space-y-4">
			{/* Stream Control Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-surface shadow-card">
				<div className="flex items-center gap-1.5 rounded-xl bg-surface-sunken p-1 border border-border overflow-x-auto">
					<button
						type="button"
						onClick={() => setFilter("ALL")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							filter === "ALL"
								? "bg-surface text-foreground shadow-sm border border-border"
								: "text-foreground-muted hover:text-foreground"
						}`}
					>
						All Activity ({streamItems.length})
					</button>
					<button
						type="button"
						onClick={() => setFilter("FINANCES")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							filter === "FINANCES"
								? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
								: "text-foreground-muted hover:text-foreground"
						}`}
					>
						Finances ({transactions.length})
					</button>
					<button
						type="button"
						onClick={() => setFilter("TASKS")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							filter === "TASKS"
								? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
								: "text-foreground-muted hover:text-foreground"
						}`}
					>
						Tasks & Events ({tasks.length})
					</button>
					<button
						type="button"
						onClick={() => setFilter("HABITS")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							filter === "HABITS"
								? "bg-teal-500/15 text-teal-400 border border-teal-500/30"
								: "text-foreground-muted hover:text-foreground"
						}`}
					>
						Habits & Monitors ({routines.length + trackers.length})
					</button>
				</div>

				<div className="flex items-center gap-2 flex-wrap">
					{(totalIncome > 0 || totalExpense > 0) && (
						<div className="hidden lg:flex items-center gap-1.5 mr-2 text-xs font-semibold text-foreground-muted bg-surface-2 px-2.5 py-1 rounded-xl border border-border">
							<span className="text-emerald-400 tabular-nums">
								+{formatCurrency(totalIncome, user?.currency || "USD")}
							</span>
							<span className="text-foreground-subtle">/</span>
							<span className="text-rose-400 tabular-nums">
								-{formatCurrency(totalExpense, user?.currency || "USD")}
							</span>
						</div>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => onOpenTransactionModal()}
						className="gap-1.5 text-xs"
					>
						<Plus className="w-3.5 h-3.5 text-emerald-400" />
						<span>Record Transaction</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onOpenTaskModal()}
						className="gap-1.5 text-xs"
					>
						<Plus className="w-3.5 h-3.5 text-indigo-400" />
						<span>Log Event/Task</span>
					</Button>
				</div>
			</div>

			{/* Stream Items List with CardDeck */}
			<CardDeck
				items={filteredItems}
				getKey={(item) => `${item.streamType}-${item.id}`}
				getTitle={(item) => item.title}
				storageKey="dashboard_stream"
				defaultMode="all"
				desktopColumns={1}
				sectionLabel="Activity Stream"
				emptyState={
					<div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-card">
						<Sparkles className="w-10 h-10 text-foreground-subtle mx-auto mb-3" />
						<h4 className="text-sm font-bold text-foreground">No items recorded in this stream</h4>
						<p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto">
							Log expenses, schedule tasks, check off habits, or monitor daily meters to build your
							unified pulse.
						</p>
					</div>
				}
				renderCard={(item) => {
					const isJustAdded = activeAdditionId === item.id;

					return (
						<div
							className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
								isJustAdded
									? "ring-2 ring-teal-500/70 border-teal-500/40 bg-teal-500/10 shadow-lg shadow-teal-500/10"
									: "border-border bg-surface hover:border-border-strong shadow-card"
							}`}
						>
							{/* Left: Icon & Details */}
							<div className="flex items-center gap-3.5 min-w-0 flex-1">
								{/* Item Type Icon */}
								<div className="shrink-0">
									{item.streamType === "TRANSACTION" ? (
										<div
											className={`flex h-10 w-10 items-center justify-center rounded-xl ${
												item.isIncome
													? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
													: "bg-rose-500/10 text-rose-400 border border-rose-500/20"
											}`}
										>
											{item.isIncome ? (
												<ArrowUpRight className="w-5 h-5" />
											) : (
												<ArrowDownRight className="w-5 h-5" />
											)}
										</div>
									) : item.streamType === "TASK" ? (
										<button
											type="button"
											onClick={() => onToggleTask(item.original as TaskItem)}
											className={`flex h-10 w-10 items-center justify-center rounded-xl border transition cursor-pointer ${
												item.isCompleted
													? "bg-teal-500 border-teal-400 text-white"
													: "border-border-strong bg-surface-2 hover:border-indigo-500 text-transparent"
											}`}
										>
											<Check className="w-5 h-5 stroke-[3]" />
										</button>
									) : item.streamType === "ROUTINE" ? (
										<button
											type="button"
											onClick={() =>
												onToggleRoutine(item.id, (item.original as RoutineItem).isCompletedToday)
											}
											className={`flex h-10 w-10 items-center justify-center rounded-xl border transition cursor-pointer ${
												item.isCompleted
													? "bg-teal-500 border-teal-400 text-white"
													: "border-border-strong bg-surface-2 hover:border-amber-500 text-amber-400"
											}`}
										>
											<CalendarCheck className="w-5 h-5" />
										</button>
									) : (
										<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
											<Calculator className="w-5 h-5" />
										</div>
									)}
								</div>

								{/* Item Titles */}
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2 flex-wrap">
										{isJustAdded && (
											<span className="rounded-md bg-teal-500/20 px-2 py-0.5 text-xs font-bold text-teal-400 border border-teal-500/40 animate-pulse">
												Just Added
											</span>
										)}
										<h4
											className={`text-sm font-bold truncate ${
												item.isCompleted ? "text-foreground-muted line-through" : "text-foreground"
											}`}
										>
											{item.title}
										</h4>
										{item.category && (
											<span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-foreground-muted border border-border font-medium">
												{item.category}
											</span>
										)}
										{item.priority && (
											<span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-foreground-muted border border-border font-medium uppercase">
												{item.priority}
											</span>
										)}
										{item.isRecurring && (
											<span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-1.5 py-0.5 text-xs text-teal-400 border border-teal-500/25">
												<Repeat className="w-2.5 h-2.5" />
												<span>Recurring</span>
											</span>
										)}
									</div>
									<p className="text-xs text-foreground-muted mt-0.5 truncate">{item.subtitle}</p>
								</div>
							</div>

							{/* Right: Amounts & Quick Adjusters */}
							<div className="flex items-center gap-3 shrink-0 pl-3">
								{typeof item.amount === "number" && (
									<span
										className={`text-sm font-extrabold tabular-nums ${
											item.isIncome ? "text-emerald-400" : "text-rose-400"
										}`}
									>
										{item.isIncome ? "+" : "-"}
										{formatCurrency(item.amount, user?.currency || "USD")}
									</span>
								)}

								{/* Tracker Quick +/- buttons */}
								{item.streamType === "TRACKER" && (
									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => onAdjustTracker(item.id, -1)}
											className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground-muted hover:text-foreground hover:border-border-strong transition cursor-pointer"
										>
											<Minus className="w-3 h-3" />
										</button>
										<button
											type="button"
											onClick={() => onAdjustTracker(item.id, 1)}
											className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground-muted hover:text-foreground hover:border-border-strong transition cursor-pointer"
										>
											<Plus className="w-3 h-3" />
										</button>
									</div>
								)}

								{/* Time Label */}
								{item.timeLabel && (
									<div className="hidden sm:flex items-center gap-1 text-xs text-foreground-muted border-l border-border pl-3">
										<Clock className="w-3 h-3 text-foreground-subtle" />
										<span>{item.timeLabel}</span>
									</div>
								)}
							</div>
						</div>
					);
				}}
			/>
		</div>
	);
}
