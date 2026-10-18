import type { Response } from "express";
import { z } from "zod";
import { isValidHttpUrl } from "./utils/validateUrl";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be 8 to 72 characters")
    .max(72, "Password must be 8 to 72 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1, "Password is required").max(72, "Invalid email or password"),
});

export const createUrlSchema = z.object({
  originalUrl: z
    .string()
    .trim()
    .max(2048, "URL is too long (max 2048 characters)")
    .refine(isValidHttpUrl, "Please enter a valid public URL starting with http:// or https://"),
  alias: z.string().trim().max(60).optional(),
  expiresAt: z.string().max(40).optional(),
});

// Returns the clean data, or sends a 400 and returns null
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
  res: Response
): z.infer<T> | null {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message ?? "Invalid input" });
    return null;
  }
  return result.data;
}