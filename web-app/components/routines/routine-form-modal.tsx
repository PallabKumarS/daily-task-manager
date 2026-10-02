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

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  timeSlot: z.enum(["morning", "afternoon", "evening", "night", "anytime"]),
  targetTime: z.string().optional(),
  daysOfWeek: z.string(),
  reminderMinutes: z.number().min(0),
});

type FormValues = z.infer<typeof formSchema>;

const DAYS = [
  { label: "S", value: "0", name: "Sun" },
  { label: "M", value: "1", name: "Mon" },
  { label: "T", value: "2", name: "Tue" },
  { label: "W", value: "3", name: "Wed" },
  { label: "T", value: "4", name: "Thu" },
  { label: "F", value: "5", name: "Fri" },
  { label: "S", value: "6", name: "Sat" },
];

interface RoutineFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    title: string;
    description?: string | null;
    timeSlot: string;
    targetTime?: string | null;
    daysOfWeek: string;
    reminderMinutes: number;
  } | null;
}

export function RoutineFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: RoutineFormModalProps) {
  const [selectedDays, setSelectedDays] = React.useState<string[]>(["0", "1", "2", "3", "4", "5", "6"]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      timeSlot: "morning",
      targetTime: "07:30",
      daysOfWeek: "0,1,2,3,4,5,6",
      reminderMinutes: 0,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      const days = initialData.daysOfWeek ? initialData.daysOfWeek.split(",") : ["0", "1", "2", "3", "4", "5", "6"];
      setSelectedDays(days);
      reset({
        title: initialData.title,
        description: initialData.description || "",
        timeSlot: (initialData.timeSlot as FormValues["timeSlot"]) || "morning",
        targetTime: initialData.targetTime || "07:30",
        daysOfWeek: initialData.daysOfWeek || "0,1,2,3,4,5,6",
        reminderMinutes: initialData.reminderMinutes || 0,
      });
    } else {
      setSelectedDays(["0", "1", "2", "3", "4", "5", "6"]);
      reset({
        title: "",
        description: "",
        timeSlot: "morning",
        targetTime: "07:30",
        daysOfWeek: "0,1,2,3,4,5,6",
        reminderMinutes: 0,
      });
    }
  }, [initialData, reset, isOpen]);

  const toggleDay = (day: string) => {
    let next: string[];
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) return; // keep at least one day
      next = selectedDays.filter((d) => d !== day);
    } else {
      next = [...selectedDays, day].sort();
    }
    setSelectedDays(next);
    setValue("daysOfWeek", next.join(","));
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const url = initialData ? `/api/routines/${initialData.id}` : "/api/routines";
      const method = initialData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          daysOfWeek: selectedDays.join(","),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || "Routine saved");
        onSuccess();
        onClose();
      } else {
        toast.error(json.message || "Failed to save routine");
      }
    } catch {
      toast.error("Network error while saving routine");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Routine" : "Create Daily Routine"}
      description="Build sustainable daily habits and scheduled routine blocks"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Routine Title</Label>
          <Input id="title" placeholder="e.g. Morning Workout & Hydration" {...register("title")} />
          {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="timeSlot">Time Slot</Label>
            <select
              id="timeSlot"
              {...register("timeSlot")}
              className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
              <option value="anytime">Anytime</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="targetTime">Target Time</Label>
            <Input id="targetTime" type="time" {...register("targetTime")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Active Days</Label>
          <div className="flex items-center gap-1.5 pt-1">
            {DAYS.map((d) => {
              const isSelected = selectedDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title={d.name}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reminderMinutes">Notification Reminder</Label>
          <select
            id="reminderMinutes"
            {...register("reminderMinutes", { valueAsNumber: true })}
            className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <option value="0">At Target Time</option>
            <option value="5">5 Minutes Before</option>
            <option value="10">10 Minutes Before</option>
            <option value="15">15 Minutes Before</option>
            <option value="30">30 Minutes Before</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Notes / Instructions (Optional)</Label>
          <textarea
            id="description"
            rows={2}
            className="flex w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            placeholder="e.g. 500ml water, 20 pushups, stretch"
            {...register("description")}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="emerald" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Create Routine"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
