"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, Calendar, CheckSquare, Clock, Plus, Repeat, X } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	formatAlarmDescription,
	parseAlarmConfig,
	RING_COUNT_OPTIONS,
	RING_INTERVAL_OPTIONS,
} from "@/lib/alarm-settings";
import { api } from "@/lib/api-client";
import { TASK_CATEGORIES } from "@/lib/currency-symbols";
import { syncNativeAndroidAlarms } from "@/lib/native-alarm-scheduler";
import { recordRecentAddition } from "@/lib/recent-activity-store";

const TYPE_OPTIONS: SelectOption[] = [
	{ label: "Task (Action item)", value: "TASK" },
	{ label: "Event (Time event / Meeting)", value: "EVENT" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
	{ label: "Low", value: "LOW", color: "#10b981", badge: "Low" },
	{ label: "Medium", value: "MEDIUM", color: "#38bdf8", badge: "Medium" },
	{ label: "High", value: "HIGH", color: "#f59e0b", badge: "High" },
	{ label: "Urgent", value: "URGENT", color: "#ef4444", badge: "Urgent" },
];

const REMINDER_OPTIONS: SelectOption[] = [
	{ label: "At time of event (Exact)", value: "0" },
	{ label: "5 Minutes Before", value: "5" },
	{ label: "10 Minutes Before", value: "10" },
	{ label: "15 Minutes Before", value: "15" },
	{ label: "30 Minutes Before", value: "30" },
	{ label: "1 Hour Before", value: "60" },
	{ label: "2 Hours Before", value: "120" },
	{ label: "1 Day Before", value: "1440" },
];

const REPEAT_DAYS = [
	{ label: "S", value: "0", name: "Sun" },
	{ label: "M", value: "1", name: "Mon" },
	{ label: "T", value: "2", name: "Tue" },
	{ label: "W", value: "3", name: "Wed" },
	{ label: "T", value: "4", name: "Thu" },
	{ label: "F", value: "5", name: "Fri" },
	{ label: "S", value: "6", name: "Sat" },
];

const MONTHS = [
	{ label: "January", value: 1 },
	{ label: "February", value: 2 },
	{ label: "March", value: 3 },
	{ label: "April", value: 4 },
	{ label: "May", value: 5 },
	{ label: "June", value: 6 },
	{ label: "July", value: 7 },
	{ label: "August", value: 8 },
	{ label: "September", value: 9 },
	{ label: "October", value: 10 },
	{ label: "November", value: 11 },
	{ label: "December", value: 12 },
];

const formSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	type: z.enum(["TASK", "EVENT"]),
	category: z.string().min(1),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
	startDate: z.string().optional(),
	dueDate: z.string().optional(),
	remindBeforeMinutes: z.number().min(0),

	// Recurrence configuration
	isRecurring: z.boolean(),
	repeatFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
	repeatInterval: z.number().int().min(1),
	repeatDaysOfWeek: z.string(),
	repeatTime: z.string(),
	repeatDayOfMonth: z.number().int().min(1).max(31),
	repeatMonthOfYear: z.number().int().min(1).max(12),
	repeatEndType: z.enum(["NEVER", "COUNT", "UNTIL_DATE"]),
	repeatCount: z.number().int().min(1).nullable().optional(),
	repeatUntil: z.string().optional(),
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
		startDate?: string | Date | null;
		dueDate?: string | Date | null;
		remindBeforeMinutes: number;
		isRecurring?: boolean;
		repeatFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
		repeatInterval?: number;
		repeatDaysOfWeek?: string | null;
		repeatTime?: string | null;
		repeatDayOfMonth?: number | null;
		repeatMonthOfYear?: number | null;
		repeatEndType?: "NEVER" | "COUNT" | "UNTIL_DATE" | null;
		repeatCount?: number | null;
		repeatUntil?: string | Date | null;
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
	const [extraTimes, setExtraTimes] = React.useState<string[]>([]);
	const [newTimeInput, setNewTimeInput] = React.useState<string>("");
	const [showAddTimeInput, setShowAddTimeInput] = React.useState(false);
	const [modalMode, setModalMode] = React.useState<"ALARM" | "TASK">(
		defaultType === "EVENT" ? "ALARM" : "TASK",
	);
	const [ringCount, setRingCount] = React.useState<number>(3);
	const [ringInterval, setRingInterval] = React.useState<number>(10);

	const {
		register,
		handleSubmit,
		reset,
		watch,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: "",
			description: "",
			type: defaultType,
			category: "General",
			priority: "MEDIUM",
			startDate: new Date().toISOString().slice(0, 10),
			dueDate: "",
			remindBeforeMinutes: 0,
			isRecurring: false,
			repeatFrequency: "DAILY",
			repeatInterval: 1,
			repeatDaysOfWeek: "0,1,2,3,4,5,6",
			repeatTime: "21:00",
			repeatDayOfMonth: 1,
			repeatMonthOfYear: 1,
			repeatEndType: "NEVER",
			repeatCount: null,
			repeatUntil: "",
		},
	});

	const selectedType = watch("type");
	const selectedPriority = watch("priority");
	const selectedCategory = watch("category");
	const selectedRemind = watch("remindBeforeMinutes");
	const isRecurring = watch("isRecurring");
	const repeatFrequency = watch("repeatFrequency");
	const repeatInterval = watch("repeatInterval");
	const repeatDaysOfWeek = watch("repeatDaysOfWeek");
	const repeatTime = watch("repeatTime");
	const repeatEndType = watch("repeatEndType");

	const categoryOptions: SelectOption[] = React.useMemo(
		() =>
			TASK_CATEGORIES.map((cat) => ({
				label: cat,
				value: cat,
			})),
		[],
	);

	const activeDays = React.useMemo(() => {
		return (repeatDaysOfWeek || "0,1,2,3,4,5,6").split(",").map((s) => s.trim());
	}, [repeatDaysOfWeek]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset form on modal open
	React.useEffect(() => {
		if (initialData) {
			const isAlarm = initialData.type === "EVENT" || initialData.category === "Alarm";
			setModalMode(isAlarm ? "ALARM" : "TASK");
			const { config, userNotes } = parseAlarmConfig(initialData.description);
			setRingCount(config.ringCount);
			setRingInterval(config.ringIntervalSeconds);

			let formattedDue = "";
			if (initialData.dueDate) {
				const d = new Date(initialData.dueDate);
				if (!Number.isNaN(d.getTime())) {
					formattedDue = d.toISOString().slice(0, 16);
				}
			}

			let formattedStart = "";
			if (initialData.startDate) {
				const s = new Date(initialData.startDate);
				if (!Number.isNaN(s.getTime())) {
					formattedStart = s.toISOString().slice(0, 10);
				}
			} else {
				formattedStart = new Date().toISOString().slice(0, 10);
			}

			let formattedUntil = "";
			if (initialData.repeatUntil) {
				const u = new Date(initialData.repeatUntil);
				if (!Number.isNaN(u.getTime())) {
					formattedUntil = u.toISOString().slice(0, 10);
				}
			}

			// Parse multiple times if present
			const rawTimes = initialData.repeatTime
				? initialData.repeatTime.split(",").map((t) => t.trim())
				: ["21:00"];
			const primaryTime = rawTimes[0] || "21:00";
			const secondaryTimes = rawTimes.slice(1);
			setExtraTimes(secondaryTimes);

			reset({
				title: initialData.title,
				description: userNotes,
				type: (initialData.type as "TASK" | "EVENT") || (isAlarm ? "EVENT" : "TASK"),
				category: initialData.category || (isAlarm ? "Alarm" : "General"),
				priority:
					(initialData.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") ||
					(isAlarm ? "HIGH" : "MEDIUM"),
				startDate: formattedStart,
				dueDate: formattedDue,
				remindBeforeMinutes: initialData.remindBeforeMinutes ?? 0,
				isRecurring: initialData.isRecurring ?? false,
				repeatFrequency: initialData.repeatFrequency || "DAILY",
				repeatInterval: initialData.repeatInterval || 1,
				repeatDaysOfWeek: initialData.repeatDaysOfWeek || "0,1,2,3,4,5,6",
				repeatTime: primaryTime,
				repeatDayOfMonth: initialData.repeatDayOfMonth || 1,
				repeatMonthOfYear: initialData.repeatMonthOfYear || 1,
				repeatEndType: initialData.repeatEndType || "NEVER",
				repeatCount: initialData.repeatCount ?? null,
				repeatUntil: formattedUntil,
			});
		} else {
			const isAlarm = defaultType === "EVENT";
			setModalMode(isAlarm ? "ALARM" : "TASK");
			setRingCount(3);
			setRingInterval(10);

			const now = new Date();
			const todayStr = now.toISOString().slice(0, 10);
			now.setHours(now.getHours() + 1, 0, 0, 0);
			const defaultDueStr = now.toISOString().slice(0, 16);

			setExtraTimes([]);
			reset({
				title: "",
				description: "",
				type: defaultType,
				category: isAlarm ? "Alarm" : "General",
				priority: isAlarm ? "HIGH" : "MEDIUM",
				startDate: todayStr,
				dueDate: defaultDueStr,
				remindBeforeMinutes: 0,
				isRecurring: isAlarm,
				repeatFrequency: "DAILY",
				repeatInterval: 1,
				repeatDaysOfWeek: "0,1,2,3,4,5,6",
				repeatTime: "21:00",
				repeatDayOfMonth: 1,
				repeatMonthOfYear: 1,
				repeatEndType: "NEVER",
				repeatCount: null,
				repeatUntil: "",
			});
		}
	}, [initialData, defaultType, reset, isOpen]);

	const toggleDay = (dayValue: string) => {
		let next: string[];
		if (activeDays.includes(dayValue)) {
			if (activeDays.length === 1) return; // keep at least 1 day
			next = activeDays.filter((d) => d !== dayValue);
		} else {
			next = [...activeDays, dayValue].sort();
		}
		setValue("repeatDaysOfWeek", next.join(","), { shouldValidate: true });
	};

	const setDaysPreset = (preset: "ALL" | "WEEKDAYS" | "WEEKENDS") => {
		if (preset === "ALL") {
			setValue("repeatDaysOfWeek", "0,1,2,3,4,5,6", { shouldValidate: true });
		} else if (preset === "WEEKDAYS") {
			setValue("repeatDaysOfWeek", "1,2,3,4,5", { shouldValidate: true });
		} else if (preset === "WEEKENDS") {
			setValue("repeatDaysOfWeek", "0,6", { shouldValidate: true });
		}
	};

	const handleAddExtraTime = () => {
		if (!newTimeInput.trim()) return;
		if (!extraTimes.includes(newTimeInput.trim())) {
			setExtraTimes((prev) => [...prev, newTimeInput.trim()]);
		}
		setNewTimeInput("");
		setShowAddTimeInput(false);
	};

	const handleRemoveExtraTime = (t: string) => {
		setExtraTimes((prev) => prev.filter((item) => item !== t));
	};

	const onSubmit = async (data: FormValues) => {
		try {
			const endpoint = initialData ? `/tasks/${initialData.id}` : "/tasks";

			// Combine primary time with any secondary times
			const allTimes = [data.repeatTime, ...extraTimes].filter(Boolean);
			const finalRepeatTime = allTimes.join(",");

			const isAlarmMode = modalMode === "ALARM";
			const finalDescription = isAlarmMode
				? formatAlarmDescription(data.description || "", {
						ringCount,
						ringIntervalSeconds: ringInterval,
					})
				: data.description || "";

			const payload = {
				...data,
				type: isAlarmMode ? "EVENT" : data.type,
				category: isAlarmMode ? "Alarm" : data.category,
				priority: isAlarmMode ? "HIGH" : data.priority,
				description: finalDescription,
				repeatTime: finalRepeatTime,
			};

			const res = initialData
				? await api.patch(endpoint, payload)
				: await api.post(endpoint, payload);

			if (res.success) {
				const taskData = (res.data as { id?: string }) || {};
				const createdId = taskData.id || initialData?.id || String(Date.now());

				recordRecentAddition({
					id: createdId,
					type: (isAlarmMode ? "EVENT" : data.type) as "TASK" | "EVENT",
					title: data.title,
					category: isAlarmMode ? "Alarm" : data.category,
					priority: isAlarmMode ? "HIGH" : data.priority,
					date: data.startDate || data.dueDate || new Date().toISOString(),
				});

				const typeLabel = isAlarmMode ? "Alarm" : data.type === "EVENT" ? "Event" : "Task";
				const descInfo = isAlarmMode
					? `Rings: ${ringCount === 0 ? "Continuous" : `${ringCount}x`} • Every ${ringInterval}s`
					: `${data.category} • Priority: ${data.priority}${data.dueDate ? ` • Due: ${data.dueDate.slice(0, 10)}` : ""}`;

				toast.success(`${typeLabel} "${data.title}" saved`, {
					description: descInfo,
				});
				onSuccess();
				onClose();
				syncNativeAndroidAlarms();
			} else {
				toast.error(res.message || "Failed to save");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Network error while saving";
			toast.error(message);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={
				initialData
					? modalMode === "ALARM"
						? "Edit Alarm & Reminder"
						: "Edit Task Item"
					: modalMode === "ALARM"
						? "Set Alarm & Reminder"
						: "Create Task Item"
			}
			description={
				modalMode === "ALARM"
					? "Configure target time, advance alert notice, and audio ringing frequency"
					: "Schedule priority actions with due dates and status tracking"
			}
			maxWidth="lg"
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				{/* Mode Switcher */}
				<div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-900/80 border border-slate-800">
					<button
						type="button"
						onClick={() => {
							setModalMode("ALARM");
							setValue("type", "EVENT");
							setValue("category", "Alarm");
							setValue("priority", "HIGH");
						}}
						className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
							modalMode === "ALARM"
								? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm"
								: "text-slate-400 hover:text-slate-200"
						}`}
					>
						<BellRing className="w-3.5 h-3.5 text-amber-400" />
						<span>Alarm & Reminder</span>
					</button>
					<button
						type="button"
						onClick={() => {
							setModalMode("TASK");
							setValue("type", "TASK");
							setValue("category", "General");
							setValue("priority", "MEDIUM");
						}}
						className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
							modalMode === "TASK"
								? "bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm"
								: "text-slate-400 hover:text-slate-200"
						}`}
					>
						<CheckSquare className="w-3.5 h-3.5 text-teal-400" />
						<span>Task Action Item</span>
					</button>
				</div>

				{/* Title */}
				<div className="space-y-1.5">
					<Label htmlFor="title">{modalMode === "ALARM" ? "Alarm Label" : "Title"}</Label>
					<Input
						id="title"
						placeholder={
							modalMode === "ALARM"
								? "e.g. Morning Wakeup, Exercise, Medicine"
								: "e.g. Review Weekly Sprint Milestones"
						}
						{...register("title")}
					/>
					{errors.title && <p className="text-xs text-rose-400">{errors.title.message}</p>}
				</div>

				{/* Category & Priority only shown for Standard Task mode */}
				{modalMode === "TASK" && (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<CustomSelect
								label="Type"
								value={selectedType}
								group="TASK_TYPE"
								onChange={(val) =>
									setValue("type", val as "TASK" | "EVENT", {
										shouldValidate: true,
									})
								}
								options={TYPE_OPTIONS}
							/>

							<CustomSelect
								label="Priority"
								value={selectedPriority}
								group="TASK_PRIORITY"
								onChange={(val) =>
									setValue("priority", val as "LOW" | "MEDIUM" | "HIGH" | "URGENT", {
										shouldValidate: true,
									})
								}
								options={PRIORITY_OPTIONS}
							/>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<CustomSelect
								label="Category"
								value={selectedCategory}
								group="TASK_CATEGORY"
								onChange={(val) => setValue("category", val, { shouldValidate: true })}
								options={categoryOptions}
							/>

							{!isRecurring ? (
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<Label htmlFor="dueDate">Target Date & Time</Label>
										<span className="text-[11px] text-teal-400 font-medium flex items-center gap-1">
											<Calendar className="w-3 h-3" />
											<span>Click box to pick</span>
										</span>
									</div>
									<Input
										id="dueDate"
										type="datetime-local"
										className="h-11 font-medium"
										{...register("dueDate")}
									/>
								</div>
							) : (
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<Label htmlFor="startDate">From When (Start Date)</Label>
										<span className="text-[11px] text-teal-400 font-medium flex items-center gap-1">
											<Calendar className="w-3 h-3" />
											<span>Click box to pick</span>
										</span>
									</div>
									<Input
										id="startDate"
										type="date"
										className="h-11 font-medium"
										{...register("startDate")}
									/>
								</div>
							)}
						</div>
					</>
				)}

				{/* Alarm mode: Direct Date/Time Target (No Category/Priority clutter) */}
				{modalMode === "ALARM" && (
					<div>
						{!isRecurring ? (
							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<Label htmlFor="dueDate">Alarm Target Date & Time</Label>
									<span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
										<Calendar className="w-3 h-3" />
										<span>Click box to pick</span>
									</span>
								</div>
								<Input
									id="dueDate"
									type="datetime-local"
									className="h-11 font-medium"
									{...register("dueDate")}
								/>
							</div>
						) : (
							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<Label htmlFor="startDate">Start Date</Label>
									<span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
										<Calendar className="w-3 h-3" />
										<span>Click box to pick</span>
									</span>
								</div>
								<Input
									id="startDate"
									type="date"
									className="h-11 font-medium"
									{...register("startDate")}
								/>
							</div>
						)}
					</div>
				)}

				{/* Recurrence Toggle Switch */}
				<div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 transition">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div
								className={`p-2.5 rounded-xl border transition ${
									isRecurring
										? "bg-teal-500/15 text-teal-400 border-teal-500/30"
										: "bg-slate-800/80 text-slate-400 border-slate-700/60"
								}`}
							>
								<Repeat className="w-4 h-4" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<span className="text-xs font-bold text-white">
										Repeat this {selectedType === "EVENT" ? "Event" : "Task"}
									</span>
									{isRecurring && (
										<span className="rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 px-2 py-0.2 text-[10px] font-bold">
											Recurring
										</span>
									)}
								</div>
								<p className="text-[11px] text-slate-400 mt-0.5">
									Trigger repeated reminders on specific times of the day, week, month, or year
								</p>
							</div>
						</div>

						<button
							type="button"
							role="switch"
							aria-checked={isRecurring}
							onClick={() => setValue("isRecurring", !isRecurring)}
							className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
								isRecurring ? "bg-teal-500" : "bg-slate-700"
							}`}
						>
							<span
								className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
									isRecurring ? "translate-x-5" : "translate-x-0"
								}`}
							/>
						</button>
					</div>

					{/* Expanded Recurrence Controls */}
					{isRecurring && (
						<div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
							{/* Frequency Tabs: Daily, Weekly, Monthly, Yearly */}
							<div className="space-y-1.5">
								<Label>Recurrence Frequency</Label>
								<div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
									{(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map((freq) => (
										<button
											key={freq}
											type="button"
											onClick={() => setValue("repeatFrequency", freq)}
											className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
												repeatFrequency === freq
													? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
													: "text-slate-400 hover:text-white"
											}`}
										>
											{freq === "DAILY"
												? "Per Day"
												: freq === "WEEKLY"
													? "Per Week"
													: freq === "MONTHLY"
														? "Per Month"
														: "Per Year"}
										</button>
									))}
								</div>
							</div>

							{/* Interval & Trigger Time Grid */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label htmlFor="repeatInterval">
										Repeat Interval (Every N{" "}
										{repeatFrequency === "DAILY"
											? "Day"
											: repeatFrequency === "WEEKLY"
												? "Week"
												: repeatFrequency === "MONTHLY"
													? "Month"
													: "Year"}
										)
									</Label>
									<div className="relative">
										<Input
											id="repeatInterval"
											type="number"
											min={1}
											className="h-11 pr-16"
											{...register("repeatInterval", { valueAsNumber: true })}
										/>
										<span className="absolute right-3 top-3 text-xs text-slate-500">
											{repeatFrequency === "DAILY"
												? "day(s)"
												: repeatFrequency === "WEEKLY"
													? "week(s)"
													: repeatFrequency === "MONTHLY"
														? "month(s)"
														: "year(s)"}
										</span>
									</div>
								</div>

								{/* Primary Trigger Time of Day */}
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<Label htmlFor="repeatTime">Alert Trigger Time of Day</Label>
										<span className="text-[11px] text-teal-400 font-medium flex items-center gap-1">
											<Clock className="w-3 h-3" />
											<span>Click box to pick</span>
										</span>
									</div>
									<Input
										id="repeatTime"
										type="time"
										className="h-11 font-medium"
										{...register("repeatTime")}
									/>
								</div>
							</div>

							{/* Multiple Times Per Day Support */}
							<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-slate-300">
										Configured Trigger Times Today
									</span>
									{!showAddTimeInput && (
										<button
											type="button"
											onClick={() => setShowAddTimeInput(true)}
											className="flex items-center gap-1 text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition cursor-pointer"
										>
											<Plus className="w-3.5 h-3.5" />
											<span>Add Extra Time of Day</span>
										</button>
									)}
								</div>

								<div className="flex flex-wrap items-center gap-2">
									<span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 px-2.5 py-1 text-xs font-mono font-semibold">
										<Clock className="w-3 h-3 text-teal-400" />
										<span>{repeatTime || "21:00"} (Primary)</span>
									</span>

									{extraTimes.map((t) => (
										<span
											key={t}
											className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-1 text-xs font-mono font-semibold"
										>
											<Clock className="w-3 h-3 text-slate-400" />
											<span>{t}</span>
											<button
												type="button"
												onClick={() => handleRemoveExtraTime(t)}
												className="text-slate-400 hover:text-rose-400 ml-0.5 cursor-pointer"
											>
												<X className="w-3 h-3" />
											</button>
										</span>
									))}
								</div>

								{showAddTimeInput && (
									<div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
										<Input
											type="time"
											value={newTimeInput}
											onChange={(e) => setNewTimeInput(e.target.value)}
											className="h-9 w-36"
										/>
										<Button type="button" size="sm" onClick={handleAddExtraTime}>
											Add Time
										</Button>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onClick={() => {
												setShowAddTimeInput(false);
												setNewTimeInput("");
											}}
										>
											Cancel
										</Button>
									</div>
								)}
							</div>

							{/* Days of Week Selection (for Daily & Weekly) */}
							{(repeatFrequency === "DAILY" || repeatFrequency === "WEEKLY") && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label>Active Days of the Week</Label>
										<div className="flex items-center gap-1 text-[11px] text-slate-400">
											<button
												type="button"
												onClick={() => setDaysPreset("ALL")}
												className="hover:text-teal-400 transition cursor-pointer"
											>
												Every Day
											</button>
											<span>•</span>
											<button
												type="button"
												onClick={() => setDaysPreset("WEEKDAYS")}
												className="hover:text-teal-400 transition cursor-pointer"
											>
												Weekdays
											</button>
											<span>•</span>
											<button
												type="button"
												onClick={() => setDaysPreset("WEEKENDS")}
												className="hover:text-teal-400 transition cursor-pointer"
											>
												Weekends
											</button>
										</div>
									</div>

									<div className="flex items-center gap-1.5">
										{REPEAT_DAYS.map((d) => {
											const isSelected = activeDays.includes(d.value);
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
							)}

							{/* Monthly Day Selection */}
							{repeatFrequency === "MONTHLY" && (
								<div className="space-y-1.5">
									<Label htmlFor="repeatDayOfMonth">Day of Month (1 - 31)</Label>
									<Input
										id="repeatDayOfMonth"
										type="number"
										min={1}
										max={31}
										className="h-11"
										{...register("repeatDayOfMonth", { valueAsNumber: true })}
									/>
									<p className="text-[11px] text-slate-500">
										Triggers on this day number every {repeatInterval} month(s).
									</p>
								</div>
							)}

							{/* Yearly Selection */}
							{repeatFrequency === "YEARLY" && (
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label htmlFor="repeatMonthOfYear">Month of Year</Label>
										<select
											id="repeatMonthOfYear"
											className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
											{...register("repeatMonthOfYear", {
												valueAsNumber: true,
											})}
										>
											{MONTHS.map((m) => (
												<option key={m.value} value={m.value}>
													{m.label}
												</option>
											))}
										</select>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="yearlyDayOfMonth">Day of Month</Label>
										<Input
											id="yearlyDayOfMonth"
											type="number"
											min={1}
											max={31}
											className="h-11"
											{...register("repeatDayOfMonth", { valueAsNumber: true })}
										/>
									</div>
								</div>
							)}

							{/* End Condition Controls */}
							<div className="space-y-2">
								<Label>Recurrence Duration / End Limit</Label>
								<div className="grid grid-cols-3 gap-2">
									<button
										type="button"
										onClick={() => setValue("repeatEndType", "NEVER")}
										className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
											repeatEndType === "NEVER"
												? "bg-teal-500/20 text-teal-300 border-teal-500/40"
												: "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
										}`}
									>
										Never Ends
									</button>
									<button
										type="button"
										onClick={() => setValue("repeatEndType", "COUNT")}
										className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
											repeatEndType === "COUNT"
												? "bg-teal-500/20 text-teal-300 border-teal-500/40"
												: "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
										}`}
									>
										After N Times
									</button>
									<button
										type="button"
										onClick={() => setValue("repeatEndType", "UNTIL_DATE")}
										className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
											repeatEndType === "UNTIL_DATE"
												? "bg-teal-500/20 text-teal-300 border-teal-500/40"
												: "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
										}`}
									>
										On Date
									</button>
								</div>

								{repeatEndType === "COUNT" && (
									<div className="pt-1">
										<Input
											type="number"
											min={1}
											placeholder="Number of occurrences (e.g. 30)"
											className="h-11"
											{...register("repeatCount", { valueAsNumber: true })}
										/>
									</div>
								)}

								{repeatEndType === "UNTIL_DATE" && (
									<div className="pt-1 space-y-1.5">
										<div className="flex items-center justify-between">
											<Label htmlFor="repeatUntil">Repeat Until Date</Label>
											<span className="text-[11px] text-teal-400 font-medium flex items-center gap-1">
												<Calendar className="w-3 h-3" />
												<span>Click box to pick</span>
											</span>
										</div>
										<Input
											id="repeatUntil"
											type="date"
											className="h-11 font-medium"
											{...register("repeatUntil")}
										/>
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Sound & Notification Settings (Progressive Disclosure) */}
				<details className="group rounded-2xl border border-slate-800 bg-slate-900/40 transition">
					<summary className="flex items-center justify-between px-3.5 py-3 cursor-pointer select-none text-xs font-semibold text-slate-300 hover:text-white">
						<span className="flex items-center gap-2">
							<BellRing className="w-3.5 h-3.5 text-teal-400" />
							<span>Alert Sound & Notification Details</span>
						</span>
						<span className="text-[11px] text-slate-500 group-open:rotate-180 transition-transform">
							▼
						</span>
					</summary>
					<div className="p-3.5 pt-1 space-y-4 border-t border-slate-800/60">
						{modalMode === "ALARM" ? (
							<>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<CustomSelect
										label="How Many Times to Ring Alarm"
										value={String(ringCount)}
										group="RING_COUNT"
										onChange={(val) => setRingCount(Number.parseInt(val, 10))}
										options={RING_COUNT_OPTIONS}
									/>

									<CustomSelect
										label="Ring Frequency / Interval Between Rings"
										value={String(ringInterval)}
										group="RING_INTERVAL"
										onChange={(val) => setRingInterval(Number.parseInt(val, 10))}
										options={RING_INTERVAL_OPTIONS}
									/>
								</div>

								<CustomSelect
									label="When to Show Notification (Advance Notice)"
									value={String(selectedRemind ?? 0)}
									group="REMINDER_TIME"
									onChange={(val) => {
										const parsed = Number.parseInt(val, 10);
										setValue("remindBeforeMinutes", Number.isNaN(parsed) ? 0 : parsed, {
											shouldValidate: true,
										});
									}}
									options={REMINDER_OPTIONS}
								/>
							</>
						) : (
							<CustomSelect
								label="Advance Notification & Audio Chime Alert"
								value={String(selectedRemind ?? 0)}
								group="REMINDER_TIME"
								onChange={(val) => {
									const parsed = Number.parseInt(val, 10);
									setValue("remindBeforeMinutes", Number.isNaN(parsed) ? 0 : parsed, {
										shouldValidate: true,
									});
								}}
								options={REMINDER_OPTIONS}
							/>
						)}
					</div>
				</details>

				{/* Description / Instructions */}
				<div className="space-y-1.5">
					<Label htmlFor="description">Details / Notes (Optional)</Label>
					<textarea
						id="description"
						rows={2}
						className="flex w-full rounded-xl border border-slate-850 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/30 focus-visible:border-teal-500 transition duration-150"
						placeholder={
							modalMode === "ALARM"
								? "e.g. Turn on water heater, take morning vitamins"
								: "e.g. Review sprint milestones and check pull requests"
						}
						{...register("description")}
					/>
				</div>

				{/* Action Buttons */}
				<div className="flex justify-end gap-3 pt-3">
					<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting
							? "Saving..."
							: initialData
								? "Save Changes"
								: modalMode === "ALARM"
									? "Set Alarm"
									: "Create Task"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
