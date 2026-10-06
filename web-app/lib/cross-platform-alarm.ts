import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { playNotificationChime } from "./audio-chime";
import { showSystemNotification } from "./web-notification";

export interface UnifiedAlarmPayload {
	id: string;
	title: string;
	message: string;
	type: "task" | "event" | "routine" | "system";
	leadMinutes?: number;
	scheduledTime?: Date;
}

let channelInitialized = false;

async function ensureAndroidAlarmChannel(): Promise<void> {
	if (channelInitialized || !Capacitor.isNativePlatform()) return;

	try {
		await LocalNotifications.createChannel({
			id: "daypulse_alarms",
			name: "DayPulse Alarms & Events",
			description: "Time-sensitive task reminders and alarm notifications",
			importance: 5,
			sound: "alarm_chime.wav",
			vibration: true,
			lights: true,
			visibility: 1,
		});
		channelInitialized = true;
	} catch {
		// Ignore channel creation failure on unsupported environments
	}
}

export async function requestPlatformNotificationPermissions(): Promise<boolean> {
	if (Capacitor.isNativePlatform()) {
		try {
			const status = await LocalNotifications.requestPermissions();
			return status.display === "granted";
		} catch {
			return false;
		}
	}

	if (typeof window !== "undefined" && "Notification" in window) {
		try {
			const permission = await Notification.requestPermission();
			return permission === "granted";
		} catch {
			return false;
		}
	}

	return false;
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
					channelId: "daypulse_alarms",
					schedule: scheduleOption,
					sound: "alarm_chime.wav",
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
		});
		return;
	}

	// 3. Fallback Web Browser Environment
	playNotificationChime();
	showSystemNotification(payload.title, {
		body: payload.message,
		tag: payload.id,
	});
}
