"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { getTransactionTitle, TransactionCard } from "@/components/finances/transaction-card";
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
				getTitle={(item) =>
					`${getTransactionTitle(item)} (${formatCurrency(item.amount, currency)})`
				}
				storageKey="finance_tx_cards"
				defaultMode="deck"
				desktopColumns={3}
				sectionLabel="Transaction Cards"
				emptyState={
					<div className="py-12 text-center text-xs text-foreground-muted">
						No transactions found for this period. Log an expense or earning to track data.
					</div>
				}
				renderCard={(item) => (
					<TransactionCard
						item={item}
						currency={currency}
						isJustAdded={activeAdditionId === item.id}
						isDuplicating={duplicatingId === item.id}
						onEdit={onEdit}
						onDelete={(tx) => handleDelete(tx.id)}
						onDuplicate={handleDuplicateToToday}
					/>
				)}
			/>
		</div>
	);
}
