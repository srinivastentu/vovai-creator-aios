import { z } from 'zod/v4'

// ─── Ideation Start ──────────────────────────────────────────────────────────

export const startIdeationSchema = z.object({
  brief: z.string().min(10, 'Brief must be at least 10 characters').max(10000, 'Brief cannot exceed 10,000 characters'),
})

export type StartIdeationInput = z.infer<typeof startIdeationSchema>

// ─── Ideation Message ────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(5000, 'Message cannot exceed 5,000 characters'),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

// ─── Ideation Grade ──────────────────────────────────────────────────────────

export const triggerGradeSchema = z.object({
  /** Optional: force re-grade even if already graded this loop */
  force: z.boolean().optional(),
})

export type TriggerGradeInput = z.infer<typeof triggerGradeSchema>

// ─── Ideation Approve ────────────────────────────────────────────────────────

export const approveSchema = z.object({
  action: z.enum(['approve', 'feedback', 'restructure']),
  message: z.string().optional().default(''),
})

export type ApproveInput = z.infer<typeof approveSchema>
