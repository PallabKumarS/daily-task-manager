"use client";

import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Edit2,
	HandCoins,
	Receipt,
	Trash2,
	WalletCards,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/currency-symbols";
import type { DebtLoanItem, DebtLoanRepaymentItem } from "./types";

interface DebtLoanCardProps {
	item: DebtLoanItem;
	currency: string;
	onEdit: (item: DebtLoanItem) => void;
	onDelete: (id: string, personName: string) => void;
	onRepay: (item: DebtLoanItem) => void;
	onDeleteRepayment: (debtLoanId: string, repaymentId: string) => void;
}

export function DebtLoanCard({
	item,
	currency,
	onEdit,
	onDelete,
	onRepay,
	onDeleteRepayment,
}: DebtLoanCardProps) {
	const confirm = useConfirm();
	const [expandedHistory, setExpandedHistory] = React.useState(false);

	const isDebt = item.type === "DEBT";
	const isSettled = item.status === "SETTLED" || item.remainingAmount <= 0;

	const percentPaid = Math.min(
		100,
		Math.max(0, Math.round((item.paidAmount / (item.amount || 1)) * 100)),
	);

	const isOverdue = React.useMemo(() => {
		if (isSettled || !item.dueDate) return false;
		const due = new Date(item.dueDate);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return due < today;
	}, [isSettled, item.dueDate]);

	const formattedDate = React.useMemo(() => {
		return new Date(item.date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}, [item.date]);

	const formattedDueDate = React.useMemo(() => {
		if (!item.dueDate) return null;
		return new Date(item.dueDate).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}, [item.dueDate]);

	const handleDeleteRepaymentPrompt = async (rep: DebtLoanRepaymentItem) => {
		const ok = await confirm({
			title: "Reverse Repayment",
			description: `Revert repayment of ${formatCurrency(rep.amount, currency)} recorded on ${new Date(rep.date).toLocaleDateString()}? The linked ledger transaction will also be removed.`,
			confirmText: "Reverse Payment",
			variant: "destructive",
		});
		if (ok) {
			onDeleteRepayment(item.id, rep.id);
		}
	};

	return (
		<div
			className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between ${
				isSettled
					? "border-slate-800 bg-slate-900/40 opacity-80 hover:opacity-100"
					: isOverdue
						? "border-rose-500/40 bg-gradient-to-br from-slate-900/90 to-rose-950/20 shadow-md shadow-rose-950/20"
						: isDebt
							? "border-amber-500/30 bg-gradient-to-br from-slate-900/90 to-amber-950/20"
							: "border-emerald-500/30 bg-gradient-to-br from-slate-900/90 to-emerald-950/20"
			}`}
		>
			<div className="space-y-3.5">
				{/* Top Row: Counterparty & Badges */}
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2.5 min-w-0">
						<div
							className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
								isDebt
									? "bg-amber-500/10 border-amber-500/30 text-amber-400"
									: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
							}`}
						>
							{isDebt ? <WalletCards className="w-4 h-4" /> : <HandCoins className="w-4 h-4" />}
						</div>

						<div className="min-w-0">
							<h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
								<span>{item.personName}</span>
							</h4>
							<p className="text-[11px] text-slate-400 truncate">
								{isDebt ? "Borrowed from" : "Lent to"}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
						<span
							className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
								isDebt
									? "bg-amber-500/10 border-amber-500/30 text-amber-300"
									: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
							}`}
						>
							{isDebt ? "I Owe (Debt)" : "Owed to Me (Loan)"}
						</span>

						{isSettled ? (
							<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
								<CheckCircle2 className="w-3 h-3" />
								<span>Settled</span>
							</span>
						) : isOverdue ? (
							<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
								<AlertCircle className="w-3 h-3" />
								<span>Overdue</span>
							</span>
						) : null}
					</div>
				</div>

				{/* Financial Balance Summary */}
				<div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
					<div className="flex items-baseline justify-between">
						<div>
							<div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
								{isSettled ? "Settled Total" : "Remaining Balance"}
							</div>
							<div
								className={`text-xl font-extrabold ${
									isSettled
										? "text-slate-300 line-through decoration-slate-500"
										: isDebt
											? "text-amber-300"
											: "text-emerald-300"
								}`}
							>
								{formatCurrency(isSettled ? item.amount : item.remainingAmount, currency)}
							</div>
						</div>

						<div className="text-right">
							<div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
								Total Principal
							</div>
							<div className="text-xs font-bold text-slate-300">
								{formatCurrency(item.amount, currency)}
							</div>
						</div>
					</div>

					{/* Progress Bar */}
					<div className="space-y-1">
						<div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
							<div
								className={`h-full transition-all duration-300 ${
									isSettled ? "bg-emerald-400" : isDebt ? "bg-amber-400" : "bg-emerald-400"
								}`}
								style={{ width: `${percentPaid}%` }}
							/>
						</div>
						<div className="flex items-center justify-between text-[10px] text-slate-400">
							<span>{percentPaid}% repaid</span>
							<span>{formatCurrency(item.paidAmount, currency)} paid</span>
						</div>
					</div>
				</div>

				{/* Description / Notes */}
				{item.description && (
					<p className="text-xs text-slate-300 italic bg-slate-900/50 p-2 rounded-lg border border-slate-800/60">
						"{item.description}"
					</p>
				)}

				{/* Dates */}
				<div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
					<div className="flex items-center gap-1">
						<Calendar className="w-3 h-3 text-slate-500" />
						<span>Issued: {formattedDate}</span>
					</div>

					{formattedDueDate && (
						<div
							className={`flex items-center gap-1 ${
								isOverdue ? "text-rose-400 font-semibold" : "text-slate-400"
							}`}
						>
							<span>Due: {formattedDueDate}</span>
						</div>
					)}
				</div>

				{/* Repayments History Accordion */}
				{item.repayments && item.repayments.length > 0 && (
					<div className="pt-1">
						<button
							type="button"
							onClick={() => setExpandedHistory(!expandedHistory)}
							className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center justify-between w-full py-1 cursor-pointer"
						>
							<span className="flex items-center gap-1.5">
								<Receipt className="w-3 h-3 text-emerald-400" />
								<span>Repayment History ({item.repayments.length})</span>
							</span>
							{expandedHistory ? (
								<ChevronUp className="w-3.5 h-3.5" />
							) : (
								<ChevronDown className="w-3.5 h-3.5" />
							)}
						</button>

						{expandedHistory && (
							<div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1 divide-y divide-slate-800/60">
								{item.repayments.map((rep) => (
									<div
										key={rep.id}
										className="flex items-center justify-between py-1.5 text-[11px] text-slate-300"
									>
										<div>
											<span className="font-semibold text-white">
												{formatCurrency(rep.amount, currency)}
											</span>
											<span className="text-slate-500 ml-1.5">
												• {new Date(rep.date).toLocaleDateString()} ({rep.paymentMethod})
											</span>
											{rep.notes && (
												<div className="text-[10px] text-slate-400 italic">{rep.notes}</div>
											)}
										</div>

										<button
											type="button"
											onClick={() => handleDeleteRepaymentPrompt(rep)}
											className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
											title="Reverse repayment"
										>
											<Trash2 className="w-3 h-3" />
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Card Bottom Actions */}
			<div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-slate-800/80">
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onEdit(item)}
						className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
						title="Edit"
					>
						<Edit2 className="w-3.5 h-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onDelete(item.id, item.personName)}
						className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
						title="Delete record & linked transactions"
					>
						<Trash2 className="w-3.5 h-3.5" />
					</Button>
				</div>

				{!isSettled && (
					<Button
						size="sm"
						variant={isDebt ? "default" : "emerald"}
						onClick={() => onRepay(item)}
						className={`h-8 text-xs font-semibold px-3 ${
							isDebt
								? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
								: "bg-emerald-600 hover:bg-emerald-500 text-white"
						}`}
					>
						{isDebt ? "Repay Debt" : "Record Return"}
					</Button>
				)}
			</div>
		</div>
	);
}
