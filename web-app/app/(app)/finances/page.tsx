"use client";

import { ChevronLeft, ChevronRight, Plus, Tag } from "lucide-react";
import * as React from "react";
import { CategoryManagerModal } from "@/components/categories/category-manager-modal";
import { CategoryBreakdown } from "@/components/finances/category-breakdown";
import { CumulativeChart } from "@/components/finances/cumulative-chart";
import { FinanceSummaryCards } from "@/components/finances/finance-summary-cards";
import { TransactionFormModal } from "@/components/finances/transaction-form-modal";
import { type TransactionItem, TransactionList } from "@/components/finances/transaction-list";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export default function FinancesPage() {
	const { user } = useAuth();
	const [period, setPeriod] = React.useState<"week" | "month" | "year">("month");
	const [currentDate, setCurrentDate] = React.useState(new Date());

	const [analytics, setAnalytics] = React.useState<{
		totalIncome: number;
		totalExpense: number;
		netBalance: number;
		savingsRate: number;
		timeline: Array<{
			label: string;
			income: number;
			expense: number;
			net: number;
			cumulativeBalance: number;
		}>;
		expenseCategories: Array<{
			category: string;
			amount: number;
			percentage: number;
		}>;
		incomeCategories: Array<{
			category: string;
			amount: number;
			percentage: number;
		}>;
	}>({
		totalIncome: 0,
		totalExpense: 0,
		netBalance: 0,
		savingsRate: 0,
		timeline: [],
		expenseCategories: [],
		incomeCategories: [],
	});

	const [transactions, setTransactions] = React.useState<TransactionItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [modalOpen, setModalOpen] = React.useState(false);
	const [editingTransaction, setEditingTransaction] = React.useState<TransactionItem | null>(null);
	const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);

	const fetchData = React.useCallback(async () => {
		try {
			const dateStr = currentDate.toISOString();
			const [analyticsRes, transRes] = await Promise.allSettled([
				api.get<typeof analytics>(
					`/finances/analytics?period=${period}&date=${encodeURIComponent(dateStr)}`,
				),
				api.get<TransactionItem[]>(`/finances?limit=100`),
			]);

			if (
				analyticsRes.status === "fulfilled" &&
				analyticsRes.value.success &&
				analyticsRes.value.data
			) {
				setAnalytics(analyticsRes.value.data);
			}

			if (transRes.status === "fulfilled" && transRes.value.success && transRes.value.data) {
				setTransactions(transRes.value.data);
			}
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, [period, currentDate]);

	React.useEffect(() => {
		fetchData();

		const onGlobalRefresh = () => fetchData();
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		window.addEventListener("daypulse:categories-updated", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
			window.removeEventListener("daypulse:categories-updated", onGlobalRefresh);
		};
	}, [fetchData]);

	const handlePrev = () => {
		const next = new Date(currentDate);
		if (period === "week") {
			next.setDate(next.getDate() - 7);
		} else if (period === "year") {
			next.setFullYear(next.getFullYear() - 1);
		} else {
			next.setMonth(next.getMonth() - 1);
		}
		setCurrentDate(next);
	};

	const handleNext = () => {
		const next = new Date(currentDate);
		if (period === "week") {
			next.setDate(next.getDate() + 7);
		} else if (period === "year") {
			next.setFullYear(next.getFullYear() + 1);
		} else {
			next.setMonth(next.getMonth() + 1);
		}
		setCurrentDate(next);
	};

	const handleResetToday = () => {
		setCurrentDate(new Date());
	};

	const formatPeriodLabel = () => {
		if (period === "week") {
			return `Week of ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
		}
		if (period === "year") {
			return `${currentDate.getFullYear()}`;
		}
		return currentDate.toLocaleDateString("en-US", {
			month: "long",
			year: "numeric",
		});
	};

	const handleEdit = (t: TransactionItem) => {
		setEditingTransaction(t);
		setModalOpen(true);
	};

	const handleAddNew = () => {
		setEditingTransaction(null);
		setModalOpen(true);
	};

	if (loading) {
		return (
			<div className="py-20 text-center text-slate-400 text-xs">
				Loading financial ledger & analytics...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Top Header & Controls */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white">
						Daily Spendings & Earnings
					</h1>
					<p className="text-xs text-slate-400 mt-1">
						Maintain daily ledger records with automated cumulative balances across weeks, months,
						and years.
					</p>
				</div>

				<div className="flex items-center gap-2 self-start sm:self-center">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setCategoryManagerOpen(true)}
						className="gap-1.5 border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
					>
						<Tag className="w-3.5 h-3.5 text-emerald-400" />
						<span>Categories</span>
					</Button>

					<Button variant="emerald" size="sm" onClick={handleAddNew} className="gap-1.5">
						<Plus className="w-4 h-4" />
						<span>Record Transaction</span>
					</Button>
				</div>
			</div>

			{/* Period & Date Navigator Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
				<div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
					<button
						type="button"
						onClick={() => setPeriod("week")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							period === "week"
								? "bg-emerald-500/20 text-emerald-400"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Weekly
					</button>
					<button
						type="button"
						onClick={() => setPeriod("month")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							period === "month"
								? "bg-emerald-500/20 text-emerald-400"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Monthly
					</button>
					<button
						type="button"
						onClick={() => setPeriod("year")}
						className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							period === "year"
								? "bg-emerald-500/20 text-emerald-400"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Yearly
					</button>
				</div>

				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={handlePrev}
							className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
							title="Previous period"
						>
							<ChevronLeft className="w-4 h-4" />
						</button>
						<span className="text-xs font-bold text-slate-200 min-w-[140px] text-center">
							{formatPeriodLabel()}
						</span>
						<button
							type="button"
							onClick={handleNext}
							className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
							title="Next period"
						>
							<ChevronRight className="w-4 h-4" />
						</button>
					</div>

					<button
						type="button"
						onClick={handleResetToday}
						className="text-xs text-slate-400 hover:text-emerald-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
					>
						Today
					</button>
				</div>
			</div>

			{/* Summary KPI Cards */}
			<FinanceSummaryCards
				totalIncome={analytics.totalIncome}
				totalExpense={analytics.totalExpense}
				netBalance={analytics.netBalance}
				savingsRate={analytics.savingsRate}
				currency={user?.currency || "USD"}
			/>

			{/* Cumulative Trajectory Chart */}
			<CumulativeChart timeline={analytics.timeline} currency={user?.currency || "USD"} />

			{/* Category Breakdown & Itemized History */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-1">
					<CategoryBreakdown
						expenseCategories={analytics.expenseCategories}
						incomeCategories={analytics.incomeCategories}
						currency={user?.currency || "USD"}
					/>
				</div>

				<div className="lg:col-span-2">
					<TransactionList
						transactions={transactions}
						currency={user?.currency || "USD"}
						onEdit={handleEdit}
						onRefresh={fetchData}
					/>
				</div>
			</div>

			<TransactionFormModal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				onSuccess={fetchData}
				initialData={editingTransaction}
			/>

			<CategoryManagerModal
				isOpen={categoryManagerOpen}
				onClose={() => setCategoryManagerOpen(false)}
				defaultGroup="EXPENSE"
				onUpdated={fetchData}
			/>
		</div>
	);
}
