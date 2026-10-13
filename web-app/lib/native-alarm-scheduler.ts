import { Capacitor } from "@capacitor/core";
import { type LocalNotificationSchema, LocalNotifications } from "@capacitor/local-notifications";
import { api } from "./api-client";
import { ensureAndroidAlarmChannel } from "./cross-platform-alarm";

interface TaskItem {
	id: string;
	title: string;
	description?: string | null;
	dueDate?: string | null;
	status: string;
	type: string;
	remindBeforeMinutes?: number;
}

interface RoutineItem {
	id: string;
	title: string;
	targetTime?: string | null;
	daysOfWeek?: string | null;
	reminderMinutes?: number;
	isCompletedToday?: boolean;
}

function stringToNumericId(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 31 + str.charCodeAt(i)) & 0x7fffffff;
	}
	return hash === 0 ? 1 : hash;
}

let isSyncing = false;

export async function syncNativeAndroidAlarms(): Promise<number> {
	if (!Capacitor.isNativePlatform()) return 0;
	if (isSyncing) return 0;

	isSyncing = true;
	try {
		await ensureAndroidAlarmChannel();

		const [tasksRes, routinesRes] = await Promise.all([
			api.get<TaskItem[]>("/tasks").catch(() => null),
			api.get<RoutineItem[]>("/routines").catch(() => null),
		]);

		const now = Date.now();
		const notificationsToSchedule: LocalNotificationSchema[] = [];
		const maxHorizonMs = 7 * 24 * 60 * 60 * 1000;

		// 1. Process future Tasks and Events
		if (tasksRes?.success && Array.isArray(tasksRes.data)) {
			for (const task of tasksRes.data) {
				if (task.status === "COMPLETED" || task.status === "CANCELLED" || !task.dueDate) {
					continue;
				}

				const dueMs = new Date(task.dueDate).getTime();
				if (Number.isNaN(dueMs)) continue;

				const leadMs = (task.remindBeforeMinutes || 0) * 60 * 1000;
				const triggerMs = dueMs - leadMs;

				if (triggerMs > now && triggerMs <= now + maxHorizonMs) {
					const isEvent = task.type === "EVENT";
					const notifId = stringToNumericId(`task_${task.id}`);
					const timeLabel = new Date(dueMs).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					});

					notificationsToSchedule.push({
						id: notifId,
						title: isEvent ? `Event Reminder: ${task.title}` : `Upcoming Task: ${task.title}`,
						body: task.description
							? `${task.title} — ${task.description.slice(0, 80)}`
							: `Scheduled for ${timeLabel}`,
						channelId: "daypulse_alarms_v2",
						schedule: { at: new Date(triggerMs), allowWhileIdle: true },
						sound: "daypulse_alarm.wav",
						extra: {
							taskId: task.id,
							type: task.type,
						},
					});
				}
			}
		}

		// 2. Process Routines for the next 7 days
		if (routinesRes?.success && Array.isArray(routinesRes.data)) {
			for (const routine of routinesRes.data) {
				if (!routine.targetTime) continue;

				const [rHour, rMin] = routine.targetTime.split(":").map(Number);
				if (Number.isNaN(rHour) || Number.isNaN(rMin)) continue;

				const activeDays = (routine.daysOfWeek || "0,1,2,3,4,5,6").split(",");
				const leadMinutes = routine.reminderMinutes || 0;

				for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
					const targetDate = new Date(now + dayOffset * 24 * 60 * 60 * 1000);
					const dayOfWeekStr = targetDate.getDay().toString();

					if (!activeDays.includes(dayOfWeekStr)) continue;

					targetDate.setHours(rHour, rMin, 0, 0);
					const routineTriggerMs = targetDate.getTime() - leadMinutes * 60 * 1000;

					if (routineTriggerMs > now && routineTriggerMs <= now + maxHorizonMs) {
						const dateKey = `${targetDate.getFullYear()}_${targetDate.getMonth() + 1}_${targetDate.getDate()}`;
						const notifId = stringToNumericId(`routine_${routine.id}_${dateKey}`);

						notificationsToSchedule.push({
							id: notifId,
							title: `Daily Routine: ${routine.title}`,
							body: `Time for your routine: "${routine.title}" at ${routine.targetTime}`,
							channelId: "daypulse_alarms_v2",
							schedule: { at: new Date(routineTriggerMs), allowWhileIdle: true },
							sound: "daypulse_alarm.wav",
							extra: {
								routineId: routine.id,
								type: "routine",
							},
						});
					}
				}
			}
		}

		// Sort by nearest trigger time and cap to safe limit (top 50)
		notificationsToSchedule.sort((a, b) => {
			const timeA = a.schedule?.at ? new Date(a.schedule.at).getTime() : 0;
			const timeB = b.schedule?.at ? new Date(b.schedule.at).getTime() : 0;
			return timeA - timeB;
		});

		const limitedBatch = notificationsToSchedule.slice(0, 50);

		// Clear pending and register new batch
		const pending = await LocalNotifications.getPending();
		if (pending.notifications.length > 0) {
			await LocalNotifications.cancel({ notifications: pending.notifications });
		}

		if (limitedBatch.length > 0) {
			await LocalNotifications.schedule({ notifications: limitedBatch });
		}

		return limitedBatch.length;
	} catch {
		return 0;
	} finally {
		isSyncing = false;
	}
}

export function initNativeAlarmListener(): () => void {
	if (!Capacitor.isNativePlatform()) return () => {};

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const triggerSync = () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			syncNativeAndroidAlarms();
		}, 1500);
	};

	// Trigger sync on initial load, app resume, visibility change, and custom refresh
	triggerSync();
	window.addEventListener("daypulse:refresh", triggerSync);
	document.addEventListener("visibilitychange", triggerSync);
	window.addEventListener("focus", triggerSync);

	return () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		window.removeEventListener("daypulse:refresh", triggerSync);
		document.removeEventListener("visibilitychange", triggerSync);
		window.removeEventListener("focus", triggerSync);
	};
}
