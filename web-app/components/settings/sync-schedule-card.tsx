"use client";

import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Cpu,
	Power,
	RefreshCw,
	ShieldCheck,
	Smartphone,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	calculateNextSyncTime,
	DEFAULT_SYNC_SCHEDULE,
	executeScheduledSync,
	getSyncScheduleConfig,
	type SyncScheduleConfig,
	saveSyncScheduleConfig,
} from "@/lib/sync-scheduler";

const INTERVAL_OPTIONS: SelectOption[] = [
	{ label: "Every 2 Hours", value: "2" },
	{ label: "Every 4 Hours", value: "4" },
	{ label: "Every 6 Hours", value: "6" },
	{ label: "Every 8 Hours", value: "8" },
	{ label: "Every 12 Hours", value: "12" },
	{ label: "Every 24 Hours (Once daily)", value: "24" },
];

export function SyncScheduleCard() {
	const [config, setConfig] = React.useState<SyncScheduleConfig>(DEFAULT_SYNC_SCHEDULE);
	const [isSyncing, setIsSyncing] = React.useState(false);
	const [nextSyncText, setNextSyncText] = React.useState<string>("");

	React.useEffect(() => {
		const current = getSyncScheduleConfig();
		setConfig(current);

		const updateNextSyncDisplay = (cfg: SyncScheduleConfig) => {
			if (!cfg.enabled) {
				setNextSyncText("Automatic sync disabled");
				return;
			}
			const nextDate = calculateNextSyncTime(cfg);
			const isToday = nextDate.toDateString() === new Date().toDateString();
			const dayLabel = isToday ? "Today" : "Tomorrow";
			const timeLabel = nextDate.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
			setNextSyncText(`${dayLabel} at ${timeLabel}`);
		};

		updateNextSyncDisplay(current);

		const onSyncUpdated = (e: Event) => {
			const customEvt = e as CustomEvent<SyncScheduleConfig>;
			const updatedCfg = customEvt.detail || getSyncScheduleConfig();
			setConfig(updatedCfg);
			updateNextSyncDisplay(updatedCfg);
		};

		const onSyncCompleted = () => {
			const updatedCfg = getSyncScheduleConfig();
			setConfig(updatedCfg);
			updateNextSyncDisplay(updatedCfg);
		};

		window.addEventListener("daypulse:sync-schedule-updated", onSyncUpdated);
		window.addEventListener("daypulse:sync-completed", onSyncCompleted);

		return () => {
			window.removeEventListener("daypulse:sync-schedule-updated", onSyncUpdated);
			window.removeEventListener("daypulse:sync-completed", onSyncCompleted);
		};
	}, []);

	const handleToggleEnabled = () => {
		const updated = saveSyncScheduleConfig({ enabled: !config.enabled });
		setConfig(updated);
		toast.success(
			updated.enabled ? "Automated background sync enabled" : "Automated background sync disabled",
		);
	};

	const handleModeChange = (mode: "daily" | "interval") => {
		const updated = saveSyncScheduleConfig({ scheduleMode: mode });
		setConfig(updated);
	};

	const handleDailyTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const timeVal = e.target.value || "00:00";
		const updated = saveSyncScheduleConfig({ dailyTime: timeVal });
		setConfig(updated);
	};

	const handleIntervalChange = (val: string) => {
		const hours = Number.parseInt(val, 10) || 24;
		const updated = saveSyncScheduleConfig({ intervalHours: hours });
		setConfig(updated);
	};

	const handleTriggerManualSync = async () => {
		setIsSyncing(true);
		try {
			const res = await executeScheduledSync();
			if (res.success) {
				toast.success(res.message);
			} else {
				toast.error(res.message);
			}
		} catch {
			toast.error("Manual sync attempt failed");
		} finally {
			setIsSyncing(false);
		}
	};

	return (
		<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-5">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
				<div className="flex items-center gap-2.5">
					<div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
						<Clock className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-sm font-bold text-white">Automated Sync Schedule</h2>
						<p className="text-xs text-slate-400 mt-0.5">
							Automated background cloud &amp; snapshot sync engine
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<Button
						type="button"
						variant={config.enabled ? "emerald" : "secondary"}
						size="sm"
						onClick={handleToggleEnabled}
						className="gap-2 text-xs"
					>
						<Power className="w-3.5 h-3.5" />
						<span>{config.enabled ? "Active" : "Disabled"}</span>
					</Button>

					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleTriggerManualSync}
						disabled={isSyncing}
						className="gap-1.5 text-xs text-slate-300"
					>
						<RefreshCw
							className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-400" : ""}`}
						/>
						<span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
					</Button>
				</div>
			</div>

			{/* Schedule Controls */}
			<div className="space-y-4">
				<div className="space-y-2">
					<Label className="text-xs text-slate-300">Schedule Trigger Mode</Label>
					<div className="grid grid-cols-2 gap-2 max-w-sm">
						<button
							type="button"
							onClick={() => handleModeChange("daily")}
							className={`px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer text-left ${
								config.scheduleMode === "daily"
									? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
									: "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
							}`}
						>
							Daily Fixed Time
							<span className="block text-[10px] text-slate-400 font-normal mt-0.5">
								Triggers at 12:00 AM (default)
							</span>
						</button>

						<button
							type="button"
							onClick={() => handleModeChange("interval")}
							className={`px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer text-left ${
								config.scheduleMode === "interval"
									? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
									: "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
							}`}
						>
							Periodic Interval
							<span className="block text-[10px] text-slate-400 font-normal mt-0.5">
								Repeats every N hours
							</span>
						</button>
					</div>
				</div>

				{config.scheduleMode === "daily" ? (
					<div className="space-y-1.5 max-w-xs">
						<Label htmlFor="sync-daily-time" className="text-xs text-slate-300">
							Daily Trigger Time (24h)
						</Label>
						<Input
							id="sync-daily-time"
							type="time"
							value={config.dailyTime || "00:00"}
							onChange={handleDailyTimeChange}
							className="text-xs font-mono"
						/>
						<p className="text-[11px] text-slate-400">
							Default: 00:00 (12:00 AM Midnight). You can adjust to any preferred hour.
						</p>
					</div>
				) : (
					<div className="space-y-1.5 max-w-xs">
						<Label className="text-xs text-slate-300">Sync Interval Frequency</Label>
						<CustomSelect
							value={String(config.intervalHours || 24)}
							onChange={handleIntervalChange}
							options={INTERVAL_OPTIONS}
						/>
						<p className="text-[11px] text-slate-400">
							Calculates the next sync relative to your last synchronization timestamp.
						</p>
					</div>
				)}
			</div>

			{/* Status Badges */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
				<div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1">
					<div className="flex items-center gap-1.5 text-xs text-slate-400">
						<Clock className="w-3.5 h-3.5 text-blue-400" />
						<span className="font-semibold uppercase text-[10px] tracking-wider">Next Trigger</span>
					</div>
					<div className="text-xs font-bold text-white">{nextSyncText}</div>
				</div>

				<div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1">
					<div className="flex items-center gap-1.5 text-xs text-slate-400">
						{config.lastSyncStatus === "error" ? (
							<AlertCircle className="w-3.5 h-3.5 text-rose-400" />
						) : (
							<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
						)}
						<span className="font-semibold uppercase text-[10px] tracking-wider">
							Last Synchronized
						</span>
					</div>
					<div className="text-xs font-semibold text-slate-200 truncate">
						{config.lastSyncAt
							? `${new Date(config.lastSyncAt).toLocaleString([], {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})} — ${config.lastSyncMessage || "Success"}`
							: "No sync executed yet"}
					</div>
				</div>
			</div>

			{/* Hardware & Energy Efficiency Overview */}
			<div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4 space-y-2">
				<div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
					<ShieldCheck className="w-4 h-4" />
					<span>Hardware-Optimized Background Execution</span>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400 leading-relaxed pt-1">
					<div className="flex items-start gap-2">
						<Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
						<div>
							<strong className="text-slate-200 block">Mobile Wake-and-Sleep Engine</strong>
							On Android, the OS wakes the app briefly at the exact scheduled time to perform sync
							and immediately returns to sleep, preventing device overheating and preserving
							battery.
						</div>
					</div>

					<div className="flex items-start gap-2">
						<Cpu className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
						<div>
							<strong className="text-slate-200 block">Zero-CPU Desktop Background</strong>
							When minimized to the system tray, timers are paused to maintain 0.0% CPU usage,
							activating processing only during the brief sync operation.
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
