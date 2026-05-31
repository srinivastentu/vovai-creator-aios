import { describe, it, expect, vi } from 'vitest'
import {
  calculateWeightedScore,
  checkThresholds,
  createJudgeFunction,
} from '../../../src/lib/core/agentic/grader'
import type {
  DimensionScore,
  GradeReport,
  RubricDefinition,
} from '../../../src/lib/core/engine/types'

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeDimensionScores(
  entries: { id: string, score: number, weight: number }[]
): DimensionScore[] {
  return entries.map(e => ({
    dimensionId: e.id,
    name: e.id,
    score: e.score,
    weight: e.weight,
    feedback: '',
  }))
}

function makeRubric(overrides?: Partial<RubricDefinition>): RubricDefinition {
  return {
    id: 'test-rubric',
    name: 'Test Rubric',
    passThreshold: 70,
    dimensions: [
      {
        id: 'dim-a',
        name: 'Dimension A',
        weight: 0.3,
        passThreshold: 60,
        description: 'First dimension',
        criteria: { excellent: '90+', good: '70-89', adequate: '50-69', poor: '<50' },
      },
      {
        id: 'dim-b',
        name: 'Dimension B',
        weight: 0.3,
        passThreshold: 60,
        description: 'Second dimension',
        criteria: { excellent: '90+', good: '70-89', adequate: '50-69', poor: '<50' },
      },
      {
        id: 'dim-c',
        name: 'Dimension C',
        weight: 0.4,
        passThreshold: 60,
        description: 'Third dimension',
        criteria: { excellent: '90+', good: '70-89', adequate: '50-69', poor: '<50' },
      },
    ],
    ...overrides,
  }
}

// ─── calculateWeightedScore ───────────────────────────────────────────────

describe('calculateWeightedScore', () => {
  it('calculates weighted sum for 3 dimensions', () => {
    const scores = makeDimensionScores([
      { id: 'a', score: 80, weight: 0.3 },
      { id: 'b', score: 60, weight: 0.3 },
      { id: 'c', score: 90, weight: 0.4 },
    ])
    // 80*0.3 + 60*0.3 + 90*0.4 = 24 + 18 + 36 = 78
    expect(calculateWeightedScore(scores)).toBeCloseTo(78, 2)
  })

  it('returns 100 for a single dimension with score 100 and weight 1.0', () => {
    const scores = makeDimensionScores([{ id: 'only', score: 100, weight: 1.0 }])
    expect(calculateWeightedScore(scores)).toBe(100)
  })

  it('returns 0 when all scores are 0', () => {
    const scores = makeDimensionScores([
      { id: 'a', score: 0, weight: 0.5 },
      { id: 'b', score: 0, weight: 0.5 },
    ])
    expect(calculateWeightedScore(scores)).toBe(0)
  })

  it('returns 0 for an empty array', () => {
    expect(calculateWeightedScore([])).toBe(0)
  })
})

// ─── checkThresholds ──────────────────────────────────────────────────────

describe('checkThresholds', () => {
  const rubric = makeRubric()

  it('passes when overall >= rubric threshold and no dim below its threshold', () => {
    const grade: GradeReport = {
      overallScore: 80,
      passesThreshold: true,
      dimensionScores: makeDimensionScores([
        { id: 'dim-a', score: 80, weight: 0.3 },
        { id: 'dim-b', score: 70, weight: 0.3 },
        { id: 'dim-c', score: 85, weight: 0.4 },
      ]),
      recommendation: '',
      improvementPriorities: [],
    }
    const result = checkThresholds(grade, rubric)
    expect(result.passes).toBe(true)
    expect(result.failingDimensions).toEqual([])
  })

  it('fails when one dimension is below its individual threshold', () => {
    const grade: GradeReport = {
      overallScore: 75,
      passesThreshold: true,
      dimensionScores: makeDimensionScores([
        { id: 'dim-a', score: 80, weight: 0.3 },
        { id: 'dim-b', score: 50, weight: 0.3 }, // below dim-b passThreshold of 60
        { id: 'dim-c', score: 90, weight: 0.4 },
      ]),
      recommendation: '',
      improvementPriorities: [],
    }
    const result = checkThresholds(grade, rubric)
    expect(result.passes).toBe(false)
    expect(result.failingDimensions).toEqual(['dim-b'])
  })

  it('fails when overall score is below rubric passThreshold', () => {
    const grade: GradeReport = {
      overallScore: 50,
      passesThreshold: false,
      dimensionScores: makeDimensionScores([
        { id: 'dim-a', score: 50, weight: 0.3 },
        { id: 'dim-b', score: 50, weight: 0.3 },
        { id: 'dim-c', score: 50, weight: 0.4 },
      ]),
      recommendation: '',
      improvementPriorities: [],
    }
    const result = checkThresholds(grade, rubric)
    expect(result.passes).toBe(false)
  })

  it('lists all failing dimensions when multiple fail', () => {
    const grade: GradeReport = {
      overallScore: 45,
      passesThreshold: false,
      dimensionScores: makeDimensionScores([
        { id: 'dim-a', score: 40, weight: 0.3 },
        { id: 'dim-b', score: 40, weight: 0.3 },
        { id: 'dim-c', score: 50, weight: 0.4 },
      ]),
      recommendation: '',
      improvementPriorities: [],
    }
    const result = checkThresholds(grade, rubric)
    expect(result.passes).toBe(false)
    expect(result.failingDimensions).toContain('dim-a')
    expect(result.failingDimensions).toContain('dim-b')
    expect(result.failingDimensions).toContain('dim-c')
  })
})

