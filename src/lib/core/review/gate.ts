// Gate enforcement — the sovereignty layer
// Imports from core/engine/types only. Zero domain imports.

import type { LoopState, ReviewAction } from '../engine/types'
import type { ReviewGate } from './types'

// ---------------------------------------------------------------------------
// All 5 review action types
// ---------------------------------------------------------------------------

const ALL_ACTIONS: ReviewAction['type'][] = [
  'approve',
  'reject',
  'feedback',
  'use_segments',
  'mix_produce',
]

// ---------------------------------------------------------------------------
// createGate — builds a gate configuration with sensible defaults
// ---------------------------------------------------------------------------

export function createGate(config: {
  stageId: string
  artifactType: string
  allowedActions?: ReviewAction['type'][]
  requiresRole?: string[]
  minReviewers?: number
}): ReviewGate {
  return {
    stageId: config.stageId,
    artifactType: config.artifactType,
    allowedActions: config.allowedActions ?? [...ALL_ACTIONS],
    requiresRole: config.requiresRole,
    minReviewers: config.minReviewers ?? 1,
  }
}

// ---------------------------------------------------------------------------
// isGateReady — true only when the loop is ready for human review
// ---------------------------------------------------------------------------

export function isGateReady(state: LoopState<unknown>): boolean {
  return state.status === 'presenting' || state.status === 'awaiting_review'
}

// ---------------------------------------------------------------------------
// enforceHumanSovereignty — throws if approval bypasses human review
// ---------------------------------------------------------------------------

export function enforceHumanSovereignty(
  previousState: LoopState<unknown>,
  newState: LoopState<unknown>
): void {
  if (
    newState.status === 'approved' &&
    previousState.status !== 'awaiting_review'
  ) {
    throw new Error(
      `Human sovereignty violation: cannot transition from '${previousState.status}' to 'approved' — ` +
      `approval must come through human review (awaiting_review → approved)`
    )
  }
}
