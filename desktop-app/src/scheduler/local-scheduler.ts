import type { BrowserWindow } from "electron";
import { triggerDesktopAlarm } from "../alarm-manager.js";
import { getCurrentUserId, getPrismaClient } from "../db/prisma-client.js";

const sentRemindersToday = new Set<string>();
let lastCleanedDate = "";
let schedulerInterval: NodeJS.Timeout | null = null;

const getTodayDateString = (date = new Date()): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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
				lastCleanedDate = todayStr;
			}

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
				const leadMs = (task.remindBeforeMinutes || 15) * 60 * 1000;
				const diffMs = dueTime - currentTime;

				if (diffMs <= leadMs && diffMs >= -5 * 60 * 1000) {
					const itemType = task.type.toLowerCase() === "event" ? "event" : "task";
					const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));

					triggerDesktopAlarm(mainWindow, {
						id: task.id,
						title: task.title,
						message:
							minutesLeft > 0
								? `${task.type}: "${task.title}" is due in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}!`
								: `${task.type}: "${task.title}" is due right now!`,
						type: itemType,
						leadMinutes: task.remindBeforeMinutes,
					});

					await prisma.task.update({
						where: { id: task.id },
						data: { reminderSent: true },
					});
				}
			}

			// 2. Process Routines
			const routines = await prisma.routine.findMany({
				where: { userId },
				include: {
					logs: {
						where: { date: todayStr },
					},
				},
			});

			const currentDayOfWeek = String(now.getDay());

			for (const routine of routines) {
				const isCompletedToday = routine.logs.length > 0 && routine.logs[0].completed;
				if (isCompletedToday) continue;

				const activeDays = (routine.daysOfWeek || "0,1,2,3,4,5,6").split(",");
				if (!activeDays.includes(currentDayOfWeek)) continue;

				if (routine.targetTime) {
					const [rHours, rMinutes] = routine.targetTime.split(":").map(Number);
					const routineTimeMinutes = rHours * 60 + rMinutes;
					const nowMinutes = now.getHours() * 60 + now.getMinutes();
					const leadTime = routine.reminderMinutes || 0;
					const diff = routineTimeMinutes - nowMinutes;

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
						});
					}
				}
			}
		} catch (err) {
			console.warn("[DayPulse Scheduler] Error running reminder sweep:", err);
		}
	};

	// Run initial check and set recurring timer
	checkReminders();
	schedulerInterval = setInterval(checkReminders, 30000);
}

export function stopLocalScheduler(): void {
	if (schedulerInterval) {
		clearInterval(schedulerInterval);
		schedulerInterval = null;
	}
}
