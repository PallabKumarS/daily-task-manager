"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
	CalendarDays,
	CalendarPlus,
	CreditCard,
	Edit2,
	Repeat,
	Trash2,
} from "lucide-react";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { formatCurrency } from "@/lib/currency-symbols";
import { cn } from "@/lib/utils";

const RECURRING_TAG = /\[Recurring:\s*([^\]]+)\]/i;

export function getCleanDescription(description?: string | null): string {
	return description ? description.replace(RECURRING_TAG, "").trim() : "";
}

export function getTransactionTitle(item: TransactionItem): string {
	return getCleanDescription(item.description) || item.category;
}

function getCategoryTone(category: string): string {
	if (category === "Debt / Borrowed" || category === "Debt Repayment") {
		return "bg-amber-500/15 text-amber-400 border-amber-500/30";
	}
	if (category === "Loan Given" || category === "Loan Return") {
		return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
	}
	return "bg-surface-2 text-muted-foreground border-border";
}

interface TransactionCardProps {
	item: TransactionItem;
	currency: string;
	isJustAdded?: boolean;
	isDuplicating?: boolean;
	onEdit: (item: TransactionItem) => void;
	onDelete: (item: TransactionItem) => void;
	onDuplicate?: (item: TransactionItem) => void;
}

export function TransactionCard({
	item,
	currency,
	isJustAdded = false,
	isDuplicating = false,
	onEdit,
	onDelete,
	onDuplicate,
}: TransactionCardProps) {
	const isIncome = item.type === "INCOME";
	const recurringMatch = item.description?.match(RECURRING_TAG);
	const dateLabel = new Date(item.date).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	return (
		<article
			className={cn(
				"group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-surface shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-pop",
				isJustAdded
					? "ring-2 ring-emerald-500/70 border-emerald-500/40"
					: "border-border hover:border-border-strong",
			)}
		>
			<div
				className={cn("h-1 w-full", isIncome ? "bg-emerald-500" : "bg-rose-500")}
				aria-hidden="true"
			/>

			<div className="flex flex-1 flex-col gap-4 p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-2.5 min-w-0">
						<div
							className={cn(
								"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
								isIncome
									? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
									: "bg-rose-500/10 text-rose-400 border-rose-500/20",
							)}
						>
							{isIncome ? (
								<ArrowUpRight className="h-5 w-5" />
							) : (
								<ArrowDownRight className="h-5 w-5" />
							)}
						</div>
						<div className="min-w-0">
							<p
								className={cn(
									"text-xs font-bold uppercase tracking-wider",
									isIncome ? "text-emerald-400" : "text-rose-400",
								)}
							>
								{isIncome ? "Income" : "Expense"}
							</p>
							<p className="flex items-center gap-1 text-xs text-muted-foreground">
								<CalendarDays className="h-3 w-3 shrink-0" />
								<span className="truncate">{dateLabel}</span>
							</p>
						</div>
					</div>

					{isJustAdded && (
						<span className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-xs font-bold text-emerald-400 animate-pulse">
							Just Added
						</span>
					)}
				</div>

				<div className="min-w-0">
					<h4 className="line-clamp-2 text-sm font-bold text-foreground">
						{getTransactionTitle(item)}
					</h4>
					<p
						className={cn(
							"mt-1 text-2xl font-black tracking-tight tabular-nums",
							isIncome ? "text-emerald-400" : "text-rose-400",
						)}
					>
						{isIncome ? "+" : "-"}
						{formatCurrency(item.amount, currency)}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-1.5">
					<span
						className={cn(
							"rounded-md border px-2 py-0.5 text-xs font-medium",
							getCategoryTone(item.category),
						)}
					>
						{item.category}
					</span>
					<span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
						<CreditCard className="h-3 w-3" />
						<span>{item.paymentMethod}</span>
					</span>
					{recurringMatch && (
						<span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
							<Repeat className="h-3 w-3" />
							<span>{recurringMatch[1]}</span>
						</span>
					)}
				</div>
			</div>

			<div className="flex items-center gap-1.5 border-t border-border bg-surface-sunken/60 px-3 py-2">
				{onDuplicate && (
					<button
						type="button"
						onClick={() => onDuplicate(item)}
						disabled={isDuplicating}
						className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-40 cursor-pointer"
						title="Repeat this transaction today"
					>
						<CalendarPlus className="h-3.5 w-3.5" />
						<span>{isDuplicating ? "Adding..." : "Today"}</span>
					</button>
				)}
				<button
					type="button"
					onClick={() => onEdit(item)}
					className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface-2 hover:text-foreground cursor-pointer"
					title="Edit transaction"
				>
					<Edit2 className="h-3.5 w-3.5" />
					<span>Edit</span>
				</button>
				<button
					type="button"
					onClick={() => onDelete(item)}
					className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
					title="Delete transaction"
				>
					<Trash2 className="h-3.5 w-3.5" />
					<span>Delete</span>
				</button>
			</div>
		</article>
	);
}
