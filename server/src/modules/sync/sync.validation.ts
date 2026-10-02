import { z } from "zod";

export const connectGoogleValidationSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});

export const restoreValidationSchema = z.object({
  fileId: z.string().optional(),
});
