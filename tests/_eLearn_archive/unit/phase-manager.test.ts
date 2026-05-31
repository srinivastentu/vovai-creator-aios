import { describe, it, expect } from 'vitest'
import {
  PHASE_TRANSITIONS,
  canTransition,
  getNextPhase,
  createInitialState,
} from '../../src/lib/domain/workflows/ideation/phase-manager'
import type { IdeationPhase, GradeReport } from '../../src/lib/domain/workflows/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGradeReport(overallScore: number): GradeReport {
  return {
    overallScore,
    passesThreshold: overallScore >= 75,
    dimensionScores: [],
    strengths: [],
    weaknesses: [],
    recommendation: overallScore >= 85 ? 'approve' : overallScore >= 75 ? 'revise' : 'restructure',
    specificImprovements: [],
  }
}

// ─── PHASE_TRANSITIONS ───────────────────────────────────────────────────────

describe('PHASE_TRANSITIONS', () => {
  it('defines transitions for all 5 phases', () => {
    const phases: IdeationPhase[] = ['brainstorm', 'structure', 'refinement', 'review', 'approved']
    for (const phase of phases) {
      expect(PHASE_TRANSITIONS).toHaveProperty(phase)
    }
  })

  it('brainstorm can only go to structure', () => {
    expect(PHASE_TRANSITIONS.brainstorm).toEqual(['structure'])
  })

  it('structure can only go to refinement', () => {
    expect(PHASE_TRANSITIONS.structure).toEqual(['refinement'])
  })

  it('refinement can only go to review', () => {
    expect(PHASE_TRANSITIONS.refinement).toEqual(['review'])
  })

  it('review can go to approved or refinement', () => {
    expect(PHASE_TRANSITIONS.review).toEqual(['approved', 'refinement'])
  })

  it('approved is terminal — no transitions', () => {
    expect(PHASE_TRANSITIONS.approved).toEqual([])
  })
})

// ─── canTransition ───────────────────────────────────────────────────────────

describe('canTransition', () => {
  it('allows valid forward transitions', () => {
    expect(canTransition('brainstorm', 'structure')).toBe(true)
    expect(canTransition('structure', 'refinement')).toBe(true)
    expect(canTransition('refinement', 'review')).toBe(true)
    expect(canTransition('review', 'approved')).toBe(true)
  })

  it('allows review → refinement (human feedback)', () => {
    expect(canTransition('review', 'refinement')).toBe(true)
  })

  it('rejects backward transitions', () => {
    expect(canTransition('structure', 'brainstorm')).toBe(false)
    expect(canTransition('refinement', 'structure')).toBe(false)
    expect(canTransition('review', 'brainstorm')).toBe(false)
  })

  it('rejects skipping phases', () => {
    expect(canTransition('brainstorm', 'refinement')).toBe(false)
    expect(canTransition('brainstorm', 'review')).toBe(false)
    expect(canTransition('brainstorm', 'approved')).toBe(false)
    expect(canTransition('structure', 'review')).toBe(false)
  })

  it('rejects self-transitions except refinement staying is not a direct self-transition', () => {
    expect(canTransition('brainstorm', 'brainstorm')).toBe(false)
    expect(canTransition('structure', 'structure')).toBe(false)
    expect(canTransition('review', 'review')).toBe(false)
    expect(canTransition('approved', 'approved')).toBe(false)
  })

  it('rejects any transition from approved', () => {
    const phases: IdeationPhase[] = ['brainstorm', 'structure', 'refinement', 'review', 'approved']
    for (const phase of phases) {
      expect(canTransition('approved', phase)).toBe(false)
    }
  })
})

// ─── getNextPhase ────────────────────────────────────────────────────────────

describe('getNextPhase', () => {
  it('brainstorm always routes to structure', () => {
    expect(getNextPhase('brainstorm')).toBe('structure')
  })

  it('structure always routes to refinement', () => {
    expect(getNextPhase('structure')).toBe('refinement')
  })

  describe('refinement auto-routing', () => {
    it('routes to review when score >= 75', () => {
      expect(getNextPhase('refinement', makeGradeReport(75))).toBe('review')
      expect(getNextPhase('refinement', makeGradeReport(85))).toBe('review')
      expect(getNextPhase('refinement', makeGradeReport(100))).toBe('review')
    })

    it('stays in refinement when score < 75', () => {
      expect(getNextPhase('refinement', makeGradeReport(74))).toBe('refinement')
      expect(getNextPhase('refinement', makeGradeReport(50))).toBe('refinement')
      expect(getNextPhase('refinement', makeGradeReport(0))).toBe('refinement')
    })

    it('stays in refinement when no grade report provided', () => {
      expect(getNextPhase('refinement')).toBe('refinement')
    })

    it('routes correctly at the threshold boundary', () => {
      expect(getNextPhase('refinement', makeGradeReport(74.9))).toBe('refinement')
      expect(getNextPhase('refinement', makeGradeReport(75))).toBe('review')
    })
  })

  it('throws on review — requires human decision', () => {
    expect(() => getNextPhase('review')).toThrow('Cannot auto-route from review')
  })

  it('throws on approved — terminal state', () => {
    expect(() => getNextPhase('approved')).toThrow('Cannot advance from approved')
  })
})

// ─── createInitialState ──────────────────────────────────────────────────────

describe('createInitialState', () => {
  const state = createInitialState('bp-001', 'Build a 40-hour teacher training course')

  it('sets blueprintId and brief from arguments', () => {
    expect(state.blueprintId).toBe('bp-001')
    expect(state.brief).toBe('Build a 40-hour teacher training course')
  })

  it('starts in brainstorm phase', () => {
    expect(state.currentPhase).toBe('brainstorm')
  })

  it('starts at loop count 0 with max 5', () => {
    expect(state.loopCount).toBe(0)
    expect(state.maxLoops).toBe(5)
  })

  it('initializes all accumulated context as null', () => {
    expect(state.archetype).toBeNull()
    expect(state.audienceProfile).toBeNull()
    expect(state.proposedStructure).toBeNull()
    expect(state.outcomesMap).toBeNull()
    expect(state.componentPlan).toBeNull()
    expect(state.gradeReport).toBeNull()
    expect(state.challenges).toBeNull()
  })

  it('initializes history arrays as empty', () => {
    expect(state.conversationHistory).toEqual([])
    expect(state.humanFeedback).toEqual([])
    expect(state.versions).toEqual([])
  })
})
