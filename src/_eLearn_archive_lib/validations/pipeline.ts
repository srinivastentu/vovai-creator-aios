import { z } from 'zod/v4'

// ─── Run Stage ───────────────────────────────────────────────────────────────

export const runStageSchema = z.object({
  context: z.record(z.string(), z.unknown()).optional(),
})

export type RunStageInput = z.infer<typeof runStageSchema>

// ─── Review Stage ────────────────────────────────────────────────────────────

export const reviewStageSchema = z.object({
  action: z.enum(['approve', 'reject', 'feedback', 'use_segments', 'mix_produce']),
  message: z.string().max(5000, 'Message cannot exceed 5,000 characters').optional(),
  editedArtifact: z.unknown().optional(),
})

export type ReviewStageInput = z.infer<typeof reviewStageSchema>
