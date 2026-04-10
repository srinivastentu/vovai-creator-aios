import { describe, it, expect } from 'vitest'
import {
  createGate,
  isGateReady,
  enforceHumanSovereignty,
  validateReviewAction,
  getAvailableActions,
  createReviewResult,
  getDefaultGateConfig,
} from '../../../src/lib/core/review'
import type { LoopState, ReviewAction } from '../../../src/lib/core/engine/types'
import type { ReviewGate } from '../../../src/lib/core/review'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(
  overrides?: Partial<LoopState<unknown>>
): LoopState<unknown> {
  return {
    stageId: 'test-stage',
    status: 'awaiting_review',
    currentArtifact: { title: 'Test' },
    bestArtifact: { title: 'Test' },
    bestGrade: null,
    iterations: [
      {
        artifactId: 'a1',
        version: 1,
        grade: null,
        modelUsed: 'test',
        tokensIn: 0,
        tokensOut: 0,
        costUSD: 0,
        createdAt: new Date(),
      },
    ],
    loopCount: 1,
    humanFeedback: [],
    costUSD: 0,
    ...overrides,
  }
}

function makeMultiVersionState(): LoopState<unknown> {
  return makeState({
    iterations: [
      {
        artifactId: 'a1',
        version: 1,
        grade: null,
        modelUsed: 'test',
        tokensIn: 0,
        tokensOut: 0,
        costUSD: 0,
        createdAt: new Date(),
      },
      {
        artifactId: 'a2',
        version: 2,
        grade: null,
        modelUsed: 'test',
        tokensIn: 0,
        tokensOut: 0,
        costUSD: 0,
        createdAt: new Date(),
      },
    ],
    loopCount: 2,
  })
}

