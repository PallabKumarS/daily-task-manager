"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/currency-symbols";

interface CategoryStat {
	category: string;
	amount: number;
	percentage: number;
}

interface CategoryBreakdownProps {
	expenseCategories: CategoryStat[];
	incomeCategories: CategoryStat[];
	currency: string;
}

export function CategoryBreakdown({
	expenseCategories = [],
	incomeCategories = [],
	currency,
}: CategoryBreakdownProps) {
	const [activeTab, setActiveTab] = React.useState<"EXPENSE" | "INCOME">("EXPENSE");

	const list = (activeTab === "EXPENSE" ? expenseCategories : incomeCategories) || [];

	return (
		<div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
			<div className="flex items-center justify-between pb-4 border-b border-slate-800">
				<div>
					<h4 className="text-sm font-bold text-slate-100">Category Distribution</h4>
					<p className="text-xs text-slate-400">Where your funds flow</p>
				</div>

				<div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
					<button
						type="button"
						onClick={() => setActiveTab("EXPENSE")}
						className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
							activeTab === "EXPENSE"
								? "bg-red-500/20 text-red-400"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Expenses
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("INCOME")}
						className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
							activeTab === "INCOME"
								? "bg-emerald-500/20 text-emerald-400"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Earnings
					</button>
				</div>
			</div>

			<div className="mt-4 space-y-3.5 max-h-72 overflow-y-auto pr-1">
				{list.length === 0 ? (
					<p className="py-6 text-center text-xs text-slate-500">
						No {activeTab.toLowerCase()} data in this timeframe.
					</p>
				) : (
					list.map((item) => (
						<div key={item.category} className="space-y-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="font-medium text-slate-300">{item.category}</span>
								<div className="flex items-center gap-2">
									<span className="font-semibold text-slate-100">
										{formatCurrency(item.amount, currency)}
									</span>
									<span className="text-[11px] text-slate-400 w-8 text-right">
										{item.percentage}%
									</span>
								</div>
							</div>

							{/* Bar */}
							<div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
								<div
									className={`h-full rounded-full transition-all duration-500 ${
										activeTab === "EXPENSE" ? "bg-red-500" : "bg-emerald-500"
									}`}
									style={{
										width: `${Math.min(100, Math.max(4, item.percentage))}%`,
									}}
								/>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
