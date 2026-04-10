import { describe, it, expect } from 'vitest'
import { BRIEF_RUBRIC } from '../../../src/lib/domain/workflows/rubrics/brief-rubric'
import { AUDIENCE_RUBRIC } from '../../../src/lib/domain/workflows/rubrics/audience-rubric'
import { COMPONENT_RUBRIC } from '../../../src/lib/domain/workflows/rubrics/component-rubric'
import { HANDOFF_RUBRIC } from '../../../src/lib/domain/workflows/rubrics/handoff-rubric'
import {
  STRUCTURE_RUBRIC,
  STRUCTURE_RUBRIC_DEFINITION,
  calculateOverallScore,
  getRecommendation,
} from '../../../src/lib/domain/workflows/rubrics/structure-rubric'
import { calculateWeightedScore, checkThresholds } from '../../../src/lib/core/agentic/grader'
import type { RubricDefinition, GradeReport, DimensionScore } from '../../../src/lib/core/engine/types'

// ─── Helpers ──────────────────────────────────────────────────────────────

function expectWeightsSum(rubric: RubricDefinition) {
  const sum = rubric.dimensions.reduce((acc, d) => acc + d.weight, 0)
  expect(sum).toBeCloseTo(1.0, 10)
}

function expectUniqueIds(rubric: RubricDefinition) {
  const ids = rubric.dimensions.map(d => d.id)
  expect(new Set(ids).size).toBe(ids.length)
}

function expectFourBands(rubric: RubricDefinition) {
  const bands = ['excellent', 'good', 'adequate', 'poor']
  for (const dim of rubric.dimensions) {
    for (const band of bands) {
      expect(dim.criteria[band]).toBeDefined()
      expect(dim.criteria[band].length).toBeGreaterThan(0)
    }
  }
}

function expectNonEmptyDescriptions(rubric: RubricDefinition) {
  for (const dim of rubric.dimensions) {
    expect(dim.description.length).toBeGreaterThan(0)
  }
}

// ─── Individual rubric tests ──────────────────────────────────────────────

describe('BRIEF_RUBRIC', () => {
  it('has exactly 5 dimensions', () => {
    expect(BRIEF_RUBRIC.dimensions).toHaveLength(5)
  })

  it('weights sum to 1.0', () => {
    expectWeightsSum(BRIEF_RUBRIC)
  })

  it('passThreshold is 75', () => {
    expect(BRIEF_RUBRIC.passThreshold).toBe(75)
  })

  it('all dimension IDs are unique', () => {
    expectUniqueIds(BRIEF_RUBRIC)
  })
})

describe('AUDIENCE_RUBRIC', () => {
  it('has exactly 5 dimensions', () => {
    expect(AUDIENCE_RUBRIC.dimensions).toHaveLength(5)
  })

  it('weights sum to 1.0', () => {
    expectWeightsSum(AUDIENCE_RUBRIC)
  })

  it('passThreshold is 75', () => {
    expect(AUDIENCE_RUBRIC.passThreshold).toBe(75)
  })
})

describe('COMPONENT_RUBRIC', () => {
  it('has exactly 5 dimensions', () => {
    expect(COMPONENT_RUBRIC.dimensions).toHaveLength(5)
  })

  it('weights sum to 1.0', () => {
    expectWeightsSum(COMPONENT_RUBRIC)
  })

  it('passThreshold is 75', () => {
    expect(COMPONENT_RUBRIC.passThreshold).toBe(75)
  })
})

describe('HANDOFF_RUBRIC', () => {
  it('has exactly 5 dimensions', () => {
    expect(HANDOFF_RUBRIC.dimensions).toHaveLength(5)
  })

  it('weights sum to 1.0', () => {
    expectWeightsSum(HANDOFF_RUBRIC)
  })

  it('passThreshold is 80 (higher than other stages)', () => {
    expect(HANDOFF_RUBRIC.passThreshold).toBe(80)
  })
})

describe('STRUCTURE_RUBRIC_DEFINITION', () => {
  it('has exactly 7 dimensions', () => {
    expect(STRUCTURE_RUBRIC_DEFINITION.dimensions).toHaveLength(7)
  })

  it('weights sum to 1.0', () => {
    expectWeightsSum(STRUCTURE_RUBRIC_DEFINITION)
  })

  it('passThreshold is 75', () => {
    expect(STRUCTURE_RUBRIC_DEFINITION.passThreshold).toBe(75)
  })

  it('dimension IDs match existing STRUCTURE_RUBRIC', () => {
    const existingIds = STRUCTURE_RUBRIC.dimensions.map(d => d.id)
    const newIds = STRUCTURE_RUBRIC_DEFINITION.dimensions.map(d => d.id)
    expect(newIds).toEqual(existingIds)
  })
})

// ─── Cross-rubric checks ─────────────────────────────────────────────────

