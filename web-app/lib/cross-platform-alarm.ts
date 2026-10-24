import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AlarmToneId } from "./alarm-settings";
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
	tone?: AlarmToneId;
}

export const ALARM_CHANNELS: Record<AlarmToneId, { id: string; name: string; sound: string }> = {
	alarm: {
		id: "daypulse_alarms_tone_alarm_v1",
		name: "DayPulse Alarm (Pulse Chime)",
		sound: "daypulse_alarm.wav",
	},
	radar: {
		id: "daypulse_alarms_tone_radar_v1",
		name: "DayPulse Alarm (Radar Beep)",
		sound: "daypulse_radar.wav",
	},
	harmonic: {
		id: "daypulse_alarms_tone_harmonic_v1",
		name: "DayPulse Alarm (Harmonic Bell)",
		sound: "daypulse_harmonic.wav",
	},
	digital: {
		id: "daypulse_alarms_tone_digital_v1",
		name: "DayPulse Alarm (Digital Watch)",
		sound: "daypulse_digital.wav",
	},
};

export function getChannelForTone(tone?: AlarmToneId): { channelId: string; sound: string } {
	const validTone: AlarmToneId = tone && ALARM_CHANNELS[tone] ? tone : "alarm";
	return {
		channelId: ALARM_CHANNELS[validTone].id,
		sound: ALARM_CHANNELS[validTone].sound,
	};
}

let channelInitialized = false;

export async function ensureAndroidAlarmChannel(): Promise<void> {
	if (channelInitialized || !Capacitor.isNativePlatform()) return;

	try {
		// Create standard legacy channel
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

		// Create dedicated channel per tone
		for (const key of Object.keys(ALARM_CHANNELS) as AlarmToneId[]) {
			const ch = ALARM_CHANNELS[key];
			await LocalNotifications.createChannel({
				id: ch.id,
				name: ch.name,
				description: "DayPulse time-sensitive alarm notifications",
				importance: 5,
				sound: ch.sound,
				vibration: true,
				lights: true,
				visibility: 1,
			});
		}

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
	const tone = payload.tone || "alarm";
	const toneInfo = getChannelForTone(tone);

	// 1. Android Capacitor Native Platform
	if (Capacitor.isNativePlatform()) {
		await ensureAndroidAlarmChannel();

		const numericId = Math.abs(
			payload.id.split("").reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0) % 2147483647,
		);

		const baseTime = payload.scheduledTime ? payload.scheduledTime.getTime() : Date.now();
		const isImmediate = !payload.scheduledTime || baseTime <= Date.now() + 2000;
		const effectiveRings =
			payload.ringCount === 0 ? 3 : Math.min(Math.max(payload.ringCount ?? 1, 1), 4);
		const intervalMs = (payload.ringIntervalSeconds || 10) * 1000;

		const notifications = [];
		for (let r = 0; r < effectiveRings; r++) {
			const ringTime = new Date(baseTime + r * intervalMs);
			const ringNumericId = (numericId + r * 10007) % 2147483647;
			const ringTitle =
				effectiveRings > 1 && r > 0
					? `${payload.title} (Alert ${r + 1}/${effectiveRings})`
					: payload.title;

			notifications.push({
				id: ringNumericId,
				title: ringTitle,
				body: payload.message,
				channelId: toneInfo.channelId,
				schedule: { at: ringTime, allowWhileIdle: true },
				sound: toneInfo.sound,
				extra: {
					originalId: payload.id,
					type: payload.type,
					ringIndex: r,
					tone,
				},
			});
		}

		await LocalNotifications.schedule({ notifications });

		// When app is in foreground and alarm is immediate, also trigger multi-ring in-app audio
		if (isImmediate) {
			if (payload.ringCount !== undefined && payload.ringCount !== 1) {
				startAlarmRinging({
					ringCount: payload.ringCount,
					intervalSeconds: payload.ringIntervalSeconds || 10,
					tone,
				});
			} else {
				playNotificationChime(tone);
			}
		}
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
			tone,
		});
		return;
	}

	// 3. Fallback Web Browser Environment
	if (payload.ringCount !== undefined && payload.ringCount !== 1) {
		startAlarmRinging({
			ringCount: payload.ringCount,
			intervalSeconds: payload.ringIntervalSeconds || 10,
			tone,
		});
	} else {
		playNotificationChime(tone);
	}

	showSystemNotification(payload.title, {
		body: payload.message,
		tag: payload.id,
	});
}
