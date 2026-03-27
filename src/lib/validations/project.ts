import { z } from 'zod/v4'

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  topic: z.string().min(1, "Topic is required").max(2000),
  targetAudience: z.string().min(1, "Target audience is required").max(500),
  durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute").max(120, "Duration cannot exceed 120 minutes"),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
