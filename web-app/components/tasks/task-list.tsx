"use client";

import * as React from "react";
import confetti from "canvas-confetti";
import {
  Check,
  Calendar,
  Clock,
  Bell,
  Trash2,
  Edit2,
  AlertCircle,
  Tag,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  type: "TASK" | "EVENT";
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  dueDate?: string | null;
  remindBeforeMinutes: number;
}

interface TaskListProps {
  tasks: TaskItem[];
  onToggleStatus: (id: string, currentStatus: string) => Promise<void>;
  onEdit: (task: TaskItem) => void;
  onRefresh: () => void;
  onAddNew: () => void;
}

export function TaskList({
  tasks,
  onToggleStatus,
  onEdit,
  onRefresh,
  onAddNew,
}: TaskListProps) {
  const [filterType, setFilterType] = React.useState<"ALL" | "TASK" | "EVENT">("ALL");
  const [filterStatus, setFilterStatus] = React.useState<"ALL" | "PENDING" | "COMPLETED">("ALL");

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Item deleted");
        onRefresh();
      } else {
        toast.error(json.message || "Failed to delete");
      }
    } catch {
      toast.error("Network error while deleting");
    }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    if (currentStatus !== "COMPLETED") {
      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ["#10b981", "#3b82f6", "#f59e0b"],
        });
      } catch {
        // ignore
      }
    }
    await onToggleStatus(id, currentStatus);
  };

  const filtered = tasks.filter((t) => {
    if (filterType !== "ALL" && t.type !== filterType) return false;
    if (filterStatus === "PENDING" && t.status === "COMPLETED") return false;
    if (filterStatus === "COMPLETED" && t.status !== "COMPLETED") return false;
    return true;
  });

  const getPriorityBadge = (priority: TaskItem["priority"]) => {
    switch (priority) {
      case "URGENT":
        return <Badge variant="destructive">Urgent</Badge>;
      case "HIGH":
        return <Badge variant="warning">High</Badge>;
      case "LOW":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="default">Medium</Badge>;
    }
  };

  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;

    const now = new Date();
    const isOverdue = d.getTime() < now.getTime();

    const formatted = d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return { text: formatted, isOverdue };
  };

  return (
    <div className="space-y-4">
      {/* Filter and Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type filters */}
          <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => setFilterType("TASK")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === "TASK" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-white"
              }`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setFilterType("EVENT")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === "EVENT" ? "bg-amber-500/20 text-amber-400" : "text-slate-400 hover:text-white"
              }`}
            >
              Events
            </button>
          </div>

          {/* Status filters */}
          <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterStatus === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("PENDING")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterStatus === "PENDING" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-white"
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("COMPLETED")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterStatus === "COMPLETED" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        <Button variant="emerald" size="sm" onClick={onAddNew} className="gap-1.5 self-start sm:self-center">
          <Plus className="w-4 h-4" />
          <span>New Item</span>
        </Button>
      </div>

      {/* Task List */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-200">No scheduled tasks or events</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Plan your day with precision. Add due dates to receive audio chimes and native system reminders.
            </p>
            <Button variant="emerald" size="sm" onClick={onAddNew} className="mt-4 gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Create Task or Event</span>
            </Button>
          </div>
        ) : (
          filtered.map((item) => {
            const isCompleted = item.status === "COMPLETED";
            const dueInfo = formatDue(item.dueDate);

            return (
              <div
                key={item.id}
                className={`flex items-start justify-between p-4 rounded-2xl border transition-all ${
                  isCompleted
                    ? "border-slate-800/40 bg-slate-900/30 opacity-70"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-700 shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggle(item.id, item.status)}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer ${
                      isCompleted
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "border-slate-700 bg-slate-950 hover:border-emerald-500 text-transparent"
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-sm font-semibold truncate ${
                          isCompleted ? "text-slate-400 line-through" : "text-slate-100"
                        }`}
                      >
                        {item.title}
                      </h4>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 border border-slate-700/60 font-medium">
                        {item.category}
                      </span>
                      {getPriorityBadge(item.priority)}
                      {item.type === "EVENT" && (
                        <span className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold">
                          Event
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-slate-400">
                      {dueInfo && (
                        <div
                          className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
                            !isCompleted && dueInfo.isOverdue
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>
                            {dueInfo.text} {!isCompleted && dueInfo.isOverdue && "(Overdue)"}
                          </span>
                        </div>
                      )}

                      {item.remindBeforeMinutes > 0 && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Bell className="w-3 h-3 text-emerald-400" />
                          <span>{item.remindBeforeMinutes}m reminder</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
