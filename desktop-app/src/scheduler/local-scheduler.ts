import type { BrowserWindow } from "electron";
import { triggerDesktopAlarm } from "../audio/index.js";
import { getCurrentUserId, getPrismaClient } from "../db/index.js";

const sentRemindersToday = new Set<string>();
let lastCleanedDate = "";
let schedulerInterval: NodeJS.Timeout | null = null;

const getTodayDateString = (date = new Date()): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const parseAlarmRingSettings = (description?: string | null) => {
	if (!description) return { ringCount: 3, ringIntervalSeconds: 10 };
	const match = description.match(/\[Alarm:\s*rings=(\d+),\s*freq=(\d+)s\]/i);
	if (!match) return { ringCount: 3, ringIntervalSeconds: 10 };
	return {
		ringCount: Number.parseInt(match[1], 10) || 3,
		ringIntervalSeconds: Number.parseInt(match[2], 10) || 10,
	};
};

export function startLocalScheduler(mainWindow: BrowserWindow): void {
	if (schedulerInterval) return;

	console.log("[DayPulse Scheduler] Starting in-process reminder scheduler (30s interval)...");

	const checkReminders = async () => {
		try {
			const prisma = getPrismaClient();
			const userId = getCurrentUserId();
			if (!userId) return;
			const now = new Date();
			const todayStr = getTodayDateString(now);

			if (lastCleanedDate !== todayStr) {
				sentRemindersToday.clear();
				if (lastCleanedDate) {
					mainWindow.webContents.send("daypulse:sync-updated", {
						entityType: "date",
						action: "rollover",
						data: { date: todayStr },
					});
				}
				lastCleanedDate = todayStr;
			}

			const nowIso = now.toISOString();

			// 1. Process One-time Tasks & Events
			const pendingTasks = await prisma.task.findMany({
				where: {
					userId,
					status: { not: "COMPLETED" },
					isRecurring: false,
					reminderSent: false,
					dueDate: { not: null },
				},
			});

			for (const task of pendingTasks) {
				if (!task.dueDate) continue;

				const dueTime = new Date(task.dueDate).getTime();
				const currentTime = now.getTime();
				const leadMs = (task.remindBeforeMinutes || 0) * 60 * 1000;
				const diffMs = dueTime - currentTime;

				if (diffMs <= leadMs && diffMs >= -5 * 60 * 1000) {
					const itemType = task.type.toLowerCase() === "event" ? "event" : "task";
					const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));
					const { ringCount, ringIntervalSeconds } = parseAlarmRingSettings(task.description);

					triggerDesktopAlarm(mainWindow, {
						id: task.id,
						title: task.title,
						message:
							minutesLeft > 0
								? `${task.type}: "${task.title}" is due in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}!`
								: `${task.type}: "${task.title}" is due right now!`,
						type: itemType,
						leadMinutes: task.remindBeforeMinutes,
						ringCount,
						ringIntervalSeconds,
					});

					await prisma.task.update({
						where: { id: task.id },
						data: {
							reminderSent: true,
							lastTriggeredDate: nowIso,
						},
					});

					mainWindow.webContents.send("daypulse:sync-updated", {
						entityType: "task",
						action: "trigger",
						data: { id: task.id },
					});
				}
			}

			// 2. Process Recurring Tasks & Alarms
			const recurringTasks = await prisma.task.findMany({
				where: {
					userId,
					isRecurring: true,
					status: { not: "COMPLETED" },
				},
			});

			const currentDayOfWeek = String(now.getDay());
			const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

			for (const rTask of recurringTasks) {
				if (!rTask.repeatTime) continue;

				const activeDays = (rTask.repeatDaysOfWeek || "0,1,2,3,4,5,6").split(",");
				if (!activeDays.includes(currentDayOfWeek)) continue;

				const timeEntries = rTask.repeatTime.split(",").map((t) => t.trim());
				for (const timeStr of timeEntries) {
					const [tHours, tMinutes] = timeStr.split(":").map(Number);
					if (Number.isNaN(tHours) || Number.isNaN(tMinutes)) continue;

					const targetMinutes = tHours * 60 + tMinutes;
					const lead = rTask.remindBeforeMinutes || 0;
					const diff = targetMinutes - currentTotalMinutes;

					const reminderKey = `recurring_task_${rTask.id}_${todayStr}_${timeStr}`;
					if (diff <= lead && diff >= -15 && !sentRemindersToday.has(reminderKey)) {
						sentRemindersToday.add(reminderKey);

						const itemType = rTask.type.toLowerCase() === "event" ? "event" : "task";
						const { ringCount, ringIntervalSeconds } = parseAlarmRingSettings(rTask.description);

						triggerDesktopAlarm(mainWindow, {
							id: rTask.id,
							title: `Alarm: ${rTask.title}`,
							message:
								diff > 0
									? `Upcoming alarm "${rTask.title}" is set for ${timeStr} (in ${diff} mins)!`
									: `Alarm "${rTask.title}" is ringing right now!`,
							type: itemType,
							leadMinutes: rTask.remindBeforeMinutes,
							ringCount,
							ringIntervalSeconds,
						});

						await prisma.task.update({
							where: { id: rTask.id },
							data: { lastTriggeredDate: nowIso },
						});

						mainWindow.webContents.send("daypulse:sync-updated", {
							entityType: "task",
							action: "trigger",
							data: { id: rTask.id },
						});
					}
				}
			}

			// 3. Process Routines
			const routines = await prisma.routine.findMany({
				where: { userId },
				include: {
					logs: {
						where: { date: todayStr },
					},
				},
			});

			for (const routine of routines) {
				const isCompletedToday = routine.logs.length > 0 && routine.logs[0].completed;
				if (isCompletedToday) continue;

				const activeDays = (routine.daysOfWeek || "0,1,2,3,4,5,6").split(",");
				if (!activeDays.includes(currentDayOfWeek)) continue;

				if (routine.targetTime) {
					const [rHours, rMinutes] = routine.targetTime.split(":").map(Number);
					const routineTimeMinutes = rHours * 60 + rMinutes;
					const leadTime = routine.reminderMinutes || 0;
					const diff = routineTimeMinutes - currentTotalMinutes;

					const reminderKey = `routine_${routine.id}_${todayStr}`;
					if (diff <= leadTime && diff >= -15 && !sentRemindersToday.has(reminderKey)) {
						sentRemindersToday.add(reminderKey);

						triggerDesktopAlarm(mainWindow, {
							id: routine.id,
							title: `Routine: ${routine.title}`,
							message:
								diff > 0
									? `Upcoming routine "${routine.title}" is scheduled at ${routine.targetTime} (in ${diff} mins)!`
									: `Routine "${routine.title}" is scheduled for right now!`,
							type: "routine",
							leadMinutes: routine.reminderMinutes,
							ringCount: 2,
							ringIntervalSeconds: 5,
						});
					}
				}
			}
		} catch (err) {
			console.warn("[DayPulse Scheduler] Error running reminder sweep:", err);
		}
	};

	checkReminders();
	schedulerInterval = setInterval(checkReminders, 30000);
}

export function stopLocalScheduler(): void {
	if (schedulerInterval) {
		clearInterval(schedulerInterval);
		schedulerInterval = null;
	}
}
