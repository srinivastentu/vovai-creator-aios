import { describe, expect, it } from 'vitest'
import { imageRubric } from '../image-rubric'

describe('imageRubric', () => {
  it('has exactly 5 dimensions', () => {
    expect(imageRubric.dimensions).toHaveLength(5)
  })

  it('has the expected dimension ids', () => {
    const ids = imageRubric.dimensions.map((d) => d.id).sort()
    expect(ids).toEqual(
      [
        'completeness',
        'prompt-alignment',
        'style-quality',
        'technical-quality',
        'visual-clarity',
      ].sort(),
    )
  })

  it('weights sum to exactly 1.0', () => {
    const sum = imageRubric.dimensions.reduce((t, d) => t + d.weight, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('every dimension has all 4 criteria bands with non-empty text', () => {
    const bands = ['1-3', '4-6', '7-8', '9-10']
    for (const d of imageRubric.dimensions) {
      for (const b of bands) {
        expect(d.criteria[b]).toBeDefined()
        expect(d.criteria[b].length).toBeGreaterThan(20)
      }
    }
  })

  it('completeness weight ≥ 0.10', () => {
    const c = imageRubric.dimensions.find((d) => d.id === 'completeness')
    expect(c).toBeDefined()
    expect(c!.weight).toBeGreaterThanOrEqual(0.1)
  })

  it('prompt-alignment is the highest-weighted dimension', () => {
    const max = imageRubric.dimensions.reduce(
      (best, d) => (d.weight > best.weight ? d : best),
      imageRubric.dimensions[0],
    )
    expect(max.id).toBe('prompt-alignment')
  })
})
