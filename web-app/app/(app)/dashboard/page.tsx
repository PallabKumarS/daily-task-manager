"use client";

import * as React from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { TransactionFormModal } from "@/components/finances/transaction-form-modal";
import type { TransactionItem } from "@/components/finances/transaction-list";
import { RoutineFormModal } from "@/components/routines/routine-form-modal";
import type { RoutineItem } from "@/components/routines/routine-list";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import type { TaskItem } from "@/components/tasks/task-list";
import { TrackerFormModal } from "@/components/trackers/tracker-form-modal";
import type { DailyTrackerItem } from "@/components/trackers/tracker-types";

export default function DashboardPage() {
	const [routineModalOpen, setRoutineModalOpen] = React.useState(false);
	const [editingRoutine, setEditingRoutine] =
		React.useState<RoutineItem | null>(null);

	const [taskModalOpen, setTaskModalOpen] = React.useState(false);
	const [editingTask, setEditingTask] = React.useState<TaskItem | null>(null);

	const [transactionModalOpen, setTransactionModalOpen] = React.useState(false);
	const [editingTransaction, setEditingTransaction] =
		React.useState<TransactionItem | null>(null);

	const [trackerModalOpen, setTrackerModalOpen] = React.useState(false);
	const [editingTracker, setEditingTracker] =
		React.useState<DailyTrackerItem | null>(null);

	const [refreshKey, setRefreshKey] = React.useState(0);

	const handleRefresh = React.useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	React.useEffect(() => {
		const onGlobalRefresh = () => handleRefresh();
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
		};
	}, [handleRefresh]);

	const handleOpenRoutineModal = (item?: RoutineItem | null) => {
		setEditingRoutine(item || null);
		setRoutineModalOpen(true);
	};

	const handleOpenTaskModal = (item?: TaskItem | null) => {
		setEditingTask(item || null);
		setTaskModalOpen(true);
	};

	const handleOpenTransactionModal = (item?: TransactionItem | null) => {
		setEditingTransaction(item || null);
		setTransactionModalOpen(true);
	};

	const handleOpenTrackerModal = (item?: DailyTrackerItem | null) => {
		setEditingTracker(item || null);
		setTrackerModalOpen(true);
	};

	return (
		<>
			<DashboardView
				key={refreshKey}
				onOpenRoutineModal={handleOpenRoutineModal}
				onOpenTaskModal={handleOpenTaskModal}
				onOpenTransactionModal={handleOpenTransactionModal}
				onOpenTrackerModal={handleOpenTrackerModal}
			/>

			<RoutineFormModal
				isOpen={routineModalOpen}
				onClose={() => {
					setRoutineModalOpen(false);
					setEditingRoutine(null);
				}}
				onSuccess={handleRefresh}
				initialData={editingRoutine}
			/>
			<TaskFormModal
				isOpen={taskModalOpen}
				onClose={() => {
					setTaskModalOpen(false);
					setEditingTask(null);
				}}
				onSuccess={handleRefresh}
				initialData={editingTask}
			/>
			<TransactionFormModal
				isOpen={transactionModalOpen}
				onClose={() => {
					setTransactionModalOpen(false);
					setEditingTransaction(null);
				}}
				onSuccess={handleRefresh}
				initialData={editingTransaction}
			/>
			<TrackerFormModal
				isOpen={trackerModalOpen}
				onClose={() => {
					setTrackerModalOpen(false);
					setEditingTracker(null);
				}}
				onSuccess={handleRefresh}
				initialData={editingTracker}
			/>
		</>
	);
}
