"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TASK_CATEGORIES } from "@/lib/currency-symbols";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["TASK", "EVENT"]),
  category: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.string().optional(),
  remindBeforeMinutes: z.number().min(0),
});

type FormValues = z.infer<typeof formSchema>;

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    title: string;
    description?: string | null;
    type: string;
    category: string;
    priority: string;
    dueDate?: string | Date | null;
    remindBeforeMinutes: number;
  } | null;
  defaultType?: "TASK" | "EVENT";
}

export function TaskFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  defaultType = "TASK",
}: TaskFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      type: defaultType,
      category: "General",
      priority: "MEDIUM",
      dueDate: "",
      remindBeforeMinutes: 15,
    },
  });

  const selectedType = watch("type");

  React.useEffect(() => {
    if (initialData) {
      let formattedDue = "";
      if (initialData.dueDate) {
        const d = new Date(initialData.dueDate);
        if (!Number.isNaN(d.getTime())) {
          formattedDue = d.toISOString().slice(0, 16);
        }
      }
      reset({
        title: initialData.title,
        description: initialData.description || "",
        type: (initialData.type as "TASK" | "EVENT") || "TASK",
        category: initialData.category || "General",
        priority: (initialData.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
        dueDate: formattedDue,
        remindBeforeMinutes: initialData.remindBeforeMinutes ?? 15,
      });
    } else {
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      const defaultDueStr = now.toISOString().slice(0, 16);

      reset({
        title: "",
        description: "",
        type: defaultType,
        category: "General",
        priority: "MEDIUM",
        dueDate: defaultDueStr,
        remindBeforeMinutes: 15,
      });
    }
  }, [initialData, defaultType, reset, isOpen]);

  const onSubmit = async (data: FormValues) => {
    try {
      const url = initialData ? `/api/tasks/${initialData.id}` : "/api/tasks";
      const method = initialData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || `${data.type === "EVENT" ? "Event" : "Task"} saved`);
        onSuccess();
        onClose();
      } else {
        toast.error(json.message || "Failed to save");
      }
    } catch {
      toast.error("Network error while saving");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Edit ${selectedType === "EVENT" ? "Event" : "Task"}` : `Create ${selectedType === "EVENT" ? "Event" : "Task"}`}
      description="Schedule time-bound activities with advance audio and system alerts"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder={selectedType === "EVENT" ? "e.g. Project Demo Meeting" : "e.g. Finish Sprint Review"} {...register("title")} />
          {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              {...register("type")}
              className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <option value="TASK">Task (Action item)</option>
              <option value="EVENT">Event (Time event / Meeting)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              {...register("priority")}
              className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              {...register("category")}
              className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {TASK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due Date & Time</Label>
            <Input id="dueDate" type="datetime-local" {...register("dueDate")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="remindBeforeMinutes">Advance Alert Reminder</Label>
          <select
            id="remindBeforeMinutes"
            {...register("remindBeforeMinutes", { valueAsNumber: true })}
            className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <option value="0">At time of event</option>
            <option value="5">5 Minutes Before</option>
            <option value="10">10 Minutes Before</option>
            <option value="15">15 Minutes Before</option>
            <option value="30">30 Minutes Before</option>
            <option value="60">1 Hour Before</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Details / Location (Optional)</Label>
          <textarea
            id="description"
            rows={2}
            className="flex w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            placeholder="e.g. Zoom link, agenda, notes"
            {...register("description")}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="emerald" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : initialData ? "Save Changes" : `Create ${selectedType === "EVENT" ? "Event" : "Task"}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
