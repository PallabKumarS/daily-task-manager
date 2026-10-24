"use client";

import {
	Ban,
	Calendar,
	CheckCircle2,
	ChevronRight,
	FileText,
	Minus,
	MoreVertical,
	Pencil,
	Plus,
	Receipt,
	Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/currency-symbols";
import { cn } from "@/lib/utils";
import type { DailyTrackerItem } from "./tracker-types";

interface TrackerCardProps {
	tracker: DailyTrackerItem;
	selectedDate: string;
	onRefresh: () => void;
	onOpenDetails: (tracker: DailyTrackerItem) => void;
	onOpenEdit: (tracker: DailyTrackerItem) => void;
	onOpenSettle: (tracker: DailyTrackerItem) => void;
}

const COLOR_ACCENTS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
	emerald: {
		border: "border-teal-500/30",
		bg: "bg-teal-500/10",
		text: "text-teal-400",
		glow: "shadow-teal-500/10",
	},
	teal: {
		border: "border-teal-500/30",
		bg: "bg-teal-500/10",
		text: "text-teal-400",
		glow: "shadow-teal-500/10",
	},
	cyan: {
		border: "border-cyan-500/30",
		bg: "bg-cyan-500/10",
		text: "text-cyan-400",
		glow: "shadow-cyan-500/10",
	},
	blue: {
		border: "border-blue-500/30",
		bg: "bg-blue-500/10",
		text: "text-blue-400",
		glow: "shadow-blue-500/10",
	},
	violet: {
		border: "border-violet-500/30",
		bg: "bg-violet-500/10",
		text: "text-violet-400",
		glow: "shadow-violet-500/10",
	},
	amber: {
		border: "border-amber-500/30",
		bg: "bg-amber-500/10",
		text: "text-amber-400",
		glow: "shadow-amber-500/10",
	},
	rose: {
		border: "border-rose-500/30",
		bg: "bg-rose-500/10",
		text: "text-rose-400",
		glow: "shadow-rose-500/10",
	},
};

