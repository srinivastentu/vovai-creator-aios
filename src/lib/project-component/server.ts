/**
 * Project Component Layer — Server-Only Exports
 *
 * These modules import from @/lib/db (Prisma/pg) and MUST NOT be imported
 * in client components. Use '@/lib/project-component/server' in API routes
 * and server components only.
 *
 * Client-safe exports (types, registries, tree-utils, rubric, cost estimator,
 * phase-manager) live in '@/lib/project-component'.
 */

// ─── Production Handoff ────────────────────────────────────────────────────

export type {
  HandoffResult,
  VideoBatch,
  HandoffErrorCode,
} from './production/handoff'

export { executeHandoff, HandoffError } from './production/handoff'

// ─── Ideation Loop Engine ──────────────────────────────────────────────────

export type {
  IdeationStepResult,
  HumanFeedback,
} from './ideation/loop-engine'

// ─── Conversation Manager ──────────────────────────────────────────────────

export type {
  CreateConversationInput,
  AddMessageInput,
} from './ideation/conversation-manager'
