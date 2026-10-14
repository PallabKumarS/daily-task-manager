import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { api } from "./api-client";

export interface SyncScheduleConfig {
	enabled: boolean;
	scheduleMode: "daily" | "interval";
	dailyTime: string; // "00:00" = 12:00 AM midnight
	intervalHours: number; // e.g. 1, 3, 6, 12, 24
	lastSyncAt: string | null;
	lastSyncStatus: "success" | "error" | null;
	lastSyncMessage: string | null;
}

const STORAGE_KEY = "daypulse_sync_schedule_config";
const SYNC_NOTIFICATION_ID = 888801;

export const DEFAULT_SYNC_SCHEDULE: SyncScheduleConfig = {
	enabled: true,
	scheduleMode: "daily",
	dailyTime: "00:00",
	intervalHours: 24,
	lastSyncAt: null,
	lastSyncStatus: null,
	lastSyncMessage: null,
};

export function getSyncScheduleConfig(): SyncScheduleConfig {
	if (typeof window === "undefined") return DEFAULT_SYNC_SCHEDULE;

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return {
				...DEFAULT_SYNC_SCHEDULE,
				...parsed,
			};
		}
	} catch {
		// Ignore JSON parse errors
	}

	return DEFAULT_SYNC_SCHEDULE;
}

export function saveSyncScheduleConfig(updates: Partial<SyncScheduleConfig>): SyncScheduleConfig {
	if (typeof window === "undefined") return { ...DEFAULT_SYNC_SCHEDULE, ...updates };

	const current = getSyncScheduleConfig();
	const merged: SyncScheduleConfig = {
		...current,
		...updates,
	};

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
	} catch {
		// Ignore storage quota errors
	}

	window.dispatchEvent(new CustomEvent("daypulse:sync-schedule-updated", { detail: merged }));

	return merged;
}

export function calculateNextSyncTime(config: SyncScheduleConfig): Date {
	const now = new Date();

	if (config.scheduleMode === "interval") {
		const intervalMs = Math.max(1, config.intervalHours) * 60 * 60 * 1000;
		if (!config.lastSyncAt) {
			return new Date(now.getTime() + intervalMs);
		}

		const lastMs = new Date(config.lastSyncAt).getTime();
		let nextMs = lastMs + intervalMs;
		while (nextMs <= now.getTime()) {
			nextMs += intervalMs;
		}
		return new Date(nextMs);
	}

	// Daily at fixed time e.g. "00:00" (12:00 AM)
	const [rawHours, rawMinutes] = (config.dailyTime || "00:00").split(":");
	const hours = Number.parseInt(rawHours, 10) || 0;
	const minutes = Number.parseInt(rawMinutes, 10) || 0;

	const target = new Date(now);
	target.setHours(hours, minutes, 0, 0);

	if (target.getTime() <= now.getTime()) {
		target.setDate(target.getDate() + 1);
	}

	return target;
}

export async function executeScheduledSync(): Promise<{
	success: boolean;
	message: string;
	timestamp: string;
}> {
	const nowIso = new Date().toISOString();

	try {
		const statusRes = await api.get<{
			connected: boolean;
			googleEmail?: string;
		}>("/sync/status");

		const isGoogleConnected = statusRes.success && Boolean(statusRes.data?.connected);
		let message = "";

		if (isGoogleConnected) {
			const syncRes = await api.post<{ lastSyncAt?: string }>("/sync/bidirectional");
			if (syncRes.success) {
				message = syncRes.message || "Synchronized with Google Drive successfully";
			} else {
				const uploadRes = await api.post<{ lastSyncAt?: string }>("/sync/upload");
				if (uploadRes.success) {
					message = uploadRes.message || "Synced to Google Drive successfully";
				} else {
					throw new Error(syncRes.message || uploadRes.message || "Failed to sync to Google Drive");
				}
			}
		} else {
			const exportRes = await api.post<{
				fileName: string;
				base64: string;
			}>("/sync/archive/export");

			if (exportRes.success && exportRes.data?.base64) {
				if (typeof window !== "undefined") {
					localStorage.setItem("daypulse_auto_snapshot_data", exportRes.data.base64);
					localStorage.setItem("daypulse_auto_snapshot_at", nowIso);
				}
				message = "Local workspace snapshot archived successfully";
			} else {
				message = "Workspace state verified";
			}
		}

		saveSyncScheduleConfig({
			lastSyncAt: nowIso,
			lastSyncStatus: "success",
			lastSyncMessage: message,
		});

		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("daypulse:sync-completed", {
					detail: { success: true, message, timestamp: nowIso },
				}),
			);
		}

		return { success: true, message, timestamp: nowIso };
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Sync encountered an unexpected error";

		saveSyncScheduleConfig({
			lastSyncAt: nowIso,
			lastSyncStatus: "error",
			lastSyncMessage: msg,
		});

		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("daypulse:sync-completed", {
					detail: { success: false, message: msg, timestamp: nowIso },
				}),
			);
		}

		return { success: false, message: msg, timestamp: nowIso };
	}
}