function makeGate(overrides?: Partial<ReviewGate>): ReviewGate {
  return createGate({
    stageId: 'test-stage',
    artifactType: 'test-artifact',
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// createGate
// ---------------------------------------------------------------------------

describe('createGate', () => {
  it('a. creates gate with all fields populated', () => {
    const gate = createGate({
      stageId: 'brief',
      artifactType: 'document',
      allowedActions: ['approve', 'reject'],
      requiresRole: ['sme'],
      minReviewers: 2,
    })

    expect(gate.stageId).toBe('brief')
    expect(gate.artifactType).toBe('document')
    expect(gate.allowedActions).toEqual(['approve', 'reject'])
    expect(gate.requiresRole).toEqual(['sme'])
    expect(gate.minReviewers).toBe(2)
  })

  it('b. default allowedActions includes all 5 types', () => {
    const gate = createGate({ stageId: 's1', artifactType: 'doc' })
    expect(gate.allowedActions).toEqual([
      'approve', 'reject', 'feedback', 'use_segments', 'mix_produce',
    ])
  })

  it('c. default minReviewers is 1', () => {
    const gate = createGate({ stageId: 's1', artifactType: 'doc' })
    expect(gate.minReviewers).toBe(1)
  })

  it('d. custom allowedActions respected', () => {
    const gate = createGate({
      stageId: 's1',
      artifactType: 'doc',
      allowedActions: ['approve', 'feedback'],
    })
    expect(gate.allowedActions).toEqual(['approve', 'feedback'])
    expect(gate.allowedActions).not.toContain('reject')
  })
})

// ---------------------------------------------------------------------------
// isGateReady
// ---------------------------------------------------------------------------

describe('isGateReady', () => {
  it('e. returns true when status is presenting', () => {
    expect(isGateReady(makeState({ status: 'presenting' }))).toBe(true)
  })

  it('f. returns true when status is awaiting_review', () => {
    expect(isGateReady(makeState({ status: 'awaiting_review' }))).toBe(true)
  })

  it('g. returns false when status is idle', () => {
    expect(isGateReady(makeState({ status: 'idle' }))).toBe(false)
  })

  it('h. returns false when status is generating', () => {
    expect(isGateReady(makeState({ status: 'generating' }))).toBe(false)
  })

  it('i. returns false when status is evaluating', () => {
    expect(isGateReady(makeState({ status: 'evaluating' }))).toBe(false)
  })

  it('j. returns false when status is approved', () => {
    expect(isGateReady(makeState({ status: 'approved' }))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// enforceHumanSovereignty
// ---------------------------------------------------------------------------

describe('enforceHumanSovereignty', () => {
  it('k. does NOT throw when transition is awaiting_review → approved', () => {
    const prev = makeState({ status: 'awaiting_review' })
    const next = makeState({ status: 'approved' })
    expect(() => enforceHumanSovereignty(prev, next)).not.toThrow()
  })

  it('l. THROWS when transition is generating → approved', () => {
    const prev = makeState({ status: 'generating' })
    const next = makeState({ status: 'approved' })
    expect(() => enforceHumanSovereignty(prev, next)).toThrow(
      /Human sovereignty violation/
    )
  })

  it('m. THROWS when transition is evaluating → approved', () => {
    const prev = makeState({ status: 'evaluating' })
    const next = makeState({ status: 'approved' })
    expect(() => enforceHumanSovereignty(prev, next)).toThrow(
      /Human sovereignty violation/
    )
  })

  it('n. does NOT throw for non-approved transitions', () => {
    const prev = makeState({ status: 'generating' })
    const next = makeState({ status: 'evaluating' })
    expect(() => enforceHumanSovereignty(prev, next)).not.toThrow()
  })

  it('o. THROWS when transition is presenting → approved (must go through awaiting_review first)', () => {
    const prev = makeState({ status: 'presenting' })
    const next = makeState({ status: 'approved' })
    expect(() => enforceHumanSovereignty(prev, next)).toThrow(
      /Human sovereignty violation/
    )
  })
})

// ---------------------------------------------------------------------------
// validateReviewAction
// ---------------------------------------------------------------------------

describe('validateReviewAction', () => {
  it('p. valid: approve when awaiting_review', () => {
    const action: ReviewAction = { type: 'approve' }
    const state = makeState({ status: 'awaiting_review' })
    const gate = makeGate()

    const result = validateReviewAction(action, state, gate)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('q. invalid: approve when generating', () => {
    const action: ReviewAction = { type: 'approve' }
    const state = makeState({ status: 'generating' })
    const gate = makeGate()

    const result = validateReviewAction(action, state, gate)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'INVALID_STATE')).toBe(true)
  })

  it('r. invalid: use_segments when not in allowedActions', () => {
    const action: ReviewAction = { type: 'use_segments' }
    const state = makeMultiVersionState()
    const gate = makeGate({ allowedActions: ['approve', 'reject', 'feedback'] })

    const result = validateReviewAction(action, state, gate)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'ACTION_NOT_ALLOWED')).toBe(true)
  })

  it('s. invalid: use_segments when only 1 iteration', () => {
    const action: ReviewAction = { type: 'use_segments' }
    const state = makeState({ status: 'awaiting_review' }) // 1 iteration
    const gate = makeGate()

    const result = validateReviewAction(action, state, gate)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'INSUFFICIENT_VERSIONS')).toBe(true)
  })

  it('t. valid: feedback with message', () => {
    const action: ReviewAction = { type: 'feedback', message: 'Needs more detail' }
    const state = makeState({ status: 'awaiting_review' })
    const gate = makeGate()

    const result = validateReviewAction(action, state, gate)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('u. warning: feedback without message (valid but with warning)', () => {
    const action: ReviewAction = { type: 'feedback' }
    const state = makeState({ status: 'awaiting_review' })
    const gate = makeGate()

    const result = validateReviewAction(action, state, gate)
    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0].code).toBe('EMPTY_FEEDBACK')
  })
})

// ---------------------------------------------------------------------------
// getAvailableActions
// ---------------------------------------------------------------------------

describe('getAvailableActions', () => {
  it('v. returns empty array when not awaiting_review', () => {
    const gate = makeGate()
    const state = makeState({ status: 'generating' })
    expect(getAvailableActions(gate, state)).toEqual([])
  })

  it('w. returns allowedActions when awaiting_review', () => {
    const gate = makeGate({ allowedActions: ['approve', 'reject', 'feedback'] })
    const state = makeState({ status: 'awaiting_review' })
    expect(getAvailableActions(gate, state)).toEqual(['approve', 'reject', 'feedback'])
  })

  it('x. filters out use_segments when only 1 iteration', () => {
    const gate = makeGate() // all 5 actions
    const state = makeState({ status: 'awaiting_review' }) // 1 iteration

    const available = getAvailableActions(gate, state)
    expect(available).toContain('approve')
    expect(available).toContain('reject')
    expect(available).toContain('feedback')
    expect(available).not.toContain('use_segments')
    expect(available).not.toContain('mix_produce')
  })

  it('y. returns all 5 for production gate with multiple iterations', () => {
    const gate = makeGate() // all 5 actions
    const state = makeMultiVersionState()

    const available = getAvailableActions(gate, state)
    expect(available).toEqual([
      'approve', 'reject', 'feedback', 'use_segments', 'mix_produce',
    ])
  })
})

// ---------------------------------------------------------------------------
// createReviewResult
// ---------------------------------------------------------------------------

describe('createReviewResult', () => {
  it('z. creates complete ReviewResult with all fields', () => {
    const action: ReviewAction = { type: 'approve' }
    const prev = makeState({ status: 'awaiting_review' })
    const next = makeState({ status: 'approved' })

    const result = createReviewResult(action, 'reviewer-1', 'brief', prev, next)

    expect(result.action).toEqual(action)
    expect(result.reviewerId).toBe('reviewer-1')
    expect(result.stageId).toBe('brief')
    expect(result.previousStatus).toBe('awaiting_review')
    expect(result.newStatus).toBe('approved')
  })

  it('aa. timestamps are present and valid', () => {
    const before = new Date()
    const action: ReviewAction = { type: 'feedback', message: 'Fix it' }
    const prev = makeState({ status: 'awaiting_review' })
    const next = makeState({ status: 'generating' })

    const result = createReviewResult(action, 'reviewer-2', 'audience', prev, next)
    const after = new Date()

    expect(result.timestamp).toBeInstanceOf(Date)
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
  })
})

// ---------------------------------------------------------------------------
// getDefaultGateConfig
// ---------------------------------------------------------------------------

describe('getDefaultGateConfig', () => {
  it('bb. ideation returns 3 actions (approve, reject, feedback)', () => {
    const config = getDefaultGateConfig('ideation')
    expect(config.allowedActions).toEqual(['approve', 'reject', 'feedback'])
    expect(config.allowedActions.length).toBe(3)
  })

  it('cc. production returns 5 actions (all)', () => {
    const config = getDefaultGateConfig('production')
    expect(config.allowedActions).toEqual([
      'approve', 'reject', 'feedback', 'use_segments', 'mix_produce',
    ])
    expect(config.allowedActions.length).toBe(5)
  })
})
