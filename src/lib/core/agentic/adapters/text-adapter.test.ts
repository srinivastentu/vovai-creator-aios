import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import {
  buildRevisePrompt,
  createClaudeTextAdapter,
} from './text-adapter'
import type { Artifact } from './types'
import type { GradeReport } from '../../engine/types'

// ─── Fake Anthropic client ────────────────────────────────────────────────

function makeFakeClient(
  handler: (params: { model: string; system: string; userMessage: string }) => {
    text: string
    tokensIn?: number
    tokensOut?: number
    throws?: boolean
  }
): { client: Anthropic; calls: { model: string; system: string; userMessage: string }[] } {
  const calls: { model: string; system: string; userMessage: string }[] = []
  const client = {
    messages: {
      create: vi.fn(async (args: {
        model: string
        system: string
        messages: { role: string; content: string }[]
      }) => {
        const record = {
          model: args.model,
          system: args.system,
          userMessage: args.messages[0].content,
        }
        calls.push(record)
        const r = handler(record)
        if (r.throws) throw new Error('primary blew up')
        return {
          content: [{ type: 'text', text: r.text }],
          usage: {
            input_tokens: r.tokensIn ?? 100,
            output_tokens: r.tokensOut ?? 50,
          },
          stop_reason: 'end_turn',
        }
      }),
    },
  } as unknown as Anthropic
  return { client, calls }
}

const grade: GradeReport = {
  overallScore: 6.5,
  passesThreshold: false,
  dimensionScores: [
    { dimensionId: 'clarity', name: 'Clarity', score: 9, weight: 1, feedback: 'Crystal clear.' },
    { dimensionId: 'depth', name: 'Depth', score: 5, weight: 1, feedback: 'Too shallow.' },
    { dimensionId: 'tone', name: 'Tone', score: 7, weight: 1, feedback: 'Slightly flat.' },
  ],
  recommendation: 'revise',
  improvementPriorities: ['depth'],
}

const prevArtifact: Artifact<string> = {
  id: 'art_prev',
  version: 3,
  kind: 'text',
  content: 'Photosynthesis is how plants make food.',
  createdAt: new Date(),
  modelUsed: 'claude-sonnet-4-20250514',
  tokensIn: 10,
  tokensOut: 20,
  costUSD: 0.001,
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('buildRevisePrompt', () => {
  it('separates PRESERVE (>=8) from IMPROVE (<8) dimensions', () => {
    const prompt = buildRevisePrompt({
      goal: 'Explain photosynthesis',
      previous: prevArtifact,
      grade,
    })
    const preserveIdx = prompt.indexOf('PRESERVE')
    const improveIdx = prompt.indexOf('IMPROVE')
    expect(preserveIdx).toBeGreaterThanOrEqual(0)
    expect(improveIdx).toBeGreaterThan(preserveIdx)
    const preserveBlock = prompt.slice(preserveIdx, improveIdx)
    const improveBlock = prompt.slice(improveIdx)
    expect(preserveBlock).toContain('Clarity (9/10)')
    expect(preserveBlock).not.toContain('Depth (5/10)')
    expect(improveBlock).toContain('Depth (5/10)')
    expect(improveBlock).toContain('Tone (7/10)')
  })

  it('includes humanFeedback when provided', () => {
    const prompt = buildRevisePrompt({
      goal: 'g',
      previous: prevArtifact,
      grade,
      humanFeedback: 'Use a plant-nerd voice.',
    })
    expect(prompt).toContain('Human reviewer also said: Use a plant-nerd voice.')
  })
})

describe('createClaudeTextAdapter', () => {
  const origKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })
  afterEach(() => {
    if (origKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = origKey
  })

  it('produce() returns Artifact v1 with kind=text and tracked cost', async () => {
    const { client } = makeFakeClient(() => ({
      text: '  Hello world.  ',
      tokensIn: 120,
      tokensOut: 80,
    }))
    const adapter = createClaudeTextAdapter({ client })
    const a = await adapter.produce({
      goal: 'Say hello',
      systemPrompt: 'You are a greeter.',
    })
    expect(a.kind).toBe('text')
    expect(a.version).toBe(1)
    expect(a.content).toBe('Hello world.')
    expect(a.tokensIn).toBe(120)
    expect(a.tokensOut).toBe(80)
    expect(a.costUSD).toBeGreaterThan(0)
    expect(a.modelUsed).toBe('claude-sonnet-4-20250514')
  })

  it('revise() sends PRESERVE/IMPROVE prompt and bumps version', async () => {
    const { client, calls } = makeFakeClient(() => ({ text: 'revised text' }))
    const adapter = createClaudeTextAdapter({ client })
    const a = await adapter.revise({
      goal: 'Explain photosynthesis',
      systemPrompt: 'You are a science writer.',
      previous: prevArtifact,
      grade,
      humanFeedback: 'More depth please.',
    })
    expect(a.version).toBe(4)
    expect(a.content).toBe('revised text')
    const sent = calls[0].userMessage
    expect(sent).toContain('PRESERVE')
    expect(sent).toContain('Clarity (9/10)')
    expect(sent).toContain('IMPROVE')
    expect(sent).toContain('Depth (5/10)')
    expect(sent).toContain('Human reviewer also said: More depth please.')
  })

  it('throws a clear error when ANTHROPIC_API_KEY is missing and no client injected', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(() => createClaudeTextAdapter()).toThrow(/ANTHROPIC_API_KEY/)
  })

  it('falls back to the secondary model when the primary throws', async () => {
    const { client, calls } = makeFakeClient(({ model }) => {
      if (model === 'claude-sonnet-4-20250514') return { text: '', throws: true }
      return { text: 'fallback ok' }
    })
    const adapter = createClaudeTextAdapter({ client })
    const a = await adapter.produce({ goal: 'g', systemPrompt: 's' })
    expect(calls.map((c) => c.model)).toEqual([
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
    ])
    expect(a.modelUsed).toBe('claude-haiku-4-5-20251001')
    expect(a.content).toBe('fallback ok')
  })
})

// One opt-in live smoke test — hits real Claude. Skipped by default.
const liveEnabled =
  process.env.RUN_LIVE_TESTS === '1' && !!process.env.ANTHROPIC_API_KEY
const maybe = liveEnabled ? describe : describe.skip

maybe('live smoke (RUN_LIVE_TESTS=1)', () => {
  it('produce() returns >= 30 chars for a simple goal', async () => {
    const adapter = createClaudeTextAdapter()
    const a = await adapter.produce({
      goal: 'Write 2 sentences about photosynthesis.',
      systemPrompt: 'You are a concise science writer.',
    })
    expect(a.content.length).toBeGreaterThanOrEqual(30)
    expect(a.costUSD).toBeGreaterThan(0)
  }, 30_000)
})
