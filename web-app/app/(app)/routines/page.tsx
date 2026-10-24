"use client";

import { CalendarCheck, Plus } from "lucide-react";
import * as React from "react";
import { useContextDock } from "@/components/layout/context-dock";
import { RoutineFormModal } from "@/components/routines/routine-form-modal";
import { type RoutineItem, RoutineList } from "@/components/routines/routine-list";
import { api } from "@/lib/api-client";

export default function RoutinesPage() {
	const [routines, setRoutines] = React.useState<RoutineItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [modalOpen, setModalOpen] = React.useState(false);
	const [editingRoutine, setEditingRoutine] = React.useState<RoutineItem | null>(null);

	const fetchRoutines = React.useCallback(async () => {
		try {
			const res = await api.get<RoutineItem[]>("/routines");
			if (res.success && res.data) {
				setRoutines(res.data);
			}
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		fetchRoutines();

		const onGlobalRefresh = () => fetchRoutines();
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
		};
	}, [fetchRoutines]);

	const handleToggle = async (id: string) => {
		const routine = routines.find((r) => r.id === id);
		const currentlyCompleted = routine?.isCompletedToday ?? false;

		// Optimistic update
		setRoutines((prev) =>
			prev.map((r) =>
				r.id === id
					? {
							...r,
							isCompletedToday: !currentlyCompleted,
							streakCount: currentlyCompleted ? Math.max(0, r.streakCount - 1) : r.streakCount + 1,
						}
					: r,
			),
		);

		try {
			await api.post(`/routines/${id}/toggle`, {});
			fetchRoutines();
		} catch {
			fetchRoutines();
		}
	};

	const handleEdit = (routine: RoutineItem) => {
		setEditingRoutine(routine);
		setModalOpen(true);
	};

	const handleAddNew = React.useCallback(() => {
		setEditingRoutine(null);
		setModalOpen(true);
	}, []);

	const completedCount = React.useMemo(
		() => routines.filter((r) => r.isCompletedToday).length,
		[routines],
	);

	const contextDockNode = React.useMemo(
		() => (
			<div className="flex items-center justify-between gap-2 w-full">
				<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-2 border border-border text-xs font-bold text-foreground">
					<CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
					<span>
						{completedCount}/{routines.length} Done Today
					</span>
				</div>
				<button
					type="button"
					onClick={handleAddNew}
					className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
				>
					<Plus className="w-3.5 h-3.5" />
					<span>New Routine</span>
				</button>
			</div>
		),
		[completedCount, routines.length, handleAddNew],
	);

	useContextDock(contextDockNode);

	if (loading) {
		return (
			<div className="py-20 text-center text-foreground-muted text-xs">
				Loading daily habit routines...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-foreground">
					Daily Routines & Protocols
				</h1>
				<p className="text-xs text-foreground-muted mt-1">
					Lock in morning, afternoon, and evening habit loops. Track streaks and get proactive
					alerts.
				</p>
			</div>

			<RoutineList
				routines={routines}
				onToggle={handleToggle}
				onEdit={handleEdit}
				onRefresh={fetchRoutines}
				onAddNew={handleAddNew}
			/>

			<RoutineFormModal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				onSuccess={fetchRoutines}
				initialData={editingRoutine}
			/>
		</div>
	);
}
