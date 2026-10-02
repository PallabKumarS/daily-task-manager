import { z } from "zod";

export const createTransactionValidationSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  paymentMethod: z.string().default("Cash"),
  date: z.string().optional(),
});

export const updateTransactionValidationSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]).optional(),
  amount: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  paymentMethod: z.string().optional(),
  date: z.string().optional(),
});
