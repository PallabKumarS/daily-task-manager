import cron from "node-cron";
import { sendAlarmNotification } from "../modules/socket/socket.service.js";
import { prisma } from "../utils/prisma.js";

const sentRoutineRemindersToday = new Set<string>();
const sentRecurringTaskRemindersToday = new Set<string>();
let lastCleanedDate = "";

const getTodayDateString = (date = new Date()): string => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export const startReminderScheduler = () => {
	// Runs every 30 seconds
	cron.schedule("*/30 * * * * *", async () => {
		const now = new Date();
		const todayStr = getTodayDateString(now);

		// Reset daily cache at midnight
		if (lastCleanedDate !== todayStr) {
			sentRoutineRemindersToday.clear();
			sentRecurringTaskRemindersToday.clear();
			lastCleanedDate = todayStr;
		}

		try {
			// 1. Process One-time Task and Event Reminders
			const pendingTasks = await prisma.task.findMany({
				where: {
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
				const leadMs = task.remindBeforeMinutes * 60 * 1000;
				const diffMs = dueTime - currentTime;

				// If current time is within lead time and not more than 5 minutes overdue
				if (diffMs <= leadMs && diffMs >= -5 * 60 * 1000) {
					const itemType =
						task.type.toLowerCase() === "event" ? "event" : "task";
					const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));

					sendAlarmNotification(task.userId, {
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

			// 2. Process Recurring Tasks & Events
			const recurringTasks = await prisma.task.findMany({
				where: {
					isRecurring: true,
					status: { not: "COMPLETED" },
				},
			});

			const currentDayOfWeek = String(now.getDay()); // 0 = Sun, 1 = Mon ...
			const currentDayOfMonth = now.getDate();
			const currentMonth = now.getMonth() + 1;

			for (const task of recurringTasks) {
				// Check repeatUntil end date
				if (task.repeatUntil && now > new Date(task.repeatUntil)) {
					await prisma.task.update({
						where: { id: task.id },
						data: { status: "COMPLETED" },
					});
					continue;
				}

				// Check max occurrences
				if (task.repeatCount && task.completedOccurrences >= task.repeatCount) {
					await prisma.task.update({
						where: { id: task.id },
						data: { status: "COMPLETED" },
					});
					continue;
				}

				// Check start date (cannot trigger before startDate day)
				if (task.startDate) {
					const startDay = new Date(task.startDate);
					startDay.setHours(0, 0, 0, 0);
					const todayBeginning = new Date(now);
					todayBeginning.setHours(0, 0, 0, 0);
					if (todayBeginning < startDay) continue;
				}

				// Recurrence frequency checks
				const frequency = task.repeatFrequency || "DAILY";

				if (frequency === "WEEKLY") {
					const activeDays = (task.repeatDaysOfWeek || "0,1,2,3,4,5,6")
						.split(",")
						.map((s) => s.trim());
					if (!activeDays.includes(currentDayOfWeek)) continue;
				} else if (frequency === "DAILY") {
					// If days of week specified for daily, honor it
					if (task.repeatDaysOfWeek) {
						const activeDays = task.repeatDaysOfWeek
							.split(",")
							.map((s) => s.trim());
						if (!activeDays.includes(currentDayOfWeek)) continue;
					}
				} else if (frequency === "MONTHLY") {
					const targetDay =
						task.repeatDayOfMonth ||
						(task.startDate ? new Date(task.startDate).getDate() : 1);
					if (currentDayOfMonth !== targetDay) continue;
				} else if (frequency === "YEARLY") {
					const targetMonth =
						task.repeatMonthOfYear ||
						(task.startDate ? new Date(task.startDate).getMonth() + 1 : 1);
					const targetDay =
						task.repeatDayOfMonth ||
						(task.startDate ? new Date(task.startDate).getDate() : 1);
					if (currentMonth !== targetMonth || currentDayOfMonth !== targetDay)
						continue;
				}

				// Extract target trigger times (supports single "21:00" or comma-separated "09:00,21:00")
				let targetTimesList: string[] = [];
				if (task.repeatTime) {
					targetTimesList = task.repeatTime
						.split(",")
						.map((t) => t.trim())
						.filter(Boolean);
				} else if (task.dueDate) {
					const d = new Date(task.dueDate);
					const hh = String(d.getHours()).padStart(2, "0");
					const mm = String(d.getMinutes()).padStart(2, "0");
					targetTimesList = [`${hh}:${mm}`];
				} else {
					targetTimesList = ["09:00"];
				}

				for (const timeStr of targetTimesList) {
					const [hoursStr, minutesStr] = timeStr.split(":");
					const targetHours = parseInt(hoursStr, 10);
					const targetMinutes = parseInt(minutesStr, 10);
					if (Number.isNaN(targetHours) || Number.isNaN(targetMinutes))
						continue;

					const recurrenceCacheKey = `${task.id}:${todayStr}:${timeStr}`;
					if (sentRecurringTaskRemindersToday.has(recurrenceCacheKey)) continue;

					const targetDate = new Date(now);
					targetDate.setHours(targetHours, targetMinutes, 0, 0);

					const diffMs = targetDate.getTime() - now.getTime();
					const leadMs = task.remindBeforeMinutes * 60 * 1000;

					if (diffMs <= leadMs && diffMs >= -5 * 60 * 1000) {
						const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));
						const itemType =
							task.type.toLowerCase() === "event" ? "event" : "task";

						const notificationMessage =
							minutesLeft > 0
								? `${task.type}: "${task.title}" is scheduled in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}!`
								: task.description
									? `${task.title}: ${task.description}`
									: `Reminder for ${task.type.toLowerCase()}: "${task.title}"!`;

						sendAlarmNotification(task.userId, {
							id: `${task.id}-${todayStr}-${timeStr}`,
							title: task.title,
							message: notificationMessage,
							type: itemType,
							leadMinutes: task.remindBeforeMinutes,
						});

						sentRecurringTaskRemindersToday.add(recurrenceCacheKey);

						const nextCount = (task.completedOccurrences || 0) + 1;
						const willComplete = task.repeatCount
							? nextCount >= task.repeatCount
							: false;

						await prisma.task.update({
							where: { id: task.id },
							data: {
								lastTriggeredDate: recurrenceCacheKey,
								completedOccurrences: nextCount,
								...(willComplete ? { status: "COMPLETED" } : {}),
							},
						});
					}
				}
			}

			// 3. Process Routine Reminders
			const activeRoutines = await prisma.routine.findMany({
				where: {
					reminderMinutes: { gt: 0 },
					targetTime: { not: null },
				},
			});

			for (const routine of activeRoutines) {
				if (!routine.targetTime) continue;

				const activeDays = routine.daysOfWeek.split(",").map((s) => s.trim());
				if (!activeDays.includes(currentDayOfWeek)) continue;

				// Skip if already completed today
				if (routine.lastCompletedDate === todayStr) continue;

				const routineCacheKey = `${routine.id}:${todayStr}`;
				if (sentRoutineRemindersToday.has(routineCacheKey)) continue;

				const [hoursStr, minutesStr] = routine.targetTime.split(":");
				const targetHours = parseInt(hoursStr, 10);
				const targetMinutes = parseInt(minutesStr, 10);

				if (Number.isNaN(targetHours) || Number.isNaN(targetMinutes)) continue;

				const routineTargetDate = new Date(now);
				routineTargetDate.setHours(targetHours, targetMinutes, 0, 0);

				const diffMs = routineTargetDate.getTime() - now.getTime();
				const leadMs = routine.reminderMinutes * 60 * 1000;

				if (diffMs <= leadMs && diffMs >= -5 * 60 * 1000) {
					const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));

					sendAlarmNotification(routine.userId, {
						id: routine.id,
						title: routine.title,
						message:
							minutesLeft > 0
								? `Routine: "${routine.title}" begins in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}!`
								: `Time for routine: "${routine.title}"!`,
						type: "routine",
						leadMinutes: routine.reminderMinutes,
					});

					sentRoutineRemindersToday.add(routineCacheKey);
				}
			}
		} catch {
			// Scheduler error suppressed to keep process resilient
		}
	});
};
