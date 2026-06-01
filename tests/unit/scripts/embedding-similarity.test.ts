// Unit tests for the pure embedding-similarity math (CR-12; discharges the
// CR-7 "[due before CR-12] Unit-test cosineSimilarity + consecutiveSimilarities"
// follow-up). The math is load-bearing for the acceptance cosine ≤ 0.92 check.
// No network: cosineSimilarity is pure; consecutiveSimilarities is exercised
// through its injectable `embed` seam with fixed vectors.
import { describe, it, expect } from 'vitest'
import {
  cosineSimilarity,
  consecutiveSimilarities,
  EMBEDDING_MODEL,
} from '../../../scripts/lib/embedding-similarity'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10)
  })

  it('returns 1 for parallel (positively scaled) vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10)
  })

  it('returns -1 for opposed vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10)
  })

  it('computes a known-pair value', () => {
    // a·b = 1*3 + 2*4 = 11; |a| = √5, |b| = 5; cos = 11 / (√5 · 5) ≈ 0.98387
    expect(cosineSimilarity([1, 2], [3, 4])).toBeCloseTo(0.9838699, 6)
  })

  it('returns 0 when either vector is the zero vector (guard)', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0)
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0)
  })
})

describe('consecutiveSimilarities', () => {
  it('returns [] for fewer than 2 texts', async () => {
    expect(await consecutiveSimilarities([])).toEqual([])
    expect(await consecutiveSimilarities(['only one'])).toEqual([])
  })

  it('pairs each consecutive embedding (via the injected embedder)', async () => {
    // 4 texts → 3 consecutive pairs. Fixed vectors: identical, orthogonal, opposed.
    const vectors = [
      [1, 0],
      [1, 0], // identical to prev → 1
      [0, 1], // orthogonal to prev → 0
      [0, -1], // opposed to prev → -1
    ]
    const sims = await consecutiveSimilarities(['a', 'b', 'c', 'd'], {
      embed: async () => vectors,
    })
    expect(sims).toHaveLength(3)
    expect(sims[0]).toBeCloseTo(1, 10)
    expect(sims[1]).toBeCloseTo(0, 10)
    expect(sims[2]).toBeCloseTo(-1, 10)
  })

  it('passes apiKey/model through to the embedder', async () => {
    let seenModel: string | undefined
    await consecutiveSimilarities(['x', 'y'], {
      model: 'custom-model',
      embed: async (_texts, opts) => {
        seenModel = opts.model
        return [
          [1, 0],
          [0, 1],
        ]
      },
    })
    expect(seenModel).toBe('custom-model')
  })
})

describe('EMBEDDING_MODEL', () => {
  it('is the model the acceptance criterion names', () => {
    expect(EMBEDDING_MODEL).toBe('text-embedding-3-large')
  })
})
