"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
	Percent,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency-symbols";

interface FinanceSummaryCardsProps {
	totalIncome: number;
	totalExpense: number;
	netBalance: number;
	savingsRate: number;
	currency: string;
}

export function FinanceSummaryCards({
	totalIncome,
	totalExpense,
	netBalance,
	savingsRate,
	currency,
}: FinanceSummaryCardsProps) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
			{/* Total Earnings (Inflow) */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-teal-500/40 p-5 backdrop-blur-xl transition-all shadow-sm">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-bold uppercase tracking-wider">Total Earnings</span>
					<div className="rounded-xl bg-teal-500/10 p-2 text-teal-400 border border-teal-500/20 shadow-inner">
						<ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
					</div>
				</div>
				<div className="mt-3.5">
					<div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
						+{formatCurrency(totalIncome, currency)}
					</div>
					<div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-400 font-semibold">
						<TrendingUp className="w-3.5 h-3.5" />
						<span>Cumulative income inflow</span>
					</div>
				</div>
			</div>

			{/* Total Spendings (Outflow) */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-rose-500/40 p-5 backdrop-blur-xl transition-all shadow-sm">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-bold uppercase tracking-wider">Total Spendings</span>
					<div className="rounded-xl bg-rose-500/10 p-2 text-rose-400 border border-rose-500/20 shadow-inner">
						<ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
					</div>
				</div>
				<div className="mt-3.5">
					<div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
						-{formatCurrency(totalExpense, currency)}
					</div>
					<div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-400 font-semibold">
						<TrendingDown className="w-3.5 h-3.5" />
						<span>Itemized expense outflow</span>
					</div>
				</div>
			</div>

			{/* Net Balance (Surplus / Deficit) */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 p-5 backdrop-blur-xl transition-all shadow-sm">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-bold uppercase tracking-wider">Net Cashflow</span>
					<div
						className={`rounded-xl p-2 border shadow-inner ${
							netBalance >= 0
								? "bg-teal-500/10 text-teal-400 border-teal-500/20"
								: "bg-rose-500/10 text-rose-400 border-rose-500/20"
						}`}
					>
						<Wallet className="w-4 h-4 stroke-[2.5]" />
					</div>
				</div>
				<div className="mt-3.5">
					<div
						className={`text-2xl sm:text-3xl font-black tracking-tight ${
							netBalance >= 0 ? "text-teal-400" : "text-rose-400"
						}`}
					>
						{netBalance >= 0 ? "+" : ""}
						{formatCurrency(netBalance, currency)}
					</div>
					<p className="text-[11px] text-slate-400 mt-1 font-medium">
						{netBalance >= 0 ? "Surplus capital retained" : "Net operating deficit"}
					</p>
				</div>
			</div>

			{/* Savings Rate */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 p-5 backdrop-blur-xl transition-all shadow-sm">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-bold uppercase tracking-wider">Savings Rate</span>
					<div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400 border border-indigo-500/20 shadow-inner">
						<Percent className="w-4 h-4 stroke-[2.5]" />
					</div>
				</div>
				<div className="mt-3.5">
					<div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
						{savingsRate}%
					</div>
					<div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
						<div
							className="h-full rounded-full bg-gradient-to-r from-teal-500 to-indigo-400 transition-all duration-500"
							style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
