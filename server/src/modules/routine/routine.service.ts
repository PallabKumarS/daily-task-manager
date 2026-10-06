import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../utils/prisma.js";
import { broadcastSyncUpdate } from "../socket/socket.service.js";
import type { ICreateRoutine, IUpdateRoutine } from "./routine.interface.js";

const getTodayDateString = (): string => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const calculateNewStreak = (
	lastCompletedDate: string | null,
	today: string,
	currentStreak: number,
): number => {
	if (!lastCompletedDate) return 1;
	if (lastCompletedDate === today) return currentStreak;

	const last = new Date(lastCompletedDate);
	const current = new Date(today);
	const diffTime = current.getTime() - last.getTime();
	const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

	if (diffDays === 1) return currentStreak + 1;
	return 1;
};

export const getRoutinesFromDB = async (userId: string, date = getTodayDateString()) => {
	const routines = await prisma.routine.findMany({
		where: { userId },
		include: {
			logs: {
				where: { date },
				select: { id: true, date: true, completed: true, completedAt: true },
			},
		},
		orderBy: { createdAt: "asc" },
	});

	return routines.map((r) => ({
		...r,
		isCompletedToday: r.logs.length > 0 && r.logs[0].completed,
		todayLog: r.logs[0] || null,
	}));
};

export const createRoutineInDB = async (userId: string, payload: ICreateRoutine) => {
	const routine = await prisma.routine.create({
		data: {
			userId,
			title: payload.title,
			description: payload.description || null,
			timeSlot: payload.timeSlot || "morning",
			targetTime: payload.targetTime || null,
			daysOfWeek: payload.daysOfWeek || "0,1,2,3,4,5,6",
			reminderMinutes: payload.reminderMinutes || 0,
		},
	});

	const formatted = {
		...routine,
		isCompletedToday: false,
		todayLog: null,
	};

	broadcastSyncUpdate(userId, "routine", "create", formatted);
	return formatted;
};

export const updateRoutineInDB = async (userId: string, id: string, payload: IUpdateRoutine) => {
	const existing = await prisma.routine.findFirst({
		where: { id, userId },
	});

	if (!existing) {
		throw new AppError(404, "Routine not found.");
	}

	const updated = await prisma.routine.update({
		where: { id },
		data: payload,
	});

	broadcastSyncUpdate(userId, "routine", "update", updated);
	return updated;
};

export const deleteRoutineFromDB = async (userId: string, id: string) => {
	const existing = await prisma.routine.findFirst({
		where: { id, userId },
	});

	if (!existing) {
		throw new AppError(404, "Routine not found.");
	}

	await prisma.routine.delete({ where: { id } });
	broadcastSyncUpdate(userId, "routine", "delete", { id });
	return null;
};

export const toggleRoutineInDB = async (
	userId: string,
	id: string,
	date = getTodayDateString(),
) => {
	const routine = await prisma.routine.findFirst({
		where: { id, userId },
		include: { logs: { where: { date } } },
	});

	if (!routine) {
		throw new AppError(404, "Routine not found.");
	}

	const currentLog = routine.logs[0] || null;
	const isCurrentlyCompleted = currentLog?.completed ?? false;
	const willBeCompleted = !isCurrentlyCompleted;

	if (willBeCompleted) {
		const newStreak = calculateNewStreak(routine.lastCompletedDate, date, routine.streakCount);

		const [log, updatedRoutine] = await prisma.$transaction([
			prisma.routineLog.upsert({
				where: { routineId_date: { routineId: id, date } },
				create: { routineId: id, userId, date, completed: true },
				update: { completed: true, completedAt: new Date() },
			}),
			prisma.routine.update({
				where: { id },
				data: { streakCount: newStreak, lastCompletedDate: date },
			}),
		]);

		const result = { routine: updatedRoutine, log, isCompletedToday: true };
		broadcastSyncUpdate(userId, "routine", "update", result);
		return result;
	}

	const newStreak = Math.max(0, routine.streakCount - 1);
	const [log, updatedRoutine] = await prisma.$transaction([
		prisma.routineLog.upsert({
			where: { routineId_date: { routineId: id, date } },
			create: { routineId: id, userId, date, completed: false },
			update: { completed: false },
		}),
		prisma.routine.update({
			where: { id },
			data: { streakCount: newStreak },
		}),
	]);

	const result = { routine: updatedRoutine, log, isCompletedToday: false };
	broadcastSyncUpdate(userId, "routine", "update", result);
	return result;
};
