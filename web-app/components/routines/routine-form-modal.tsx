"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { syncNativeAndroidAlarms } from "@/lib/native-alarm-scheduler";
import { recordRecentAddition } from "@/lib/recent-activity-store";

const TIME_SLOT_OPTIONS: SelectOption[] = [
	{
		label: "Morning",
		value: "morning",
		color: "#f59e0b",
		badge: "06:00 - 12:00",
	},
	{
		label: "Afternoon",
		value: "afternoon",
		color: "#38bdf8",
		badge: "12:00 - 17:00",
	},
	{
		label: "Evening",
		value: "evening",
		color: "#818cf8",
		badge: "17:00 - 21:00",
	},
	{ label: "Night", value: "night", color: "#a855f7", badge: "21:00 - 04:00" },
	{ label: "Anytime", value: "anytime", color: "#10b981", badge: "Flexible" },
];

const ROUTINE_REMINDER_OPTIONS: SelectOption[] = [
	{ label: "At Target Time", value: "0" },
	{ label: "5 Minutes Before", value: "5" },
	{ label: "10 Minutes Before", value: "10" },
	{ label: "15 Minutes Before", value: "15" },
	{ label: "30 Minutes Before", value: "30" },
	{ label: "1 Hour Before", value: "60" },
];

const formSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	timeSlot: z.string().min(1, "Time slot is required"),
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
	const [selectedDays, setSelectedDays] = React.useState<string[]>([
		"0",
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
	]);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
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

	const selectedTimeSlot = watch("timeSlot");
	const selectedReminder = watch("reminderMinutes");

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset form on modal open
	React.useEffect(() => {
		if (initialData) {
			const days = initialData.daysOfWeek
				? initialData.daysOfWeek.split(",")
				: ["0", "1", "2", "3", "4", "5", "6"];
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
			const endpoint = initialData ? `/routines/${initialData.id}` : "/routines";
			const payload = {
				...data,
				daysOfWeek: selectedDays.join(","),
			};

			const res = initialData
				? await api.patch(endpoint, payload)
				: await api.post(endpoint, payload);

			if (res.success) {
				const routineData = (res.data as { id?: string }) || {};
				const createdId = routineData.id || initialData?.id || String(Date.now());

				recordRecentAddition({
					id: createdId,
					type: "ROUTINE",
					title: data.title,
					category: data.timeSlot.toUpperCase(),
					date: new Date().toISOString(),
				});

				toast.success(`Routine "${data.title}" saved`, {
					description: `Scheduled for ${data.timeSlot} at ${data.targetTime || "custom time"}`,
				});
				onSuccess();
				onClose();
				syncNativeAndroidAlarms();
			} else {
				toast.error(res.message || "Failed to save routine");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Network error while saving routine";
			toast.error(message);
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
					{errors.title && <p className="text-xs text-rose-400">{errors.title.message}</p>}
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<CustomSelect
						label="Time Slot"
						value={selectedTimeSlot}
						onChange={(val) => setValue("timeSlot", val, { shouldValidate: true })}
						options={TIME_SLOT_OPTIONS}
						group="ROUTINE_SLOT"
						placeholder="Select time slot..."
					/>

					<div className="space-y-1.5">
						<Label htmlFor="targetTime">Target Time</Label>
						<Input id="targetTime" type="time" className="h-11" {...register("targetTime")} />
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
											? "bg-teal-500 text-slate-950 shadow-sm"
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

				<CustomSelect
					label="Notification Reminder"
					value={String(selectedReminder ?? 0)}
					onChange={(val) =>
						setValue("reminderMinutes", Number(val) || 0, {
							shouldValidate: true,
						})
					}
					options={ROUTINE_REMINDER_OPTIONS}
					group="REMINDER_TIME"
				/>

				<div className="space-y-1.5">
					<Label htmlFor="description">Notes / Instructions (Optional)</Label>
					<textarea
						id="description"
						rows={2}
						className="flex w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/30 focus-visible:border-teal-500 transition duration-150"
						placeholder="e.g. 500ml water, 20 pushups, stretch"
						{...register("description")}
					/>
				</div>

				<div className="flex justify-end gap-3 pt-3">
					<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Create Routine"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
