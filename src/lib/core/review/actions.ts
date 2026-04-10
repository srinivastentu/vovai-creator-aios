// Action validation — what actions are allowed when
// Imports from core/engine/types only. Zero domain imports.

import type { LoopState, ReviewAction } from '../engine/types'
import type { ReviewGate, ReviewResult, ReviewValidationError } from './types'

// ---------------------------------------------------------------------------
// validateReviewAction — checks if an action is valid given state and gate
// ---------------------------------------------------------------------------

export function validateReviewAction(
  action: ReviewAction,
  state: LoopState<unknown>,
  gate: ReviewGate
): { valid: boolean, errors: ReviewValidationError[] } {
  const errors: ReviewValidationError[] = []

  // Must be in awaiting_review state
  if (state.status !== 'awaiting_review') {
    errors.push({
      code: 'INVALID_STATE',
      message: `Cannot review in '${state.status}' state — must be 'awaiting_review'`,
      action: action.type,
      currentStatus: state.status,
    })
  }

  // Action must be in gate's allowed list
  if (!gate.allowedActions.includes(action.type)) {
    errors.push({
      code: 'ACTION_NOT_ALLOWED',
      message: `Action '${action.type}' is not allowed at this gate`,
      action: action.type,
      currentStatus: state.status,
    })
  }

  // use_segments and mix_produce require multiple versions
  if (
    (action.type === 'use_segments' || action.type === 'mix_produce') &&
    state.iterations.length <= 1
  ) {
    errors.push({
      code: 'INSUFFICIENT_VERSIONS',
      message: `Action '${action.type}' requires multiple artifact versions (found ${state.iterations.length})`,
      action: action.type,
      currentStatus: state.status,
    })
  }

  // Feedback without message is a warning (still valid)
  if (action.type === 'feedback' && !action.message) {
    errors.push({
      code: 'EMPTY_FEEDBACK',
      message: 'Feedback action has no message — consider providing guidance',
      action: action.type,
      currentStatus: state.status,
    })
  }

  // Empty feedback is a warning, not a hard block
  const hardErrors = errors.filter(e => e.code !== 'EMPTY_FEEDBACK')

  return {
    valid: hardErrors.length === 0,
    errors,
  }
}

// ---------------------------------------------------------------------------
// getAvailableActions — which actions are available right now
// ---------------------------------------------------------------------------

export function getAvailableActions(
  gate: ReviewGate,
  state: LoopState<unknown>
): ReviewAction['type'][] {
  if (state.status !== 'awaiting_review') {
    return []
  }

  return gate.allowedActions.filter(actionType => {
    // use_segments and mix_produce need multiple versions
    if (
      (actionType === 'use_segments' || actionType === 'mix_produce') &&
      state.iterations.length <= 1
    ) {
      return false
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// createReviewResult — immutable record of a review decision
// ---------------------------------------------------------------------------

export function createReviewResult(
  action: ReviewAction,
  reviewerId: string,
  stageId: string,
  previousState: LoopState<unknown>,
  newState: LoopState<unknown>
): ReviewResult {
  return {
    action,
    reviewerId,
    stageId,
    timestamp: new Date(),
    previousStatus: previousState.status,
    newStatus: newState.status,
  }
}

// ---------------------------------------------------------------------------
// getDefaultGateConfig — default allowed actions per phase category
// ---------------------------------------------------------------------------

export function getDefaultGateConfig(
  phase: 'ideation' | 'production'
): { allowedActions: ReviewAction['type'][] } {
  if (phase === 'ideation') {
    return {
      allowedActions: ['approve', 'reject', 'feedback'],
    }
  }

  return {
    allowedActions: ['approve', 'reject', 'feedback', 'use_segments', 'mix_produce'],
  }
}
