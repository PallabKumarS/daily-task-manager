import { z } from "zod";

export const createRoutineValidationSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	timeSlot: z.string().min(1).default("morning"),
	targetTime: z.string().optional().nullable(),
	daysOfWeek: z.string().default("0,1,2,3,4,5,6"),
	reminderMinutes: z.number().int().min(0).default(0),
});

export const updateRoutineValidationSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	timeSlot: z.string().min(1).optional(),
	targetTime: z.string().nullable().optional(),
	daysOfWeek: z.string().optional(),
	reminderMinutes: z.number().int().min(0).optional(),
});
