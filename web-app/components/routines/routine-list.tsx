"use client";

import confetti from "canvas-confetti";
import { Bell, Check, Clock, Edit2, Flame, Plus, Sparkles, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardDeck } from "@/components/ui/card-deck";
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
			try {
				confetti({
					particleCount: 50,
					spread: 60,
					origin: { y: 0.8 },
					colors: ["#10b981", "#14b8a6", "#34d399", "#f59e0b"],
				});
			} catch {
				// Ignore confetti error
			}
		}
		await onToggle(id);
	};

	const completedCount = routines.filter((r) => r.isCompletedToday).length;
	const progressPercent =
		routines.length > 0 ? Math.round((completedCount / routines.length) * 100) : 0;

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

	const renderRoutineCard = (routine: RoutineItem) => (
		<div
			className={`flex items-start justify-between p-4 sm:p-5 rounded-2xl border transition-all shadow-[var(--shadow-card)] ${
				routine.isCompletedToday
					? "border-teal-500/35 bg-primary-soft/50"
					: "border-border bg-surface hover:border-border-strong"
			}`}
		>
			<div className="flex items-start gap-3.5 min-w-0 flex-1">
				<button
					type="button"
					onClick={() => handleCheck(routine.id, routine.isCompletedToday)}
					className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer ${
						routine.isCompletedToday
							? "bg-teal-600 dark:bg-teal-500 border-teal-500 text-white dark:text-slate-950"
							: "border-border-strong bg-surface-2 hover:border-teal-500 text-transparent"
					}`}
				>
					<Check className="w-4 h-4 stroke-[3]" />
				</button>

				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-md bg-surface-2 border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground">
							{SLOT_LABELS[routine.timeSlot.toLowerCase()] || routine.timeSlot}
						</span>
					</div>

					<h4
						className={`text-sm sm:text-base font-bold mt-1.5 truncate ${
							routine.isCompletedToday ? "text-muted-foreground line-through" : "text-foreground"
						}`}
					>
						{routine.title}
					</h4>

					{routine.description && (
						<p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
							{routine.description}
						</p>
					)}

					<div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-muted-foreground">
						{routine.targetTime && (
							<div className="flex items-center gap-1 rounded-md bg-surface-2 border border-border px-2 py-0.5">
								<Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
								<span>{routine.targetTime}</span>
							</div>
						)}

						{routine.reminderMinutes > 0 && (
							<div className="flex items-center gap-1 rounded-md bg-alarm-soft px-2 py-0.5 text-alarm-fg">
								<Bell className="w-3.5 h-3.5" />
								<span>{routine.reminderMinutes}m alert</span>
							</div>
						)}

						{routine.streakCount > 0 && (
							<div className="flex items-center gap-1 rounded-md bg-orange-500/12 text-orange-600 dark:text-orange-400 border border-orange-500/25 px-2 py-0.5 font-bold">
								<Flame className="w-3.5 h-3.5 fill-current" />
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
					className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer"
					title="Edit Routine"
				>
					<Edit2 className="w-4 h-4" />
				</button>
				<button
					type="button"
					onClick={() => handleDelete(routine.id)}
					className="p-2 rounded-xl text-muted-foreground hover:text-expense-fg hover:bg-expense-soft transition cursor-pointer"
					title="Delete Routine"
				>
					<Trash2 className="w-4 h-4" />
				</button>
			</div>
		</div>
	);

	return (
		<div className="space-y-6">
			<div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
							<h3 className="text-base font-bold text-foreground">Daily Habit Loop Completion</h3>
						</div>
						<p className="text-xs sm:text-sm text-muted-foreground mt-1">
							{completedCount} of {routines.length} routines completed today ({progressPercent}%)
						</p>
					</div>

					<div className="flex items-center gap-2 self-start sm:self-center">
						{routines.length > 0 && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleClearAll}
								className="gap-1.5 border-rose-500/30 text-expense-fg hover:bg-expense-soft"
							>
								<Trash2 className="w-4 h-4" />
								<span>Clear All</span>
							</Button>
						)}
						<Button size="sm" onClick={onAddNew} className="gap-1.5">
							<Plus className="w-4 h-4" />
							<span>Add Routine</span>
						</Button>
					</div>
				</div>

				<div className="mt-4 h-2.5 w-full rounded-full bg-surface-2 overflow-hidden">
					<div
						className="h-full rounded-full bg-gradient-to-r from-teal-500 to-indigo-500 transition-all duration-500"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>
			</div>

			{routines.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-border-strong bg-surface/60 p-12 text-center">
					<Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
					<h4 className="text-sm font-bold text-foreground">No daily routines established yet</h4>
					<p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
						Design daily routines with target time slots, advance alerts, and streak tracking to
						build compound momentum.
					</p>
					<Button size="sm" onClick={onAddNew} className="mt-4 gap-1.5">
						<Plus className="w-4 h-4" />
						<span>Create First Routine</span>
					</Button>
				</div>
			) : (
				<CardDeck
					items={routines}
					keyExtractor={(r) => r.id}
					storageKey="routines"
					defaultMode="deck"
					desktopColumns={2}
					title="Routine Cards"
					subtitle="Step through routines with Previous / Next buttons or view All by time slot"
					renderCard={(routine) => renderRoutineCard(routine)}
					renderGrid={() => (
						<div className="space-y-5">
							{orderedSlots.map((slot) => {
								const items = grouped[slot] || [];
								if (items.length === 0) return null;

								return (
									<div key={slot} className="space-y-3">
										<div className="flex items-center gap-2 px-1">
											<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
												{SLOT_LABELS[slot] || slot.charAt(0).toUpperCase() + slot.slice(1)}
											</span>
											<span className="rounded-full bg-surface-2 border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground">
												{items.length}
											</span>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
											{items.map((routine) => (
												<div key={routine.id}>{renderRoutineCard(routine)}</div>
											))}
										</div>
									</div>
								);
							})}
						</div>
					)}
				/>
			)}
		</div>
	);
}
