"use client";

import { BellRing, Plus } from "lucide-react";
import * as React from "react";
import { RecentlyAddedBanner } from "@/components/dashboard/recently-added-banner";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { type TaskItem, TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useTodayDate } from "@/lib/date-helpers";

export default function TasksPage() {
	const { todayDateString: todayStr } = useTodayDate();
	const [tasks, setTasks] = React.useState<TaskItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [modalOpen, setModalOpen] = React.useState(false);
	const [editingTask, setEditingTask] = React.useState<TaskItem | null>(null);
	const [modalDefaultType, setModalDefaultType] = React.useState<"TASK" | "EVENT">("EVENT");

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
		window.addEventListener("daypulse:date-changed", onGlobalRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onGlobalRefresh);
			window.removeEventListener("daypulse:date-changed", onGlobalRefresh);
		};
	}, [fetchTasks]);

	const handleToggleStatus = async (item: TaskItem) => {
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
					t.id === item.id ? { ...t, status: nextStatus as TaskItem["status"] } : t,
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
		setModalDefaultType(task.type === "EVENT" ? "EVENT" : "TASK");
		setModalOpen(true);
	};

	const handleAddNewAlarm = () => {
		setEditingTask(null);
		setModalDefaultType("EVENT");
		setModalOpen(true);
	};

	const handleAddNewTask = () => {
		setEditingTask(null);
		setModalDefaultType("TASK");
		setModalOpen(true);
	};

	if (loading) {
		return (
			<div className="py-20 text-center text-slate-400 text-xs">
				Loading scheduled alarms & tasks...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<RecentlyAddedBanner />

			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-white">Alarms & Scheduled Tasks</h1>
					<p className="text-xs text-slate-400 mt-1">
						Configure daily or one-time alarms with multi-ring chimes, frequency intervals, and
						advance notifications.
					</p>
				</div>
				<div className="flex items-center gap-2 self-start sm:self-center">
					<Button
						variant="emerald"
						size="sm"
						onClick={handleAddNewAlarm}
						className="gap-1.5 shadow-sm shadow-emerald-950/40"
					>
						<BellRing className="w-4 h-4" />
						<span>Set Alarm</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleAddNewTask}
						className="gap-1.5 border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
					>
						<Plus className="w-4 h-4" />
						<span>New Task</span>
					</Button>
				</div>
			</div>

			<TaskList
				tasks={tasks}
				onToggleStatus={handleToggleStatus}
				onEdit={handleEdit}
				onRefresh={fetchTasks}
				onAddNew={handleAddNewAlarm}
			/>

			<TaskFormModal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				onSuccess={fetchTasks}
				initialData={editingTask}
				defaultType={modalDefaultType}
			/>
		</div>
	);
}
