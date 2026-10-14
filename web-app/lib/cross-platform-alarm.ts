import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { playNotificationChime, startAlarmRinging } from "./audio-chime";
import { showSystemNotification } from "./web-notification";

export interface UnifiedAlarmPayload {
	id: string;
	title: string;
	message: string;
	type: "task" | "event" | "routine" | "system";
	leadMinutes?: number;
	scheduledTime?: Date;
	ringCount?: number;
	ringIntervalSeconds?: number;
}

let channelInitialized = false;

export async function ensureAndroidAlarmChannel(): Promise<void> {
	if (channelInitialized || !Capacitor.isNativePlatform()) return;

	try {
		await LocalNotifications.createChannel({
			id: "daypulse_alarms_v3",
			name: "DayPulse Alarms & Events",
			description: "Time-sensitive task reminders and alarm notifications",
			importance: 5,
			sound: "daypulse_alarm.wav",
			vibration: true,
			lights: true,
			visibility: 1,
		});
		channelInitialized = true;
	} catch {
		// Ignore channel creation failure on unsupported environments
	}
}

export async function getPlatformNotificationPermission(): Promise<NotificationPermission> {
	if (Capacitor.isNativePlatform()) {
		try {
			const status = await LocalNotifications.checkPermissions();
			if (status.display === "granted") return "granted";
			if (status.display === "denied") return "denied";
			return "default";
		} catch {
			return "default";
		}
	}

	if (typeof window !== "undefined" && "Notification" in window) {
		return Notification.permission;
	}

	return "denied";
}

export async function requestPlatformNotificationPermissions(): Promise<NotificationPermission> {
	if (Capacitor.isNativePlatform()) {
		try {
			await ensureAndroidAlarmChannel();
			const status = await LocalNotifications.requestPermissions();
			return status.display === "granted" ? "granted" : "denied";
		} catch {
			return "denied";
		}
	}

	if (typeof window !== "undefined" && "Notification" in window) {
		try {
			const permission = await Notification.requestPermission();
			return permission;
		} catch {
			return "denied";
		}
	}

	return "denied";
}

export async function dispatchUnifiedAlarm(payload: UnifiedAlarmPayload): Promise<void> {
	// 1. Android Capacitor Native Platform
	if (Capacitor.isNativePlatform()) {
		await ensureAndroidAlarmChannel();

		const numericId = Math.abs(
			payload.id.split("").reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0) % 2147483647,
		);

		const scheduleOption = payload.scheduledTime
			? { at: payload.scheduledTime, allowWhileIdle: true }
			: undefined;

		await LocalNotifications.schedule({
			notifications: [
				{
					id: numericId,
					title: payload.title,
					body: payload.message,
					channelId: "daypulse_alarms_v3",
					schedule: scheduleOption,
					sound: "daypulse_alarm.wav",
					extra: {
						originalId: payload.id,
						type: payload.type,
					},
				},
			],
		});
		return;
	}

	// 2. Desktop Electron Environment
	if (
		typeof window !== "undefined" &&
		(
			window as unknown as {
				electronAPI?: { triggerAlarm: (data: unknown) => void };
			}
		).electronAPI?.triggerAlarm
	) {
		(
			window as unknown as {
				electronAPI: { triggerAlarm: (data: unknown) => void };
			}
		).electronAPI.triggerAlarm({
			id: payload.id,
			title: payload.title,
			message: payload.message,
			type: payload.type,
			leadMinutes: payload.leadMinutes,
			ringCount: payload.ringCount,
			ringIntervalSeconds: payload.ringIntervalSeconds,
		});
		return;
	}

	// 3. Fallback Web Browser Environment
	if (payload.ringCount !== undefined && payload.ringCount !== 1) {
		startAlarmRinging({
			ringCount: payload.ringCount,
			intervalSeconds: payload.ringIntervalSeconds || 10,
		});
	} else {
		playNotificationChime();
	}

	showSystemNotification(payload.title, {
		body: payload.message,
		tag: payload.id,
	});
}
