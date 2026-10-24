"use client";

import { ArrowDownRight, ArrowUpRight, ChevronRight, TrendingUp } from "lucide-react";
import * as React from "react";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { formatCurrency } from "@/lib/currency-symbols";

interface YearTimelineViewProps {
	currentDate: Date;
	transactions: TransactionItem[];
	currency: string;
	onSelectMonth: (monthIndex: number) => void;
}

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

export function YearTimelineView({
	currentDate,
	transactions,
	currency,
	onSelectMonth,
}: YearTimelineViewProps) {
	const currentYear = currentDate.getFullYear();
	const now = new Date();
	const currentMonthIndex = now.getMonth();
	const isCurrentYear = now.getFullYear() === currentYear;

	// Calculate totals for all 12 months
	const monthData = React.useMemo(() => {
		return Array.from({ length: 12 }, (_, monthIndex) => {
			const monthTransactions = transactions.filter((t) => {
				const d = new Date(t.date);
				return d.getFullYear() === currentYear && d.getMonth() === monthIndex;
			});

			const income = monthTransactions
				.filter((t) => t.type === "INCOME")
				.reduce((sum, t) => sum + t.amount, 0);

			const expense = monthTransactions
				.filter((t) => t.type === "EXPENSE")
				.reduce((sum, t) => sum + t.amount, 0);

			const net = income - expense;
			const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;
			const quarter = `Q${Math.floor(monthIndex / 3) + 1}`;
			const isCurrentMonth = isCurrentYear && monthIndex === currentMonthIndex;

			return {
				monthIndex,
				name: MONTH_NAMES[monthIndex],
				quarter,
				isCurrentMonth,
				income,
				expense,
				net,
				savingsRate,
				count: monthTransactions.length,
			};
		});
	}, [transactions, currentYear, isCurrentYear, currentMonthIndex]);

	const yearTotalIncome = monthData.reduce((sum, m) => sum + m.income, 0);
	const yearTotalExpense = monthData.reduce((sum, m) => sum + m.expense, 0);
	const yearNet = yearTotalIncome - yearTotalExpense;

	return (
		<div className="space-y-4">
			{/* Year Header Banner */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl">
				<div>
					<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
						<TrendingUp className="w-4 h-4 text-emerald-400" />
						<span>Annual 12-Month Performance Overview ({currentYear})</span>
					</h3>
					<p className="text-xs text-zinc-400 mt-0.5">
						Monthly inflow and outflow totals with net savings ratios across the entire calendar
						year
					</p>
				</div>

				<div className="flex items-center gap-3 text-xs bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 self-start sm:self-auto">
					<div>
						<span className="text-zinc-500">Year Inflow:</span>{" "}
						<span className="font-bold text-emerald-400">
							+{formatCurrency(yearTotalIncome, currency)}
						</span>
					</div>
					<span className="text-zinc-700">|</span>
					<div>
						<span className="text-zinc-500">Year Outflow:</span>{" "}
						<span className="font-bold text-rose-400">
							-{formatCurrency(yearTotalExpense, currency)}
						</span>
					</div>
					<span className="text-zinc-700">|</span>
					<div>
						<span className="text-zinc-500">Net:</span>{" "}
						<span className={`font-black ${yearNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
							{yearNet >= 0 ? "+" : ""}
							{formatCurrency(yearNet, currency)}
						</span>
					</div>
				</div>
			</div>

			{/* 12 Months Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
				{monthData.map((m) => {
					const hasActivity = m.count > 0;
					const expenseRatio =
						m.income > 0
							? Math.min(100, Math.round((m.expense / m.income) * 100))
							: m.expense > 0
								? 100
								: 0;

					return (
						<div
							key={m.monthIndex}
							className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
								m.isCurrentMonth
									? "border-emerald-500/60 bg-gradient-to-b from-emerald-950/20 via-zinc-900 to-zinc-900 shadow-md shadow-emerald-950/20"
									: "border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900/90"
							}`}
						>
							<div>
								{/* Month Title & Badges */}
								<div className="flex items-start justify-between pb-3 border-b border-zinc-800/80">
									<div>
										<div className="flex items-center gap-2">
											<h4 className="text-base font-extrabold text-foreground">{m.name}</h4>
											<span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
												{m.quarter}
											</span>
										</div>
										<p className="text-[11px] text-zinc-400 mt-0.5">
											{m.count} transaction{m.count === 1 ? "" : "s"} logged
										</p>
									</div>

									{m.isCurrentMonth && (
										<span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
											Current
										</span>
									)}
								</div>

								{/* Inflow & Outflow Numbers */}
								<div className="mt-3.5 space-y-2">
									<div className="flex items-center justify-between text-xs">
										<span className="text-zinc-400 flex items-center gap-1.5">
											<ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
											<span>Total Earnings</span>
										</span>
										<span
											className={`font-extrabold ${
												m.income > 0 ? "text-emerald-400" : "text-zinc-500"
											}`}
										>
											+{formatCurrency(m.income, currency)}
										</span>
									</div>

									<div className="flex items-center justify-between text-xs">
										<span className="text-zinc-400 flex items-center gap-1.5">
											<ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
											<span>Total Spendings</span>
										</span>
										<span
											className={`font-extrabold ${
												m.expense > 0 ? "text-rose-400" : "text-zinc-500"
											}`}
										>
											-{formatCurrency(m.expense, currency)}
										</span>
									</div>

									{/* Spend vs Income Progress Bar */}
									{hasActivity && (
										<div className="pt-1.5">
											<div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
												<span>Spend / Earn Ratio</span>
												<span>{expenseRatio}%</span>
											</div>
											<div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
												<div
													className={`h-full rounded-full transition-all duration-500 ${
														m.net >= 0 ? "bg-emerald-500" : "bg-rose-500"
													}`}
													style={{ width: `${Math.min(100, expenseRatio)}%` }}
												/>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Month Footer: Net & Jump button */}
							<div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
								<div>
									<span className="text-[10px] text-zinc-500 uppercase font-bold block">
										Net Savings
									</span>
									<span
										className={`text-sm font-black ${
											m.net > 0 ? "text-emerald-400" : m.net < 0 ? "text-rose-400" : "text-zinc-400"
										}`}
									>
										{m.net > 0 ? "+" : ""}
										{formatCurrency(m.net, currency)}
									</span>
								</div>

								<button
									type="button"
									onClick={() => onSelectMonth(m.monthIndex)}
									className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-zinc-800"
								>
									<span>View Month</span>
									<ChevronRight className="w-3.5 h-3.5" />
								</button>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
