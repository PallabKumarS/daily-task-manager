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
import { useAuth } from "@/components/providers/auth-provider";
import { TrackerCard } from "@/components/trackers/tracker-card";
import { TrackerDetailModal } from "@/components/trackers/tracker-detail-modal";
import { TrackerFormModal } from "@/components/trackers/tracker-form-modal";
import { TrackerSettlementModal } from "@/components/trackers/tracker-settlement-modal";
import type { DailyTrackerItem } from "@/components/trackers/tracker-types";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";

const getTodayDateString = (): string => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export default function TrackersPage() {
	const { user } = useAuth();
	const confirm = useConfirm();
	const [trackers, setTrackers] = React.useState<DailyTrackerItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [selectedDate, setSelectedDate] = React.useState<string>(
		getTodayDateString(),
	);

	const [formModalOpen, setFormModalOpen] = React.useState(false);
	const [editingTracker, setEditingTracker] =
		React.useState<DailyTrackerItem | null>(null);

	const [detailModalOpen, setDetailModalOpen] = React.useState(false);
	const [activeDetailTracker, setActiveDetailTracker] =
		React.useState<DailyTrackerItem | null>(null);

	const [settlementModalOpen, setSettlementModalOpen] = React.useState(false);
	const [activeSettleTracker, setActiveSettleTracker] =
		React.useState<DailyTrackerItem | null>(null);

	const fetchTrackers = React.useCallback(async () => {
		try {
			const res = await api.get<DailyTrackerItem[]>(
				`/trackers?date=${selectedDate}`,
			);
			if (res.success && res.data) {
				setTrackers(res.data);
			}
		} catch {
			// silently handle network error
		} finally {
			setLoading(false);
		}
	}, [selectedDate]);

	React.useEffect(() => {
		fetchTrackers();

		const onGlobalRefresh = () => fetchTrackers();
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
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

	const handlePrevDay = () => {
		const d = new Date(`${selectedDate}T00:00:00`);
		d.setDate(d.getDate() - 1);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		setSelectedDate(`${year}-${month}-${day}`);
	};

	const handleNextDay = () => {
		const d = new Date(`${selectedDate}T00:00:00`);
		d.setDate(d.getDate() + 1);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		setSelectedDate(`${year}-${month}-${day}`);
	};

	const handleSetToday = () => {
		setSelectedDate(getTodayDateString());
	};

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

	const isToday = selectedDate === getTodayDateString();

	const formattedDateLabel = React.useMemo(() => {
		const d = new Date(`${selectedDate}T00:00:00`);
		return d.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}, [selectedDate]);

	// Total summary calculations
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

	const totalTodayUnits = trackers.reduce(
		(sum, t) => sum + (t.todayValue || 0),
		0,
	);

	return (
		<div className="space-y-6">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
						<span>Daily Trackers & Counters</span>
					</h1>
					<p className="text-xs text-slate-400 mt-1">
						Log daily variable meals, metered deliveries, and habits. Automatic
						monthly billing calculation and ledger settlement.
					</p>
				</div>

				<div className="flex items-center gap-2.5">
					{trackers.length > 0 && (
						<Button
							type="button"
							variant="outline"
							onClick={handleClearAll}
							className="gap-1.5 border-rose-900/40 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 hover:border-rose-800"
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
						className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950"
					>
						<Plus className="w-4 h-4" />
						<span>New Tracker</span>
					</Button>
				</div>
			</div>

			{/* Date Navigation & Period Controls */}
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 backdrop-blur-xl">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handlePrevDay}
						className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
						title="Previous Day"
					>
						<ChevronLeft className="w-4 h-4" />
					</button>

					<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200">
						<Calendar className="w-3.5 h-3.5 text-emerald-400" />
						<span>{formattedDateLabel}</span>
					</div>

					<button
						type="button"
						onClick={handleNextDay}
						className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
						title="Next Day"
					>
						<ChevronRight className="w-4 h-4" />
					</button>

					{!isToday && (
						<button
							type="button"
							onClick={handleSetToday}
							className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
						>
							Today
						</button>
					)}
				</div>

				{/* Date picker input */}
				<div className="flex items-center gap-2">
					<input
						type="date"
						value={selectedDate}
						onChange={(e) => setSelectedDate(e.target.value)}
						className="bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
					/>
				</div>
			</div>

			{/* KPI Overview Summary Ribbon */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
					<span className="text-[11px] font-medium text-slate-400">
						Active Trackers
					</span>
					<p className="mt-1 text-2xl font-extrabold text-white">
						{trackers.length}
					</p>
				</div>

				<div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
					<span className="text-[11px] font-medium text-slate-400">
						Logged Today
					</span>
					<p className="mt-1 text-2xl font-extrabold text-slate-200">
						{totalTodayUnits}{" "}
						<span className="text-xs font-normal text-slate-400">units</span>
					</p>
				</div>

				<div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
					<span className="text-[11px] font-medium text-slate-400">
						Today&apos;s Spend
					</span>
					<p className="mt-1 text-2xl font-extrabold text-slate-200">
						{formatCurrency(totalTodayCost, user?.currency || "USD")}
					</p>
				</div>

				<div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
					<span className="text-[11px] font-medium text-amber-400">
						Total Unpaid Due
					</span>
					<p className="mt-1 text-2xl font-extrabold text-amber-300">
						{formatCurrency(totalUnsettledCost, user?.currency || "USD")}
					</p>
				</div>
			</div>

			{/* Trackers List */}
			{loading ? (
				<div className="py-20 text-center text-xs text-slate-400">
					Loading daily trackers...
				</div>
			) : trackers.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
					{trackers.map((tracker) => (
						<TrackerCard
							key={tracker.id}
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
					))}
				</div>
			) : (
				/* Empty State with Quick Starter Templates */
				<div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-8 sm:p-12 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
						<Calculator className="w-7 h-7" />
					</div>
					<h2 className="mt-4 text-lg font-bold text-white">
						No Trackers Set Up Yet
					</h2>
					<p className="mt-1.5 text-xs text-slate-400 max-w-md mx-auto">
						Track daily variable meals, milk delivery, water supplies, or daily
						habits with 1-click counters and monthly billing calculation.
					</p>

					<div className="mt-8 max-w-xl mx-auto">
						<p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
							Quick Start with a Template:
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
							<button
								type="button"
								onClick={() =>
									handleCreateTemplate({
										name: "Daily Meals Delivery",
										category: "Meals & Food",
										unitName: "meals",
										defaultTarget: 2,
										unitPrice: 4.0,
										color: "emerald",
									})
								}
								className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-emerald-500/40 hover:bg-slate-800/80 transition cursor-pointer"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
									<Utensils className="w-5 h-5" />
								</div>
								<div>
									<p className="text-xs font-bold text-white">
										Daily Meals (Tiffin)
									</p>
									<p className="text-[11px] text-slate-400">
										2 meals/day · $4.00 each
									</p>
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
								className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-cyan-500/40 hover:bg-slate-800/80 transition cursor-pointer"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
									<Milk className="w-5 h-5" />
								</div>
								<div>
									<p className="text-xs font-bold text-white">Milk Delivery</p>
									<p className="text-[11px] text-slate-400">
										1 liter/day · $2.00 each
									</p>
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
								className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-blue-500/40 hover:bg-slate-800/80 transition cursor-pointer"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
									<Droplet className="w-5 h-5" />
								</div>
								<div>
									<p className="text-xs font-bold text-white">Water Glasses</p>
									<p className="text-[11px] text-slate-400">
										8 glasses/day · Habit
									</p>
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
								className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-violet-500/40 hover:bg-slate-800/80 transition cursor-pointer"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
									<BookOpen className="w-5 h-5" />
								</div>
								<div>
									<p className="text-xs font-bold text-white">Study Sessions</p>
									<p className="text-[11px] text-slate-400">
										4 sessions/day · Habit
									</p>
								</div>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Tracker Form Modal */}
			<TrackerFormModal
				isOpen={formModalOpen}
				onClose={() => setFormModalOpen(false)}
				onSuccess={fetchTrackers}
				initialData={editingTracker}
			/>

			{/* Tracker Detail Month Modal */}
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

			{/* Tracker Settlement Modal */}
			<TrackerSettlementModal
				isOpen={settlementModalOpen}
				onClose={() => setSettlementModalOpen(false)}
				tracker={activeSettleTracker}
				onSuccess={fetchTrackers}
			/>
		</div>
	);
}
