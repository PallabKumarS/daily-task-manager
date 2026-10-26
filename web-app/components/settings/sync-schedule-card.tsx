"use client";

import { AlertCircle, CheckCircle2, Clock, Power, RefreshCw } from "lucide-react";
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
import { cn } from "@/lib/utils";

const INTERVAL_OPTIONS: SelectOption[] = [
	{ label: "Every 2 Hours", value: "2" },
	{ label: "Every 4 Hours", value: "4" },
	{ label: "Every 6 Hours", value: "6" },
	{ label: "Every 8 Hours", value: "8" },
	{ label: "Every 12 Hours", value: "12" },
	{ label: "Every 24 Hours", value: "24" },
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
				setNextSyncText("Sync disabled");
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
		<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div className="flex items-center gap-2.5">
					<div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
						<Clock className="w-4 h-4" />
					</div>
					<div>
						<h2 className="text-sm font-bold text-foreground">Sync Schedule & Automation</h2>
						<p className="text-[11px] text-muted-foreground">
							Automated background cloud synchronization timer
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 self-start sm:self-center">
					<Button
						type="button"
						variant={config.enabled ? "default" : "secondary"}
						size="sm"
						onClick={handleToggleEnabled}
						title={config.enabled ? "Click to disable auto-sync" : "Click to enable auto-sync"}
						className="gap-1.5 text-xs h-8"
					>
						<Power className="w-3.5 h-3.5" />
						<span>{config.enabled ? "Auto: Active" : "Auto: Off"}</span>
					</Button>

					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleTriggerManualSync}
						disabled={isSyncing}
						title="Execute cloud sync immediately"
						className="gap-1.5 text-xs h-8"
					>
						<RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-teal-400")} />
						<span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div className="space-y-1.5">
					<Label className="text-xs font-semibold text-foreground">Trigger Mode</Label>
					<div className="grid grid-cols-2 gap-1.5">
						<button
							type="button"
							onClick={() => handleModeChange("daily")}
							title="Run automatic sync once daily at a specified time"
							className={cn(
								"px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition text-left cursor-pointer",
								config.scheduleMode === "daily"
									? "border-teal-500 bg-primary-soft text-routine-fg"
									: "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground",
							)}
						>
							Daily Fixed
							<span className="block text-[10px] text-muted-foreground font-normal">
								At set time
							</span>
						</button>

						<button
							type="button"
							onClick={() => handleModeChange("interval")}
							title="Run automatic sync repeatedly every N hours"
							className={cn(
								"px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition text-left cursor-pointer",
								config.scheduleMode === "interval"
									? "border-teal-500 bg-primary-soft text-routine-fg"
									: "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground",
							)}
						>
							Periodic
							<span className="block text-[10px] text-muted-foreground font-normal">
								Every N hours
							</span>
						</button>
					</div>
				</div>

				<div className="space-y-1.5">
					{config.scheduleMode === "daily" ? (
						<>
							<Label htmlFor="sync-daily-time" className="text-xs font-semibold text-foreground">
								Daily Trigger Time (24h)
							</Label>
							<Input
								id="sync-daily-time"
								type="time"
								value={config.dailyTime || "00:00"}
								onChange={handleDailyTimeChange}
								title="Time of day to run sync (24h format)"
								className="text-xs font-mono h-9"
							/>
						</>
					) : (
						<>
							<Label className="text-xs font-semibold text-foreground">Sync Frequency</Label>
							<CustomSelect
								value={String(config.intervalHours || 24)}
								onChange={handleIntervalChange}
								options={INTERVAL_OPTIONS}
							/>
						</>
					)}
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2.5 pt-1">
				<div
					className="rounded-xl border border-border bg-surface-2/40 p-2.5"
					title="Next scheduled synchronization time"
				>
					<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
						<Clock className="w-3.5 h-3.5 text-blue-400" />
						<span className="font-semibold uppercase text-[10px] tracking-wider">Next Sync</span>
					</div>
					<div className="text-xs font-bold text-foreground mt-0.5 truncate">{nextSyncText}</div>
				</div>

				<div
					className="rounded-xl border border-border bg-surface-2/40 p-2.5"
					title="Most recent synchronization attempt"
				>
					<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
						{config.lastSyncStatus === "error" ? (
							<AlertCircle className="w-3.5 h-3.5 text-rose-400" />
						) : (
							<CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
						)}
						<span className="font-semibold uppercase text-[10px] tracking-wider">Last Run</span>
					</div>
					<div className="text-xs font-semibold text-foreground mt-0.5 truncate">
						{config.lastSyncAt
							? `${new Date(config.lastSyncAt).toLocaleString([], {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}`
							: "No sync yet"}
					</div>
				</div>
			</div>
		</div>
	);
}
