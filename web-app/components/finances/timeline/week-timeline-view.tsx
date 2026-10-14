"use client";

import { ChevronLeft, ChevronRight, Edit2, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { formatCurrency } from "@/lib/currency-symbols";
import { useRecentAdditions } from "@/lib/recent-activity-store";
import {
	DAY_NAMES_SHORT,
	getEndOfWeek,
	getStartOfWeek,
	type StartOfWeekDay,
} from "@/lib/workweek-preferences";

interface WeekTimelineViewProps {
	currentDate: Date;
	transactions: TransactionItem[];
	currency: string;
	startOfWeek: StartOfWeekDay;
	onEdit: (transaction: TransactionItem) => void;
	onDelete: (id: string, desc: string) => void;
	onAddNew: (dateString: string) => void;
	onPrevWeek: () => void;
	onNextWeek: () => void;
	onResetToday: () => void;
}

export function WeekTimelineView({
	currentDate,
	transactions,
	currency,
	startOfWeek,
	onEdit,
	onDelete,
	onAddNew,
	onPrevWeek,
	onNextWeek,
	onResetToday,
}: WeekTimelineViewProps) {
	const { activeAdditionId } = useRecentAdditions();

	const weekStart = React.useMemo(
		() => getStartOfWeek(currentDate, startOfWeek),
		[currentDate, startOfWeek],
	);

	const weekEnd = React.useMemo(
		() => getEndOfWeek(currentDate, startOfWeek),
		[currentDate, startOfWeek],
	);

	const todayStr = React.useMemo(() => new Date().toLocaleDateString("en-CA"), []);

	// Generate 7 days in order
	const weekDays = React.useMemo(() => {
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(weekStart);
			d.setDate(d.getDate() + i);
			const dateStr = d.toLocaleDateString("en-CA");
			const isToday = dateStr === todayStr;
			const dayName = DAY_NAMES_SHORT[d.getDay()];
			const formattedLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
			return {
				date: d,
				dateStr,
				isToday,
				dayName,
				formattedLabel,
			};
		});
	}, [weekStart, todayStr]);

	// Group transactions by date string
	const transactionsByDay = React.useMemo(() => {
		const map: Record<string, TransactionItem[]> = {};
		for (const d of weekDays) {
			map[d.dateStr] = [];
		}

		for (const tx of transactions) {
			const txDateStr = tx.date.slice(0, 10);
			if (map[txDateStr]) {
				map[txDateStr].push(tx);
			}
		}
		return map;
	}, [weekDays, transactions]);

	const weekRangeLabel = React.useMemo(() => {
		const startText = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
		const endText = weekEnd.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		return `${startText} – ${endText}`;
	}, [weekStart, weekEnd]);

	return (
		<div className="space-y-4">
			{/* Week Navigator Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl">
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
						<button
							type="button"
							onClick={onPrevWeek}
							className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
							title="Previous Week"
						>
							<ChevronLeft className="w-4 h-4" />
						</button>
						<span className="text-xs font-extrabold text-white px-3 min-w-[170px] text-center">
							{weekRangeLabel}
						</span>
						<button
							type="button"
							onClick={onNextWeek}
							className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
							title="Next Week"
						>
							<ChevronRight className="w-4 h-4" />
						</button>
					</div>

					<button
						type="button"
						onClick={onResetToday}
						className="text-xs font-semibold text-zinc-400 hover:text-emerald-400 px-3 py-1.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition cursor-pointer"
					>
						This Week
					</button>
				</div>

				<div className="flex items-center gap-2 text-xs text-zinc-400">
					<span>7-Day Financial Flow</span>
					<span className="text-zinc-600">•</span>
					<span>Click + on any day to log transaction</span>
				</div>
			</div>

			{/* 7 Columns Timeline */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 w-full overflow-x-auto pb-2">
				{weekDays.map((day) => {
					const dayTransactions = transactionsByDay[day.dateStr] || [];
					const dayIncome = dayTransactions
						.filter((t) => t.type === "INCOME")
						.reduce((sum, t) => sum + t.amount, 0);
					const dayExpense = dayTransactions
						.filter((t) => t.type === "EXPENSE")
						.reduce((sum, t) => sum + t.amount, 0);
					const dayNet = dayIncome - dayExpense;

					return (
						<div
							key={day.dateStr}
							className={`flex flex-col justify-between rounded-2xl border p-3 min-h-[380px] transition-all ${
								day.isToday
									? "border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 via-zinc-900/90 to-zinc-900/80 shadow-md shadow-emerald-950/20"
									: "border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700"
							}`}
						>
							<div>
								{/* Day Header */}
								<div className="flex items-center justify-between pb-2.5 border-b border-zinc-800/80">
									<div className="min-w-0">
										<div className="flex items-center gap-1.5">
											<span className="text-xs font-bold uppercase tracking-wider text-white">
												{day.dayName}
											</span>
											{day.isToday && (
												<span className="rounded-md bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/30">
													Today
												</span>
											)}
										</div>
										<p className="text-[11px] text-zinc-400 font-medium">{day.formattedLabel}</p>
									</div>

									<button
										type="button"
										onClick={() => onAddNew(day.dateStr)}
										className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-emerald-600 hover:border-emerald-500 transition cursor-pointer"
										title={`Add transaction on ${day.formattedLabel}`}
									>
										<Plus className="w-3.5 h-3.5" />
									</button>
								</div>

								{/* Daily Totals Pill */}
								<div className="mt-2.5 flex items-center justify-between rounded-xl bg-zinc-950/70 p-2 text-[10px] border border-zinc-800/60">
									<div>
										<span className="text-zinc-500 block">Inflow</span>
										<span className="font-bold text-emerald-400">
											+{formatCurrency(dayIncome, currency)}
										</span>
									</div>
									<div className="text-right">
										<span className="text-zinc-500 block">Outflow</span>
										<span className="font-bold text-rose-400">
											-{formatCurrency(dayExpense, currency)}
										</span>
									</div>
								</div>

								{/* Transactions List */}
								<div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
									{dayTransactions.length === 0 ? (
										<div className="py-8 text-center text-[11px] text-zinc-500">
											<p>No activity</p>
											<button
												type="button"
												onClick={() => onAddNew(day.dateStr)}
												className="mt-2 text-[10px] text-emerald-400 hover:underline font-semibold cursor-pointer"
											>
												+ Add entry
											</button>
										</div>
									) : (
										dayTransactions.map((tx) => {
											const isIncome = tx.type === "INCOME";
											const isJustAdded = activeAdditionId === tx.id;
											const cleanDesc = tx.description
												? tx.description.replace(/\[Recurring:\s*[^\]]+\]/i, "").trim()
												: "";

											return (
												<div
													key={tx.id}
													className={`group rounded-xl border p-2.5 transition-all ${
														isJustAdded
															? "ring-2 ring-emerald-500/70 bg-emerald-500/10 border-emerald-500/50"
															: "bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700"
													}`}
												>
													<div className="flex items-start justify-between gap-1.5">
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-1.5 flex-wrap">
																<span
																	className={`rounded px-1.5 py-0.5 text-[9px] font-medium border truncate ${
																		tx.category === "Debt / Borrowed" ||
																		tx.category === "Debt Repayment"
																			? "bg-amber-500/15 text-amber-300 border-amber-500/30"
																			: tx.category === "Loan Given" ||
																					tx.category === "Loan Return"
																				? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
																				: "bg-zinc-800 text-zinc-300 border-zinc-700/60"
																	}`}
																>
																	{tx.category}
																</span>
																{isJustAdded && (
																	<span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[8px] font-bold text-emerald-300 border border-emerald-500/40">
																		New
																	</span>
																)}
															</div>
															<p className="mt-1 text-xs font-semibold text-white truncate">
																{cleanDesc || tx.category}
															</p>
															<p className="text-[10px] text-zinc-400">{tx.paymentMethod}</p>
														</div>

														<div className="text-right shrink-0">
															<span
																className={`text-xs font-black block ${
																	isIncome ? "text-emerald-400" : "text-rose-400"
																}`}
															>
																{isIncome ? "+" : "-"}
																{formatCurrency(tx.amount, currency)}
															</span>

															{/* Hover action buttons */}
															<div className="mt-1 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition">
																<button
																	type="button"
																	onClick={() => onEdit(tx)}
																	className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
																	title="Edit"
																>
																	<Edit2 className="w-2.5 h-2.5" />
																</button>
																<button
																	type="button"
																	onClick={() =>
																		onDelete(tx.id, cleanDesc || `${tx.category} transaction`)
																	}
																	className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
																	title="Delete"
																>
																	<Trash2 className="w-2.5 h-2.5" />
																</button>
															</div>
														</div>
													</div>
												</div>
											);
										})
									)}
								</div>
							</div>

							{/* Day Column Footer */}
							<div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
								<span className="text-zinc-500">Day Net</span>
								<span
									className={`font-black ${dayNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}
								>
									{dayNet >= 0 ? "+" : ""}
									{formatCurrency(dayNet, currency)}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