describe('cross-rubric checks', () => {
  const allRubrics = [
    BRIEF_RUBRIC,
    AUDIENCE_RUBRIC,
    COMPONENT_RUBRIC,
    HANDOFF_RUBRIC,
    STRUCTURE_RUBRIC_DEFINITION,
  ]

  it('all 5 rubric IDs are unique', () => {
    const ids = allRubrics.map(r => r.id)
    expect(new Set(ids).size).toBe(5)
  })

  it('all rubrics have criteria with exactly 4 bands per dimension', () => {
    for (const rubric of allRubrics) {
      expectFourBands(rubric)
    }
  })

  it('every dimension has a non-empty description', () => {
    for (const rubric of allRubrics) {
      expectNonEmptyDescriptions(rubric)
    }
  })
})

// ─── Integration with core grader ─────────────────────────────────────────

describe('core grader integration', () => {
  it('calculateWeightedScore produces correct result with brief rubric dimensions', () => {
    const scores: DimensionScore[] = BRIEF_RUBRIC.dimensions.map(d => ({
      dimensionId: d.id,
      name: d.name,
      score: 80,
      weight: d.weight,
      feedback: 'Good work',
    }))

    const result = calculateWeightedScore(scores)
    // All scores 80, weights sum to 1.0 → weighted score = 80
    expect(result).toBeCloseTo(80, 1)
  })

  it('calculateWeightedScore handles mixed scores correctly', () => {
    const scores: DimensionScore[] = [
      { dimensionId: 'clarity', name: 'Clarity', score: 90, weight: 0.25, feedback: '' },
      { dimensionId: 'specificity', name: 'Specificity', score: 70, weight: 0.20, feedback: '' },
      { dimensionId: 'scope', name: 'Scope', score: 85, weight: 0.20, feedback: '' },
      { dimensionId: 'constraints', name: 'Constraints', score: 60, weight: 0.15, feedback: '' },
      { dimensionId: 'objectives', name: 'Objectives', score: 75, weight: 0.20, feedback: '' },
    ]
    // 90*0.25 + 70*0.20 + 85*0.20 + 60*0.15 + 75*0.20
    // = 22.5 + 14 + 17 + 9 + 15 = 77.5
    expect(calculateWeightedScore(scores)).toBeCloseTo(77.5, 1)
  })

  it('checkThresholds identifies failing dimensions', () => {
    const grade: GradeReport = {
      overallScore: 78,
      passesThreshold: false,
      dimensionScores: [
        { dimensionId: 'clarity', name: 'Clarity', score: 90, weight: 0.25, feedback: '' },
        { dimensionId: 'specificity', name: 'Specificity', score: 50, weight: 0.20, feedback: '' },
        { dimensionId: 'scope', name: 'Scope', score: 85, weight: 0.20, feedback: '' },
        { dimensionId: 'constraints', name: 'Constraints', score: 40, weight: 0.15, feedback: '' },
        { dimensionId: 'objectives', name: 'Objectives', score: 80, weight: 0.20, feedback: '' },
      ],
      recommendation: 'Revise',
      improvementPriorities: [],
    }

    const result = checkThresholds(grade, BRIEF_RUBRIC)
    expect(result.passes).toBe(false)
    expect(result.failingDimensions).toContain('specificity')
    expect(result.failingDimensions).toContain('constraints')
    expect(result.failingDimensions).not.toContain('clarity')
  })

  it('checkThresholds passes when all dimensions meet thresholds', () => {
    const grade: GradeReport = {
      overallScore: 85,
      passesThreshold: false,
      dimensionScores: BRIEF_RUBRIC.dimensions.map(d => ({
        dimensionId: d.id,
        name: d.name,
        score: 90,
        weight: d.weight,
        feedback: '',
      })),
      recommendation: 'Approve',
      improvementPriorities: [],
    }

    const result = checkThresholds(grade, BRIEF_RUBRIC)
    expect(result.passes).toBe(true)
    expect(result.failingDimensions).toEqual([])
  })
})

// ─── Backward compatibility ───────────────────────────────────────────────

describe('backward compatibility', () => {
  it('existing calculateOverallScore still works', () => {
    const scores = STRUCTURE_RUBRIC.dimensions.map(d => ({
      dimensionId: d.id,
      score: 80,
    }))
    const result = calculateOverallScore(scores)
    expect(result.overallScore).toBeCloseTo(80, 1)
    expect(result.passesThreshold).toBe(true)
  })

  it('existing getRecommendation still works', () => {
    expect(getRecommendation(90, [])).toBe('approve')
    expect(getRecommendation(80, [])).toBe('revise')
    expect(getRecommendation(60, ['a', 'b'])).toBe('restructure')
    expect(getRecommendation(50, [])).toBe('reject')
  })

  it('STRUCTURE_RUBRIC still exports with domain-specific fields', () => {
    expect(STRUCTURE_RUBRIC.domain).toBe('elearn')
    expect(STRUCTURE_RUBRIC.maxRefinementLoops).toBe(5)
  })
})