export function TrackerCard({
	tracker,
	selectedDate,
	onRefresh,
	onOpenDetails,
	onOpenEdit,
	onOpenSettle,
}: TrackerCardProps) {
	const confirm = useConfirm();
	const [currentValue, setCurrentValue] = React.useState<number>(
		tracker.todayLog ? tracker.todayLog.value : 0,
	);
	const [status, setStatus] = React.useState<string>(
		tracker.todayLog ? tracker.todayLog.status : "UNLOGGED",
	);
	const [notes, setNotes] = React.useState<string>(tracker.todayLog?.notes || "");
	const [isEditingNote, setIsEditingNote] = React.useState(false);
	const [menuOpen, setMenuOpen] = React.useState(false);
	const [isUpdating, setIsUpdating] = React.useState(false);
	const menuRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		setCurrentValue(tracker.todayLog ? tracker.todayLog.value : 0);
		setStatus(tracker.todayLog ? tracker.todayLog.status : "UNLOGGED");
		setNotes(tracker.todayLog?.notes || "");
	}, [tracker.todayLog]);

	React.useEffect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		if (menuOpen) {
			document.addEventListener("mousedown", handleOutsideClick);
		}
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, [menuOpen]);

	const colorStyle = COLOR_ACCENTS[tracker.color || "emerald"] || COLOR_ACCENTS.emerald;

	const handleUpdateCount = async (
		newValue: number,
		newStatus: "LOGGED" | "CANCELLED" | "SKIPPED" = "LOGGED",
		newNotes?: string,
	) => {
		const sanitizedVal = Math.max(0, newValue);
		setCurrentValue(sanitizedVal);
		setStatus(newStatus);
		if (newNotes !== undefined) setNotes(newNotes);

		try {
			setIsUpdating(true);
			await api.post(`/trackers/${tracker.id}/log`, {
				date: selectedDate,
				value: sanitizedVal,
				status: newStatus,
				notes: newNotes !== undefined ? newNotes : notes,
			});
			onRefresh();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to update count";
			toast.error(msg);
			onRefresh();
		} finally {
			setIsUpdating(false);
		}
	};

	const handleQuickCancel = () => {
		if (status === "CANCELLED" && currentValue === 0) {
			handleUpdateCount(tracker.defaultTarget, "LOGGED", "");
		} else {
			handleUpdateCount(0, "CANCELLED", notes || "Cancelled with provider");
		}
	};

	const handleSaveNote = async () => {
		setIsEditingNote(false);
		await handleUpdateCount(currentValue, status as "LOGGED" | "CANCELLED" | "SKIPPED", notes);
		toast.success("Note saved");
	};

	const handleDelete = async () => {
		const ok = await confirm({
			title: "Delete Tracker",
			description: `Are you sure you want to delete tracker "${tracker.name}"? This action cannot be undone.`,
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;
		try {
			await api.delete(`/trackers/${tracker.id}`);
			toast.success("Tracker deleted successfully");
			onRefresh();
		} catch {
			toast.error("Failed to delete tracker");
		}
	};

	const hasUnitPrice = typeof tracker.unitPrice === "number" && tracker.unitPrice > 0;
	const todayCost = hasUnitPrice ? currentValue * (tracker.unitPrice || 0) : 0;
	const isSettled = tracker.todayLog?.isSettled ?? false;

	return (
		<div
			className={cn(
				"relative flex flex-col justify-between rounded-2xl border bg-slate-900/70 p-5 shadow-lg backdrop-blur-xl transition duration-200 hover:border-slate-700",
				colorStyle.border,
				colorStyle.glow,
			)}
		>
			<div>
				{/* Header */}
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span
								className={cn(
									"inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
									colorStyle.bg,
									colorStyle.text,
								)}
							>
								{tracker.category}
							</span>
							{hasUnitPrice ? (
								<span className="text-[11px] font-medium text-slate-400">
									{formatCurrency(tracker.unitPrice || 0, tracker.currency)} / {tracker.unitName}
								</span>
							) : (
								<span className="text-[11px] font-medium text-slate-500">Daily Habit</span>
							)}
						</div>
						<h3 className="mt-1.5 text-lg font-bold text-foreground tracking-tight truncate">
							{tracker.name}
						</h3>
						{tracker.description && (
							<p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{tracker.description}</p>
						)}
					</div>

					{/* Context Menu */}
					<div className="relative shrink-0" ref={menuRef}>
						<button
							type="button"
							onClick={() => setMenuOpen(!menuOpen)}
							className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
						>
							<MoreVertical className="w-4 h-4" />
						</button>

						{menuOpen && (
							<div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-800 bg-slate-900 p-1 shadow-2xl z-20 animate-in fade-in zoom-in-95">
								<button
									type="button"
									onClick={() => {
										setMenuOpen(false);
										onOpenDetails(tracker);
									}}
									className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-foreground hover:bg-slate-800 rounded-lg transition cursor-pointer"
								>
									<Calendar className="w-3.5 h-3.5 text-slate-400" />
									<span>Month History</span>
								</button>
								{hasUnitPrice && (
									<button
										type="button"
										onClick={() => {
											setMenuOpen(false);
											onOpenSettle(tracker);
										}}
										className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition cursor-pointer"
									>
										<Receipt className="w-3.5 h-3.5 text-emerald-400" />
										<span>Settle Bill</span>
									</button>
								)}
								<button
									type="button"
									onClick={() => {
										setMenuOpen(false);
										onOpenEdit(tracker);
									}}
									className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-foreground hover:bg-slate-800 rounded-lg transition cursor-pointer"
								>
									<Pencil className="w-3.5 h-3.5 text-slate-400" />
									<span>Edit Tracker</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setMenuOpen(false);
										handleDelete();
									}}
									className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
								>
									<Trash2 className="w-3.5 h-3.5 text-rose-400" />
									<span>Delete Tracker</span>
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Counter Stepper Section */}
				<div className="mt-5 rounded-xl bg-slate-950/70 border border-slate-800/80 p-4">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-slate-400">Count for Selected Day:</span>
						{status === "CANCELLED" && (
							<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
								<Ban className="w-3 h-3" />
								Cancelled
							</span>
						)}
						{isSettled && (
							<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
								<CheckCircle2 className="w-3 h-3" />
								Settled / Paid
							</span>
						)}
					</div>

					<div className="mt-3 flex items-center justify-between gap-4">
						<button
							type="button"
							disabled={isUpdating || currentValue <= 0}
							onClick={() => handleUpdateCount(currentValue - 1, "LOGGED")}
							className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:text-foreground transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
							title="Decrease by 1"
						>
							<Minus className="w-5 h-5" />
						</button>

						<div className="flex flex-col items-center">
							<span className="text-3xl font-extrabold text-foreground tracking-tight">
								{currentValue}
							</span>
							<span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
								{tracker.unitName}
							</span>
						</div>

						<button
							type="button"
							disabled={isUpdating}
							onClick={() => handleUpdateCount(currentValue + 1, "LOGGED")}
							className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 border border-teal-500/40 text-white hover:bg-teal-500 transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-md shadow-teal-500/10"
							title="Increase by 1"
						>
							<Plus className="w-5 h-5" />
						</button>
					</div>

					{/* Quick Shortcut Buttons */}
					<div className="mt-4 grid grid-cols-3 gap-2">
						<button
							type="button"
							onClick={handleQuickCancel}
							className={cn(
								"py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer border text-center",
								status === "CANCELLED"
									? "bg-rose-500/20 text-rose-300 border-rose-500/40"
									: "bg-slate-900 text-slate-300 hover:text-foreground hover:bg-slate-800 border-slate-800",
							)}
						>
							0 (Cancel)
						</button>
						<button
							type="button"
							onClick={() => handleUpdateCount(1, "LOGGED")}
							className={cn(
								"py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer border text-center",
								currentValue === 1 && status !== "CANCELLED"
									? "bg-teal-500/20 text-teal-300 border-teal-500/40"
									: "bg-slate-900 text-slate-300 hover:text-foreground hover:bg-slate-800 border-slate-800",
							)}
						>
							1 {tracker.unitName.slice(0, 4)}
						</button>
						<button
							type="button"
							onClick={() => handleUpdateCount(tracker.defaultTarget, "LOGGED")}
							className={cn(
								"py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer border text-center",
								currentValue === tracker.defaultTarget && status !== "CANCELLED"
									? "bg-teal-500/20 text-teal-300 border-teal-500/40"
									: "bg-slate-900 text-slate-300 hover:text-foreground hover:bg-slate-800 border-slate-800",
							)}
						>
							{tracker.defaultTarget} (Normal)
						</button>
					</div>

					{/* Today Cost Calculation Display */}
					{hasUnitPrice && (
						<div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
							<span className="text-slate-400">Day Cost:</span>
							<span className="font-bold text-slate-200">
								{status === "CANCELLED" ? (
									<span className="text-rose-400 line-through">
										{formatCurrency(todayCost, tracker.currency)}
									</span>
								) : (
									formatCurrency(todayCost, tracker.currency)
								)}
							</span>
						</div>
					)}
				</div>

				{/* Note snippet or inline edit */}
				<div className="mt-3">
					{isEditingNote ? (
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Reason or notes (e.g. Canceled dinner)..."
								className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSaveNote();
									if (e.key === "Escape") setIsEditingNote(false);
								}}
							/>
							<button
								type="button"
								onClick={handleSaveNote}
								className="px-2.5 py-1 rounded-lg bg-teal-600 text-[11px] font-semibold text-white hover:bg-teal-500 cursor-pointer"
							>
								Save
							</button>
						</div>
					) : (
						<div className="flex items-center justify-between text-xs text-slate-400">
							<button
								type="button"
								onClick={() => setIsEditingNote(true)}
								className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-teal-400 transition cursor-pointer truncate max-w-full"
							>
								<FileText className="w-3.5 h-3.5 shrink-0" />
								<span className="truncate">
									{notes ? `Note: "${notes}"` : "Add day note / reason..."}
								</span>
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Month Running Stats & Settlement Action */}
			<div className="mt-5 pt-4 border-t border-slate-800/80">
				<div className="flex items-center justify-between text-xs text-slate-400 mb-2">
					<span>This Month:</span>
					<span className="font-semibold text-slate-200">
						{tracker.monthStats?.totalUnits ?? 0} {tracker.unitName}
						{hasUnitPrice &&
							` · ${formatCurrency(tracker.monthStats?.totalCost ?? 0, tracker.currency)}`}
					</span>
				</div>

				{hasUnitPrice && (
					<div className="flex items-center justify-between text-xs mb-3">
						<span className="text-amber-400 font-medium">Unsettled Due:</span>
						<span className="font-bold text-amber-300">
							{formatCurrency(tracker.monthStats?.unsettledCost ?? 0, tracker.currency)}
						</span>
					</div>
				)}

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => onOpenDetails(tracker)}
						className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-xs font-semibold text-slate-200 hover:text-foreground transition cursor-pointer border border-slate-700/60"
					>
						<Calendar className="w-3.5 h-3.5 text-slate-400" />
						<span>Full Month</span>
						<ChevronRight className="w-3.5 h-3.5 text-slate-400" />
					</button>

					{hasUnitPrice && (tracker.monthStats?.unsettledCost ?? 0) > 0 && (
						<button
							type="button"
							onClick={() => onOpenSettle(tracker)}
							className="py-2 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white transition cursor-pointer shadow-sm shadow-teal-500/10 flex items-center gap-1.5"
						>
							<Receipt className="w-3.5 h-3.5" />
							<span>Settle</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
