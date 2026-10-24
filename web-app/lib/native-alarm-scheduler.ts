import { Capacitor } from "@capacitor/core";
import { type LocalNotificationSchema, LocalNotifications } from "@capacitor/local-notifications";
import { parseAlarmConfig } from "./alarm-settings";
import { api } from "./api-client";
import { stopCurrentAlarm } from "./audio-chime";
import { ensureAndroidAlarmChannel, getChannelForTone } from "./cross-platform-alarm";

interface TaskItem {
	id: string;
	title: string;
	description?: string | null;
	dueDate?: string | null;
	status: string;
	type: string;
	remindBeforeMinutes?: number;
	isRecurring?: boolean;
	repeatTime?: string | null;
	repeatDaysOfWeek?: string | null;
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
				if (task.status === "COMPLETED" || task.status === "CANCELLED") {
					continue;
				}

				const isEvent = task.type === "EVENT";
				const leadMinutes = task.remindBeforeMinutes || 0;
				const leadMs = leadMinutes * 60 * 1000;
				const { config } = parseAlarmConfig(task.description);
				const toneInfo = getChannelForTone(config.tone);
				const ringCount = config.ringCount === 0 ? 3 : Math.min(Math.max(config.ringCount, 1), 4);
				const ringIntervalMs = (config.ringIntervalSeconds || 10) * 1000;

