import { describe, it, expect } from 'vitest'
import {
  STRUCTURE_RUBRIC,
  calculateOverallScore,
  getRecommendation,
} from '../../src/lib/domain/workflows/rubrics/structure-rubric'

describe('STRUCTURE_RUBRIC', () => {
  it('has exactly 7 dimensions', () => {
    expect(STRUCTURE_RUBRIC.dimensions).toHaveLength(7)
  })

  it('weights sum to exactly 1.0', () => {
    const sum = STRUCTURE_RUBRIC.dimensions.reduce((acc, d) => acc + d.weight, 0)
    expect(sum).toBeCloseTo(1.0, 10)
  })

  it('overall pass threshold is 75', () => {
    expect(STRUCTURE_RUBRIC.passThreshold).toBe(75)
  })
})

describe('calculateOverallScore', () => {
  const allDimensions = STRUCTURE_RUBRIC.dimensions.map(d => d.id)

  function makeScores(score: number) {
    return allDimensions.map(id => ({ dimensionId: id, score }))
  }

  it('calculates weighted average correctly with uniform scores', () => {
    const result = calculateOverallScore(makeScores(80))
    expect(result.overallScore).toBeCloseTo(80, 1)
  })

  it('passes when all dimensions are above their thresholds and overall >= 75', () => {
    const result = calculateOverallScore(makeScores(90))
    expect(result.passesThreshold).toBe(true)
    expect(result.failingDimensions).toEqual([])
  })

  it('fails when overall score is below 75 even if no individual dimension fails', () => {
    // All scores at 65 — some dimensions pass (feasibility threshold 60)
    // but overall will be 65 which is below 75
    const result = calculateOverallScore(makeScores(65))
    expect(result.overallScore).toBeCloseTo(65, 1)
    expect(result.passesThreshold).toBe(false)
  })

  it('flags a dimension below its passThreshold', () => {
    const scores = makeScores(90)
    // Set progression (passThreshold 75) to 50 — should fail
    const progressionIdx = scores.findIndex(s => s.dimensionId === 'progression')
    scores[progressionIdx] = { dimensionId: 'progression', score: 50 }

    const result = calculateOverallScore(scores)
    expect(result.failingDimensions).toContain('progression')
    // Overall is still high but passesThreshold should be false due to failing dimension
    expect(result.passesThreshold).toBe(false)
  })

  it('flags multiple failing dimensions', () => {
    const scores = makeScores(90)
    scores[scores.findIndex(s => s.dimensionId === 'coverage')] = { dimensionId: 'coverage', score: 50 }
    scores[scores.findIndex(s => s.dimensionId === 'engagement')] = { dimensionId: 'engagement', score: 40 }

    const result = calculateOverallScore(scores)
    expect(result.failingDimensions).toContain('coverage')
    expect(result.failingDimensions).toContain('engagement')
  })

  it('handles mixed scores with correct weighting', () => {
    const scores = [
      { dimensionId: 'coverage', score: 100 },     // 0.18 * 100 = 18
      { dimensionId: 'depth', score: 80 },          // 0.15 * 80  = 12
      { dimensionId: 'progression', score: 90 },    // 0.18 * 90  = 16.2
      { dimensionId: 'balance', score: 70 },         // 0.12 * 70  = 8.4
      { dimensionId: 'engagement', score: 85 },      // 0.15 * 85  = 12.75
      { dimensionId: 'feasibility', score: 75 },     // 0.10 * 75  = 7.5
      { dimensionId: 'coherence', score: 95 },       // 0.12 * 95  = 11.4
    ]
    // Expected: 18 + 12 + 16.2 + 8.4 + 12.75 + 7.5 + 11.4 = 86.25
    const result = calculateOverallScore(scores)
    expect(result.overallScore).toBeCloseTo(86.25, 1)
  })
})

describe('getRecommendation', () => {
  it('returns approve when score >= 85 and no failing dimensions', () => {
    expect(getRecommendation(90, [])).toBe('approve')
    expect(getRecommendation(85, [])).toBe('approve')
  })

  it('returns revise when score >= 75 and <= 1 failing dimension', () => {
    expect(getRecommendation(80, [])).toBe('revise')
    expect(getRecommendation(75, ['depth'])).toBe('revise')
  })

  it('does not approve when score >= 85 but has failing dimensions', () => {
    expect(getRecommendation(88, ['coverage'])).toBe('revise')
  })

  it('returns restructure when score >= 60 but too many failures for revise', () => {
    expect(getRecommendation(75, ['coverage', 'depth'])).toBe('restructure')
    expect(getRecommendation(60, ['coverage', 'depth', 'balance'])).toBe('restructure')
  })

  it('returns reject when score < 60', () => {
    expect(getRecommendation(59, [])).toBe('reject')
    expect(getRecommendation(40, ['coverage', 'depth'])).toBe('reject')
  })

  it('handles boundary values correctly', () => {
    expect(getRecommendation(85, [])).toBe('approve')
    expect(getRecommendation(84.99, [])).toBe('revise')
    expect(getRecommendation(75, [])).toBe('revise')
    expect(getRecommendation(74.99, ['depth'])).toBe('restructure')
    expect(getRecommendation(60, [])).toBe('restructure')
    expect(getRecommendation(59.99, [])).toBe('reject')
  })
})
