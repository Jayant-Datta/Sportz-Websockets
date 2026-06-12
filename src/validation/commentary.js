import { z } from "zod";

// 1. Schema for querying the commentary list
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .optional(),
});

// 2. Schema for creating a new commentary event
export const createCommentarySchema = z.object({
  minutes: z.number().int().nonnegative(),
  sequence: z.number().int().optional(), // Typically an integer to order events within the same minute
  period: z.string().optional(),
  eventType: z.string().optional(),
  actor: z.string().optional(),
  team: z.string().optional(),
  message: z.string().min(1, "Message cannot be empty"), // Explicitly required string
  metadata: z.record(z.string(), z.any()).optional(), // Record allowing key-value pairs
  tags: z.array(z.string()).optional(),
});