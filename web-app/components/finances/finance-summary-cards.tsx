"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Wallet, Percent } from "lucide-react";
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
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{/* Net Balance Card */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-semibold uppercase tracking-wider">
						Net Cashflow
					</span>
					<div className="rounded-xl bg-slate-800 p-2 text-slate-300">
						<Wallet className="w-4 h-4" />
					</div>
				</div>
				<div className="mt-3">
					<div
						className={`text-2xl font-black tracking-tight ${
							netBalance >= 0 ? "text-emerald-400" : "text-red-400"
						}`}
					>
						{formatCurrency(netBalance, currency)}
					</div>
					<p className="text-[11px] text-slate-400 mt-1">
						{netBalance >= 0
							? "Surplus balance saved"
							: "Deficit / Net negative"}
					</p>
				</div>
			</div>

			{/* Total Earnings */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-semibold uppercase tracking-wider">
						Total Earnings
					</span>
					<div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
						<ArrowUpRight className="w-4 h-4" />
					</div>
				</div>
				<div className="mt-3">
					<div className="text-2xl font-black tracking-tight text-slate-100">
						{formatCurrency(totalIncome, currency)}
					</div>
					<p className="text-[11px] text-emerald-400 mt-1">
						Inflow from salaries & income
					</p>
				</div>
			</div>

			{/* Total Spendings */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-semibold uppercase tracking-wider">
						Total Spendings
					</span>
					<div className="rounded-xl bg-red-500/10 p-2 text-red-400 border border-red-500/20">
						<ArrowDownRight className="w-4 h-4" />
					</div>
				</div>
				<div className="mt-3">
					<div className="text-2xl font-black tracking-tight text-slate-100">
						{formatCurrency(totalExpense, currency)}
					</div>
					<p className="text-[11px] text-red-400 mt-1">
						Outflow across daily expenses
					</p>
				</div>
			</div>

			{/* Savings Rate */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-xl">
				<div className="flex items-center justify-between text-slate-400">
					<span className="text-xs font-semibold uppercase tracking-wider">
						Savings Rate
					</span>
					<div className="rounded-xl bg-teal-500/10 p-2 text-teal-400 border border-teal-500/20">
						<Percent className="w-4 h-4" />
					</div>
				</div>
				<div className="mt-3">
					<div className="text-2xl font-black tracking-tight text-slate-100">
						{savingsRate}%
					</div>
					<p className="text-[11px] text-slate-400 mt-1">
						Percentage of income retained
					</p>
				</div>
			</div>
		</div>
	);
}
