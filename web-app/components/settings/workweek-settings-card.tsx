"use client";

import { Calendar, Check, RotateCcw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DAY_NAMES_FULL,
	DAY_NAMES_SHORT,
	DEFAULT_WORKWEEK_PREFERENCES,
	type StartOfWeekDay,
	useWorkweekPreferences,
} from "@/lib/workweek-preferences";

const START_DAY_OPTIONS: Array<{ label: string; value: StartOfWeekDay }> = [
	{ label: "Sunday (Default)", value: 0 },
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
				// Prevent empty weekend list
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
		toast.success("Schedule reset to default (Sunday start, Fri-Sat weekend)");
	};

	const formattedWeekdays = weekdays.map((d) => DAY_NAMES_SHORT[d]).join(", ");
	const formattedWeekends = selectedWeekends.map((d) => DAY_NAMES_SHORT[d]).join(", ");

	return (
		<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-5">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
				<div className="flex items-center gap-2.5">
					<div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
						<Calendar className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-sm font-bold text-foreground">Workweek & Schedule Preferences</h2>
						<p className="text-[11px] text-slate-400">
							Define your start day of the week, weekends, and automatic background sync
						</p>
					</div>
				</div>

				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={handleReset}
					className="text-xs text-slate-400 hover:text-slate-200 gap-1.5 self-start sm:self-center"
				>
					<RotateCcw className="w-3.5 h-3.5" />
					<span>Reset to Defaults</span>
				</Button>
			</div>

			<div className="space-y-4">
				{/* Start Day of the Week */}
				<div className="p-4 rounded-2xl border border-slate-800 bg-slate-950 space-y-2">
					<label htmlFor="start-of-week-select" className="text-xs font-semibold text-slate-200">
						Start Day of the Week
					</label>
					<p className="text-[11px] text-slate-400">
						Determines the first day displayed in weekly financial charts and task calendars.
					</p>
					<div className="flex flex-wrap gap-2 pt-1">
						{START_DAY_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type="button"
								onClick={() => setStartDay(opt.value)}
								className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
									startDay === opt.value
										? "bg-teal-500/15 text-teal-300 border-teal-500/40 shadow-sm"
										: "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850"
								}`}
							>
								{startDay === opt.value && <Check className="w-3.5 h-3.5" />}
								<span>{opt.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* Weekend Days Selector */}
				<div className="p-4 rounded-2xl border border-slate-800 bg-slate-950 space-y-2">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
						<label htmlFor="weekend-days-group" className="text-xs font-semibold text-slate-200">
							Configured Weekend Days
						</label>
						<span className="text-[10px] text-slate-400">
							Weekends: <strong className="text-teal-400">{formattedWeekends || "None"}</strong> •
							Workdays: <strong className="text-slate-200">{formattedWeekdays}</strong>
						</span>
					</div>
					<p className="text-[11px] text-slate-400">
						Select which days represent your weekend break. Recurring routines and finances will
						adapt to these days.
					</p>
					<div className="flex flex-wrap gap-1.5 pt-1">
						{DAY_NAMES_FULL.map((name, idx) => {
							const isWeekend = selectedWeekends.includes(idx);
							return (
								<button
									key={name}
									type="button"
									onClick={() => toggleWeekendDay(idx)}
									className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
										isWeekend
											? "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm"
											: "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850"
									}`}
								>
									<span>{name}</span>
									{isWeekend && <span className="ml-1 text-[10px] opacity-75">(Weekend)</span>}
								</button>
							);
						})}
					</div>
				</div>

				{/* Auto Daily Sync Toggle */}
				<div className="p-4 rounded-2xl border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<p className="text-xs font-semibold text-slate-200">Automated Daily Cloud Sync</p>
						<p className="text-[11px] text-slate-400 mt-0.5">
							Automatically backup database to Google Drive once every 24 hours while DayPulse is
							running.
						</p>
					</div>
					<button
						type="button"
						onClick={() => setAutoSync(!autoSync)}
						className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
							autoSync
								? "bg-teal-500/15 text-teal-300 border-teal-500/30"
								: "bg-slate-800 text-slate-400 border-slate-700 hover:text-foreground"
						}`}
					>
						{autoSync ? "Auto-Sync Enabled" : "Auto-Sync Disabled"}
					</button>
				</div>

				<div className="pt-2 flex justify-end">
					<Button type="button" size="sm" onClick={handleSave} className="gap-2">
						<Check className="w-4 h-4" />
						<span>Save Workweek Preferences</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
