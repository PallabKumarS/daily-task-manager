"use client";

import { Calendar, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { TransactionCard } from "@/components/finances/transaction-card";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";
import { useTodayDate } from "@/lib/date-helpers";
import { useRecentAdditions } from "@/lib/recent-activity-store";

export interface TransactionItem {
	id: string;
	type: "EXPENSE" | "INCOME";
	amount: number;
	category: string;
	description?: string | null;
	paymentMethod: string;
	date: string;
}

interface TransactionListProps {
	transactions: TransactionItem[];
	currency: string;
	currentDate: Date;
	filterType: "ALL" | "EXPENSE" | "INCOME";
	onEdit: (transaction: TransactionItem) => void;
	onRefresh: () => void;
	onPrevPeriod?: () => void;
	onNextPeriod?: () => void;
	onSelectDate?: (date: Date) => void;
}

function getLocalDateKey(dateInput: string | Date): string {
	const d = new Date(dateInput);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function formatDaySeparator(dateKey: string): string {
	const [y, m, day] = dateKey.split("-").map(Number);
	const d = new Date(y, m - 1, day);
	return d.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatDayNet(items: TransactionItem[], currency: string): string {
	const income = items.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0);
	const expense = items.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0);
	const net = income - expense;
	return `${net >= 0 ? "+" : ""}${formatCurrency(net, currency)}`;
}

export function TransactionList({
	transactions,
	currency,
	currentDate,
	filterType,
	onEdit,
	onRefresh,
	onPrevPeriod,
	onNextPeriod,
	onSelectDate,
}: TransactionListProps) {
	const confirm = useConfirm();
	const { activeAdditionId } = useRecentAdditions();
	const { todayDateString: todayKey } = useTodayDate();
	const prevTodayRef = React.useRef(todayKey);
	const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);
	const [selectedDate, setSelectedDate] = React.useState<Date>(() => new Date(currentDate));
	const [isMonthView, setIsMonthView] = React.useState(false);

	React.useEffect(() => {
		if (prevTodayRef.current !== todayKey) {
			const prevToday = prevTodayRef.current;
			prevTodayRef.current = todayKey;
			if (getLocalDateKey(selectedDate) === prevToday) {
				const nextDate = new Date();
				setSelectedDate(nextDate);
				onSelectDate?.(nextDate);
			}
		}
	}, [todayKey, selectedDate, onSelectDate]);

	React.useEffect(() => {
		setSelectedDate((prev) => {
			if (
				prev.getMonth() === currentDate.getMonth() &&
				prev.getFullYear() === currentDate.getFullYear()
			) {
				return prev;
			}
			return new Date(currentDate);
		});
	}, [currentDate]);

	const handleDelete = async (id: string) => {
		const ok = await confirm({
			title: "Delete Transaction",
			description:
				"Are you sure you want to delete this transaction record? This action cannot be undone.",
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete(`/finances/${id}`);
			if (res.success) {
				toast.success("Transaction deleted");
				onRefresh();
			} else {
				toast.error(res.message || "Failed to delete");
			}
		} catch {
			toast.error("Network error while deleting");
		}
	};

	const handleDuplicateToToday = async (item: TransactionItem) => {
		setDuplicatingId(item.id);
		try {
			const res = await api.post("/finances", {
				type: item.type,
				amount: item.amount,
				category: item.category,
				description: item.description,
				paymentMethod: item.paymentMethod,
				date: new Date().toISOString(),
			});

			if (res.success) {
				toast.success(`Added ${item.type === "INCOME" ? "income" : "expense"} to today's ledger`);
				onRefresh();
			} else {
				toast.error(res.message || "Failed to duplicate transaction to today");
			}
		} catch {
			toast.error("Network error while adding transaction to today");
		} finally {
			setDuplicatingId(null);
		}
	};

	const filteredTransactions = React.useMemo(() => {
		return transactions.filter((t) => {
			if (filterType === "ALL") return true;
			return t.type === filterType;
		});
	}, [transactions, filterType]);

	const selectedDateKey = getLocalDateKey(selectedDate);

	const dayTransactions = React.useMemo(() => {
		return filteredTransactions.filter((t) => getLocalDateKey(t.date) === selectedDateKey);
	}, [filteredTransactions, selectedDateKey]);

	const monthLabel = currentDate.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});

	const groupedMonthDays = React.useMemo(() => {
		const map: Record<string, TransactionItem[]> = {};
		for (const t of filteredTransactions) {
			const k = getLocalDateKey(t.date);
			if (!map[k]) map[k] = [];
			map[k].push(t);
		}
		return Object.keys(map)
			.sort()
			.reverse()
			.map((dateKey) => ({
				dateKey,
				items: map[dateKey],
			}));
	}, [filteredTransactions]);

	const handlePrevDay = () => {
		const next = new Date(selectedDate);
		next.setDate(next.getDate() - 1);
		setSelectedDate(next);
		if (
			next.getMonth() !== currentDate.getMonth() ||
			next.getFullYear() !== currentDate.getFullYear()
		) {
			onSelectDate?.(next);
		}
	};

	const handleNextDay = () => {
		const next = new Date(selectedDate);
		next.setDate(next.getDate() + 1);
		setSelectedDate(next);
		if (
			next.getMonth() !== currentDate.getMonth() ||
			next.getFullYear() !== currentDate.getFullYear()
		) {
			onSelectDate?.(next);
		}
	};

	const handleResetToday = () => {
		const today = new Date();
		setSelectedDate(today);
		if (
			today.getMonth() !== currentDate.getMonth() ||
			today.getFullYear() !== currentDate.getFullYear()
		) {
			onSelectDate?.(today);
		}
	};

	return (
		<div className="space-y-4">
			{!isMonthView ? (
				<div className="space-y-3.5">
					{/* Day Header Info */}
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border bg-surface-2/40">
						<div className="flex items-center gap-2">
							<CalendarDays className="w-4 h-4 text-teal-400 shrink-0" />
							<span className="text-xs sm:text-sm font-bold text-foreground">
								{formatDaySeparator(selectedDateKey)}
							</span>
							{selectedDateKey === todayKey && (
								<span className="rounded bg-teal-500/20 px-1.5 py-0.2 text-[9px] font-bold text-teal-400 border border-teal-500/30">
									Today
								</span>
							)}
						</div>

						<div className="flex items-center gap-2 text-xs">
							<span className="text-[11px] text-muted-foreground">
								{dayTransactions.length} {dayTransactions.length === 1 ? "entry" : "entries"}
							</span>
							{dayTransactions.length > 0 && (
								<>
									<span className="text-muted-foreground">•</span>
									<span className="font-semibold tabular-nums text-foreground">
										Net: {formatDayNet(dayTransactions, currency)}
									</span>
								</>
							)}
						</div>
					</div>

					{/* Day's Transactions Cards */}
					{dayTransactions.length === 0 ? (
						<div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
							No transactions logged for this day.
						</div>
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
							{dayTransactions.map((item) => (
								<TransactionCard
									key={item.id}
									item={item}
									currency={currency}
									isJustAdded={activeAdditionId === item.id}
									isDuplicating={duplicatingId === item.id}
									onEdit={onEdit}
									onDelete={(tx) => handleDelete(tx.id)}
									onDuplicate={handleDuplicateToToday}
								/>
							))}
						</div>
					)}

					{/* Button to load all this month's events */}
					<div className="flex justify-center pt-1">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsMonthView(true)}
							title={`Load and show all events for ${monthLabel}`}
							className="gap-2 text-xs h-8"
						>
							<Calendar className="w-3.5 h-3.5 text-teal-400" />
							<span>
								Load All Events for {monthLabel} ({filteredTransactions.length})
							</span>
						</Button>
					</div>

					{/* Day Progress Navigation Bar */}
					<div className="flex items-center justify-between border-t border-border pt-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={handlePrevDay}
							title="View previous day's events"
							className="gap-1.5 text-xs h-8"
						>
							<ChevronLeft className="w-4 h-4" />
							<span>Previous Day</span>
						</Button>

						<button
							type="button"
							onClick={handleResetToday}
							title="Jump to today's date"
							className="text-xs font-semibold text-routine-fg hover:underline cursor-pointer"
						>
							Today
						</button>

						<Button
							variant="ghost"
							size="sm"
							onClick={handleNextDay}
							title="View next day's events"
							className="gap-1.5 text-xs h-8"
						>
							<span>Next Day</span>
							<ChevronRight className="w-4 h-4" />
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-4">
					{/* Month View Subheader */}
					<div className="flex items-center justify-between pb-1">
						<div className="flex items-center gap-2">
							<span className="text-xs sm:text-sm font-bold text-foreground">
								All Events for {monthLabel}
							</span>
							<span className="text-[11px] text-muted-foreground">
								({filteredTransactions.length} entries across {groupedMonthDays.length} days)
							</span>
						</div>

						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsMonthView(false)}
							title="Return to single day view"
							className="gap-1.5 text-xs h-7"
						>
							<CalendarDays className="w-3.5 h-3.5 text-teal-400" />
							<span>Back to Day View</span>
						</Button>
					</div>

					{/* Grouped Month Events with Date Separators */}
					{groupedMonthDays.length === 0 ? (
						<div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
							No transactions found for {monthLabel}.
						</div>
					) : (
						<div className="space-y-4">
							{groupedMonthDays.map((group) => (
								<div key={group.dateKey} className="space-y-2.5">
									{/* Date Separator */}
									<div className="flex items-center gap-2.5 py-1 border-b border-border/80">
										<div className="flex items-center gap-2">
											<span className="text-xs font-bold text-foreground">
												{formatDaySeparator(group.dateKey)}
											</span>
											<span className="text-[10px] text-muted-foreground px-2 py-0.2 rounded-full bg-surface-2 border border-border">
												{group.items.length} {group.items.length === 1 ? "entry" : "entries"}
											</span>
										</div>
										<div className="h-px flex-1 bg-border/60" />
										<span className="text-xs font-semibold tabular-nums text-muted-foreground">
											{formatDayNet(group.items, currency)}
										</span>
									</div>

									{/* Day's cards */}
									<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
										{group.items.map((item) => (
											<TransactionCard
												key={item.id}
												item={item}
												currency={currency}
												isJustAdded={activeAdditionId === item.id}
												isDuplicating={duplicatingId === item.id}
												onEdit={onEdit}
												onDelete={(tx) => handleDelete(tx.id)}
												onDuplicate={handleDuplicateToToday}
											/>
										))}
									</div>
								</div>
							))}
						</div>
					)}

					{/* Month Navigation Bar */}
					<div className="flex items-center justify-between border-t border-border pt-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={onPrevPeriod}
							title="Load previous month's transactions"
							className="gap-1.5 text-xs h-8"
						>
							<ChevronLeft className="w-4 h-4" />
							<span>Previous Month</span>
						</Button>

						<span className="text-xs font-bold text-foreground">{monthLabel}</span>

						<Button
							variant="ghost"
							size="sm"
							onClick={onNextPeriod}
							title="Load next month's transactions"
							className="gap-1.5 text-xs h-8"
						>
							<span>Next Month</span>
							<ChevronRight className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
