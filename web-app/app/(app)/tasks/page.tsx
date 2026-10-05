"use client";

import * as React from "react";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { type TaskItem, TaskList } from "@/components/tasks/task-list";
import { api } from "@/lib/api-client";

export default function TasksPage() {
	const [tasks, setTasks] = React.useState<TaskItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [modalOpen, setModalOpen] = React.useState(false);
	const [editingTask, setEditingTask] = React.useState<TaskItem | null>(null);

	const fetchTasks = React.useCallback(async () => {
		try {
			const res = await api.get<TaskItem[]>("/tasks");
			if (res.success && res.data) {
				setTasks(res.data);
			}
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		fetchTasks();

		const onGlobalRefresh = () => fetchTasks();
		window.addEventListener("daypulse:refresh", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
		};
	}, [fetchTasks]);

	const handleToggleStatus = async (item: TaskItem) => {
		const todayStr = new Date().toLocaleDateString("en-CA");

		if (item.isRecurring) {
			const isCompletedToday = item.lastCompletedDate === todayStr;
			const nextLastCompletedDate = isCompletedToday ? null : todayStr;

			setTasks((prev) =>
				prev.map((t) =>
					t.id === item.id
						? {
								...t,
								lastCompletedDate: nextLastCompletedDate,
								status: "PENDING",
							}
						: t,
				),
			);

			try {
				await api.patch(`/tasks/${item.id}`, {
					lastCompletedDate: nextLastCompletedDate,
					status: "PENDING",
				});
				fetchTasks();
			} catch {
				fetchTasks();
			}
		} else {
			const nextStatus = item.status === "COMPLETED" ? "PENDING" : "COMPLETED";

			setTasks((prev) =>
				prev.map((t) =>
					t.id === item.id
						? { ...t, status: nextStatus as TaskItem["status"] }
						: t,
				),
			);

			try {
				await api.patch(`/tasks/${item.id}`, { status: nextStatus });
				fetchTasks();
			} catch {
				fetchTasks();
			}
		}
	};

	const handleEdit = (task: TaskItem) => {
		setEditingTask(task);
		setModalOpen(true);
	};

	const handleAddNew = () => {
		setEditingTask(null);
		setModalOpen(true);
	};

	if (loading) {
		return (
			<div className="py-20 text-center text-slate-400 text-xs">
				Loading scheduled tasks & events...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-white">
					Tasks & Calendar Events
				</h1>
				<p className="text-xs text-slate-400 mt-1">
					Schedule priority actions with precision alert lead times (5m, 15m,
					30m, 1h) and status tracking.
				</p>
			</div>

			<TaskList
				tasks={tasks}
				onToggleStatus={handleToggleStatus}
				onEdit={handleEdit}
				onRefresh={fetchTasks}
				onAddNew={handleAddNew}
			/>

			<TaskFormModal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				onSuccess={fetchTasks}
				initialData={editingTask}
			/>
		</div>
	);
}
