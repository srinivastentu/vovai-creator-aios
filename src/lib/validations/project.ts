import { z } from 'zod/v4'

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  topic: z.string().min(1, "Topic is required").max(2000),
  targetAudience: z.string().min(1, "Target audience is required").max(500),
  durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute").max(6000, "Duration cannot exceed 6000 minutes (100 hours)"),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const quickCreateSchema = z.object({
  intent: z.string().min(10, "Please describe your learning intent in at least 10 characters").max(10000),
})

export type QuickCreateInput = z.infer<typeof quickCreateSchema>