				// Case A: Recurring Task with repeatTime
				if (task.isRecurring && task.repeatTime) {
					const times = task.repeatTime
						.split(",")
						.map((t) => t.trim())
						.filter(Boolean);
					const activeDays = (task.repeatDaysOfWeek || "0,1,2,3,4,5,6")
						.split(",")
						.map((s) => s.trim());

					for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
						const dayTarget = new Date(now + dayOffset * 24 * 60 * 60 * 1000);
						const dayOfWeekStr = dayTarget.getDay().toString();
						if (!activeDays.includes(dayOfWeekStr)) continue;

						for (const timeStr of times) {
							const [tHour, tMin] = timeStr.split(":").map(Number);
							if (Number.isNaN(tHour) || Number.isNaN(tMin)) continue;

							const occTarget = new Date(dayTarget);
							occTarget.setHours(tHour, tMin, 0, 0);
							const dueTimeMs = occTarget.getTime();
							const triggerMs = dueTimeMs - leadMs;

							const dateKey = `${occTarget.getFullYear()}_${occTarget.getMonth() + 1}_${occTarget.getDate()}_${tHour}_${tMin}`;

							// Multi-ring alarms at due time
							for (let r = 0; r < ringCount; r++) {
								const ringMs = dueTimeMs + r * ringIntervalMs;
								if (ringMs > now && ringMs <= now + maxHorizonMs) {
									const title =
										ringCount > 1 && r > 0
											? `${isEvent ? "Event" : "Task Due"}: ${task.title} (Alert ${r + 1}/${ringCount})`
											: `${isEvent ? "Event" : "Task Due"}: ${task.title}`;

									notificationsToSchedule.push({
										id: stringToNumericId(`task_due_${task.id}_${dateKey}_ring_${r}`),
										title,
										body: task.description
											? task.description.slice(0, 80)
											: `Scheduled for ${timeStr}`,
										channelId: toneInfo.channelId,
										schedule: { at: new Date(ringMs), allowWhileIdle: true },
										sound: toneInfo.sound,
										extra: { taskId: task.id, type: task.type, dateKey, ring: r },
									});
								}
							}

							// Advance reminder if requested
							if (leadMs > 0 && triggerMs > now && triggerMs <= now + maxHorizonMs) {
								notificationsToSchedule.push({
									id: stringToNumericId(`task_adv_${task.id}_${dateKey}`),
									title: isEvent ? `Upcoming Event: ${task.title}` : `Upcoming Task: ${task.title}`,
									body: `${task.title} starts in ${leadMinutes}m (at ${timeStr})`,
									channelId: toneInfo.channelId,
									schedule: { at: new Date(triggerMs), allowWhileIdle: true },
									sound: toneInfo.sound,
									extra: { taskId: task.id, type: task.type, dateKey },
								});
							}
						}
					}
					continue;
				}

				// Case B: Single occurrence with dueDate
				if (!task.dueDate) continue;
				const dueMs = new Date(task.dueDate).getTime();
				if (Number.isNaN(dueMs)) continue;

				const timeLabel = new Date(dueMs).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				});

				// Multi-ring exact due time alarm
				for (let r = 0; r < ringCount; r++) {
					const ringMs = dueMs + r * ringIntervalMs;
					if (ringMs > now && ringMs <= now + maxHorizonMs) {
						const title =
							ringCount > 1 && r > 0
								? `${isEvent ? "Event" : "Task Due"}: ${task.title} (Alert ${r + 1}/${ringCount})`
								: `${isEvent ? "Event" : "Task Due"}: ${task.title}`;

						notificationsToSchedule.push({
							id: stringToNumericId(`task_due_${task.id}_ring_${r}`),
							title,
							body: task.description ? task.description.slice(0, 80) : `Scheduled for ${timeLabel}`,
							channelId: toneInfo.channelId,
							schedule: { at: new Date(ringMs), allowWhileIdle: true },
							sound: toneInfo.sound,
							extra: { taskId: task.id, type: task.type, ring: r },
						});
					}
				}

				// Advance alert if lead time configured
				const advanceMs = dueMs - leadMs;
				if (leadMs > 0 && advanceMs > now && advanceMs <= now + maxHorizonMs) {
					notificationsToSchedule.push({
						id: stringToNumericId(`task_adv_${task.id}`),
						title: isEvent ? `Upcoming Event: ${task.title}` : `Upcoming Task: ${task.title}`,
						body: `${task.title} starts in ${leadMinutes}m (at ${timeLabel})`,
						channelId: toneInfo.channelId,
						schedule: { at: new Date(advanceMs), allowWhileIdle: true },
						sound: toneInfo.sound,
						extra: { taskId: task.id, type: task.type },
					});
				}
			}
		}

		// 2. Process Routines for the next 7 days
		if (routinesRes?.success && Array.isArray(routinesRes.data)) {
			const routineTone = getChannelForTone("alarm");
			for (const routine of routinesRes.data) {
				if (!routine.targetTime) continue;

				const [rHour, rMin] = routine.targetTime.split(":").map(Number);
				if (Number.isNaN(rHour) || Number.isNaN(rMin)) continue;

				const activeDays = (routine.daysOfWeek || "0,1,2,3,4,5,6").split(",");
				const leadMinutes = routine.reminderMinutes || 0;
				const leadMs = leadMinutes * 60 * 1000;

				for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
					const targetDate = new Date(now + dayOffset * 24 * 60 * 60 * 1000);
					const dayOfWeekStr = targetDate.getDay().toString();

					if (!activeDays.includes(dayOfWeekStr)) continue;

					targetDate.setHours(rHour, rMin, 0, 0);
					const routineDueMs = targetDate.getTime();
					const routineTriggerMs = routineDueMs - leadMs;
					const dateKey = `${targetDate.getFullYear()}_${targetDate.getMonth() + 1}_${targetDate.getDate()}`;

					// Exact routine time
					if (routineDueMs > now && routineDueMs <= now + maxHorizonMs) {
						notificationsToSchedule.push({
							id: stringToNumericId(`routine_due_${routine.id}_${dateKey}`),
							title: `Daily Routine: ${routine.title}`,
							body: `Time for your routine: "${routine.title}" at ${routine.targetTime}`,
							channelId: routineTone.channelId,
							schedule: { at: new Date(routineDueMs), allowWhileIdle: true },
							sound: routineTone.sound,
							extra: { routineId: routine.id, type: "routine" },
						});
					}

					// Advance reminder if configured
					if (leadMs > 0 && routineTriggerMs > now && routineTriggerMs <= now + maxHorizonMs) {
						notificationsToSchedule.push({
							id: stringToNumericId(`routine_adv_${routine.id}_${dateKey}`),
							title: `Upcoming Routine: ${routine.title}`,
							body: `Routine "${routine.title}" starts in ${leadMinutes}m at ${routine.targetTime}`,
							channelId: routineTone.channelId,
							schedule: { at: new Date(routineTriggerMs), allowWhileIdle: true },
							sound: routineTone.sound,
							extra: { routineId: routine.id, type: "routine" },
						});
					}
				}
			}
		}

		// Sort by nearest trigger time and cap to safe limit (top 80)
		notificationsToSchedule.sort((a, b) => {
			const timeA = a.schedule?.at ? new Date(a.schedule.at).getTime() : 0;
			const timeB = b.schedule?.at ? new Date(b.schedule.at).getTime() : 0;
			return timeA - timeB;
		});

		const limitedBatch = notificationsToSchedule.slice(0, 80);

		// Clear existing scheduled notifications and register latest batch
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
	const scheduleCoalesced = (immediate = false) => {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (immediate) {
			syncNativeAndroidAlarms();
			return;
		}
		debounceTimer = setTimeout(() => {
			syncNativeAndroidAlarms();
		}, 200);
	};

	const onVisibilityChange = () => {
		// Minimizing or backgrounding immediately triggers sync before suspension
		if (document.hidden) {
			syncNativeAndroidAlarms();
		} else {
			scheduleCoalesced(false);
		}
	};

	const onRefresh = () => scheduleCoalesced(false);
	const onFocus = () => scheduleCoalesced(false);

	// Action performed listener to dismiss ongoing audio ringing
	try {
		LocalNotifications.addListener("localNotificationActionPerformed", () => {
			stopCurrentAlarm();
		});
	} catch {
		// Safe fallback
	}

	// Initial sync upon startup
	scheduleCoalesced(true);

	window.addEventListener("daypulse:refresh", onRefresh);
	document.addEventListener("visibilitychange", onVisibilityChange);
	window.addEventListener("focus", onFocus);

	return () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		window.removeEventListener("daypulse:refresh", onRefresh);
		document.removeEventListener("visibilitychange", onVisibilityChange);
		window.removeEventListener("focus", onFocus);
	};
}
