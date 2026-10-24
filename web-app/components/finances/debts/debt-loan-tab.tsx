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
import { CardDeck } from "@/components/ui/card-deck";
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
			// Ignore network error
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

	const renderSingleCard = (item: DebtLoanItem) => (
		<DebtLoanCard
			item={item}
			currency={currency}
			onEdit={handleEdit}
			onDelete={handleDelete}
			onRepay={handleRepay}
			onDeleteRepayment={handleDeleteRepayment}
		/>
	);

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-4 rounded-2xl border border-amber-500/30 bg-alarm-soft shadow-[var(--shadow-card)] flex flex-col justify-between">
					<div className="flex items-center justify-between text-alarm-fg">
						<span className="text-xs font-bold uppercase tracking-wider">I Owe (Debts)</span>
						<div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-alarm-fg">
							<WalletCards className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div className="text-2xl font-black text-alarm-fg tabular-nums">
							{formatCurrency(summary.totalDebt, currency)}
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{summary.activeDebtCount} active borrowed{" "}
							{summary.activeDebtCount === 1 ? "entry" : "entries"}
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border border-emerald-500/30 bg-income-soft shadow-[var(--shadow-card)] flex flex-col justify-between">
					<div className="flex items-center justify-between text-income-fg">
						<span className="text-xs font-bold uppercase tracking-wider">Owed to Me (Loans)</span>
						<div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-income-fg">
							<HandCoins className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div className="text-2xl font-black text-income-fg tabular-nums">
							{formatCurrency(summary.totalLoan, currency)}
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{summary.activeLoanCount} active lent{" "}
							{summary.activeLoanCount === 1 ? "entry" : "entries"}
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] flex flex-col justify-between">
					<div className="flex items-center justify-between text-muted-foreground">
						<span className="text-xs font-bold uppercase tracking-wider">Net Position</span>
						<div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-foreground">
							<Scale className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div
							className={`text-2xl font-black tabular-nums ${
								summary.netBalance >= 0 ? "text-income-fg" : "text-alarm-fg"
							}`}
						>
							{formatCurrency(summary.netBalance, currency)}
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{summary.netBalance >= 0 ? "Net receivable position" : "Net payable obligation"}
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] flex flex-col justify-between">
					<div className="flex items-center justify-between text-muted-foreground">
						<span className="text-xs font-bold uppercase tracking-wider">Settled in Full</span>
						<div className="w-8 h-8 rounded-lg bg-income-soft border border-emerald-500/20 flex items-center justify-center text-income-fg">
							<CheckCheck className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div className="text-2xl font-black text-foreground tabular-nums">
							{formatCurrency(summary.totalSettledAmount, currency)}
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							{summary.settledCount} completely settled records
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
				<div className="flex items-center rounded-xl bg-surface-2 p-1 border border-border overflow-x-auto">
					<button
						type="button"
						onClick={() => setActiveFilter("ALL")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							activeFilter === "ALL"
								? "bg-surface text-foreground shadow-xs border border-border"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						All ({items.length})
					</button>

					<button
						type="button"
						onClick={() => setActiveFilter("DEBTS")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							activeFilter === "DEBTS"
								? "bg-alarm-soft text-alarm-fg border border-amber-500/30 shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						I Owe ({summary.activeDebtCount})
					</button>

					<button
						type="button"
						onClick={() => setActiveFilter("LOANS")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							activeFilter === "LOANS"
								? "bg-income-soft text-income-fg border border-emerald-500/30 shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Owed to Me ({summary.activeLoanCount})
					</button>

					<button
						type="button"
						onClick={() => setActiveFilter("SETTLED")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
							activeFilter === "SETTLED"
								? "bg-surface text-foreground border border-border shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Settled ({summary.settledCount})
					</button>
				</div>

				<div className="flex items-center gap-2">
					<div className="relative min-w-[180px] sm:min-w-[220px]">
						<Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
						<Input
							placeholder="Search person or notes..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 text-xs h-9"
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

			{loading && items.length === 0 ? (
				<div className="py-20 text-center text-muted-foreground text-xs">
					Loading debts and loans...
				</div>
			) : filteredItems.length === 0 ? (
				<div className="py-16 text-center rounded-2xl border border-dashed border-border-strong bg-surface/60 p-6 space-y-3">
					<div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border mx-auto flex items-center justify-center text-muted-foreground">
						<WalletCards className="w-6 h-6" />
					</div>
					<div>
						<h4 className="text-sm font-bold text-foreground">No entries found</h4>
						<p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
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
							className="gap-1.5 border-amber-500/30 text-alarm-fg hover:bg-alarm-soft"
						>
							<ArrowDownRight className="w-3.5 h-3.5 text-amber-500" />
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
				<CardDeck
					items={filteredItems}
					keyExtractor={(item) => item.id}
					storageKey="debts_loans"
					defaultMode="deck"
					desktopColumns={2}
					title="Debts & Loans Cards"
					subtitle="Browse records with Previous / Next buttons or switch to All"
					renderCard={(item) => renderSingleCard(item)}
					renderGrid={(allItems) => (
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
							{allItems.map((item) => (
								<div key={item.id}>{renderSingleCard(item)}</div>
							))}
						</div>
					)}
				/>
			)}

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
