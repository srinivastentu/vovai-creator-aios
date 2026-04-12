import { describe, expect, it, vi } from 'vitest'
import { TEXT_RUBRIC, validateTextRubric } from '../rubrics/text-rubric'
import { createOpenAITextJudge, type JudgeCostEvent } from './text-judge'

type MockClient = {
  chat: {
    completions: {
      create: (args: unknown) => Promise<{
        choices: { message: { content: string } }[]
        usage: { prompt_tokens: number; completion_tokens: number }
      }>
    }
  }
}

function mockClient(content: string | ((userMessage: string) => string)): MockClient {
  return {
    chat: {
      completions: {
        create: async (args: unknown) => {
          const messages = (args as { messages: { role: string; content: string }[] })
            .messages
          const userMsg = messages.find((m) => m.role === 'user')?.content ?? ''
          const out = typeof content === 'function' ? content(userMsg) : content
          return {
            choices: [{ message: { content: out } }],
            usage: { prompt_tokens: 500, completion_tokens: 200 },
          }
        },
      },
    },
  }
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function mockClientSequence(
  responders: Array<() => Promise<{ content: string }> | never>
): MockClient {
  let i = 0
  return {
    chat: {
      completions: {
        create: async () => {
          const r = responders[Math.min(i, responders.length - 1)]
          i++
          const out = await r()
          return {
            choices: [{ message: { content: out.content } }],
            usage: { prompt_tokens: 500, completion_tokens: 200 },
          }
        },
      },
    },
  }
}

const GOOD_JSON = JSON.stringify({
  reasoning: 'Covers topic fully with clear structure.',
  dimensionScores: [
    { dimensionId: 'clarity', score: 8, feedback: 'clear' },
    { dimensionId: 'depth', score: 8, feedback: 'solid' },
    { dimensionId: 'engagement', score: 7, feedback: 'fine' },
    { dimensionId: 'accuracy', score: 8, feedback: 'accurate' },
    { dimensionId: 'structure_completeness', score: 9, feedback: 'complete' },
  ],
  recommendation: 'Professional quality.',
  improvementPriorities: ['tighten voice'],
})

const BAD_JSON = JSON.stringify({
  reasoning: 'Lorem ipsum filler, incomplete.',
  dimensionScores: [
    { dimensionId: 'clarity', score: 3, feedback: 'placeholder' },
    { dimensionId: 'depth', score: 2, feedback: 'no substance' },
    { dimensionId: 'engagement', score: 3, feedback: 'flat' },
    { dimensionId: 'accuracy', score: 4, feedback: 'meaningless' },
    { dimensionId: 'structure_completeness', score: 3, feedback: 'truncated' },
  ],
  recommendation: 'Unusable.',
  improvementPriorities: ['rewrite'],
})

describe('text rubric', () => {
  it('validates weights sum to 1.0 and completeness >= 0.20', () => {
    const r = validateTextRubric()
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
    const completeness = TEXT_RUBRIC.dimensions.find(
      (d) => d.id === 'structure_completeness'
    )
    expect(completeness?.weight).toBeGreaterThanOrEqual(0.2)
  })
})

describe('createOpenAITextJudge', () => {
  it('returns a valid grade with all 5 dimensions', async () => {
    const judge = createOpenAITextJudge({
      client: mockClient(GOOD_JSON) as never,
    })
    const grade = await judge('some article', TEXT_RUBRIC)
    expect(grade.dimensionScores).toHaveLength(5)
    expect(grade.overallScore).toBeGreaterThan(7)
    expect(grade.passesThreshold).toBe(true)
  })

  it('recalculates composite score from weights (never trusts AI math)', async () => {
    const payload = JSON.stringify({
      reasoning: 'x',
      overallScore: 99,
      dimensionScores: [
        { dimensionId: 'clarity', score: 10, feedback: 'f' },
        { dimensionId: 'depth', score: 10, feedback: 'f' },
        { dimensionId: 'engagement', score: 10, feedback: 'f' },
        { dimensionId: 'accuracy', score: 10, feedback: 'f' },
        { dimensionId: 'structure_completeness', score: 10, feedback: 'f' },
      ],
      recommendation: '',
      improvementPriorities: [],
    })
    const judge = createOpenAITextJudge({ client: mockClient(payload) as never })
    const grade = await judge('x', TEXT_RUBRIC)
    expect(grade.overallScore).toBe(10)
  })

  it('returns synthetic failing grade on malformed JSON', async () => {
    const judge = createOpenAITextJudge({
      client: mockClient('not json at all {{{') as never,
    })
    const grade = await judge('x', TEXT_RUBRIC)
    expect(grade.overallScore).toBe(4)
    expect(grade.passesThreshold).toBe(false)
    expect(grade.dimensionScores).toHaveLength(5)
    expect(grade.dimensionScores.every((d) => d.score === 4)).toBe(true)
  })

  it('strips markdown fences before parsing', async () => {
    const wrapped = '```json\n' + GOOD_JSON + '\n```'
    const judge = createOpenAITextJudge({ client: mockClient(wrapped) as never })
    const grade = await judge('x', TEXT_RUBRIC)
    expect(grade.overallScore).toBeGreaterThan(7)
  })

  it('discriminates quality: good article >= 7, lorem ipsum <= 5', async () => {
    const judge = createOpenAITextJudge({
      client: mockClient((prompt) =>
        prompt.includes('Lorem ipsum') ? BAD_JSON : GOOD_JSON
      ) as never,
    })
    const good = await judge('Thoughtful article about TDD discipline.', TEXT_RUBRIC)
    const bad = await judge(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      TEXT_RUBRIC
    )
    expect(good.overallScore).toBeGreaterThanOrEqual(7)
    expect(bad.overallScore).toBeLessThanOrEqual(5)
  })

  it('tracks cost on every call via onCost', async () => {
    const onCost = vi.fn()
    const judge = createOpenAITextJudge({
      client: mockClient(GOOD_JSON) as never,
      onCost,
    })
    await judge('x', TEXT_RUBRIC)
    expect(onCost).toHaveBeenCalledOnce()
    const event = onCost.mock.calls[0][0] as JudgeCostEvent
    expect(event.model).toBe('gpt-4o')
    expect(event.tokensIn).toBe(500)
    expect(event.tokensOut).toBe(200)
    expect(event.costUSD).toBeGreaterThan(0)
  })

  it('falls back to mini on 5xx and reports fallback model in onCost', async () => {
    const onCost = vi.fn()
    const client = mockClientSequence([
      () => {
        throw new HttpError(500, 'internal')
      },
      async () => ({ content: GOOD_JSON }),
    ])
    const judge = createOpenAITextJudge({ client: client as never, onCost })
    const grade = await judge('x', TEXT_RUBRIC)
    expect(grade.passesThreshold).toBe(true)
    expect(onCost).toHaveBeenCalledOnce()
    const event = onCost.mock.calls[0][0] as JudgeCostEvent
    expect(event.model).toBe('gpt-4o-mini')
  })

  it('rethrows on 4xx (non-429) without hitting fallback', async () => {
    const onCost = vi.fn()
    const create = vi.fn(async () => {
      throw new HttpError(400, 'bad request')
    })
    const client = { chat: { completions: { create } } }
    const judge = createOpenAITextJudge({ client: client as never, onCost })
    await expect(judge('x', TEXT_RUBRIC)).rejects.toThrow('bad request')
    expect(create).toHaveBeenCalledOnce()
    expect(onCost).not.toHaveBeenCalled()
  })

  it('returns synthetic failing grade when both primary and fallback fail', async () => {
    const onCost = vi.fn()
    const client = mockClientSequence([
      () => {
        throw new HttpError(503, 'unavailable')
      },
      () => {
        throw new HttpError(503, 'unavailable')
      },
    ])
    const judge = createOpenAITextJudge({ client: client as never, onCost })
    const grade = await judge('x', TEXT_RUBRIC)
    expect(grade.overallScore).toBe(4)
    expect(grade.passesThreshold).toBe(false)
    expect(grade.dimensionScores).toHaveLength(5)
    expect(onCost).toHaveBeenCalledOnce()
    const event = onCost.mock.calls[0][0] as JudgeCostEvent
    expect(event.tokensIn).toBe(0)
    expect(event.tokensOut).toBe(0)
    expect(event.costUSD).toBe(0)
  })

  it('backfills score=4 for any dimension missing from the response', async () => {
    const partial = JSON.stringify({
      reasoning: 'partial response',
      dimensionScores: [
        { dimensionId: 'clarity', score: 9, feedback: 'clear' },
        { dimensionId: 'depth', score: 9, feedback: 'deep' },
        { dimensionId: 'engagement', score: 9, feedback: 'engaging' },
        { dimensionId: 'accuracy', score: 9, feedback: 'accurate' },
        // structure_completeness missing
      ],
      recommendation: 'partial',
      improvementPriorities: [],
    })
    const judge = createOpenAITextJudge({ client: mockClient(partial) as never })
    const grade = await judge('x', TEXT_RUBRIC)
    expect(grade.dimensionScores).toHaveLength(5)
    const missing = grade.dimensionScores.find(
      (d) => d.dimensionId === 'structure_completeness'
    )
    expect(missing?.score).toBe(4)
    expect(missing?.feedback).toContain('No score returned')
  })

  it('throws at eval time when rubric is invalid (fail fast)', async () => {
    const bad = {
      ...TEXT_RUBRIC,
      dimensions: TEXT_RUBRIC.dimensions.map((d) => ({ ...d, weight: 0.1 })),
    }
    const judge = createOpenAITextJudge({ client: mockClient(GOOD_JSON) as never })
    await expect(judge('x', bad)).rejects.toThrow(/invalid rubric/)
  })

  const liveIt = process.env.RUN_LIVE_TESTS ? it : it.skip
  liveIt('live smoke: real GPT-4o grades a paragraph', async () => {
    const judge = createOpenAITextJudge()
    const grade = await judge(
      'Test-driven development is a discipline in which tests are written before code.',
      TEXT_RUBRIC
    )
    expect(grade.overallScore).toBeGreaterThanOrEqual(1)
    expect(grade.overallScore).toBeLessThanOrEqual(10)
  }, 30_000)
})
