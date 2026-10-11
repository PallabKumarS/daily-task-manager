"use client";

import { Kanban, List, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { MonthTimelineView } from "@/components/finances/timeline/month-timeline-view";
import { WeekTimelineView } from "@/components/finances/timeline/week-timeline-view";
import { YearTimelineView } from "@/components/finances/timeline/year-timeline-view";
import { type TransactionItem, TransactionList } from "@/components/finances/transaction-list";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import type { StartOfWeekDay } from "@/lib/workweek-preferences";

interface TransactionTimelineViewProps {
	period: "week" | "month" | "year";
	currentDate: Date;
	transactions: TransactionItem[];
	currency: string;
	startOfWeek: StartOfWeekDay;
	onEdit: (transaction: TransactionItem) => void;
	onAddNew: (dateString?: string) => void;
	onPrev: () => void;
	onNext: () => void;
	onResetToday: () => void;
	onSelectMonth: (monthIndex: number) => void;
	onRefresh: () => void;
}

export function TransactionTimelineView({
	period,
	currentDate,
	transactions,
	currency,
	startOfWeek,
	onEdit,
	onAddNew,
	onPrev,
	onNext,
	onResetToday,
	onSelectMonth,
	onRefresh,
}: TransactionTimelineViewProps) {
	const confirm = useConfirm();
	const [viewMode, setViewMode] = React.useState<"TIMELINE" | "LIST">("TIMELINE");

	const handleDelete = async (id: string, desc: string) => {
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
				onRefresh();
			} else {
				toast.error(res.message || "Failed to delete transaction");
			}
		} catch {
			toast.error("Network error while deleting transaction");
		}
	};

	const handleClearAll = async () => {
		const ok = await confirm({
			title: "Delete All Transactions",
			description:
				"Are you sure you want to delete all transaction records for this period? This action cannot be undone.",
			confirmText: "Delete All",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete("/finances");
			if (res.success) {
				toast.success("All transactions deleted");
				onRefresh();
			} else {
				toast.error(res.message || "Failed to delete transactions");
			}
		} catch {
			toast.error("Network error while deleting transactions");
		}
	};

	return (
		<div className="space-y-4">
			{/* View Toggle Bar (Timeline vs Itemized List) */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl">
				<div>
					<h3 className="text-sm font-bold text-white">
						{viewMode === "TIMELINE"
							? period === "week"
								? "Weekly Column Timeline (Day by Day)"
								: period === "month"
									? "Monthly 30-Day Horizontal Flow"
									: "Annual 12-Month Performance"
							: "Itemized Transaction Ledger"}
					</h3>
					<p className="text-xs text-zinc-400 mt-0.5">
						{viewMode === "TIMELINE"
							? "Structured temporal flow with daily and monthly totals"
							: `Flat itemized ledger entries (${transactions.length} total)`}
					</p>
				</div>

				<div className="flex items-center gap-2 self-start sm:self-auto">
					{transactions.length > 0 && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleClearAll}
							className="h-8 gap-1.5 border-rose-900/40 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 hover:border-rose-800 text-xs px-2.5"
						>
							<Trash2 className="w-3.5 h-3.5" />
							<span>Clear All</span>
						</Button>
					)}

					<div className="flex items-center rounded-xl bg-zinc-950 p-1 border border-zinc-800">
						<button
							type="button"
							onClick={() => setViewMode("TIMELINE")}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
								viewMode === "TIMELINE"
									? "bg-zinc-800 text-white shadow-sm"
									: "text-zinc-400 hover:text-white"
							}`}
						>
							<Kanban className="w-3.5 h-3.5 text-emerald-400" />
							<span>Timeline Board</span>
						</button>
						<button
							type="button"
							onClick={() => setViewMode("LIST")}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
								viewMode === "LIST"
									? "bg-zinc-800 text-white shadow-sm"
									: "text-zinc-400 hover:text-white"
							}`}
						>
							<List className="w-3.5 h-3.5 text-zinc-400" />
							<span>Itemized List</span>
						</button>
					</div>
				</div>
			</div>

			{/* Render active view */}
			{viewMode === "LIST" ? (
				<TransactionList
					transactions={transactions}
					currency={currency}
					onEdit={onEdit}
					onRefresh={onRefresh}
				/>
			) : period === "week" ? (
				<WeekTimelineView
					currentDate={currentDate}
					transactions={transactions}
					currency={currency}
					startOfWeek={startOfWeek}
					onEdit={onEdit}
					onDelete={handleDelete}
					onAddNew={(dateStr) => onAddNew(dateStr)}
					onPrevWeek={onPrev}
					onNextWeek={onNext}
					onResetToday={onResetToday}
				/>
			) : period === "month" ? (
				<MonthTimelineView
					currentDate={currentDate}
					transactions={transactions}
					currency={currency}
					onEdit={onEdit}
					onDelete={handleDelete}
					onAddNew={(dateStr) => onAddNew(dateStr)}
				/>
			) : (
				<YearTimelineView
					currentDate={currentDate}
					transactions={transactions}
					currency={currency}
					onSelectMonth={onSelectMonth}
				/>
			)}
		</div>
	);
}
