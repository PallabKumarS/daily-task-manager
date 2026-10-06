"use client";

import confetti from "canvas-confetti";
import { Bell, Calendar, Check, Clock, Edit2, Plus, Repeat, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";

export interface TaskItem {
	id: string;
	title: string;
	description?: string | null;
	type: "TASK" | "EVENT";
	category: string;
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
	startDate?: string | null;
	dueDate?: string | null;
	remindBeforeMinutes: number;
	isRecurring?: boolean;
	repeatFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
	repeatInterval?: number;
	repeatDaysOfWeek?: string | null;
	repeatTime?: string | null;
	repeatDayOfMonth?: number | null;
	repeatMonthOfYear?: number | null;
	repeatEndType?: "NEVER" | "COUNT" | "UNTIL_DATE" | null;
	repeatCount?: number | null;
	completedOccurrences?: number;
	repeatUntil?: string | null;
	lastTriggeredDate?: string | null;
	lastCompletedDate?: string | null;
}

interface TaskListProps {
	tasks: TaskItem[];
	onToggleStatus: (task: TaskItem) => Promise<void>;
	onEdit: (task: TaskItem) => void;
	onRefresh: () => void;
	onAddNew: () => void;
}

const formatRecurrenceSchedule = (item: TaskItem): string => {
	if (!item.isRecurring) return "";
	const freq = item.repeatFrequency || "DAILY";
	const interval =
		item.repeatInterval && item.repeatInterval > 1 ? `Every ${item.repeatInterval} ` : "";
	const time = item.repeatTime ? ` at ${item.repeatTime.split(",").join(", ")}` : "";

	if (freq === "DAILY") {
		if (item.repeatDaysOfWeek && item.repeatDaysOfWeek !== "0,1,2,3,4,5,6") {
			const dayMap: Record<string, string> = {
				"0": "Sun",
				"1": "Mon",
				"2": "Tue",
				"3": "Wed",
				"4": "Thu",
				"5": "Fri",
				"6": "Sat",
			};
			const days = item.repeatDaysOfWeek
				.split(",")
				.map((d) => dayMap[d.trim()] || d)
				.join(", ");
			return `${interval ? `${interval}days` : "Daily"} (${days})${time}`;
		}
		return `${interval ? `${interval}days` : "Daily"}${time}`;
	}

	if (freq === "WEEKLY") {
		const dayMap: Record<string, string> = {
			"0": "Sun",
			"1": "Mon",
			"2": "Tue",
			"3": "Wed",
			"4": "Thu",
			"5": "Fri",
			"6": "Sat",
		};
		const days = (item.repeatDaysOfWeek || "1")
			.split(",")
			.map((d) => dayMap[d.trim()] || d)
			.join(", ");
		return `${interval ? `${interval}weeks on ` : "Weekly on "}${days}${time}`;
	}

	if (freq === "MONTHLY") {
		return `${interval ? `${interval}months` : "Monthly"} on day ${item.repeatDayOfMonth || 1}${time}`;
	}

	if (freq === "YEARLY") {
		return `${interval ? `${interval}years` : "Yearly"}${time}`;
	}

	return "Recurring";
};

export function TaskList({ tasks, onToggleStatus, onEdit, onRefresh, onAddNew }: TaskListProps) {
	const confirm = useConfirm();
	const [filterType, setFilterType] = React.useState<"ALL" | "TASK" | "EVENT" | "RECURRING">("ALL");
	const [filterStatus, setFilterStatus] = React.useState<"ALL" | "PENDING" | "COMPLETED">("ALL");

	const handleDelete = async (id: string) => {
		const ok = await confirm({
			title: "Delete Item",
			description:
				"Are you sure you want to delete this scheduled item? This action cannot be undone.",
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;
		try {
			const res = await api.delete(`/tasks/${id}`);
			if (res.success) {
				toast.success("Item deleted");
				onRefresh();
			} else {
				toast.error(res.message || "Failed to delete");
			}
		} catch {
			toast.error("Network error while deleting");
		}
	};

	const todayStr = React.useMemo(() => new Date().toLocaleDateString("en-CA"), []);

	const handleToggle = async (item: TaskItem) => {
		const isCurrentlyCompleted = item.isRecurring
			? item.lastCompletedDate === todayStr
			: item.status === "COMPLETED";

		if (!isCurrentlyCompleted) {
			try {
				confetti({
					particleCount: 40,
					spread: 50,
					origin: { y: 0.8 },
					colors: ["#10b981", "#3b82f6", "#f59e0b"],
				});
			} catch {
				// ignore
			}
		}
		await onToggleStatus(item);
	};

	const filtered = tasks.filter((t) => {
		if (filterType === "RECURRING" && !t.isRecurring) return false;
		if (filterType !== "ALL" && filterType !== "RECURRING" && t.type !== filterType) return false;

		const isItemDone = t.isRecurring ? t.lastCompletedDate === todayStr : t.status === "COMPLETED";

		if (filterStatus === "PENDING" && isItemDone) return false;
		if (filterStatus === "COMPLETED" && !isItemDone) return false;
		return true;
	});

	const getPriorityBadge = (priority: TaskItem["priority"]) => {
		switch (priority) {
			case "URGENT":
				return <Badge variant="destructive">Urgent</Badge>;
			case "HIGH":
				return <Badge variant="warning">High</Badge>;
			case "LOW":
				return <Badge variant="secondary">Low</Badge>;
			default:
				return <Badge variant="default">Medium</Badge>;
		}
	};

	const formatDue = (dateStr?: string | null) => {
		if (!dateStr) return null;
		const d = new Date(dateStr);
		if (Number.isNaN(d.getTime())) return null;

		const now = new Date();
		const isOverdue = d.getTime() < now.getTime();

		const formatted = d.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});

		return { text: formatted, isOverdue };
	};

	const handleClearAll = async () => {
		const ok = await confirm({
			title: "Delete All Items",
			description:
				"Are you sure you want to delete all scheduled tasks and events? This action cannot be undone.",
			confirmText: "Delete All",
			variant: "destructive",
		});
		if (!ok) return;
		try {
			const res = await api.delete("/tasks");
			if (res.success) {
				toast.success("All scheduled items deleted");
				onRefresh();
			} else {
				toast.error(res.message || "Failed to delete items");
			}
		} catch {
			toast.error("Network error while deleting");
		}
	};

	return (
		<div className="space-y-4">
			{/* Filter and Action Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
				<div className="flex flex-wrap items-center gap-2">
					{/* Type filters */}
					<div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
						<button
							type="button"
							onClick={() => setFilterType("ALL")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterType === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
							}`}
						>
							All Items
						</button>
						<button
							type="button"
							onClick={() => setFilterType("TASK")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterType === "TASK"
									? "bg-emerald-500/20 text-emerald-400"
									: "text-slate-400 hover:text-white"
							}`}
						>
							Tasks
						</button>
						<button
							type="button"
							onClick={() => setFilterType("EVENT")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterType === "EVENT"
									? "bg-amber-500/20 text-amber-400"
									: "text-slate-400 hover:text-white"
							}`}
						>
							Events
						</button>
						<button
							type="button"
							onClick={() => setFilterType("RECURRING")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
								filterType === "RECURRING"
									? "bg-teal-500/20 text-teal-400"
									: "text-slate-400 hover:text-white"
							}`}
						>
							<Repeat className="w-3 h-3" />
							<span>Recurring</span>
						</button>
					</div>

					{/* Status filters */}
					<div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
						<button
							type="button"
							onClick={() => setFilterStatus("ALL")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterStatus === "ALL"
									? "bg-slate-800 text-white"
									: "text-slate-400 hover:text-white"
							}`}
						>
							All Status
						</button>
						<button
							type="button"
							onClick={() => setFilterStatus("PENDING")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterStatus === "PENDING"
									? "bg-emerald-500/20 text-emerald-400"
									: "text-slate-400 hover:text-white"
							}`}
						>
							Pending
						</button>
						<button
							type="button"
							onClick={() => setFilterStatus("COMPLETED")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterStatus === "COMPLETED"
									? "bg-slate-800 text-white"
									: "text-slate-400 hover:text-white"
							}`}
						>
							Completed
						</button>
					</div>
				</div>

				<div className="flex items-center gap-2 self-start sm:self-center">
					{tasks.length > 0 && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleClearAll}
							className="gap-1.5 border-rose-900/40 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 hover:border-rose-800"
						>
							<Trash2 className="w-4 h-4" />
							<span>Clear All</span>
						</Button>
					)}
					<Button variant="emerald" size="sm" onClick={onAddNew} className="gap-1.5">
						<Plus className="w-4 h-4" />
						<span>New Item</span>
					</Button>
				</div>
			</div>

			{/* Task List */}
			<div className="space-y-2.5">
				{filtered.length === 0 ? (
					<div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
						<Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
						<h4 className="text-sm font-bold text-slate-200">No scheduled tasks or events</h4>
						<p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
							Plan your day with precision. Add due dates to receive audio chimes and native system
							reminders.
						</p>
						<Button variant="emerald" size="sm" onClick={onAddNew} className="mt-4 gap-1.5">
							<Plus className="w-4 h-4" />
							<span>Create Task or Event</span>
						</Button>
					</div>
				) : (
					filtered.map((item) => {
						const isCompleted = item.isRecurring
							? item.lastCompletedDate === todayStr
							: item.status === "COMPLETED";
						const dueInfo = formatDue(item.dueDate);

						return (
							<div
								key={item.id}
								className={`flex items-start justify-between p-4 rounded-2xl border transition-all ${
									isCompleted
										? "border-slate-800/40 bg-slate-900/30 opacity-70"
										: "border-slate-800 bg-slate-900/70 hover:border-slate-700 shadow-sm"
								}`}
							>
								<div className="flex items-start gap-3 min-w-0 flex-1">
									<button
										type="button"
										onClick={() => handleToggle(item)}
										className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer ${
											isCompleted
												? "bg-emerald-500 border-emerald-400 text-slate-950"
												: "border-slate-700 bg-slate-950 hover:border-emerald-500 text-transparent"
										}`}
									>
										<Check className="w-4 h-4 stroke-[3]" />
									</button>

									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<h4
												className={`text-sm font-semibold truncate ${
													isCompleted && !item.isRecurring
														? "text-slate-400 line-through"
														: "text-slate-100"
												}`}
											>
												{item.title}
											</h4>
											<span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 border border-slate-700/60 font-medium">
												{item.category}
											</span>
											{getPriorityBadge(item.priority)}
											{item.type === "EVENT" && (
												<span className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold">
													Event
												</span>
											)}
											{item.isRecurring && (
												<span
													className={`rounded-md px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 border ${
														isCompleted
															? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
															: "bg-teal-500/15 text-teal-300 border-teal-500/30"
													}`}
												>
													{isCompleted ? (
														<>
															<Check className="w-3 h-3 text-emerald-400" />
															<span>Done for Today • Next alarm tomorrow</span>
														</>
													) : (
														<>
															<Repeat className="w-3 h-3 text-teal-400" />
															<span>{formatRecurrenceSchedule(item)}</span>
														</>
													)}
												</span>
											)}
										</div>

										{item.description && (
											<p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
										)}

										<div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-slate-400">
											{dueInfo && !item.isRecurring && (
												<div
													className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
														!isCompleted && dueInfo.isOverdue
															? "bg-red-500/10 text-red-400 border border-red-500/20"
															: "bg-slate-800 text-slate-300"
													}`}
												>
													<Clock className="w-3 h-3" />
													<span>
														{dueInfo.text} {!isCompleted && dueInfo.isOverdue && "(Overdue)"}
													</span>
												</div>
											)}

											{item.isRecurring && item.repeatTime && (
												<div className="flex items-center gap-1 text-teal-300 bg-teal-500/10 border border-teal-500/20 rounded-md px-2 py-0.5 font-medium">
													<Clock className="w-3 h-3 text-teal-400" />
													<span>
														{isCompleted
															? `Alert times: ${item.repeatTime} (Resets tomorrow)`
															: `Alert times: ${item.repeatTime}`}
													</span>
												</div>
											)}

											{item.remindBeforeMinutes > 0 ? (
												<div className="flex items-center gap-1 text-slate-400">
													<Bell className="w-3 h-3 text-emerald-400" />
													<span>{item.remindBeforeMinutes}m reminder</span>
												</div>
											) : (
												<div className="flex items-center gap-1 text-slate-400">
													<Bell className="w-3 h-3 text-emerald-400" />
													<span>Exact time chime</span>
												</div>
											)}
										</div>
									</div>
								</div>

								<div className="flex items-center gap-1 ml-3 shrink-0">
									<button
										type="button"
										onClick={() => onEdit(item)}
										className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
										title="Edit"
									>
										<Edit2 className="w-3.5 h-3.5" />
									</button>
									<button
										type="button"
										onClick={() => handleDelete(item.id)}
										className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
										title="Delete"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
