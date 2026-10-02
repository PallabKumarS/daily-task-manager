import { z } from "zod";

export const createCategoryValidationSchema = z.object({
  name: z.string().min(1, "Option name is required").max(50),
  group: z.string().min(1, "Option group is required"),
  color: z.string().optional(),
});

export const updateCategoryValidationSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().optional(),
});
