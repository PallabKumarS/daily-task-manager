import { z } from "zod";

export const createDebtLoanZodSchema = z.object({
	type: z.enum(["DEBT", "LOAN"], { required_error: "Type must be either DEBT or LOAN" }),
	personName: z.string({ required_error: "Person name is required" }).min(1),
	amount: z
		.number({ required_error: "Amount is required" })
		.positive("Amount must be greater than zero"),
	date: z.string().optional(),
	dueDate: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	paymentMethod: z.string().optional().default("Cash"),
});

export const updateDebtLoanZodSchema = z.object({
	personName: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	dueDate: z.string().nullable().optional(),
	date: z.string().optional(),
	status: z.enum(["ACTIVE", "SETTLED"]).optional(),
});

export const recordRepaymentZodSchema = z.object({
	amount: z
		.number({ required_error: "Repayment amount is required" })
		.positive("Amount must be greater than zero"),
	date: z.string().optional(),
	paymentMethod: z.string().optional().default("Cash"),
	notes: z.string().nullable().optional(),
});
