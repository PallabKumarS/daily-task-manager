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
import { formatCurrency } from "@/lib/currency-symbols";
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

	const todayStr = React.useMemo(() => new Date().toLocaleDateString("en-CA"), []);

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
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl">
				<div className="flex items-center gap-1.5 rounded-xl bg-zinc-950 p-1 border border-zinc-800">
					<button
						type="button"
						onClick={() => setFilter("ALL")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							filter === "ALL" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
						}`}
					>
						All Activity ({streamItems.length})
					</button>
					<button
						type="button"
						onClick={() => setFilter("FINANCES")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							filter === "FINANCES"
								? "bg-emerald-500/20 text-emerald-400"
								: "text-zinc-400 hover:text-white"
						}`}
					>
						Finances ({transactions.length})
					</button>
					<button
						type="button"
						onClick={() => setFilter("TASKS")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							filter === "TASKS" ? "bg-sky-500/20 text-sky-400" : "text-zinc-400 hover:text-white"
						}`}
					>
						Tasks & Events ({tasks.length})
					</button>
					<button
						type="button"
						onClick={() => setFilter("HABITS")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							filter === "HABITS"
								? "bg-purple-500/20 text-purple-400"
								: "text-zinc-400 hover:text-white"
						}`}
					>
						Habits & Monitors ({routines.length + trackers.length})
					</button>
				</div>

				<div className="flex items-center gap-2 flex-wrap">
					{(totalIncome > 0 || totalExpense > 0) && (
						<div className="hidden lg:flex items-center gap-1.5 mr-2 text-[11px] font-semibold text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800">
							<span className="text-emerald-400">
								+{formatCurrency(totalIncome, user?.currency || "USD")}
							</span>
							<span className="text-zinc-600">/</span>
							<span className="text-rose-400">
								-{formatCurrency(totalExpense, user?.currency || "USD")}
							</span>
						</div>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => onOpenTransactionModal()}
						className="gap-1.5 border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-xs"
					>
						<Plus className="w-3.5 h-3.5 text-emerald-400" />
						<span>Record Transaction</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onOpenTaskModal()}
						className="gap-1.5 border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-xs"
					>
						<Plus className="w-3.5 h-3.5 text-sky-400" />
						<span>Log Event/Task</span>
					</Button>
				</div>
			</div>

			{/* Stream Items List */}
			<div className="space-y-2.5">
				{filteredItems.length === 0 ? (
					<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
						<Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
						<h4 className="text-sm font-bold text-zinc-200">No items recorded in this stream</h4>
						<p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
							Log expenses, schedule tasks, check off habits, or monitor daily meters to build your
							unified pulse.
						</p>
					</div>
				) : (
					filteredItems.map((item) => {
						const isJustAdded = activeAdditionId === item.id;

						return (
							<div
								key={`${item.streamType}-${item.id}`}
								className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
									isJustAdded
										? "ring-2 ring-emerald-500/70 border-emerald-500/40 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
										: "border-zinc-800/80 bg-zinc-900/70 hover:border-zinc-700 shadow-sm"
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
														? "bg-emerald-500 border-emerald-400 text-zinc-950"
														: "border-zinc-700 bg-zinc-950/80 hover:border-sky-500 text-transparent"
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
														? "bg-emerald-500 border-emerald-400 text-zinc-950"
														: "border-zinc-700 bg-zinc-950/80 hover:border-amber-500 text-amber-400"
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
												<span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40 animate-pulse">
													Just Added
												</span>
											)}
											<h4
												className={`text-sm font-bold truncate ${
													item.isCompleted ? "text-zinc-400 line-through" : "text-white"
												}`}
											>
												{item.title}
											</h4>
											{item.category && (
												<span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-700/60 font-medium">
													{item.category}
												</span>
											)}
											{item.priority && (
												<span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-700/60 font-medium uppercase">
													{item.priority}
												</span>
											)}
											{item.isRecurring && (
												<span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-1.5 py-0.5 text-[10px] text-teal-400 border border-teal-500/25">
													<Repeat className="w-2.5 h-2.5" />
													<span>Recurring</span>
												</span>
											)}
										</div>
										<p className="text-xs text-zinc-400 mt-0.5 truncate">{item.subtitle}</p>
									</div>
								</div>

								{/* Right: Amounts & Quick Adjusters */}
								<div className="flex items-center gap-3 shrink-0 pl-3">
									{typeof item.amount === "number" && (
										<span
											className={`text-sm font-extrabold ${
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
												className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 transition cursor-pointer"
											>
												<Minus className="w-3 h-3" />
											</button>
											<button
												type="button"
												onClick={() => onAdjustTracker(item.id, 1)}
												className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 transition cursor-pointer"
											>
												<Plus className="w-3 h-3" />
											</button>
										</div>
									)}

									{/* Time Label */}
									{item.timeLabel && (
										<div className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400 border-l border-zinc-800 pl-3">
											<Clock className="w-3 h-3 text-zinc-500" />
											<span>{item.timeLabel}</span>
										</div>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
