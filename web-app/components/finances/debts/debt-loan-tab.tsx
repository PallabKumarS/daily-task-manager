"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
	CheckCheck,
	HandCoins,
	Plus,
	Scale,
	Search,
	WalletCards,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";
import { DebtLoanCard } from "./debt-loan-card";
import { DebtLoanModal } from "./debt-loan-modal";
import { RepaymentModal } from "./repayment-modal";
import type { DebtLoanItem, DebtLoanSummary } from "./types";

interface DebtLoanTabProps {
	currency: string;
	onLedgerChanged?: () => void;
}

export function DebtLoanTab({ currency, onLedgerChanged }: DebtLoanTabProps) {
	const confirm = useConfirm();

	const [items, setItems] = React.useState<DebtLoanItem[]>([]);
	const [summary, setSummary] = React.useState<DebtLoanSummary>({
		totalDebt: 0,
		totalLoan: 0,
		netBalance: 0,
		activeDebtCount: 0,
		activeLoanCount: 0,
		settledCount: 0,
		totalSettledAmount: 0,
	});

	const [loading, setLoading] = React.useState(true);
	const [activeFilter, setActiveFilter] = React.useState<"ALL" | "DEBTS" | "LOANS" | "SETTLED">(
		"ALL",
	);
	const [searchQuery, setSearchQuery] = React.useState("");

	// Modals
	const [createModalOpen, setCreateModalOpen] = React.useState(false);
	const [editingItem, setEditingItem] = React.useState<DebtLoanItem | null>(null);
	const [repayingItem, setRepayingItem] = React.useState<DebtLoanItem | null>(null);
	const [defaultCreateType, setDefaultCreateType] = React.useState<"DEBT" | "LOAN">("DEBT");

	const fetchData = React.useCallback(async () => {
		try {
			const res = await api.get<{
				debtsLoans: DebtLoanItem[];
				summary: DebtLoanSummary;
			}>("/debts-loans");

			if (res.success && res.data) {
				setItems(res.data.debtsLoans || []);
				setSummary(
					res.data.summary || {
						totalDebt: 0,
						totalLoan: 0,
						netBalance: 0,
						activeDebtCount: 0,
						activeLoanCount: 0,
						settledCount: 0,
						totalSettledAmount: 0,
					},
				);
			}
		} catch {
			// ignore network err
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		fetchData();

		const onGlobalRefresh = () => fetchData();
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
		};
	}, [fetchData]);

	const handleSuccess = () => {
		fetchData();
		if (onLedgerChanged) onLedgerChanged();
	};

	const handleDelete = async (id: string, personName: string) => {
		const ok = await confirm({
			title: "Delete Record",
			description: `Are you sure you want to delete this debt/loan with ${personName}? All associated initial and repayment transactions in your ledger will also be removed.`,
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete(`/debts-loans/${id}`);
			if (res.success) {
				toast.success("Record deleted");
				handleSuccess();
			} else {
				toast.error(res.message || "Failed to delete record");
			}
		} catch {
			toast.error("Network error while deleting");
		}
	};

	const handleDeleteRepayment = async (debtLoanId: string, repaymentId: string) => {
		try {
			const res = await api.delete(`/debts-loans/${debtLoanId}/repayments/${repaymentId}`);
			if (res.success) {
				toast.success("Repayment reversed");
				handleSuccess();
			} else {
				toast.error(res.message || "Failed to reverse repayment");
			}
		} catch {
			toast.error("Network error while reversing repayment");
		}
	};

	const handleOpenAdd = (type: "DEBT" | "LOAN" = "DEBT") => {
		setEditingItem(null);
		setDefaultCreateType(type);
		setCreateModalOpen(true);
	};

	const handleEdit = (item: DebtLoanItem) => {
		setEditingItem(item);
		setCreateModalOpen(true);
	};

	const handleRepay = (item: DebtLoanItem) => {
		setRepayingItem(item);
	};

	// Filter and search
	const filteredItems = React.useMemo(() => {
		return items.filter((item) => {
			if (activeFilter === "DEBTS" && (item.type !== "DEBT" || item.status === "SETTLED")) {
				return false;
			}
			if (activeFilter === "LOANS" && (item.type !== "LOAN" || item.status === "SETTLED")) {
				return false;
			}
			if (activeFilter === "SETTLED" && item.status !== "SETTLED") {
				return false;
			}

			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const nameMatch = item.personName.toLowerCase().includes(q);
				const descMatch = (item.description || "").toLowerCase().includes(q);
				if (!nameMatch && !descMatch) return false;
			}

			return true;
		});
	}, [items, activeFilter, searchQuery]);

	return (
		<div className="space-y-6">
			{/* KPI Summary Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Total You Owe */}
				<div className="p-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900/80 to-amber-950/20 shadow-sm flex flex-col justify-between">
					<div className="flex items-center justify-between text-slate-400">
						<span className="text-xs font-semibold uppercase tracking-wider">I Owe (Debts)</span>
						<div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
							<WalletCards className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div className="text-2xl font-black text-amber-300">
							{formatCurrency(summary.totalDebt, currency)}
						</div>
						<div className="text-[11px] text-slate-400 mt-1">
							{summary.activeDebtCount} active borrowed{" "}
							{summary.activeDebtCount === 1 ? "entry" : "entries"}
						</div>
					</div>
				</div>

				{/* Total Owed To You */}
				<div className="p-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/80 to-emerald-950/20 shadow-sm flex flex-col justify-between">
					<div className="flex items-center justify-between text-slate-400">
						<span className="text-xs font-semibold uppercase tracking-wider">
							Owed to Me (Loans)
						</span>
						<div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
							<HandCoins className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div className="text-2xl font-black text-emerald-300">
							{formatCurrency(summary.totalLoan, currency)}
						</div>
						<div className="text-[11px] text-slate-400 mt-1">
							{summary.activeLoanCount} active lent{" "}
							{summary.activeLoanCount === 1 ? "entry" : "entries"}
						</div>
					</div>
				</div>

				{/* Net Balance */}
				<div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-sm flex flex-col justify-between">
					<div className="flex items-center justify-between text-slate-400">
						<span className="text-xs font-semibold uppercase tracking-wider">Net Position</span>
						<div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
							<Scale className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div
							className={`text-2xl font-black ${
								summary.netBalance >= 0 ? "text-emerald-300" : "text-amber-300"
							}`}
						>
							{formatCurrency(summary.netBalance, currency)}
						</div>
						<div className="text-[11px] text-slate-400 mt-1">
							{summary.netBalance >= 0 ? "Net receivable position" : "Net payable obligation"}
						</div>
					</div>
				</div>

				{/* Settled Archive */}
				<div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm flex flex-col justify-between">
					<div className="flex items-center justify-between text-slate-400">
						<span className="text-xs font-semibold uppercase tracking-wider">Settled in Full</span>
						<div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
							<CheckCheck className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div className="text-2xl font-black text-slate-200">
							{formatCurrency(summary.totalSettledAmount, currency)}
						</div>
						<div className="text-[11px] text-slate-400 mt-1">
							{summary.settledCount} completely settled records
						</div>
					</div>
				</div>
			</div>

			{/* Filter Controls & Search */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
				{/* Sub-Tabs */}
				<div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 overflow-x-auto">
					<button
						type="button"
						onClick={() => setActiveFilter("ALL")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							activeFilter === "ALL"
								? "bg-slate-800 text-white shadow-sm"
								: "text-slate-400 hover:text-white"
						}`}
					>
						All ({items.length})
					</button>

					<button
						type="button"
						onClick={() => setActiveFilter("DEBTS")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							activeFilter === "DEBTS"
								? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
								: "text-slate-400 hover:text-white"
						}`}
					>
						I Owe ({summary.activeDebtCount})
					</button>

					<button
						type="button"
						onClick={() => setActiveFilter("LOANS")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							activeFilter === "LOANS"
								? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Owed to Me ({summary.activeLoanCount})
					</button>

					<button
						type="button"
						onClick={() => setActiveFilter("SETTLED")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							activeFilter === "SETTLED"
								? "bg-slate-800 text-slate-200 border border-slate-700 shadow-sm"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Settled ({summary.settledCount})
					</button>
				</div>

				{/* Search & Actions */}
				<div className="flex items-center gap-2">
					<div className="relative min-w-[180px] sm:min-w-[220px]">
						<Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
						<Input
							placeholder="Search person or notes..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 text-xs h-9"
						/>
					</div>

					<Button
						variant="emerald"
						size="sm"
						onClick={() => handleOpenAdd("DEBT")}
						className="gap-1.5 h-9 shrink-0"
					>
						<Plus className="w-4 h-4" />
						<span>Record Debt / Loan</span>
					</Button>
				</div>
			</div>

			{/* Cards Grid */}
			{loading && items.length === 0 ? (
				<div className="py-20 text-center text-slate-400 text-xs">Loading debts and loans...</div>
			) : filteredItems.length === 0 ? (
				<div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-6 space-y-3">
					<div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 mx-auto flex items-center justify-center text-slate-400">
						<WalletCards className="w-6 h-6" />
					</div>
					<div>
						<h4 className="text-sm font-bold text-white">No entries found</h4>
						<p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
							{searchQuery
								? "No records match your search criteria. Try a different person name or clear the search filter."
								: "Track cash borrowed from others or loans given to colleagues and friends with automated ledger sync."}
						</p>
					</div>

					<div className="flex items-center justify-center gap-2 pt-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleOpenAdd("DEBT")}
							className="gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
						>
							<ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
							<span>I Borrowed Money</span>
						</Button>

						<Button
							variant="emerald"
							size="sm"
							onClick={() => handleOpenAdd("LOAN")}
							className="gap-1.5"
						>
							<ArrowUpRight className="w-3.5 h-3.5" />
							<span>I Lent Money</span>
						</Button>
					</div>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					{filteredItems.map((item) => (
						<DebtLoanCard
							key={item.id}
							item={item}
							currency={currency}
							onEdit={handleEdit}
							onDelete={handleDelete}
							onRepay={handleRepay}
							onDeleteRepayment={handleDeleteRepayment}
						/>
					))}
				</div>
			)}

			{/* Modals */}
			<DebtLoanModal
				isOpen={createModalOpen}
				onClose={() => setCreateModalOpen(false)}
				onSuccess={handleSuccess}
				initialData={editingItem}
				defaultType={defaultCreateType}
			/>

			<RepaymentModal
				isOpen={Boolean(repayingItem)}
				onClose={() => setRepayingItem(null)}
				onSuccess={handleSuccess}
				debtLoan={repayingItem}
				currency={currency}
			/>
		</div>
	);
}
