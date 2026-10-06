import { z } from "zod";

export const registerValidationSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Invalid email address"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	currency: z.string().optional(),
});

export const loginValidationSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

export const updateProfileValidationSchema = z.object({
	name: z.string().min(2).optional(),
	currency: z.string().min(1).max(5).optional(),
});
