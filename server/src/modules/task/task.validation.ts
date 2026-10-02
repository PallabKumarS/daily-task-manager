import { z } from "zod";

export const createTaskValidationSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional().nullable(),
	type: z.enum(["TASK", "EVENT"]).default("TASK"),
	category: z.string().default("General"),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
	status: z
		.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
		.default("PENDING"),
	startDate: z.string().optional().nullable(),
	dueDate: z.string().optional().nullable(),
	remindBeforeMinutes: z.number().int().min(0).default(15),
	isRecurring: z.boolean().default(false),
	repeatFrequency: z
		.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
		.optional()
		.nullable(),
	repeatInterval: z.number().int().min(1).default(1),
	repeatDaysOfWeek: z.string().optional().nullable(),
	repeatTime: z.string().optional().nullable(),
	repeatDayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
	repeatMonthOfYear: z.number().int().min(1).max(12).optional().nullable(),
	repeatEndType: z.enum(["NEVER", "COUNT", "UNTIL_DATE"]).optional().nullable(),
	repeatCount: z.number().int().min(1).optional().nullable(),
	repeatUntil: z.string().optional().nullable(),
	lastCompletedDate: z.string().optional().nullable(),
});

export const updateTaskValidationSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	type: z.enum(["TASK", "EVENT"]).optional(),
	category: z.string().optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
	status: z
		.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
		.optional(),
	startDate: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional(),
	remindBeforeMinutes: z.number().int().min(0).optional(),
	isRecurring: z.boolean().optional(),
	repeatFrequency: z
		.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
		.nullable()
		.optional(),
	repeatInterval: z.number().int().min(1).optional(),
	repeatDaysOfWeek: z.string().nullable().optional(),
	repeatTime: z.string().nullable().optional(),
	repeatDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
	repeatMonthOfYear: z.number().int().min(1).max(12).nullable().optional(),
	repeatEndType: z.enum(["NEVER", "COUNT", "UNTIL_DATE"]).nullable().optional(),
	repeatCount: z.number().int().min(1).nullable().optional(),
	repeatUntil: z.string().nullable().optional(),
	completedOccurrences: z.number().int().min(0).optional(),
	lastTriggeredDate: z.string().nullable().optional(),
	lastCompletedDate: z.string().nullable().optional(),
});
