"use client";

import { ChevronLeft, ChevronRight, HandCoins, Plus, Receipt, Tag } from "lucide-react";
import * as React from "react";
import { CategoryManagerModal } from "@/components/categories/category-manager-modal";
import { RecentlyAddedBanner } from "@/components/dashboard/recently-added-banner";
import { CategoryBreakdown } from "@/components/finances/category-breakdown";
import { CumulativeChart } from "@/components/finances/cumulative-chart";
import { DebtLoanTab } from "@/components/finances/debts";
import { FinanceSummaryCards } from "@/components/finances/finance-summary-cards";
import { TransactionTimelineView } from "@/components/finances/timeline/transaction-timeline-view";
import { TransactionFormModal } from "@/components/finances/transaction-form-modal";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { getPeriodDateRange, useWorkweekPreferences } from "@/lib/workweek-preferences";

export default function FinancesPage() {
	const { user } = useAuth();
	const { startOfWeek } = useWorkweekPreferences();

	const [mainTab, setMainTab] = React.useState<"LEDGER" | "DEBTS_LOANS">("LEDGER");
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
	const [defaultFormDate, setDefaultFormDate] = React.useState<string | undefined>(undefined);
	const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);

	const dateRange = React.useMemo(() => {
		return getPeriodDateRange(currentDate, period, startOfWeek);
	}, [currentDate, period, startOfWeek]);

	const fetchData = React.useCallback(async () => {
		try {
			const startIso = dateRange.startDate.toISOString();
			const endIso = dateRange.endDate.toISOString();

			const [analyticsRes, transRes] = await Promise.allSettled([
				api.get<typeof analytics>(
					`/finances/analytics?period=${period}&date=${encodeURIComponent(currentDate.toISOString())}`,
				),
				api.get<TransactionItem[]>(
					`/finances?startDate=${encodeURIComponent(startIso)}&endDate=${encodeURIComponent(endIso)}`,
				),
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
			// ignore network errors
		} finally {
			setLoading(false);
		}
	}, [period, currentDate, dateRange]);

	React.useEffect(() => {
		fetchData();

		const onGlobalRefresh = () => fetchData();
		const onDateChanged = () => {
			setCurrentDate(new Date());
			fetchData();
		};
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		window.addEventListener("daypulse:date-changed", onDateChanged);
		window.addEventListener("daypulse:categories-updated", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
			window.removeEventListener("daypulse:date-changed", onDateChanged);
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
			const start = dateRange.startDate.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			});
			const end = dateRange.endDate.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
			return `${start} – ${end}`;
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

	const handleAddNew = (dateStr?: string) => {
		setEditingTransaction(null);
		setDefaultFormDate(dateStr);
		setModalOpen(true);
	};

	const handleSelectMonth = (monthIndex: number) => {
		const next = new Date(currentDate.getFullYear(), monthIndex, 1);
		setCurrentDate(next);
		setPeriod("month");
	};

	if (loading && transactions.length === 0) {
		return (
			<div className="py-20 text-center text-slate-400 text-xs">
				Loading financial ledger & analytics...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<RecentlyAddedBanner />

			{/* Top Header & Controls */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white">
						{mainTab === "LEDGER" ? "Daily Spendings & Earnings" : "Debts & Loans Management"}
					</h1>
					<p className="text-xs text-slate-400 mt-1">
						{mainTab === "LEDGER"
							? "Itemized ledger entries with tabbed timeframes and 1-click repetition"
							: "Track money borrowed or lent with automated income and expense ledger tracking"}
					</p>
				</div>

				{mainTab === "LEDGER" && (
					<div className="flex items-center gap-2 self-start sm:self-center">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCategoryManagerOpen(true)}
							className="gap-1.5 border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
						>
							<Tag className="w-3.5 h-3.5 text-teal-400" />
							<span>Categories</span>
						</Button>

						<Button size="sm" onClick={() => handleAddNew()} className="gap-1.5">
							<Plus className="w-4 h-4" />
							<span>Record Transaction</span>
						</Button>
					</div>
				)}
			</div>

			{/* Primary Finances Section Tabs */}
			<div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
				<button
					type="button"
					onClick={() => setMainTab("LEDGER")}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
						mainTab === "LEDGER"
							? "bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm"
							: "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
					}`}
				>
					<Receipt className="w-4 h-4" />
					<span>Ledger & Timeline</span>
				</button>

				<button
					type="button"
					onClick={() => setMainTab("DEBTS_LOANS")}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
						mainTab === "DEBTS_LOANS"
							? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm"
							: "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
					}`}
				>
					<HandCoins className="w-4 h-4" />
					<span>Debts & Loans</span>
				</button>
			</div>

			{mainTab === "DEBTS_LOANS" ? (
				<DebtLoanTab currency={user?.currency || "USD"} onLedgerChanged={fetchData} />
			) : (
				<>
					{/* Primary Section: Period & Date Navigator Tabs */}
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
						<div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
							<button
								type="button"
								onClick={() => setPeriod("week")}
								className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
									period === "week"
										? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm"
										: "text-slate-400 hover:text-white"
								}`}
							>
								Weekly
							</button>
							<button
								type="button"
								onClick={() => setPeriod("month")}
								className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
									period === "month"
										? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm"
										: "text-slate-400 hover:text-white"
								}`}
							>
								Monthly
							</button>
							<button
								type="button"
								onClick={() => setPeriod("year")}
								className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
									period === "year"
										? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-sm"
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
								<span className="text-xs font-bold text-slate-200 min-w-[150px] text-center">
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
								className="text-xs text-slate-400 hover:text-teal-400 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
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

					{/* Main Focus: Transaction Timeline History for Selected Period */}
					<TransactionTimelineView
						period={period}
						currentDate={currentDate}
						transactions={transactions}
						currency={user?.currency || "USD"}
						startOfWeek={startOfWeek}
						onEdit={handleEdit}
						onAddNew={handleAddNew}
						onPrev={handlePrev}
						onNext={handleNext}
						onResetToday={handleResetToday}
						onSelectMonth={handleSelectMonth}
						onRefresh={fetchData}
					/>

					{/* Secondary Section Placed Below: Cumulative Trajectory & Category Breakdown */}
					<div className="space-y-4 pt-2">
						<div className="pb-1">
							<h3 className="text-sm font-bold text-white">Cashflow Analytics & Breakdown</h3>
							<p className="text-xs text-slate-400">
								Visual trajectory and category proportions for {formatPeriodLabel()}
							</p>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							<div className="lg:col-span-2">
								<CumulativeChart timeline={analytics.timeline} currency={user?.currency || "USD"} />
							</div>

							<div className="lg:col-span-1">
								<CategoryBreakdown
									expenseCategories={analytics.expenseCategories}
									incomeCategories={analytics.incomeCategories}
									currency={user?.currency || "USD"}
								/>
							</div>
						</div>
					</div>
				</>
			)}

			<TransactionFormModal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				onSuccess={fetchData}
				initialData={editingTransaction}
				defaultDate={defaultFormDate}
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
