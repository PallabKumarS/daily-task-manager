"use client";

import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import * as React from "react";
import { TransactionCard } from "@/components/finances/transaction-card";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { Button } from "@/components/ui/button";
import { CardDeck } from "@/components/ui/card-deck";
import { formatCurrency } from "@/lib/currency-symbols";
import { useRecentAdditions } from "@/lib/recent-activity-store";
import { DAY_NAMES_SHORT } from "@/lib/workweek-preferences";

interface MonthTimelineViewProps {
	currentDate: Date;
	transactions: TransactionItem[];
	currency: string;
	onEdit: (transaction: TransactionItem) => void;
	onDelete: (id: string, desc: string) => void;
	onAddNew: (dateString: string) => void;
}

export function MonthTimelineView({
	currentDate,
	transactions,
	currency,
	onEdit,
	onDelete,
	onAddNew,
}: MonthTimelineViewProps) {
	const { activeAdditionId } = useRecentAdditions();
	const scrollRef = React.useRef<HTMLDivElement>(null);

	const todayStr = React.useMemo(() => new Date().toLocaleDateString("en-CA"), []);

	// Total days in current month
	const daysInMonth = React.useMemo(() => {
		return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
	}, [currentDate]);

	// Generate all days of month
	const days = React.useMemo(() => {
		return Array.from({ length: daysInMonth }, (_, i) => {
			const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
			const dateStr = d.toLocaleDateString("en-CA");
			const dayNumber = i + 1;
			const dayName = DAY_NAMES_SHORT[d.getDay()];
			const isToday = dateStr === todayStr;
			return {
				date: d,
				dateStr,
				dayNumber: dayNumber < 10 ? `0${dayNumber}` : String(dayNumber),
				dayName,
				isToday,
			};
		});
	}, [currentDate, daysInMonth, todayStr]);

	// Selected day state (default to today if in current month, otherwise 1st day)
	const [selectedDateStr, setSelectedDateStr] = React.useState<string>(() => {
		const hasToday = days.some((d) => d.isToday);
		return hasToday ? todayStr : days[0]?.dateStr || "";
	});

	// Keep selectedDateStr valid when month changes
	React.useEffect(() => {
		const match = days.find((d) => d.dateStr === selectedDateStr);
		if (!match && days.length > 0) {
			const hasToday = days.find((d) => d.isToday);
			setSelectedDateStr(hasToday ? todayStr : days[0].dateStr);
		}
	}, [days, selectedDateStr, todayStr]);

	// Auto-scroll to today or selected day on mount / month change
	React.useEffect(() => {
		if (scrollRef.current) {
			const targetEl = scrollRef.current.querySelector(`[data-date="${selectedDateStr}"]`);
			if (targetEl) {
				targetEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
			}
		}
	}, [selectedDateStr]);

	// Group transactions by date
	const transactionsByDate = React.useMemo(() => {
		const map: Record<string, TransactionItem[]> = {};
		for (const d of days) {
			map[d.dateStr] = [];
		}
		for (const tx of transactions) {
			const txDateStr = tx.date.slice(0, 10);
			if (map[txDateStr]) {
				map[txDateStr].push(tx);
			}
		}
		return map;
	}, [days, transactions]);

	const handleScrollLeft = () => {
		if (scrollRef.current) {
			scrollRef.current.scrollBy({ left: -320, behavior: "smooth" });
		}
	};

	const handleScrollRight = () => {
		if (scrollRef.current) {
			scrollRef.current.scrollBy({ left: 320, behavior: "smooth" });
		}
	};

	const selectedDayData = days.find((d) => d.dateStr === selectedDateStr);
	const selectedTransactions = selectedDateStr ? transactionsByDate[selectedDateStr] || [] : [];

	const selectedDayIncome = selectedTransactions
		.filter((t) => t.type === "INCOME")
		.reduce((sum, t) => sum + t.amount, 0);

	const selectedDayExpense = selectedTransactions
		.filter((t) => t.type === "EXPENSE")
		.reduce((sum, t) => sum + t.amount, 0);

	const selectedDayNet = selectedDayIncome - selectedDayExpense;

	return (
		<div className="space-y-4">
			{/* Timeline Header & Scroll Controls */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-surface backdrop-blur-xl">
				<div>
					<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
						<Calendar className="w-4 h-4 text-emerald-400" />
						<span>30-Day Daily Financial Timeline</span>
					</h3>
					<p className="text-xs text-muted-foreground mt-0.5">
						Scroll horizontally to inspect daily totals or click any day to view itemized
						transactions
					</p>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleScrollLeft}
						className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface-sunken text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
						title="Scroll Left"
					>
						<ChevronLeft className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={handleScrollRight}
						className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface-sunken text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
						title="Scroll Right"
					>
						<ChevronRight className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Horizontally Scrollable 30-Day Track */}
			<div
				ref={scrollRef}
				className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x select-none"
				style={{ scrollbarWidth: "thin" }}
			>
				{days.map((day) => {
					const dayTx = transactionsByDate[day.dateStr] || [];
					const dayIncome = dayTx
						.filter((t) => t.type === "INCOME")
						.reduce((sum, t) => sum + t.amount, 0);
					const dayExpense = dayTx
						.filter((t) => t.type === "EXPENSE")
						.reduce((sum, t) => sum + t.amount, 0);
					const dayNet = dayIncome - dayExpense;
					const isSelected = day.dateStr === selectedDateStr;
					const hasActivity = dayTx.length > 0;

					return (
						<button
							type="button"
							key={day.dateStr}
							data-date={day.dateStr}
							onClick={() => setSelectedDateStr(day.dateStr)}
							className={`shrink-0 w-44 rounded-2xl border p-3 cursor-pointer transition-all snap-start flex flex-col justify-between text-left ${
								isSelected
									? "ring-2 ring-emerald-500 border-emerald-500/80 bg-gradient-to-b from-emerald-500/10 via-surface to-surface shadow-lg shadow-emerald-500/10"
									: day.isToday
										? "border-emerald-500/40 bg-surface hover:border-emerald-500/60"
										: "border-border bg-surface hover:border-border-strong hover:bg-surface"
							}`}
						>
							<div className="w-full">
								{/* Day Header */}
								<div className="flex items-start justify-between">
									<div>
										<span className="text-2xl font-black tracking-tight text-foreground block">
											{day.dayNumber}
										</span>
										<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
											{day.dayName}
										</span>
									</div>

									<div className="flex flex-col items-end gap-1">
										{day.isToday && (
											<span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/30">
												Today
											</span>
										)}
										{hasActivity && (
											<span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-semibold text-foreground">
												{dayTx.length} items
											</span>
										)}
									</div>
								</div>

								{/* Daily Totals */}
								<div className="mt-3 space-y-1.5 rounded-xl bg-surface-sunken p-2.5 text-[11px] border border-border">
									<div className="flex items-center justify-between">
										<span className="text-subtle">Inflow:</span>
										<span
											className={`font-bold ${dayIncome > 0 ? "text-emerald-400" : "text-subtle"}`}
										>
											+{formatCurrency(dayIncome, currency)}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-subtle">Outflow:</span>
										<span
											className={`font-bold ${dayExpense > 0 ? "text-rose-400" : "text-subtle"}`}
										>
											-{formatCurrency(dayExpense, currency)}
										</span>
									</div>
								</div>
							</div>

							{/* Day Net Card Footer */}
							<div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs">
								<span className="text-[10px] text-subtle uppercase font-bold">Net</span>
								<span
									className={`font-black ${
										dayNet > 0
											? "text-emerald-400"
											: dayNet < 0
												? "text-rose-400"
												: "text-muted-foreground"
									}`}
								>
									{dayNet > 0 ? "+" : ""}
									{formatCurrency(dayNet, currency)}
								</span>
							</div>
						</button>
					);
				})}
			</div>

			{/* Selected Day Itemized Details Panel */}
			<div className="rounded-2xl border border-border bg-surface p-5 backdrop-blur-xl">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
					<div>
						<div className="flex items-center gap-2">
							<h4 className="text-sm font-extrabold text-foreground">
								Transactions for Day {selectedDayData?.dayNumber} (
								{selectedDayData?.date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric",
								})}
								)
							</h4>
							{selectedDayData?.isToday && (
								<span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
									Today
								</span>
							)}
						</div>
						<p className="text-xs text-muted-foreground mt-0.5">
							{selectedTransactions.length} transaction
							{selectedTransactions.length === 1 ? "" : "s"} logged on this date
						</p>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
							<span className="text-emerald-400 font-bold">
								+{formatCurrency(selectedDayIncome, currency)}
							</span>
							<span className="text-subtle">/</span>
							<span className="text-rose-400 font-bold">
								-{formatCurrency(selectedDayExpense, currency)}
							</span>
							<span className="text-subtle">•</span>
							<span
								className={`font-black ${
									selectedDayNet >= 0 ? "text-emerald-400" : "text-rose-400"
								}`}
							>
								Net: {selectedDayNet >= 0 ? "+" : ""}
								{formatCurrency(selectedDayNet, currency)}
							</span>
						</div>

						{selectedDateStr && (
							<Button
								variant="emerald"
								size="sm"
								onClick={() => onAddNew(selectedDateStr)}
								className="gap-1.5 text-xs h-8 shrink-0"
							>
								<Plus className="w-3.5 h-3.5" />
								<span>Add to this Day</span>
							</Button>
						)}
					</div>
				</div>

				{/* Transactions List / Card Deck */}
				<div className="mt-4">
					{selectedTransactions.length === 0 ? (
						<div className="py-12 text-center text-xs text-subtle border border-dashed border-border rounded-2xl">
							<p>No transactions logged for this day.</p>
							{selectedDateStr && (
								<button
									type="button"
									onClick={() => onAddNew(selectedDateStr)}
									className="mt-2 text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
								>
									+ Record an expense or income for this day
								</button>
							)}
						</div>
					) : (
						<CardDeck
							items={selectedTransactions}
							keyExtractor={(item) => item.id}
							storageKey="month_day_transactions"
							defaultMode="deck"
							desktopColumns={2}
							title={`Day ${selectedDayData?.dayNumber} Transactions`}
							subtitle={`${selectedTransactions.length} transaction${selectedTransactions.length === 1 ? "" : "s"} on ${selectedDateStr}`}
							renderCard={(item) => (
								<TransactionCard
									item={item}
									currency={currency}
									onEdit={onEdit}
									onDelete={(tx) => onDelete(tx.id, tx.description || `${tx.category} transaction`)}
									isJustAdded={activeAdditionId === item.id}
								/>
							)}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