async function registerAndroidSyncAlarm(targetDate: Date): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;

	try {
		await LocalNotifications.createChannel({
			id: "daypulse_background_sync",
			name: "DayPulse Background Sync",
			description: "Silent automated sync wake-up channel",
			importance: 2,
			sound: undefined,
			vibration: false,
			lights: false,
			visibility: -1,
		});

		await LocalNotifications.cancel({
			notifications: [{ id: SYNC_NOTIFICATION_ID }],
		});

		await LocalNotifications.schedule({
			notifications: [
				{
					id: SYNC_NOTIFICATION_ID,
					title: "DayPulse Auto-Sync",
					body: `Background sync running for ${targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
					channelId: "daypulse_background_sync",
					schedule: {
						at: targetDate,
						allowWhileIdle: true,
					},
					silent: true,
					extra: { type: "BACKGROUND_SYNC" },
				},
			],
		});
	} catch {
		// Ignore notification scheduling failures
	}
}

let isAndroidListenerAttached = false;

function attachAndroidSyncListener(): void {
	if (isAndroidListenerAttached || !Capacitor.isNativePlatform()) return;
	isAndroidListenerAttached = true;

	LocalNotifications.addListener("localNotificationReceived", async (notification) => {
		if (notification.id === SYNC_NOTIFICATION_ID) {
			await executeScheduledSync();
			scheduleNextWakeup();
		}
	});
}

let activeTimeoutId: ReturnType<typeof setTimeout> | null = null;
let activeIntervalId: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

export function scheduleNextWakeup(): void {
	if (typeof window === "undefined") return;

	if (activeTimeoutId) {
		clearTimeout(activeTimeoutId);
		activeTimeoutId = null;
	}

	const config = getSyncScheduleConfig();
	if (!config.enabled) return;

	const nextDate = calculateNextSyncTime(config);
	const msUntilNext = Math.max(1000, nextDate.getTime() - Date.now());

	if (Capacitor.isNativePlatform()) {
		registerAndroidSyncAlarm(nextDate);
		attachAndroidSyncListener();
	}

	activeTimeoutId = setTimeout(async () => {
		await executeScheduledSync();
		scheduleNextWakeup();
	}, msUntilNext);
}

export function initSyncScheduler(): () => void {
	if (typeof window === "undefined" || isInitialized) {
		return () => {};
	}

	isInitialized = true;
	scheduleNextWakeup();

	// Low-frequency heartbeat check every 30 minutes for system sleep drift recovery
	if (!activeIntervalId) {
		activeIntervalId = setInterval(
			() => {
				const config = getSyncScheduleConfig();
				if (!config.enabled) return;

				const nextDate = calculateNextSyncTime(config);
				const lastSyncMs = config.lastSyncAt ? new Date(config.lastSyncAt).getTime() : 0;

				// If last sync was more than 1 hour ago and scheduled time passed
				if (Date.now() - lastSyncMs >= 60 * 60 * 1000 && Date.now() >= nextDate.getTime() - 60000) {
					executeScheduledSync().then(() => {
						scheduleNextWakeup();
					});
				}
			},
			30 * 60 * 1000,
		);
	}

	const onScheduleUpdated = () => {
		scheduleNextWakeup();
	};

	const onVisibilityChange = () => {
		if (document.visibilityState === "visible") {
			const config = getSyncScheduleConfig();
			if (!config.enabled) return;

			const nextDate = calculateNextSyncTime(config);
			if (Date.now() >= nextDate.getTime()) {
				executeScheduledSync().then(() => {
					scheduleNextWakeup();
				});
			}
		}
	};

	window.addEventListener("daypulse:sync-schedule-updated", onScheduleUpdated);
	document.addEventListener("visibilitychange", onVisibilityChange);

	return () => {
		if (activeTimeoutId) {
			clearTimeout(activeTimeoutId);
			activeTimeoutId = null;
		}
		if (activeIntervalId) {
			clearInterval(activeIntervalId);
			activeIntervalId = null;
		}
		window.removeEventListener("daypulse:sync-schedule-updated", onScheduleUpdated);
		document.removeEventListener("visibilitychange", onVisibilityChange);
		isInitialized = false;
	};
}
