"use client";

import confetti from "canvas-confetti";
import { Bell, Check, Clock, Edit2, Flame, Plus, Sparkles, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";

export interface RoutineItem {
	id: string;
	title: string;
	description?: string | null;
	timeSlot: string;
	targetTime?: string | null;
	daysOfWeek: string;
	streakCount: number;
	lastCompletedDate?: string | null;
	reminderMinutes: number;
	isCompletedToday: boolean;
}

interface RoutineListProps {
	routines: RoutineItem[];
	onToggle: (id: string) => Promise<void>;
	onEdit: (routine: RoutineItem) => void;
	onRefresh: () => void;
	onAddNew: () => void;
}

const SLOT_ORDER = ["morning", "afternoon", "evening", "night", "anytime"];
const SLOT_LABELS: Record<string, string> = {
	morning: "Morning Routines",
	afternoon: "Afternoon Focus",
	evening: "Evening Wind-Down",
	night: "Night Protocols",
	anytime: "Anytime Habits",
};

export function RoutineList({ routines, onToggle, onEdit, onRefresh, onAddNew }: RoutineListProps) {
	const confirm = useConfirm();

	const handleDelete = async (id: string) => {
		const ok = await confirm({
			title: "Delete Routine",
			description: "Are you sure you want to delete this routine? This action cannot be undone.",
			confirmText: "Delete",
			variant: "destructive",
		});
		if (!ok) return;
		try {
			const res = await api.delete(`/routines/${id}`);
			if (res.success) {
				toast.success("Routine deleted");
				onRefresh();
			} else {
				toast.error(res.message || "Failed to delete");
			}
		} catch {
			toast.error("Network error while deleting");
		}
	};

	const handleCheck = async (id: string, currentlyCompleted: boolean) => {
		if (!currentlyCompleted) {
			// Fire confetti for celebration!
			try {
				confetti({
					particleCount: 50,
					spread: 60,
					origin: { y: 0.8 },
					colors: ["#10b981", "#14b8a6", "#34d399", "#f59e0b"],
				});
			} catch {
				// ignore
			}
		}
		await onToggle(id);
	};

	const completedCount = routines.filter((r) => r.isCompletedToday).length;
	const progressPercent =
		routines.length > 0 ? Math.round((completedCount / routines.length) * 100) : 0;

	// Group routines by timeSlot
	const grouped = React.useMemo(() => {
		const map: Record<string, RoutineItem[]> = {};
		for (const slot of SLOT_ORDER) {
			map[slot] = [];
		}
		for (const r of routines) {
			const s = r.timeSlot.toLowerCase();
			if (!map[s]) map[s] = [];
			map[s].push(r);
		}
		return map;
	}, [routines]);

	const orderedSlots = React.useMemo(() => {
		const present = Object.keys(grouped);
		const standard = SLOT_ORDER.filter((s) => present.includes(s));
		const custom = present.filter((s) => !SLOT_ORDER.includes(s));
		return [...standard, ...custom];
	}, [grouped]);

	const handleClearAll = async () => {
		const ok = await confirm({
			title: "Delete All Routines",
			description:
				"Are you sure you want to delete all daily routines? This action cannot be undone.",
			confirmText: "Delete All",
			variant: "destructive",
		});
		if (!ok) return;
		try {
			const res = await api.delete("/routines");
			if (res.success) {
				toast.success("All routines deleted");
				onRefresh();
			} else {
				toast.error(res.message || "Failed to delete routines");
			}
		} catch {
			toast.error("Network error while deleting");
		}
	};

	return (
		<div className="space-y-6">
			{/* Daily Progress Tracker Card */}
			<div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900/90 p-5 backdrop-blur-xl">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<Sparkles className="w-4 h-4 text-emerald-400" />
							<h3 className="text-base font-bold text-white">Daily Habit Loop Completion</h3>
						</div>
						<p className="text-xs text-slate-400 mt-1">
							{completedCount} of {routines.length} routines completed today ({progressPercent}%)
						</p>
					</div>

					<div className="flex items-center gap-2 self-start sm:self-center">
						{routines.length > 0 && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleClearAll}
								className="gap-1.5 border-rose-900/40 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 hover:border-rose-800"
							>
								<Trash2 className="w-4 h-4" />
								<span>Clear All</span>
							</Button>
						)}
						<Button variant="emerald" size="sm" onClick={onAddNew} className="gap-1.5">
							<Plus className="w-4 h-4" />
							<span>Add Routine</span>
						</Button>
					</div>
				</div>

				{/* Progress bar */}
				<div className="mt-4 h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
					<div
						className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>
			</div>

			{routines.length === 0 ? (
				<div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
					<Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
					<h4 className="text-sm font-bold text-slate-200">No daily routines established yet</h4>
					<p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
						Design daily routines with target time slots, advance alerts, and streak tracking to
						build compound momentum.
					</p>
					<Button variant="emerald" size="sm" onClick={onAddNew} className="mt-4 gap-1.5">
						<Plus className="w-4 h-4" />
						<span>Create First Routine</span>
					</Button>
				</div>
			) : (
				orderedSlots.map((slot) => {
					const items = grouped[slot] || [];
					if (items.length === 0) return null;

					return (
						<div key={slot} className="space-y-3">
							<div className="flex items-center gap-2 px-1">
								<span className="text-xs font-bold uppercase tracking-wider text-slate-400">
									{SLOT_LABELS[slot] || slot.charAt(0).toUpperCase() + slot.slice(1)}
								</span>
								<span className="rounded-full bg-slate-800 px-2 py-0.2 text-[10px] text-slate-400">
									{items.length}
								</span>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{items.map((routine) => {
									return (
										<div
											key={routine.id}
											className={`flex items-start justify-between p-4 rounded-2xl border transition-all ${
												routine.isCompletedToday
													? "border-emerald-500/30 bg-emerald-950/10"
													: "border-slate-800/80 bg-slate-900/60 hover:border-slate-700"
											}`}
										>
											<div className="flex items-start gap-3 min-w-0 flex-1">
												{/* Checkbox button */}
												<button
													type="button"
													onClick={() => handleCheck(routine.id, routine.isCompletedToday)}
													className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer ${
														routine.isCompletedToday
															? "bg-emerald-500 border-emerald-400 text-slate-950"
															: "border-slate-700 bg-slate-950 hover:border-emerald-500 text-transparent"
													}`}
												>
													<Check className="w-4 h-4 stroke-[3]" />
												</button>

												<div className="min-w-0 flex-1">
													<h4
														className={`text-sm font-semibold truncate ${
															routine.isCompletedToday
																? "text-slate-400 line-through"
																: "text-slate-100"
														}`}
													>
														{routine.title}
													</h4>

													{routine.description && (
														<p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
															{routine.description}
														</p>
													)}

													<div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
														{routine.targetTime && (
															<div className="flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-0.5">
																<Clock className="w-3 h-3 text-emerald-400" />
																<span>{routine.targetTime}</span>
															</div>
														)}

														{routine.reminderMinutes > 0 && (
															<div className="flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-0.5">
																<Bell className="w-3 h-3 text-amber-400" />
																<span>{routine.reminderMinutes}m alert</span>
															</div>
														)}

														{routine.streakCount > 0 && (
															<div className="flex items-center gap-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 font-bold">
																<Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
																<span>{routine.streakCount} day streak</span>
															</div>
														)}
													</div>
												</div>
											</div>

											<div className="flex items-center gap-1 ml-2">
												<button
													type="button"
													onClick={() => onEdit(routine)}
													className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
													title="Edit Routine"
												>
													<Edit2 className="w-3.5 h-3.5" />
												</button>
												<button
													type="button"
													onClick={() => handleDelete(routine.id)}
													className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
													title="Delete Routine"
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					);
				})
			)}
		</div>
	);
}
