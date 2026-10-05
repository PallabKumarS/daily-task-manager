"use client";

import * as React from "react";
import { RoutineFormModal } from "@/components/routines/routine-form-modal";
import {
	type RoutineItem,
	RoutineList,
} from "@/components/routines/routine-list";
import { api } from "@/lib/api-client";

export default function RoutinesPage() {
	const [routines, setRoutines] = React.useState<RoutineItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [modalOpen, setModalOpen] = React.useState(false);
	const [editingRoutine, setEditingRoutine] =
		React.useState<RoutineItem | null>(null);

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
							streakCount: currentlyCompleted
								? Math.max(0, r.streakCount - 1)
								: r.streakCount + 1,
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

	const handleAddNew = () => {
		setEditingRoutine(null);
		setModalOpen(true);
	};

	if (loading) {
		return (
			<div className="py-20 text-center text-slate-400 text-xs">
				Loading daily habit routines...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-white">
					Daily Routines & Protocols
				</h1>
				<p className="text-xs text-slate-400 mt-1">
					Lock in morning, afternoon, and evening habit loops. Track streaks and
					get proactive alerts.
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
