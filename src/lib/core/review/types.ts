// Human Review System Types — System 3
// Imports from core/engine/types only. Zero domain imports.

import type { LoopStatus, ReviewAction } from '../engine/types'

// ---------------------------------------------------------------------------
// Gate configuration
// ---------------------------------------------------------------------------

export interface ReviewGate {
  stageId: string
  artifactType: string
  allowedActions: ReviewAction['type'][]
  requiresRole?: string[]
  minReviewers?: number
}

// ---------------------------------------------------------------------------
// Review result — immutable record of a completed review
// ---------------------------------------------------------------------------

export interface ReviewResult {
  action: ReviewAction
  reviewerId: string
  stageId: string
  timestamp: Date
  previousStatus: LoopStatus
  newStatus: LoopStatus
}

// ---------------------------------------------------------------------------
// Validation error — when an action is invalid
// ---------------------------------------------------------------------------

export interface ReviewValidationError {
  code: string
  message: string
  action: ReviewAction['type']
  currentStatus: LoopStatus
}
