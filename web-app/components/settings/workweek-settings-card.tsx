"use client";

import { Calendar, Check, RotateCcw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	DAY_NAMES_FULL,
	DAY_NAMES_SHORT,
	DEFAULT_WORKWEEK_PREFERENCES,
	type StartOfWeekDay,
	useWorkweekPreferences,
} from "@/lib/workweek-preferences";

const START_DAY_OPTIONS: Array<{ label: string; value: StartOfWeekDay }> = [
	{ label: "Sunday", value: 0 },
	{ label: "Monday", value: 1 },
	{ label: "Saturday", value: 6 },
];

export function WorkweekSettingsCard() {
	const { preferences, updatePreferences, weekdays } = useWorkweekPreferences();

	const [startDay, setStartDay] = React.useState<StartOfWeekDay>(preferences.startOfWeek);
	const [selectedWeekends, setSelectedWeekends] = React.useState<number[]>(preferences.weekendDays);
	const [autoSync, setAutoSync] = React.useState<boolean>(preferences.autoDailySync);

	React.useEffect(() => {
		setStartDay(preferences.startOfWeek);
		setSelectedWeekends(preferences.weekendDays);
		setAutoSync(preferences.autoDailySync);
	}, [preferences]);

	const toggleWeekendDay = (dayIndex: number) => {
		setSelectedWeekends((prev) => {
			if (prev.includes(dayIndex)) {
				if (prev.length <= 1) {
					toast.error("At least one weekend day must remain selected");
					return prev;
				}
				return prev.filter((d) => d !== dayIndex);
			}
			return [...prev, dayIndex].sort();
		});
	};

	const handleSave = () => {
		updatePreferences({
			startOfWeek: startDay,
			weekendDays: selectedWeekends,
			autoDailySync: autoSync,
		});
		toast.success("Schedule & auto-sync preferences updated");
	};

	const handleReset = () => {
		setStartDay(DEFAULT_WORKWEEK_PREFERENCES.startOfWeek);
		setSelectedWeekends(DEFAULT_WORKWEEK_PREFERENCES.weekendDays);
		setAutoSync(DEFAULT_WORKWEEK_PREFERENCES.autoDailySync);
		updatePreferences(DEFAULT_WORKWEEK_PREFERENCES);
		toast.success("Schedule reset to default");
	};

	const formattedWeekdays = weekdays.map((d) => DAY_NAMES_SHORT[d]).join(", ");
	const formattedWeekends = selectedWeekends.map((d) => DAY_NAMES_SHORT[d]).join(", ");

	return (
		<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div className="flex items-center gap-2.5">
					<div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 flex items-center justify-center shrink-0">
						<Calendar className="w-4 h-4" />
					</div>
					<div>
						<h2 className="text-sm font-bold text-foreground">Workweek & Schedule</h2>
						<p className="text-[11px] text-muted-foreground">
							First day of week, weekend schedule, and recurring cadence
						</p>
					</div>
				</div>

				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={handleReset}
					title="Reset schedule to Sunday start and Fri-Sat weekend"
					className="text-xs text-muted-foreground hover:text-foreground gap-1.5 self-start sm:self-center h-8"
				>
					<RotateCcw className="w-3.5 h-3.5" />
					<span>Reset Defaults</span>
				</Button>
			</div>

			<div className="space-y-3">
				{/* Start Day of the Week */}
				<div className="p-3 rounded-xl border border-border bg-surface-2/40 space-y-1.5">
					<div className="flex items-center justify-between">
						<label htmlFor="start-day-pills" className="text-xs font-semibold text-foreground">
							First Day of the Week
						</label>
						<span className="text-[10px] text-muted-foreground">Used in charts & calendars</span>
					</div>
					<div id="start-day-pills" className="flex flex-wrap gap-1.5 pt-0.5">
						{START_DAY_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type="button"
								onClick={() => setStartDay(opt.value)}
								title={`Set start of week to ${opt.label}`}
								className={cn(
									"px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border",
									startDay === opt.value
										? "bg-teal-500/15 text-teal-400 border-teal-500/40"
										: "bg-surface text-muted-foreground border-border hover:text-foreground",
								)}
							>
								{startDay === opt.value && <Check className="w-3 h-3 stroke-[3]" />}
								<span>{opt.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* Weekend Days Selector */}
				<div className="p-3 rounded-xl border border-border bg-surface-2/40 space-y-1.5">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
						<label htmlFor="weekend-pills" className="text-xs font-semibold text-foreground">
							Configured Weekend Days
						</label>
						<span className="text-[10px] text-muted-foreground">
							Weekends: <strong className="text-teal-400">{formattedWeekends || "None"}</strong> •
							Workdays: <strong className="text-foreground">{formattedWeekdays}</strong>
						</span>
					</div>
					<div id="weekend-pills" className="flex flex-wrap gap-1.5 pt-0.5">
						{DAY_NAMES_FULL.map((name, idx) => {
							const isWeekend = selectedWeekends.includes(idx);
							return (
								<button
									key={name}
									type="button"
									onClick={() => toggleWeekendDay(idx)}
									title={`Toggle ${name} as weekend day`}
									className={cn(
										"px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border",
										isWeekend
											? "bg-amber-500/15 text-amber-400 border-amber-500/40"
											: "bg-surface text-muted-foreground border-border hover:text-foreground",
									)}
								>
									<span>{name}</span>
									{isWeekend && <span className="ml-1 text-[10px] opacity-75">✓</span>}
								</button>
							);
						})}
					</div>
				</div>

				{/* Auto Daily Sync Toggle */}
				<div className="p-3 rounded-xl border border-border bg-surface-2/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
					<div>
						<p className="text-xs font-semibold text-foreground">Daily Google Drive Backup</p>
						<p className="text-[11px] text-muted-foreground">
							Upload snapshot once every 24h while app is active
						</p>
					</div>
					<button
						type="button"
						onClick={() => setAutoSync(!autoSync)}
						title={autoSync ? "Click to disable auto-sync" : "Click to enable auto-sync"}
						className={cn(
							"px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border self-start sm:self-center",
							autoSync
								? "bg-teal-500/15 text-teal-400 border-teal-500/40"
								: "bg-surface text-muted-foreground border-border hover:text-foreground",
						)}
					>
						{autoSync ? "Enabled" : "Disabled"}
					</button>
				</div>

				<div className="pt-1 flex justify-end">
					<Button
						type="button"
						size="sm"
						onClick={handleSave}
						title="Save start day, weekend days, and auto-sync preferences"
						className="gap-1.5 text-xs h-8"
					>
						<Check className="w-3.5 h-3.5" />
						<span>Save Preferences</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
