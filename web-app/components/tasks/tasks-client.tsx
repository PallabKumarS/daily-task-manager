"use client";

import { BellRing, CheckSquare, Plus } from "lucide-react";
import * as React from "react";
import { RecentlyAddedBanner } from "@/components/dashboard/recently-added-banner";
import { useContextDock } from "@/components/layout/context-dock";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { type TaskItem, TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useTodayDate } from "@/lib/date-helpers";

export function TasksClient() {
	const { todayDateString: todayStr } = useTodayDate();
	const [tasks, setTasks] = React.useState<TaskItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [modalOpen, setModalOpen] = React.useState(false);
	const [editingTask, setEditingTask] = React.useState<TaskItem | null>(null);
	const [modalDefaultType, setModalDefaultType] = React.useState<"TASK" | "EVENT">("EVENT");
	const isFetchingRef = React.useRef(false);
	const pendingFetchRef = React.useRef(false);

	const fetchTasks = React.useCallback(async () => {
		if (isFetchingRef.current) {
			pendingFetchRef.current = true;
			return;
		}
		isFetchingRef.current = true;
		pendingFetchRef.current = false;

		try {
			const res = await api.get<TaskItem[]>("/tasks");
			if (res.success && res.data) {
				setTasks(res.data);
			}
		} catch {
			// ignore
		} finally {
			setLoading(false);
			isFetchingRef.current = false;
			if (pendingFetchRef.current) {
				pendingFetchRef.current = false;
				fetchTasks();
			}
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

	const handleAddNewAlarm = React.useCallback(() => {
		setEditingTask(null);
		setModalDefaultType("EVENT");
		setModalOpen(true);
	}, []);

	const handleAddNewTask = React.useCallback(() => {
		setEditingTask(null);
		setModalDefaultType("TASK");
		setModalOpen(true);
	}, []);

	const pendingCount = React.useMemo(
		() =>
			tasks.filter((t) =>
				t.isRecurring ? t.lastCompletedDate !== todayStr : t.status !== "COMPLETED",
			).length,
		[tasks, todayStr],
	);

	const contextDockNode = React.useMemo(
		() => (
			<div className="flex items-center justify-between gap-2 w-full">
				<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-2 border border-border text-xs font-bold text-foreground">
					<CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
					<span>{pendingCount} Pending</span>
				</div>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={handleAddNewAlarm}
						className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
					>
						<BellRing className="w-3.5 h-3.5" />
						<span>Set Alarm</span>
					</button>
					<button
						type="button"
						onClick={handleAddNewTask}
						className="px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
					>
						<Plus className="w-3.5 h-3.5" />
						<span>New Task</span>
					</button>
				</div>
			</div>
		),
		[pendingCount, handleAddNewAlarm, handleAddNewTask],
	);

	useContextDock(contextDockNode);

	if (loading) {
		return (
			<div className="py-20 text-center text-foreground-muted text-xs">
				Loading scheduled alarms & tasks...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<RecentlyAddedBanner />

			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-foreground">
						Alarms & Scheduled Tasks
					</h1>
					<p className="text-xs text-foreground-muted mt-1">
						Configure daily or one-time alarms with multi-ring chimes, frequency intervals, and
						advance notifications.
					</p>
				</div>
				<div className="flex items-center gap-2 self-start sm:self-center">
					<Button size="sm" onClick={handleAddNewAlarm} className="gap-1.5 shadow-sm">
						<BellRing className="w-4 h-4" />
						<span>Set Alarm</span>
					</Button>
					<Button variant="outline" size="sm" onClick={handleAddNewTask} className="gap-1.5">
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