// ─── createJudgeFunction ──────────────────────────────────────────────────

describe('createJudgeFunction', () => {
  const rubric = makeRubric()

  const validJudgeResponse = JSON.stringify({
    dimensionScores: [
      { dimensionId: 'dim-a', score: 80, feedback: 'Good coverage' },
      { dimensionId: 'dim-b', score: 60, feedback: 'Needs work' },
      { dimensionId: 'dim-c', score: 90, feedback: 'Excellent' },
    ],
    recommendation: 'Solid work with room for improvement',
    improvementPriorities: ['Improve dim-b'],
  })

  it('returns a GradeReport with correct overallScore', async () => {
    const mockCall = vi.fn().mockResolvedValue(validJudgeResponse)
    const judge = createJudgeFunction(mockCall)

    const report = await judge({ some: 'artifact' }, rubric)

    // 80*0.3 + 60*0.3 + 90*0.4 = 78
    expect(report.overallScore).toBeCloseTo(78, 2)
  })

  it('sets passesThreshold correctly based on rubric', async () => {
    const mockCall = vi.fn().mockResolvedValue(validJudgeResponse)
    const judge = createJudgeFunction(mockCall)

    const report = await judge({ some: 'artifact' }, rubric)

    // overallScore 78 >= 70 threshold, dim-b score 60 >= 60 threshold → passes
    expect(report.passesThreshold).toBe(true)
  })

  it('populates dimensionScores with weights from rubric', async () => {
    const mockCall = vi.fn().mockResolvedValue(validJudgeResponse)
    const judge = createJudgeFunction(mockCall)

    const report = await judge({ some: 'artifact' }, rubric)

    expect(report.dimensionScores).toHaveLength(3)
    expect(report.dimensionScores[0]).toMatchObject({
      dimensionId: 'dim-a',
      score: 80,
      weight: 0.3,
      feedback: 'Good coverage',
    })
  })

  it('propagates recommendation and improvementPriorities', async () => {
    const mockCall = vi.fn().mockResolvedValue(validJudgeResponse)
    const judge = createJudgeFunction(mockCall)

    const report = await judge({ some: 'artifact' }, rubric)

    expect(report.recommendation).toBe('Solid work with room for improvement')
    expect(report.improvementPriorities).toEqual(['Improve dim-b'])
  })

  it('returns failing grade with score 0 on invalid JSON (does not throw)', async () => {
    const brokenCall = vi.fn().mockResolvedValue('not valid json {')
    const judge = createJudgeFunction(brokenCall)

    const report = await judge({ some: 'artifact' }, rubric)

    expect(report.overallScore).toBe(0)
    expect(report.passesThreshold).toBe(false)
    expect(report.dimensionScores).toHaveLength(3)
    for (const ds of report.dimensionScores) {
      expect(ds.score).toBe(0)
      expect(ds.feedback).toContain('Failed to parse judge response')
    }
    expect(report.recommendation).toContain('Failed to parse judge response')
  })

  it('builds a prompt containing rubric dimension names', async () => {
    const mockCall = vi.fn().mockResolvedValue(validJudgeResponse)
    const judge = createJudgeFunction(mockCall)

    await judge({ some: 'artifact' }, rubric)

    const prompt = mockCall.mock.calls[0][0]
    expect(prompt).toContain('Dimension A')
    expect(prompt).toContain('Dimension B')
    expect(prompt).toContain('Dimension C')
    // Must NOT contain domain words
    expect(prompt).not.toContain('eLearning')
    expect(prompt).not.toContain('course')
    expect(prompt).not.toContain('elearn')
  })
})

// CR-0: backward-compat tests removed — they only asserted re-exports from the
// now-purged eLearn domain modules (rubric-grader, structure-rubric).
