"use client";

import { CalendarDays, Kanban } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { MonthTimelineView } from "@/components/finances/timeline/month-timeline-view";
import { WeekTimelineView } from "@/components/finances/timeline/week-timeline-view";
import { YearTimelineView } from "@/components/finances/timeline/year-timeline-view";
import { type TransactionItem, TransactionList } from "@/components/finances/transaction-list";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
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
	onSelectDate?: (date: Date) => void;
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
	onSelectDate,
}: TransactionTimelineViewProps) {
	const confirm = useConfirm();
	const [viewMode, setViewMode] = React.useState<"TIMELINE" | "DAY">("DAY");
	const [filterType, setFilterType] = React.useState<"ALL" | "EXPENSE" | "INCOME">("ALL");

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

	return (
		<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-4">
			{/* Combined Unified Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div>
					<h3 className="text-sm sm:text-base font-bold text-foreground">Transaction History</h3>
					<p className="text-[11px] text-muted-foreground mt-0.5">
						{viewMode === "TIMELINE"
							? "Temporal flow and daily financial totals"
							: `Itemized ledger entries (${transactions.length} total)`}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
					{/* View Switcher: Timeline Board vs Day View */}
					<div className="flex items-center rounded-xl bg-surface-sunken p-1 border border-border">
						<button
							type="button"
							onClick={() => setViewMode("TIMELINE")}
							title="Switch to timeline board view"
							className={cn(
								"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
								viewMode === "TIMELINE"
									? "bg-surface-2 text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Kanban className="w-3.5 h-3.5 text-teal-400" />
							<span>Timeline Board</span>
						</button>
						<button
							type="button"
							onClick={() => setViewMode("DAY")}
							title="Switch to day view"
							className={cn(
								"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
								viewMode === "DAY"
									? "bg-surface-2 text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<CalendarDays className="w-3.5 h-3.5 text-teal-400" />
							<span>Day View</span>
						</button>
					</div>

					{/* Filter Tabs (when in Day View) */}
					{viewMode === "DAY" && (
						<div className="flex items-center gap-1 rounded-xl bg-surface-sunken p-1 border border-border">
							<button
								type="button"
								onClick={() => setFilterType("ALL")}
								title="Show all transactions"
								className={cn(
									"px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer",
									filterType === "ALL"
										? "bg-surface text-foreground shadow-sm border border-border"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								All
							</button>
							<button
								type="button"
								onClick={() => setFilterType("EXPENSE")}
								title="Show expenses only"
								className={cn(
									"px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer",
									filterType === "EXPENSE"
										? "bg-rose-500/20 text-rose-400"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Expenses
							</button>
							<button
								type="button"
								onClick={() => setFilterType("INCOME")}
								title="Show income only"
								className={cn(
									"px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer",
									filterType === "INCOME"
										? "bg-emerald-500/20 text-emerald-400"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Income
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Render active view */}
			{viewMode === "DAY" ? (
				<TransactionList
					transactions={transactions}
					currency={currency}
					currentDate={currentDate}
					filterType={filterType}
					onEdit={onEdit}
					onRefresh={onRefresh}
					onPrevPeriod={onPrev}
					onNextPeriod={onNext}
					onSelectDate={onSelectDate}
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
