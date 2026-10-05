"use client";

import { ArrowDownRight, ArrowUpRight, Edit2, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";

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
	const [filterType, setFilterType] = React.useState<
		"ALL" | "EXPENSE" | "INCOME"
	>("ALL");

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

	const filtered = transactions.filter((t) => {
		if (filterType === "ALL") return true;
		return t.type === filterType;
	});

	return (
		<div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
				<div>
					<h4 className="text-sm font-bold text-slate-100">
						Transaction History
					</h4>
					<p className="text-xs text-slate-400">
						Detailed itemized record of earnings & spendings
					</p>
				</div>

				<div className="flex items-center gap-2 self-start sm:self-center">
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
					<div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
						<button
							type="button"
							onClick={() => setFilterType("ALL")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterType === "ALL"
									? "bg-slate-800 text-white"
									: "text-slate-400 hover:text-white"
							}`}
						>
							All
						</button>
						<button
							type="button"
							onClick={() => setFilterType("EXPENSE")}
							className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
								filterType === "EXPENSE"
									? "bg-red-500/20 text-red-400"
									: "text-slate-400 hover:text-white"
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
									: "text-slate-400 hover:text-white"
							}`}
						>
							Income
						</button>
					</div>
				</div>
			</div>

			<div className="mt-4 divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
				{filtered.length === 0 ? (
					<div className="py-12 text-center text-xs text-slate-500">
						No transactions found. Log your first expense or earning to track
						data.
					</div>
				) : (
					filtered.map((item) => {
						const isIncome = item.type === "INCOME";
						const dateStr = new Date(item.date).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
							year: "numeric",
						});

						return (
							<div
								key={item.id}
								className="flex items-center justify-between py-3.5 hover:bg-slate-800/30 px-2 rounded-xl transition"
							>
								<div className="flex items-center gap-3 min-w-0">
									<div
										className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
											isIncome
												? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
												: "bg-red-500/10 text-red-400 border border-red-500/20"
										}`}
									>
										{isIncome ? (
											<ArrowUpRight className="w-4 h-4" />
										) : (
											<ArrowDownRight className="w-4 h-4" />
										)}
									</div>
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<p className="text-xs font-semibold text-slate-100 truncate">
												{item.description || item.category}
											</p>
											<span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 border border-slate-700/60">
												{item.category}
											</span>
										</div>
										<p className="text-[11px] text-slate-400 mt-0.5">
											{dateStr} • {item.paymentMethod}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-4 shrink-0 pl-2">
									<span
										className={`text-sm font-bold ${
											isIncome ? "text-emerald-400" : "text-red-400"
										}`}
									>
										{isIncome ? "+" : "-"}
										{formatCurrency(item.amount, currency)}
									</span>

									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => onEdit(item)}
											className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
											title="Edit"
										>
											<Edit2 className="w-3.5 h-3.5" />
										</button>
										<button
											type="button"
											onClick={() => handleDelete(item.id)}
											className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
											title="Delete"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
