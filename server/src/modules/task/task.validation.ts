import { z } from "zod";

export const createTaskValidationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  type: z.enum(["TASK", "EVENT"]).default("TASK"),
  category: z.string().default("General"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("PENDING"),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  remindBeforeMinutes: z.number().int().min(0).default(15),
});

export const updateTaskValidationSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(["TASK", "EVENT"]).optional(),
  category: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  remindBeforeMinutes: z.number().int().min(0).optional(),
});
