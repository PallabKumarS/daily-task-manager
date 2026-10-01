"use client";

import * as React from "react";
import { TaskList, TaskItem } from "@/components/tasks/task-list";
import { TaskFormModal } from "@/components/tasks/task-form-modal";

export default function TasksPage() {
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<TaskItem | null>(null);

  const fetchTasks = React.useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setTasks(json.data);
        }
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

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: nextStatus as TaskItem["status"] } : t))
    );

    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchTasks();
    } catch {
      fetchTasks();
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
        <h1 className="text-2xl font-bold tracking-tight text-white">Tasks & Calendar Events</h1>
        <p className="text-xs text-slate-400 mt-1">
          Schedule priority actions with precision alert lead times (5m, 15m, 30m, 1h) and status tracking.
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
