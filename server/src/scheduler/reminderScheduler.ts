import cron from "node-cron";
import { prisma } from "../utils/prisma.js";
import { sendAlarmNotification } from "../modules/socket/socket.service.js";

const sentRoutineRemindersToday = new Set<string>();
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
      lastCleanedDate = todayStr;
    }

    try {
      // 1. Process Task and Event Reminders
      const pendingTasks = await prisma.task.findMany({
        where: {
          status: { not: "COMPLETED" },
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
          const itemType = task.type.toLowerCase() === "event" ? "event" : "task";
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

      // 2. Process Routine Reminders
      const activeRoutines = await prisma.routine.findMany({
        where: {
          reminderMinutes: { gt: 0 },
          targetTime: { not: null },
        },
      });

      const currentDayOfWeek = String(now.getDay());

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
