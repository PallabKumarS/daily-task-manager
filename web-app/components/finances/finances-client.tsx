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
import { useContextDock } from "@/components/layout/context-dock";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { getPeriodDateRange, useWorkweekPreferences } from "@/lib/workweek-preferences";

export function FinancesClient() {
	const { user } = useAuth();
	const { startOfWeek } = useWorkweekPreferences();
	const { setCustomSlot } = useContextDock();

	const [mainTab, setMainTab] = React.useState<"LEDGER" | "DEBTS_LOANS">("LEDGER");
	const [period, setPeriod] = React.useState<"week" | "month" | "year">("month");
	const [currentDate, setCurrentDate] = React.useState(new Date());
	const [debtModalOpen, setDebtModalOpen] = React.useState(false);

	const [analytics, setAnalytics] = React.useState<{
		totalIncome: number;
		totalExpense: number;
		netBalance: number;
		savingsRate: number;
		todayCashflow?: {
			net: number;
			income: number;
			expense: number;
		};
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
		todayCashflow: { net: 0, income: 0, expense: 0 },
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
	const isFetchingRef = React.useRef(false);
	const pendingFetchRef = React.useRef(false);

	const dateRange = React.useMemo(() => {
		return getPeriodDateRange(currentDate, period, startOfWeek);
	}, [currentDate, period, startOfWeek]);

	const fetchData = React.useCallback(async () => {
		if (isFetchingRef.current) {
			pendingFetchRef.current = true;
			return;
		}

		isFetchingRef.current = true;
		pendingFetchRef.current = false;

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
			// Ignore network errors
		} finally {
			setLoading(false);
			isFetchingRef.current = false;
			if (pendingFetchRef.current) {
				pendingFetchRef.current = false;
				fetchData();
			}
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

	const handlePrev = React.useCallback(() => {
		setCurrentDate((prev) => {
			const next = new Date(prev);
			if (period === "week") {
				next.setDate(next.getDate() - 7);
			} else if (period === "year") {
				next.setFullYear(next.getFullYear() - 1);
			} else {
				next.setMonth(next.getMonth() - 1);
			}
			return next;
		});
	}, [period]);

	const handleNext = React.useCallback(() => {
		setCurrentDate((prev) => {
			const next = new Date(prev);
			if (period === "week") {
				next.setDate(next.getDate() + 7);
			} else if (period === "year") {
				next.setFullYear(next.getFullYear() + 1);
			} else {
				next.setMonth(next.getMonth() + 1);
			}
			return next;
		});
	}, [period]);

	const handleResetToday = React.useCallback(() => {
		setCurrentDate(new Date());
	}, []);

	const formatPeriodLabel = React.useCallback(() => {
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
	}, [period, dateRange, currentDate]);

	const handleEdit = (t: TransactionItem) => {
		setEditingTransaction(t);
		setModalOpen(true);
	};

	const handleAddNew = React.useCallback((dateStr?: string) => {
		setEditingTransaction(null);
		setDefaultFormDate(dateStr);
		setModalOpen(true);
	}, []);

	const handleSelectMonth = (monthIndex: number) => {
		const next = new Date(currentDate.getFullYear(), monthIndex, 1);
		setCurrentDate(next);
		setPeriod("month");
	};

	React.useEffect(() => {
		setCustomSlot(
			<div className="flex items-center justify-between gap-1 w-full flex-wrap">
				<div className="flex items-center gap-1 rounded-xl bg-surface-2 p-0.5 border border-border">
					<button
						type="button"
						onClick={() => setMainTab("LEDGER")}
						className={`px-1 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
							mainTab === "LEDGER"
								? "bg-surface text-routine-fg shadow-xs"
								: "text-muted-foreground"
						}`}
					>
						Ledger
					</button>
					<button
						type="button"
						onClick={() => setMainTab("DEBTS_LOANS")}
						className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
							mainTab === "DEBTS_LOANS"
								? "bg-surface text-alarm-fg shadow-xs"
								: "text-muted-foreground"
						}`}
					>
						Debts
					</button>
				</div>

				{mainTab === "LEDGER" && (
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={handlePrev}
							className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
							aria-label="Previous period"
						>
							<ChevronLeft className="w-3.5 h-3.5" />
						</button>
						<span className="text-xs font-bold text-foreground truncate max-w-23">
							{formatPeriodLabel()}
						</span>
						<button
							type="button"
							onClick={handleNext}
							className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
							aria-label="Next period"
						>
							<ChevronRight className="w-3.5 h-3.5" />
						</button>
					</div>
				)}

				<button
					type="button"
					onClick={() => {
						if (mainTab === "DEBTS_LOANS") {
							setDebtModalOpen(true);
						} else {
							handleAddNew();
						}
					}}
					className={`inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-white shadow-sm cursor-pointer shrink-0 transition-colors ${
						mainTab === "DEBTS_LOANS"
							? "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
							: "bg-teal-600 hover:bg-teal-700 active:bg-teal-800"
					}`}
				>
					<Plus className="w-3.5 h-3.5" />
					<span>{mainTab === "DEBTS_LOANS" ? "Debt/Loan" : "Entry"}</span>
				</button>
			</div>,
		);
		return () => setCustomSlot(null);
	}, [setCustomSlot, mainTab, handlePrev, handleNext, formatPeriodLabel, handleAddNew]);

	if (loading && transactions.length === 0) {
		return (
			<div className="py-20 text-center text-muted-foreground text-xs">
				Loading financial ledger & analytics...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<RecentlyAddedBanner />

			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">
						{mainTab === "LEDGER" ? "Daily Spendings & Earnings" : "Debts & Loans Management"}
					</h1>
					<p className="text-xs sm:text-sm text-muted-foreground mt-1">
						{mainTab === "LEDGER"
							? "Itemized ledger entries with tabbed timeframes and 1-click repetition"
							: "Track money borrowed or lent with automated income and expense ledger tracking"}
					</p>
				</div>

				{mainTab === "LEDGER" ? (
					<div className="flex items-center gap-2 self-start sm:self-center">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCategoryManagerOpen(true)}
							className="gap-1.5"
						>
							<Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
							<span>Categories</span>
						</Button>

						<Button size="sm" onClick={() => handleAddNew()} className="gap-1.5">
							<Plus className="w-4 h-4" />
							<span>Record Transaction</span>
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-2 self-start sm:self-center">
						<Button
							size="sm"
							onClick={() => setDebtModalOpen(true)}
							className="gap-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white"
						>
							<Plus className="w-4 h-4" />
							<span>Record Debt / Loan</span>
						</Button>
					</div>
				)}
			</div>

			<div className="flex items-center gap-2 border-b border-border pb-3">
				<button
					type="button"
					onClick={() => setMainTab("LEDGER")}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
						mainTab === "LEDGER"
							? "bg-primary-soft text-routine-fg border border-teal-500/30 shadow-xs"
							: "text-muted-foreground hover:text-foreground hover:bg-surface-2"
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
							? "bg-alarm-soft text-alarm-fg border border-amber-500/30 shadow-xs"
							: "text-muted-foreground hover:text-foreground hover:bg-surface-2"
					}`}
				>
					<HandCoins className="w-4 h-4" />
					<span>Debts & Loans</span>
				</button>
			</div>

			{mainTab === "DEBTS_LOANS" ? (
				<DebtLoanTab
					currency={user?.currency || "USD"}
					onLedgerChanged={fetchData}
					createModalOpen={debtModalOpen}
					onCloseCreateModal={() => setDebtModalOpen(false)}
					onOpenCreateModal={() => setDebtModalOpen(true)}
				/>
			) : (
				<>
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-surface shadow-(--shadow-card)">
						<div className="flex items-center rounded-xl bg-surface-2 p-1 border border-border">
							<button
								type="button"
								onClick={() => setPeriod("week")}
								className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
									period === "week"
										? "bg-primary-soft text-routine-fg border border-teal-500/30 shadow-xs"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								Weekly
							</button>
							<button
								type="button"
								onClick={() => setPeriod("month")}
								className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
									period === "month"
										? "bg-primary-soft text-routine-fg border border-teal-500/30 shadow-xs"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								Monthly
							</button>
							<button
								type="button"
								onClick={() => setPeriod("year")}
								className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
									period === "year"
										? "bg-primary-soft text-routine-fg border border-teal-500/30 shadow-xs"
										: "text-muted-foreground hover:text-foreground"
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
									className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
									title="Previous period"
								>
									<ChevronLeft className="w-4 h-4" />
								</button>
								<span className="text-xs font-bold text-foreground min-w-37.5 text-center">
									{formatPeriodLabel()}
								</span>
								<button
									type="button"
									onClick={handleNext}
									className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
									title="Next period"
								>
									<ChevronRight className="w-4 h-4" />
								</button>
							</div>

							<button
								type="button"
								onClick={handleResetToday}
								className="text-xs font-semibold text-routine-fg px-2.5 py-1 rounded-lg bg-primary-soft hover:opacity-90 transition cursor-pointer"
							>
								Today
							</button>
						</div>
					</div>

					<FinanceSummaryCards
						totalIncome={analytics.totalIncome}
						totalExpense={analytics.totalExpense}
						netBalance={analytics.netBalance}
						todayCashflow={analytics.todayCashflow}
						currency={user?.currency || "USD"}
					/>

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
						onSelectDate={(date) => setCurrentDate(date)}
					/>

					<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-(--shadow-card) space-y-4">
						<div>
							<h3 className="text-sm sm:text-base font-bold text-foreground">
								Cashflow Analytics & Breakdown
							</h3>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Visual trajectory and category proportions for {formatPeriodLabel()}
							</p>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
				onUpdated={fetchData}
			/>
		</div>
	);
}
