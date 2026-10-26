"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
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
	const dateObj = new Date(item.date);
	const dateLabel = dateObj.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
	const fullDateLabel = dateObj.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
	const title = getTransactionTitle(item);
	const formattedAmount = `${isIncome ? "+" : "-"}${formatCurrency(item.amount, currency)}`;

	return (
		<article
			className={cn(
				"group relative flex items-stretch overflow-hidden rounded-xl border bg-surface transition-all duration-200 hover:border-border-strong w-full gap-1",
				isJustAdded ? "ring-1 ring-emerald-500/70 border-emerald-500/40" : "border-border",
			)}
			title={`${title} • ${formattedAmount} • ${fullDateLabel}`}
		>
			{/* Left accent border */}
			<div
				className={cn("w-1 shrink-0", isIncome ? "bg-emerald-500" : "bg-rose-500")}
				aria-hidden="true"
			/>

			{/* Main Content Area */}
			<div className="flex-1 p-2 flex flex-col justify-between gap-1">
				{/* Header: Icon, Type, and Date directly below */}
				<div className="flex items-center gap-1.5 min-w-0">
					<div
						className={cn(
							"flex h-5 w-5 shrink-0 items-center justify-center rounded border",
							isIncome
								? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
								: "bg-rose-500/10 text-rose-400 border-rose-500/20",
						)}
						title={isIncome ? "Income" : "Expense"}
					>
						{isIncome ? (
							<ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
						) : (
							<ArrowDownRight className="h-3 w-3 stroke-[2.5]" />
						)}
					</div>

					<div className="min-w-0 flex flex-col">
						<span
							className={cn(
								"text-[9px] font-bold uppercase tracking-wider leading-none",
								isIncome ? "text-emerald-400" : "text-rose-400",
							)}
						>
							{isIncome ? "Income" : "Expense"}
						</span>
						<span
							className="text-[9px] text-muted-foreground truncate leading-tight mt-0.5"
							title={fullDateLabel}
						>
							{dateLabel}
						</span>
					</div>
				</div>

				{/* Title & Amount */}
				<div className="min-w-0">
					<h4 className="text-xs font-bold text-foreground truncate" title={title}>
						{title}
					</h4>
					<p
						className={cn(
							"text-sm font-extrabold tracking-tight tabular-nums mt-0.5",
							isIncome ? "text-emerald-400" : "text-rose-400",
						)}
						title={`Amount: ${formattedAmount}`}
					>
						{formattedAmount}
					</p>
				</div>

				{/* Metadata Badges */}
				<div className="flex items-center gap-0.5 pt-0.5 overflow-hidden">
					<span
						className={cn(
							"rounded px-1 py-0.2 text-[8.5px] font-medium border truncate max-w-17.5",
							getCategoryTone(item.category),
						)}
						title={`Category: ${item.category}`}
					>
						{item.category}
					</span>
					<span
						className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-2 px-1 py-0.2 text-[8.5px] text-muted-foreground truncate max-w-13.75"
						title={`Payment method: ${item.paymentMethod}`}
					>
						<CreditCard className="h-2.5 w-2.5 shrink-0" />
						<span className="truncate">{item.paymentMethod}</span>
					</span>
					{recurringMatch && (
						<span
							className="inline-flex items-center gap-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-1 py-0.2 text-[8.5px] text-emerald-400"
							title={`Recurring: ${recurringMatch[1]}`}
						>
							<Repeat className="h-2 w-2" />
							<span>{recurringMatch[1]}</span>
						</span>
					)}
				</div>
			</div>

			{/* Right Column: Actions in a single vertical column */}
			<div className="flex flex-col justify-around items-center border-l border-border bg-surface-2/40 px-0.5 py-1 shrink-0 w-8 self-stretch">
				{onDuplicate && (
					<button
						type="button"
						onClick={() => onDuplicate(item)}
						disabled={isDuplicating}
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-emerald-500/15 hover:text-emerald-400 disabled:opacity-40 cursor-pointer transition"
						title="Repeat this transaction today"
					>
						<CalendarPlus className="h-3 w-3" />
					</button>
				)}
				<button
					type="button"
					onClick={() => onEdit(item)}
					className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground cursor-pointer transition"
					title="Edit transaction details"
				>
					<Edit2 className="h-3 w-3" />
				</button>
				<button
					type="button"
					onClick={() => onDelete(item)}
					className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer transition"
					title="Delete transaction"
				>
					<Trash2 className="h-3 w-3" />
				</button>
			</div>
		</article>
	);
}
