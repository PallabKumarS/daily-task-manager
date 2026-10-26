"use client";

import {
	BookOpen,
	Calculator,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Droplet,
	Milk,
	Plus,
	Trash2,
	Utensils,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useContextDock } from "@/components/layout/context-dock";
import { useAuth } from "@/components/providers/auth-provider";
import { TrackerCard } from "@/components/trackers/tracker-card";
import { TrackerDetailModal } from "@/components/trackers/tracker-detail-modal";
import { TrackerFormModal } from "@/components/trackers/tracker-form-modal";
import { TrackerSettlementModal } from "@/components/trackers/tracker-settlement-modal";
import type { DailyTrackerItem } from "@/components/trackers/tracker-types";
import { Button } from "@/components/ui/button";
import { CardDeck } from "@/components/ui/card-deck";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";
import { getTodayDateString, useTodayDate } from "@/lib/date-helpers";

export function TrackersClient() {
	const { user } = useAuth();
	const confirm = useConfirm();
	const { setCustomSlot } = useContextDock();
	const { todayDateString: todayStr } = useTodayDate();
	const [trackers, setTrackers] = React.useState<DailyTrackerItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [selectedDate, setSelectedDate] = React.useState<string>(getTodayDateString());
	const prevTodayRef = React.useRef(todayStr);

	React.useEffect(() => {
		if (prevTodayRef.current !== todayStr) {
			const prevToday = prevTodayRef.current;
			prevTodayRef.current = todayStr;
			if (selectedDate === prevToday) {
				setSelectedDate(todayStr);
			}
		}
	}, [todayStr, selectedDate]);

	const [formModalOpen, setFormModalOpen] = React.useState(false);
	const [editingTracker, setEditingTracker] = React.useState<DailyTrackerItem | null>(null);

	const [detailModalOpen, setDetailModalOpen] = React.useState(false);
	const [activeDetailTracker, setActiveDetailTracker] = React.useState<DailyTrackerItem | null>(
		null,
	);

	const [settlementModalOpen, setSettlementModalOpen] = React.useState(false);
	const [activeSettleTracker, setActiveSettleTracker] = React.useState<DailyTrackerItem | null>(
		null,
	);
	const isFetchingRef = React.useRef(false);
	const pendingFetchRef = React.useRef(false);

	const fetchTrackers = React.useCallback(async () => {
		if (isFetchingRef.current) {
			pendingFetchRef.current = true;
			return;
		}
		isFetchingRef.current = true;
		pendingFetchRef.current = false;

		try {
			const res = await api.get<DailyTrackerItem[]>(`/trackers?date=${selectedDate}`);
			if (res.success && res.data) {
				setTrackers(res.data);
			}
		} catch {
			// ignore
		} finally {
			setLoading(false);
			isFetchingRef.current = false;
			if (pendingFetchRef.current) {
				pendingFetchRef.current = false;
				fetchTrackers();
			}
		}
	}, [selectedDate]);

	React.useEffect(() => {
		fetchTrackers();

		const onGlobalRefresh = () => fetchTrackers();
		const onDateChanged = (e: Event) => {
			const customEvent = e as CustomEvent<{ date: string }>;
			if (customEvent.detail?.date) {
				setSelectedDate(customEvent.detail.date);
			} else {
				setSelectedDate(getTodayDateString());
			}
		};
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		window.addEventListener("daypulse:date-changed", onDateChanged);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
			window.removeEventListener("daypulse:date-changed", onDateChanged);
		};
	}, [fetchTrackers]);

	const handleClearAll = async () => {
		const ok = await confirm({
			title: "Delete All Trackers",
			description:
				"Are you sure you want to permanently delete all daily trackers and monitors? This action cannot be undone.",
			confirmText: "Delete All",
			variant: "destructive",
		});
		if (!ok) return;

		try {
			const res = await api.delete("/trackers");
			if (res.success) {
				toast.success("All trackers deleted");
				fetchTrackers();
			} else {
				toast.error(res.message || "Failed to delete trackers");
			}
		} catch {
			toast.error("Network error while deleting trackers");
		}
	};

	const handlePrevDay = React.useCallback(() => {
		const d = new Date(`${selectedDate}T00:00:00`);
		d.setDate(d.getDate() - 1);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		setSelectedDate(`${year}-${month}-${day}`);
	}, [selectedDate]);

	const handleNextDay = React.useCallback(() => {
		const d = new Date(`${selectedDate}T00:00:00`);
		d.setDate(d.getDate() + 1);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		setSelectedDate(`${year}-${month}-${day}`);
	}, [selectedDate]);

	const handleSetToday = React.useCallback(() => {
		setSelectedDate(getTodayDateString());
	}, []);

	const handleCreateTemplate = async (template: {
		name: string;
		category: string;
		unitName: string;
		defaultTarget: number;
		unitPrice: number | null;
		color: string;
	}) => {
		try {
			await api.post("/trackers", {
				...template,
				currency: user?.currency || "USD",
			});
			toast.success(`Created "${template.name}" tracker`);
			fetchTrackers();
		} catch {
			toast.error("Failed to create template tracker");
		}
	};

	const isToday = selectedDate === todayStr;

	const formattedDateLabel = React.useMemo(() => {
		const d = new Date(`${selectedDate}T00:00:00`);
		return d.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}, [selectedDate]);

	React.useEffect(() => {
		setCustomSlot(
			<div className="flex items-center justify-between gap-2 w-full">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={handlePrevDay}
						className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
						aria-label="Previous day"
					>
						<ChevronLeft className="w-4 h-4" />
					</button>
					<span className="px-2 text-xs font-bold text-foreground truncate max-w-[130px]">
						{isToday ? "Today" : formattedDateLabel}
					</span>
					<button
						type="button"
						onClick={handleNextDay}
						className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
						aria-label="Next day"
					>
						<ChevronRight className="w-4 h-4" />
					</button>
					{!isToday && (
						<button
							type="button"
							onClick={handleSetToday}
							className="px-2 py-1 rounded-lg bg-primary-soft text-routine-fg text-xs font-semibold cursor-pointer"
						>
							Today
						</button>
					)}
				</div>
				<button
					type="button"
					onClick={() => {
						setEditingTracker(null);
						setFormModalOpen(true);
					}}
					className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm cursor-pointer shrink-0"
				>
					<Plus className="w-3.5 h-3.5" />
					<span>Tracker</span>
				</button>
			</div>,
		);
		return () => setCustomSlot(null);
	}, [setCustomSlot, handlePrevDay, handleNextDay, handleSetToday, isToday, formattedDateLabel]);

	const totalUnsettledCost = trackers.reduce(
		(sum, t) => sum + (t.monthStats?.unsettledCost || 0),
		0,
	);

	const totalTodayCost = trackers.reduce((sum, t) => {
		if (t.unitPrice && t.todayLog && t.todayLog.status !== "CANCELLED") {
			return sum + t.todayLog.value * t.unitPrice;
		}
		return sum;
	}, 0);

	const totalTodayUnits = trackers.reduce((sum, t) => sum + (t.todayValue || 0), 0);

	const renderSingleCard = (tracker: DailyTrackerItem) => (
		<TrackerCard
			tracker={tracker}
			selectedDate={selectedDate}
			onRefresh={fetchTrackers}
			onOpenDetails={(t) => {
				setActiveDetailTracker(t);
				setDetailModalOpen(true);
			}}
			onOpenEdit={(t) => {
				setEditingTracker(t);
				setFormModalOpen(true);
			}}
			onOpenSettle={(t) => {
				setActiveSettleTracker(t);
				setSettlementModalOpen(true);
			}}
		/>
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
						<span>Daily Trackers & Counters</span>
					</h1>
					<p className="text-xs sm:text-sm text-muted-foreground mt-1">
						Log daily variable meals, metered deliveries, and habits with monthly billing
						calculation and ledger settlement.
					</p>
				</div>

				<div className="flex items-center gap-2.5">
					{trackers.length > 0 && (
						<Button
							type="button"
							variant="outline"
							onClick={handleClearAll}
							className="gap-1.5 border-rose-500/30 text-expense-fg hover:bg-expense-soft"
						>
							<Trash2 className="w-4 h-4" />
							<span>Clear All</span>
						</Button>
					)}
					<Button
						type="button"
						onClick={() => {
							setEditingTracker(null);
							setFormModalOpen(true);
						}}
						className="flex items-center gap-1.5"
					>
						<Plus className="w-4 h-4" />
						<span>New Tracker</span>
					</Button>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-card)]">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handlePrevDay}
						className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 border border-border text-muted-foreground hover:text-foreground transition cursor-pointer"
						title="Previous Day"
					>
						<ChevronLeft className="w-4 h-4" />
					</button>

					<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs font-semibold text-foreground">
						<Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
						<span>{formattedDateLabel}</span>
					</div>

					<button
						type="button"
						onClick={handleNextDay}
						className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 border border-border text-muted-foreground hover:text-foreground transition cursor-pointer"
						title="Next Day"
					>
						<ChevronRight className="w-4 h-4" />
					</button>

					{!isToday && (
						<button
							type="button"
							onClick={handleSetToday}
							className="px-3 py-1.5 rounded-xl bg-primary-soft hover:opacity-90 text-routine-fg border border-teal-500/30 text-xs font-semibold transition cursor-pointer"
						>
							Today
						</button>
					)}
				</div>

				<div className="flex items-center gap-2">
					<input
						type="date"
						value={selectedDate}
						onChange={(e) => setSelectedDate(e.target.value)}
						className="bg-surface-2 border border-border text-foreground px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-teal-500"
					/>
				</div>
			</div>

			<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
				<div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
					<span className="text-xs font-semibold text-muted-foreground">Active Trackers</span>
					<p className="mt-1 text-2xl font-extrabold text-foreground tabular-nums">
						{trackers.length}
					</p>
				</div>

				<div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
					<span className="text-xs font-semibold text-muted-foreground">Logged Today</span>
					<p className="mt-1 text-2xl font-extrabold text-foreground tabular-nums">
						{totalTodayUnits}{" "}
						<span className="text-xs font-normal text-muted-foreground">units</span>
					</p>
				</div>

				<div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
					<span className="text-xs font-semibold text-muted-foreground">Today&apos;s Spend</span>
					<p className="mt-1 text-2xl font-extrabold text-foreground tabular-nums">
						{formatCurrency(totalTodayCost, user?.currency || "USD")}
					</p>
				</div>

				<div className="rounded-2xl border border-amber-500/30 bg-alarm-soft p-4 shadow-[var(--shadow-card)]">
					<span className="text-xs font-semibold text-alarm-fg">Total Unpaid Due</span>
					<p className="mt-1 text-2xl font-extrabold text-alarm-fg tabular-nums">
						{formatCurrency(totalUnsettledCost, user?.currency || "USD")}
					</p>
				</div>
			</div>

			{loading ? (
				<div className="py-20 text-center text-xs text-muted-foreground">
					Loading daily trackers...
				</div>
			) : trackers.length > 0 ? (
				<CardDeck
					items={trackers}
					keyExtractor={(t) => t.id}
					storageKey="trackers"
					defaultMode="deck"
					desktopColumns={2}
					title="Active Trackers"
					subtitle="Browse cards with Previous / Next buttons or switch to All"
					renderCard={(tracker) => renderSingleCard(tracker)}
					renderGrid={(allTrackers) => (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2">
							{allTrackers.map((tracker) => (
								<div key={tracker.id}>{renderSingleCard(tracker)}</div>
							))}
						</div>
					)}
				/>
			) : (
				<div className="rounded-3xl border border-dashed border-border-strong bg-surface/60 p-8 sm:p-12 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-routine-fg">
						<Calculator className="w-7 h-7" />
					</div>
					<h2 className="mt-4 text-lg font-bold text-foreground">No Trackers Set Up Yet</h2>
					<p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
						Track daily variable meals, milk delivery, water supplies, or daily habits with 1-click
						counters and monthly billing calculation.
					</p>

					<div className="mt-8 max-w-xl mx-auto">
						<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Quick Start with a Template:
						</p>
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(175px,100%),1fr))] gap-2 text-left">
							<button
								type="button"
								onClick={() =>
									handleCreateTemplate({
										name: "Daily Meals Delivery",
										category: "Meals & Food",
										unitName: "meals",
										defaultTarget: 2,
										unitPrice: 4.0,
										color: "teal",
									})
								}
								className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface hover:border-teal-500/40 hover:bg-surface-2 transition cursor-pointer"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-routine-soft text-routine-fg">
									<Utensils className="w-5 h-5" />
								</div>
								<div>
									<p className="text-xs font-bold text-foreground">Daily Meals (Tiffin)</p>
									<p className="text-xs text-muted-foreground">2 meals/day · $4.00 each</p>
								</div>
							</button>

							<button
								type="button"
								onClick={() =>
									handleCreateTemplate({
										name: "Milk Delivery",
										category: "Household & Utilities",
										unitName: "liters",
										defaultTarget: 1,
										unitPrice: 2.0,
										color: "cyan",
									})
								}
								className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface hover:border-cyan-500/40 hover:bg-surface-2 transition cursor-pointer"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
									<Milk className="w-5 h-5" />
								</div>
								<div>
									<p className="text-xs font-bold text-foreground">Milk Delivery</p>
									<p className="text-xs text-muted-foreground">1 liter/day · $2.00 each</p>
								</div>
							</button>

							<button
								type="button"
								onClick={() =>
									handleCreateTemplate({
										name: "Water Intake",
										category: "Health & Fitness",
										unitName: "glasses",
										defaultTarget: 8,
										unitPrice: null,
										color: "blue",
									})
								}
								className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface hover:border-blue-500/40 hover:bg-surface-2 transition cursor-pointer"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
									<Droplet className="w-5 h-5" />
								</div>
								<div>
									<p className="text-xs font-bold text-foreground">Water Glasses</p>
									<p className="text-xs text-muted-foreground">8 glasses/day · Habit</p>
								</div>
							</button>

							<button
								type="button"
								onClick={() =>
									handleCreateTemplate({
										name: "Study Pomodoros",
										category: "Work & Study",
										unitName: "sessions",
										defaultTarget: 4,
										unitPrice: null,
										color: "violet",
									})
								}
								className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface hover:border-violet-500/40 hover:bg-surface-2 transition cursor-pointer"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tracker-soft text-tracker-fg">
									<BookOpen className="w-5 h-5" />
								</div>
								<div>
									<p className="text-xs font-bold text-foreground">Study Sessions</p>
									<p className="text-xs text-muted-foreground">4 sessions/day · Habit</p>
								</div>
							</button>
						</div>
					</div>
				</div>
			)}

			<TrackerFormModal
				isOpen={formModalOpen}
				onClose={() => setFormModalOpen(false)}
				onSuccess={fetchTrackers}
				initialData={editingTracker}
			/>

			<TrackerDetailModal
				isOpen={detailModalOpen}
				onClose={() => setDetailModalOpen(false)}
				tracker={activeDetailTracker}
				onOpenSettle={(t) => {
					setDetailModalOpen(false);
					setActiveSettleTracker(t);
					setSettlementModalOpen(true);
				}}
				onRefreshParent={fetchTrackers}
			/>

			<TrackerSettlementModal
				isOpen={settlementModalOpen}
				onClose={() => setSettlementModalOpen(false)}
				tracker={activeSettleTracker}
				onSuccess={fetchTrackers}
			/>
		</div>
	);
}
