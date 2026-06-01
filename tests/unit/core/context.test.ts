// CR-8 — Context Engineering System (System 6) tests.
// Pure Core: the PassthroughCurator + token estimation. No domain imports.

import { describe, expect, it } from 'vitest'
import {
  CHARS_PER_TOKEN,
  DEFAULT_CONTEXT_PRIORITY,
  estimateTokens,
  type ContextSource,
} from '../../../src/lib/core/context/types'
import { PassthroughCurator } from '../../../src/lib/core/context/passthrough-curator'

function src(id: string, priority: number, text: string): ContextSource {
  return { id, content: text, priority, byteSize: text.length }
}

describe('estimateTokens', () => {
  it('approximates ~4 characters per token, rounding up', () => {
    expect(CHARS_PER_TOKEN).toBe(4)
    expect(estimateTokens(0)).toBe(0)
    expect(estimateTokens(1)).toBe(1) // ceil(1/4)
    expect(estimateTokens(4)).toBe(1)
    expect(estimateTokens(5)).toBe(2) // ceil(5/4)
    expect(estimateTokens(400)).toBe(100)
  })

  it('clamps negative sizes to zero', () => {
    expect(estimateTokens(-10)).toBe(0)
  })

  it('exposes a conventional default priority', () => {
    expect(DEFAULT_CONTEXT_PRIORITY).toBe(5)
  })
})

describe('PassthroughCurator.curate', () => {
  const curator = new PassthroughCurator()
  const generous = { maxTokens: 1_000_000 }

  it('keeps every source under a generous budget, none compressed or dropped', async () => {
    const sources = [src('persona', 10, 'voice'), src('idea', 10, 'topic'), src('sources', 8, 'refs')]
    const result = await curator.curate(sources, generous)

    expect(result.kept).toHaveLength(3)
    expect(result.compressed).toEqual([]) // V1: never compresses
    expect(result.dropped).toEqual([])
    expect(result.metadata.finalTokens).toBe(result.metadata.originalTokens)
    expect(result.metadata.decisions.every((d) => d.action === 'kept')).toBe(true)
  })

  it('orders kept sources by priority DESC', async () => {
    const sources = [src('low', 3, 'c'), src('high', 10, 'a'), src('mid', 6, 'b')]
    const result = await curator.curate(sources, generous)
    expect(result.kept.map((s) => s.id)).toEqual(['high', 'mid', 'low'])
  })

  it('preserves input order for equal priorities (stable sort)', async () => {
    const sources = [
      src('persona', 10, 'p'),
      src('idea', 10, 'i'),
      src('master', 8, 'm'),
      src('uploads', 6, 'u'),
    ]
    const result = await curator.curate(sources, generous)
    // persona before idea even though both are priority 10.
    expect(result.kept.map((s) => s.id)).toEqual(['persona', 'idea', 'master', 'uploads'])
  })

  it('drops the lowest-priority sources first when over the token budget', async () => {
    // Each source is 40 chars => 10 tokens. Budget of 20 tokens fits exactly two.
    const sources = [
      src('keepA', 10, 'a'.repeat(40)),
      src('keepB', 8, 'b'.repeat(40)),
      src('dropC', 5, 'c'.repeat(40)),
    ]
    const result = await curator.curate(sources, { maxTokens: 20 })

    expect(result.kept.map((s) => s.id)).toEqual(['keepA', 'keepB'])
    expect(result.dropped.map((s) => s.id)).toEqual(['dropC'])
    expect(result.metadata.finalTokens).toBe(20)
    expect(result.metadata.originalTokens).toBe(30)
    const dropDecision = result.metadata.decisions.find((d) => d.sourceId === 'dropC')
    expect(dropDecision?.action).toBe('dropped')
    expect(dropDecision?.reason).toContain('token')
  })

  it('respects an optional maxBytes hard cap independent of tokens', async () => {
    const sources = [src('a', 10, 'x'.repeat(30)), src('b', 8, 'y'.repeat(30))]
    // Tokens fit (15 of huge budget) but bytes cap at 30 => only the first fits.
    const result = await curator.curate(sources, { maxTokens: 1_000_000, maxBytes: 30 })
    expect(result.kept.map((s) => s.id)).toEqual(['a'])
    expect(result.dropped.map((s) => s.id)).toEqual(['b'])
    expect(result.metadata.decisions.find((d) => d.sourceId === 'b')?.reason).toContain('byte')
  })

  it('keeps a smaller lower-priority source after dropping a larger higher-priority one', async () => {
    // big (priority 10) is 40 chars/10 tokens; small (priority 5) is 4 chars/1 token.
    // Budget 5 tokens: big does not fit, small does — greedy keep-if-fits.
    const sources = [src('big', 10, 'a'.repeat(40)), src('small', 5, 'bbbb')]
    const result = await curator.curate(sources, { maxTokens: 5 })
    expect(result.kept.map((s) => s.id)).toEqual(['small'])
    expect(result.dropped.map((s) => s.id)).toEqual(['big'])
  })

  it('returns an empty curated result for no sources', async () => {
    const result = await curator.curate([], generous)
    expect(result.kept).toEqual([])
    expect(result.dropped).toEqual([])
    expect(result.metadata).toEqual({ originalTokens: 0, finalTokens: 0, decisions: [] })
  })
})
