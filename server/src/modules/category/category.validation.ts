import { z } from "zod";

export const createCategoryValidationSchema = z.object({
  name: z.string().min(1, "Category name is required").max(50),
  group: z.enum(["EXPENSE", "INCOME", "PAYMENT_METHOD", "TASK_CATEGORY"]),
  color: z.string().optional(),
});
