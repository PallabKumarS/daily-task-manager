"use client";

import { ArrowDownRight, ArrowUpRight, CalendarPlus, Edit2, Repeat, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardDeck } from "@/components/ui/card-deck";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";
import { useRecentAdditions } from "@/lib/recent-activity-store";

export interface TransactionItem {
	id: string;
	type: "EXPENSE" | "INCOME";
	amount: number;
	category: string;
	description?: string | null;
	paymentMethod: string;
	date: string;
}

interface TransactionListProps {
	transactions: TransactionItem[];
	currency: string;
	onEdit: (transaction: TransactionItem) => void;
	onRefresh: () => void;
}

export function TransactionList({
	transactions,
	currency,
	onEdit,
	onRefresh,
}: TransactionListProps) {
	const confirm = useConfirm();
	const { activeAdditionId } = useRecentAdditions();
	const [filterType, setFilterType] = React.useState<"ALL" | "EXPENSE" | "INCOME">("ALL");
	const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);

	const handleDelete = async (id: string) => {
		const ok = await confirm({
			title: "Delete Transaction",
			description:
				"Are you sure you want to delete this transaction record? This action cannot be undone.",
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
				toast.error(res.message || "Failed to delete");
			}
		} catch {
			toast.error("Network error while deleting");
		}
	};

	const handleClearAll = async () => {
		const ok = await confirm({
			title: "Delete All Transactions",
			description:
				"Are you sure you want to delete all transaction records? This action cannot be undone.",
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
			toast.error("Network error while deleting");
		}
	};

	const handleDuplicateToToday = async (item: TransactionItem) => {
		setDuplicatingId(item.id);
		try {
			const res = await api.post("/finances", {
				type: item.type,
				amount: item.amount,
				category: item.category,
				description: item.description,
				paymentMethod: item.paymentMethod,
				date: new Date().toISOString(),
			});

			if (res.success) {
				toast.success(`Added ${item.type === "INCOME" ? "income" : "expense"} to today's ledger`);
				onRefresh();
			} else {
				toast.error(res.message || "Failed to duplicate transaction to today");
			}
		} catch {
			toast.error("Network error while adding transaction to today");
		} finally {
			setDuplicatingId(null);
		}
	};

	const filtered = transactions.filter((t) => {
		if (filterType === "ALL") return true;
		return t.type === filterType;
	});

	return (
		<div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
				<div>
					<h4 className="text-sm font-bold text-foreground">Transaction History</h4>
					<p className="text-xs text-foreground-muted">
						Itemized entries for this period ({filtered.length} total)
					</p>
				</div>

				<div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
					{transactions.length > 0 && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleClearAll}
							className="h-8 gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs px-2.5"
						>
							<Trash2 className="w-3.5 h-3.5" />
							<span>Clear All</span>
						</Button>
					)}
					<div className="flex items-center gap-1 rounded-xl bg-surface-sunken p-1 border border-border">
						<button
							type="button"
							onClick={() => setFilterType("ALL")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterType === "ALL"
									? "bg-surface text-foreground shadow-sm border border-border"
									: "text-foreground-muted hover:text-foreground"
							}`}
						>
							All
						</button>
						<button
							type="button"
							onClick={() => setFilterType("EXPENSE")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterType === "EXPENSE"
									? "bg-rose-500/20 text-rose-400"
									: "text-foreground-muted hover:text-foreground"
							}`}
						>
							Expenses
						</button>
						<button
							type="button"
							onClick={() => setFilterType("INCOME")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterType === "INCOME"
									? "bg-emerald-500/20 text-emerald-400"
									: "text-foreground-muted hover:text-foreground"
							}`}
						>
							Income
						</button>
					</div>
				</div>
			</div>

			<CardDeck
				items={filtered}
				getKey={(item) => item.id}
				getTitle={(item) => {
					const cleanDesc = item.description
						? item.description.replace(/\[Recurring:\s*[^\]]+\]/i, "").trim()
						: "";
					return `${cleanDesc || item.category} (${formatCurrency(item.amount, currency)})`;
				}}
				storageKey="finance_ledger_tx"
				defaultMode="all"
				desktopColumns={1}
				sectionLabel="Transactions"
				emptyState={
					<div className="py-12 text-center text-xs text-foreground-muted">
						No transactions found for this period. Log an expense or earning to track data.
					</div>
				}
				renderCard={(item) => {
					const isIncome = item.type === "INCOME";
					const dateStr = new Date(item.date).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					});

					const recurringMatch = item.description?.match(/\[Recurring:\s*([^\]]+)\]/i);
					const cleanDesc = item.description
						? item.description.replace(/\[Recurring:\s*[^\]]+\]/i, "").trim()
						: "";

					const isJustAdded = activeAdditionId === item.id;

					return (
						<div
							className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 ${
								isJustAdded
									? "ring-2 ring-emerald-500/70 bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
									: "border-border bg-surface-2/50 hover:bg-surface-2"
							}`}
						>
							<div className="flex items-center gap-3 min-w-0">
								<div
									className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
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
									<div className="flex items-center gap-2 flex-wrap">
										{isJustAdded && (
											<span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/40 animate-pulse">
												Just Added
											</span>
										)}
										<p className="text-xs font-semibold text-foreground truncate">
											{cleanDesc || item.category}
										</p>
										<span
											className={`rounded-md px-1.5 py-0.5 text-xs border ${
												item.category === "Debt / Borrowed" || item.category === "Debt Repayment"
													? "bg-amber-500/15 text-amber-400 border-amber-500/30"
													: item.category === "Loan Given" || item.category === "Loan Return"
														? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
														: "bg-surface text-foreground-muted border-border"
											}`}
										>
											{item.category}
										</span>
										{recurringMatch && (
											<span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-400 border border-emerald-500/25">
												<Repeat className="w-2.5 h-2.5" />
												<span>{recurringMatch[1]}</span>
											</span>
										)}
									</div>
									<p className="text-xs text-foreground-muted mt-0.5">
										{dateStr} • {item.paymentMethod}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-3 shrink-0 pl-2">
								<span
									className={`text-sm font-bold tabular-nums ${
										isIncome ? "text-emerald-400" : "text-rose-400"
									}`}
								>
									{isIncome ? "+" : "-"}
									{formatCurrency(item.amount, currency)}
								</span>

								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => handleDuplicateToToday(item)}
										disabled={duplicatingId === item.id}
										className="p-1.5 rounded-lg text-foreground-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer disabled:opacity-40"
										title="Add previous day card today (Repeat to today)"
									>
										<CalendarPlus className="w-3.5 h-3.5" />
									</button>
									<button
										type="button"
										onClick={() => onEdit(item)}
										className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface transition cursor-pointer"
										title="Edit"
									>
										<Edit2 className="w-3.5 h-3.5" />
									</button>
									<button
										type="button"
										onClick={() => handleDelete(item.id)}
										className="p-1.5 rounded-lg text-foreground-muted hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
										title="Delete"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						</div>
					);
				}}
			/>
		</div>
	);
}
