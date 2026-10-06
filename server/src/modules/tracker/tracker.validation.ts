import { z } from "zod";

export const createTrackerZodSchema = z.object({
	name: z.string({ required_error: "Tracker name is required" }).min(1),
	category: z.string().optional().default("Meals & Food"),
	unitName: z.string().optional().default("meals"),
	defaultTarget: z.number().nonnegative().optional().default(2),
	unitPrice: z.number().nonnegative().nullable().optional(),
	currency: z.string().optional().default("USD"),
	description: z.string().nullable().optional(),
	color: z.string().optional().default("emerald"),
});

export const updateTrackerZodSchema = z.object({
	name: z.string().min(1).optional(),
	category: z.string().optional(),
	unitName: z.string().optional(),
	defaultTarget: z.number().nonnegative().optional(),
	unitPrice: z.number().nonnegative().nullable().optional(),
	currency: z.string().optional(),
	description: z.string().nullable().optional(),
	color: z.string().optional(),
	isArchived: z.boolean().optional(),
});

export const logDailyTrackerZodSchema = z.object({
	date: z
		.string({ required_error: "Date (YYYY-MM-DD) is required" })
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
	value: z.number().min(0, "Value cannot be negative"),
	status: z.enum(["LOGGED", "CANCELLED", "SKIPPED"]).optional().default("LOGGED"),
	notes: z.string().nullable().optional(),
	unitPrice: z.number().nonnegative().nullable().optional(),
});

export const settleTrackerZodSchema = z.object({
	startDate: z
		.string({ required_error: "Start date is required" })
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
	endDate: z
		.string({ required_error: "End date is required" })
		.regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
	paymentMethod: z.string().optional().default("Cash"),
	category: z.string().optional(),
	notes: z.string().nullable().optional(),
});
