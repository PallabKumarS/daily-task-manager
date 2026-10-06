"use client";

import {
	Ban,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	FileText,
	Minus,
	Plus,
	Receipt,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";
import { cn } from "@/lib/utils";
import type { DailyTrackerItem, TrackerDayDetail, TrackerDetailResponse } from "./tracker-types";

interface TrackerDetailModalProps {
	isOpen: boolean;
	onClose: () => void;
	tracker: DailyTrackerItem | null;
	onOpenSettle: (tracker: DailyTrackerItem) => void;
	onRefreshParent: () => void;
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
];

export function TrackerDetailModal({
	isOpen,
	onClose,
	tracker,
	onOpenSettle,
	onRefreshParent,
}: TrackerDetailModalProps) {
	const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());
	const [selectedMonth, setSelectedMonth] = React.useState<number>(new Date().getMonth() + 1);
	const [detailData, setDetailData] = React.useState<TrackerDetailResponse | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [editingDayDate, setEditingDayDate] = React.useState<string | null>(null);
	const [editingDayNote, setEditingDayNote] = React.useState<string>("");

	const fetchDetails = React.useCallback(async () => {
		if (!tracker) return;
		try {
			setLoading(true);
			const res = await api.get<TrackerDetailResponse>(
				`/trackers/${tracker.id}?year=${selectedYear}&month=${selectedMonth}`,
			);
			if (res.success && res.data) {
				setDetailData(res.data);
			}
		} catch {
			toast.error("Failed to load tracker details");
		} finally {
			setLoading(false);
		}
	}, [tracker, selectedYear, selectedMonth]);

	React.useEffect(() => {
		if (isOpen && tracker) {
			fetchDetails();
		}
	}, [isOpen, tracker, fetchDetails]);

	if (!tracker) return null;

	const handlePrevMonth = () => {
		if (selectedMonth === 1) {
			setSelectedMonth(12);
			setSelectedYear((prev) => prev - 1);
		} else {
			setSelectedMonth((prev) => prev - 1);
		}
	};

	const handleNextMonth = () => {
		if (selectedMonth === 12) {
			setSelectedMonth(1);
			setSelectedYear((prev) => prev + 1);
		} else {
			setSelectedMonth((prev) => prev + 1);
		}
	};

	const handleDayValueChange = async (
		day: TrackerDayDetail,
		delta: number,
		newStatus: "LOGGED" | "CANCELLED" | "SKIPPED" = "LOGGED",
	) => {
		const newVal = Math.max(0, day.value + delta);
		try {
			await api.post(`/trackers/${tracker.id}/log`, {
				date: day.date,
				value: newVal,
				status: newStatus,
				notes: day.notes,
			});
			fetchDetails();
			onRefreshParent();
		} catch {
			toast.error("Failed to update day log");
		}
	};

	const handleQuickToggleCancel = async (day: TrackerDayDetail) => {
		const isCurrentlyCancelled = day.status === "CANCELLED" && day.value === 0;
		const nextVal = isCurrentlyCancelled ? tracker.defaultTarget : 0;
		const nextStatus = isCurrentlyCancelled ? "LOGGED" : "CANCELLED";
		const nextNote = isCurrentlyCancelled ? "" : day.notes || "Cancelled with provider";

		try {
			await api.post(`/trackers/${tracker.id}/log`, {
				date: day.date,
				value: nextVal,
				status: nextStatus,
				notes: nextNote,
			});
			fetchDetails();
			onRefreshParent();
		} catch {
			toast.error("Failed to toggle cancel state");
		}
	};

	const handleSaveDayNote = async (day: TrackerDayDetail) => {
		try {
			await api.post(`/trackers/${tracker.id}/log`, {
				date: day.date,
				value: day.value,
				status: day.status as "LOGGED" | "CANCELLED" | "SKIPPED",
				notes: editingDayNote,
			});
			setEditingDayDate(null);
			fetchDetails();
			onRefreshParent();
			toast.success("Note updated");
		} catch {
			toast.error("Failed to update note");
		}
	};

	const hasUnitPrice = typeof tracker.unitPrice === "number" && tracker.unitPrice > 0;
	const stats = detailData?.stats;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={tracker.name}
			description={`Monthly logs and billing overview for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
			maxWidth="2xl"
		>
			<div className="space-y-6">
				{/* Month Selector Bar */}
				<div className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 p-3">
					<button
						type="button"
						onClick={handlePrevMonth}
						className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
					>
						<ChevronLeft className="w-5 h-5" />
					</button>
					<div className="text-center">
						<span className="text-base font-bold text-white tracking-wide">
							{MONTH_NAMES[selectedMonth - 1]} {selectedYear}
						</span>
						<p className="text-[11px] text-slate-400">
							{hasUnitPrice
								? `${formatCurrency(tracker.unitPrice || 0, tracker.currency)} per ${tracker.unitName}`
								: "Count Tracker"}
						</p>
					</div>
					<button
						type="button"
						onClick={handleNextMonth}
						className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
					>
						<ChevronRight className="w-5 h-5" />
					</button>
				</div>

				{/* KPI Stat Cards */}
				{stats && (
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
							<span className="text-[11px] font-medium text-slate-400">Total Consumed</span>
							<p className="mt-1 text-xl font-extrabold text-white">
								{stats.totalUnits}{" "}
								<span className="text-xs font-normal text-slate-400">{tracker.unitName}</span>
							</p>
						</div>
						<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
							<span className="text-[11px] font-medium text-slate-400">Total Bill</span>
							<p className="mt-1 text-xl font-extrabold text-slate-200">
								{hasUnitPrice ? formatCurrency(stats.totalCost, tracker.currency) : "—"}
							</p>
						</div>
						<div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
							<span className="text-[11px] font-medium text-amber-400">Unsettled Due</span>
							<p className="mt-1 text-xl font-extrabold text-amber-300">
								{hasUnitPrice ? formatCurrency(stats.unsettledCost, tracker.currency) : "—"}
							</p>
						</div>
						<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
							<span className="text-[11px] font-medium text-slate-400">Cancelled Days</span>
							<p className="mt-1 text-xl font-extrabold text-rose-400">
								{stats.cancelledDaysCount}{" "}
								<span className="text-xs font-normal text-slate-400">days</span>
							</p>
						</div>
					</div>
				)}

				{/* Settlement Prompt Banner */}
				{hasUnitPrice && stats && stats.unsettledCost > 0 && (
					<div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm">
						<div className="flex items-center gap-3 text-left">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
								<Receipt className="w-5 h-5" />
							</div>
							<div>
								<p className="text-sm font-bold text-white">
									Unsettled Balance: {formatCurrency(stats.unsettledCost, tracker.currency)}
								</p>
								<p className="text-xs text-slate-300">
									{stats.unsettledUnits} unpaid {tracker.unitName} logged for{" "}
									{MONTH_NAMES[selectedMonth - 1]}.
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => onOpenSettle(tracker)}
							className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-950 transition cursor-pointer"
						>
							Settle & Record in Finances
						</button>
					</div>
				)}

				{/* Month Calendar Matrix Table */}
				<div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
					<div className="border-b border-slate-800 bg-slate-900/60 px-4 py-3 text-xs font-bold text-slate-300 grid grid-cols-12 gap-2">
						<div className="col-span-3 sm:col-span-2">Date</div>
						<div className="col-span-4 sm:col-span-3 text-center">Count ({tracker.unitName})</div>
						<div className="col-span-3 sm:col-span-2 text-right">Cost</div>
						<div className="col-span-2 sm:col-span-2 text-center">Status</div>
						<div className="hidden sm:block sm:col-span-3 text-left">Notes</div>
					</div>

					<div className="max-h-[360px] overflow-y-auto divide-y divide-slate-800/60 text-xs">
						{loading ? (
							<div className="p-8 text-center text-slate-400">Loading daily logs...</div>
						) : detailData && detailData.days.length > 0 ? (
							detailData.days.map((day) => {
								const dateObj = new Date(`${day.date}T00:00:00`);
								const weekdayName = dateObj.toLocaleDateString("en-US", {
									weekday: "short",
								});
								const isCancelled = day.status === "CANCELLED" && day.value === 0;

								return (
									<div
										key={day.date}
										className={cn(
											"px-4 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-slate-900/40 transition",
											isCancelled && "bg-rose-500/5",
											day.isSettled && "bg-emerald-500/5",
										)}
									>
										{/* Date */}
										<div className="col-span-3 sm:col-span-2">
											<span className="font-semibold text-white">
												{String(day.dayNumber).padStart(2, "0")} {weekdayName}
											</span>
										</div>

										{/* Count Stepper */}
										<div className="col-span-4 sm:col-span-3 flex items-center justify-center gap-1.5">
											<button
												type="button"
												onClick={() => handleDayValueChange(day, -1)}
												disabled={day.value <= 0}
												className="h-6 w-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
											>
												<Minus className="w-3 h-3" />
											</button>
											<span className="w-6 text-center font-bold text-white text-sm">
												{day.value}
											</span>
											<button
												type="button"
												onClick={() => handleDayValueChange(day, 1)}
												className="h-6 w-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
											>
												<Plus className="w-3 h-3" />
											</button>

											{/* Quick Cancel Button */}
											<button
												type="button"
												onClick={() => handleQuickToggleCancel(day)}
												title={isCancelled ? "Restore default count" : "Cancel for this day"}
												className={cn(
													"ml-1 p-1 rounded transition cursor-pointer",
													isCancelled
														? "text-rose-400 bg-rose-500/20 hover:bg-rose-500/30"
														: "text-slate-500 hover:text-rose-400 hover:bg-slate-800",
												)}
											>
												<Ban className="w-3.5 h-3.5" />
											</button>
										</div>

										{/* Cost */}
										<div className="col-span-3 sm:col-span-2 text-right font-medium text-slate-200">
											{hasUnitPrice ? (
												isCancelled ? (
													<span className="text-rose-400 line-through">
														{formatCurrency(day.dayCost, tracker.currency)}
													</span>
												) : (
													formatCurrency(day.dayCost, tracker.currency)
												)
											) : (
												"—"
											)}
										</div>

										{/* Status */}
										<div className="col-span-2 sm:col-span-2 text-center">
											{day.isSettled ? (
												<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
													<CheckCircle2 className="w-2.5 h-2.5" /> Paid
												</span>
											) : isCancelled ? (
												<span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
													Cancelled
												</span>
											) : day.value > 0 ? (
												<span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
													Unpaid
												</span>
											) : (
												<span className="text-[10px] text-slate-600">—</span>
											)}
										</div>

										{/* Notes */}
										<div className="hidden sm:block sm:col-span-3 text-left">
											{editingDayDate === day.date ? (
												<div className="flex items-center gap-1">
													<input
														type="text"
														value={editingDayNote}
														onChange={(e) => setEditingDayNote(e.target.value)}
														className="w-full bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[11px] text-white focus:outline-none"
														onKeyDown={(e) => {
															if (e.key === "Enter") handleSaveDayNote(day);
															if (e.key === "Escape") setEditingDayDate(null);
														}}
													/>
													<button
														type="button"
														onClick={() => handleSaveDayNote(day)}
														className="text-[10px] bg-emerald-600 px-1.5 py-0.5 rounded text-white cursor-pointer"
													>
														OK
													</button>
												</div>
											) : (
												<button
													type="button"
													onClick={() => {
														setEditingDayDate(day.date);
														setEditingDayNote(day.notes || "");
													}}
													className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition cursor-pointer text-[11px] truncate max-w-full"
												>
													<FileText className="w-3 h-3 shrink-0" />
													<span className="truncate">{day.notes || "Add note..."}</span>
												</button>
											)}
										</div>
									</div>
								);
							})
						) : (
							<div className="p-8 text-center text-slate-400">No days found for this period.</div>
						)}
					</div>
				</div>
			</div>
		</Modal>
	);
}
