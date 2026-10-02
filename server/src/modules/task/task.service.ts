import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../utils/prisma.js";
import { broadcastSyncUpdate } from "../socket/socket.service.js";
import type { ICreateTask, IUpdateTask } from "./task.interface.js";

export const getTasksFromDB = async (
	userId: string,
	filters: {
		type?: string;
		status?: string;
		priority?: string;
		upcoming?: boolean;
	},
) => {
	const where: Record<string, unknown> = { userId };

	if (filters.type && ["TASK", "EVENT"].includes(filters.type.toUpperCase())) {
		where.type = filters.type.toUpperCase();
	}

	if (filters.status) {
		where.status = filters.status.toUpperCase();
	}

	if (filters.priority) {
		where.priority = filters.priority.toUpperCase();
	}

	if (filters.upcoming) {
		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);
		where.dueDate = { gte: startOfToday };
	}

	return prisma.task.findMany({
		where,
		orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
	});
};

export const createTaskInDB = async (userId: string, payload: ICreateTask) => {
	const task = await prisma.task.create({
		data: {
			userId,
			title: payload.title,
			description: payload.description || null,
			type: payload.type || "TASK",
			category: payload.category || "General",
			priority: payload.priority || "MEDIUM",
			status: payload.status || "PENDING",
			startDate: payload.startDate ? new Date(payload.startDate) : null,
			dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
			remindBeforeMinutes: payload.remindBeforeMinutes ?? 15,
			isRecurring: payload.isRecurring ?? false,
			repeatFrequency: payload.repeatFrequency || null,
			repeatInterval: payload.repeatInterval ?? 1,
			repeatDaysOfWeek: payload.repeatDaysOfWeek || null,
			repeatTime: payload.repeatTime || null,
			repeatDayOfMonth: payload.repeatDayOfMonth ?? null,
			repeatMonthOfYear: payload.repeatMonthOfYear ?? null,
			repeatEndType: payload.repeatEndType || null,
			repeatCount: payload.repeatCount ?? null,
			repeatUntil: payload.repeatUntil ? new Date(payload.repeatUntil) : null,
			lastCompletedDate: payload.lastCompletedDate || null,
		},
	});

	broadcastSyncUpdate(userId, "task", "create", task);
	return task;
};

export const updateTaskInDB = async (
	userId: string,
	id: string,
	payload: IUpdateTask,
) => {
	const existing = await prisma.task.findFirst({
		where: { id, userId },
	});

	if (!existing) {
		throw new AppError(404, "Task or Event not found.");
	}

	const updateData: Record<string, unknown> = { ...payload };

	if (payload.startDate !== undefined) {
		updateData.startDate = payload.startDate
			? new Date(payload.startDate)
			: null;
	}
	if (payload.dueDate !== undefined) {
		updateData.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
	}
	if (payload.repeatUntil !== undefined) {
		updateData.repeatUntil = payload.repeatUntil
			? new Date(payload.repeatUntil)
			: null;
	}
	if (payload.status === "COMPLETED" && existing.status !== "COMPLETED") {
		updateData.completedAt = new Date();
	} else if (payload.status && payload.status !== "COMPLETED") {
		updateData.completedAt = null;
	}

	const updated = await prisma.task.update({
		where: { id },
		data: updateData,
	});

	broadcastSyncUpdate(userId, "task", "update", updated);
	return updated;
};

export const deleteTaskFromDB = async (userId: string, id: string) => {
	const existing = await prisma.task.findFirst({
		where: { id, userId },
	});

	if (!existing) {
		throw new AppError(404, "Task or Event not found.");
	}

	await prisma.task.delete({ where: { id } });
	broadcastSyncUpdate(userId, "task", "delete", { id });
	return null;
};
