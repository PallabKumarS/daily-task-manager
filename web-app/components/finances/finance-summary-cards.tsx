"use client";

import {
	Activity,
	ArrowDownRight,
	ArrowUpRight,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency-symbols";

interface FinanceSummaryCardsProps {
	totalIncome: number;
	totalExpense: number;
	netBalance: number;
	todayCashflow?: {
		net: number;
		income: number;
		expense: number;
	};
	currency: string;
}

export function FinanceSummaryCards({
	totalIncome,
	totalExpense,
	netBalance,
	todayCashflow,
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

			{/* Today's Cash Flow */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 p-5 backdrop-blur-xl transition-all shadow-sm">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-bold uppercase tracking-wider">Today's Cash Flow</span>
					<div
						className={`rounded-xl p-2 border shadow-inner ${
							(todayCashflow?.net ?? 0) >= 0
								? "bg-teal-500/10 text-teal-400 border-teal-500/20"
								: "bg-rose-500/10 text-rose-400 border-rose-500/20"
						}`}
					>
						<Activity className="w-4 h-4 stroke-[2.5]" />
					</div>
				</div>
				<div className="mt-3.5">
					<div
						className={`text-2xl sm:text-3xl font-black tracking-tight ${
							(todayCashflow?.net ?? 0) >= 0 ? "text-teal-400" : "text-rose-400"
						}`}
					>
						{(todayCashflow?.net ?? 0) >= 0 ? "+" : ""}
						{formatCurrency(todayCashflow?.net ?? 0, currency)}
					</div>
					<div className="mt-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
						<span className="text-teal-400 font-semibold">
							+{formatCurrency(todayCashflow?.income ?? 0, currency)}
						</span>
						<span className="text-rose-400 font-semibold">
							-{formatCurrency(todayCashflow?.expense ?? 0, currency)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
