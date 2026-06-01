// CR-6 — Cross-Critique (Pattern 5) runtime tests.
// Pure Core: a mocked ModelGateway + a mocked CrossCritiqueAdapter + an injected
// JudgeFunction drive the runner. No domain imports, no API keys.

import { describe, expect, it, vi } from 'vitest'
import type { ModelGateway } from '../../../src/lib/core/models/gateway'
import type { GatewayRequest, GatewayResponse } from '../../../src/lib/core/models/types'
import {
  assertCrossCritiqueModels,
  classifyModelFamily,
  runCrossCritiqueIteration,
  type CrossCritiqueAdapter,
} from '../../../src/lib/core/engine/cross-critique'
import { createInitialState, runLoop } from '../../../src/lib/core/engine/loop-engine'
import type {
  AgentConfig,
  CrossCritiqueConfig,
  CrossCritiqueIterationRecord,
  GradeReport,
  JudgeFunction,
  LoopStage,
  RubricDefinition,
} from '../../../src/lib/core/engine/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface TextArtifact {
  text: string
}

const RUBRIC: RubricDefinition = {
  id: 'cc-rubric',
  name: 'Cross-Critique Test Rubric',
  passThreshold: 80,
  dimensions: [
    { id: 'a', name: 'Alpha', weight: 0.5, passThreshold: 7, description: 'a', criteria: {} },
    { id: 'b', name: 'Beta', weight: 0.5, passThreshold: 7, description: 'b', criteria: {} },
  ],
}

function agent(id: string, model: string): AgentConfig {
  return { id, name: id, model: { primary: model, fallback: model }, maxRetries: 1, timeoutMs: 1000 }
}

function makeGrade(score: number): GradeReport {
  return {
    overallScore: score,
    passesThreshold: score >= RUBRIC.passThreshold,
    dimensionScores: [
      { dimensionId: 'a', name: 'Alpha', score: score / 10, weight: 0.5, feedback: `a@${score}` },
      { dimensionId: 'b', name: 'Beta', score: score / 10, weight: 0.5, feedback: `b@${score}` },
    ],
    recommendation: 'test',
    improvementPriorities: [],
  }
}

// V1 shape: Claude + GPT producers, Claude + GPT critics, Claude integrator,
// Gemini judge. Note Producer A (Claude) and the integrator (Claude) share a
// family on purpose — that is allowed; only the judge must be disjoint.
function makeConfig(overrides: Partial<CrossCritiqueConfig> = {}): CrossCritiqueConfig {
  return {
    producers: [agent('producer-claude', 'claude-sonnet-4-20250514'), agent('producer-gpt', 'gpt-4o')],
    critics: [agent('claude-on-gpt', 'claude-sonnet-4-20250514'), agent('gpt-on-claude', 'gpt-4o')],
    criticAssignments: { 'claude-on-gpt': 'producer-gpt', 'gpt-on-claude': 'producer-claude' },
    integratorAgent: agent('integrator', 'claude-sonnet-4-20250514'),
    judgeAgent: agent('judge', 'gemini-2.5-pro'),
    ...overrides,
  }
}

function makeStage(opts: {
  threshold?: number
  min?: number
  max?: number
  maxBudgetUSD?: number
  config?: CrossCritiqueConfig
} = {}): LoopStage<TextArtifact> {
  return {
    id: 'cc-stage',
    agents: [],
    rubric: RUBRIC,
    threshold: opts.threshold ?? 80,
    minIterations: opts.min ?? 2,
    maxIterations: opts.max ?? 4,
    loopPattern: 'cross-critique',
    crossCritique: opts.config ?? makeConfig(),
    ...(opts.maxBudgetUSD !== undefined ? { maxBudgetUSD: opts.maxBudgetUSD } : {}),
  }
}

// Trivial adapter: tags each request with a `role` param so the mock gateway can
// price critic vs integrator (both can be Claude, so model id alone won't do).
const adapter: CrossCritiqueAdapter<TextArtifact> = {
  producerRequest: ({ feedback, iteration }) => ({
    params: { role: 'producer', prompt: `p${iteration}|${feedback ?? 'none'}` },
  }),
  criticRequest: ({ criticId, targetProducerId }) => ({
    params: { role: 'critic', prompt: `${criticId}->${targetProducerId}` },
  }),
  integratorRequest: ({ producerArtifacts, critiques }) => ({
    params: {
      role: 'integrator',
      prompt: `int|${Object.keys(producerArtifacts).length}|${Object.keys(critiques).length}`,
    },
  }),
  parseArtifact: (r) =>
    r.success && typeof r.result.content === 'string' ? { text: r.result.content } : null,
  parseCritique: (r) => (typeof r.result.content === 'string' ? r.result.content : ''),
  feedbackFromGrade: (g) => `PRESERVE/IMPROVE @ ${g.overallScore}`,
}

function textResponse(modelId: string, content: string, costUsd: number): GatewayResponse {
  return {
    success: true,
    modelId,
    providerId: 'test',
    capability: 'text-generation',
    result: { content },
    cost: { costUsd, durationMs: 10, unit: '1k-tokens-in' },
    metadata: {},
  }
}

function failureResponse(modelId: string): GatewayResponse {
  return {
    success: false,
    modelId,
    providerId: 'test',
    capability: 'text-generation',
    result: {},
    cost: { costUsd: 0, durationMs: 10, unit: 'none' },
    error: 'mock failure',
    metadata: {},
  }
}

interface MockGateway {
  gateway: ModelGateway
  requestMultiple: ReturnType<typeof vi.fn>
  request: ReturnType<typeof vi.fn>
  /** executeOne-level count: requestMultiple counts modelIds.length; request counts 1. */
  underlyingCalls: () => number
}

function makeGateway(
  costs: {
    producer?: number
    critic?: number
    integrator?: number
    integratorFails?: boolean
    producersFail?: boolean
  } = {}
): MockGateway {
  const producerCost = costs.producer ?? 0
  const criticCost = costs.critic ?? 0
  const integratorCost = costs.integrator ?? 0
  let underlying = 0
  let integratorSeq = 0

  const requestMultiple = vi.fn(async (_req: GatewayRequest, modelIds: string[]) => {
    underlying += modelIds.length
    // producersFail → every producer returns a failure response (parses to null),
    // exercising the rule-9 dialectic-degradation path (producersSucceeded === 0).
    return modelIds.map((id) =>
      costs.producersFail ? failureResponse(id) : textResponse(id, `producer:${id}`, producerCost)
    )
  })

  const request = vi.fn(async (req: GatewayRequest) => {
    underlying += 1
    if (req.capability === 'text-scoring') {
      // Judge's own gateway call (count only — the grade comes from the injected judge).
      return textResponse(req.preferences.modelId ?? 'judge', 'judge-call', 0)
    }
    const role = req.params.role as string
    if (role === 'critic') {
      return textResponse(req.preferences.modelId ?? '', `critique:${req.params.prompt}`, criticCost)
    }
    // integrator
    integratorSeq += 1
    if (costs.integratorFails) return failureResponse(req.preferences.modelId ?? '')
    return textResponse(req.preferences.modelId ?? '', `integrated:${integratorSeq}`, integratorCost)
  })

  const gateway = {
    request,
    requestMultiple,
    getAvailableModels: vi.fn(() => []),
    getCostSummary: vi.fn(),
    getCostTable: vi.fn(() => []),
    getHealthDashboard: vi.fn(() => new Map()),
  } as unknown as ModelGateway

  return { gateway, requestMultiple, request, underlyingCalls: () => underlying }
}

/** Judge returning successive scores. Optionally makes one gateway text-scoring call. */
function makeJudge(scores: number[], opts: { gateway?: ModelGateway } = {}): JudgeFunction {
  let i = 0
  return async (_artifact, _rubric): Promise<GradeReport> => {
    const score = scores[Math.min(i, scores.length - 1)]
    i += 1
    if (opts.gateway) {
      await opts.gateway.request({
        capability: 'text-scoring',
        params: {},
        preferences: { modelId: 'gemini-2.5-pro' },
        context: {},
      })
    }
    return makeGrade(score)
  }
}

// ---------------------------------------------------------------------------
// classifyModelFamily
// ---------------------------------------------------------------------------

describe('classifyModelFamily', () => {
  it('maps known model ids to families', () => {
    expect(classifyModelFamily('claude-sonnet-4-20250514')).toBe('anthropic')
    expect(classifyModelFamily('gpt-4o')).toBe('openai')
    expect(classifyModelFamily('o3-mini')).toBe('openai')
    expect(classifyModelFamily('gemini-2.5-pro')).toBe('google')
    expect(classifyModelFamily('imagen-4')).toBe('google')
  })

  it('returns the id itself for unknown models (no false collisions)', () => {
    expect(classifyModelFamily('llama-3-70b')).toBe('llama-3-70b')
    expect(classifyModelFamily('mistral-large')).toBe('mistral-large')
  })
})

// ---------------------------------------------------------------------------
// assertCrossCritiqueModels (Pattern-5 rule 10)
// ---------------------------------------------------------------------------

describe('assertCrossCritiqueModels', () => {
  it('passes the V1 config (Claude producer + Claude integrator, Gemini judge)', () => {
    expect(() => assertCrossCritiqueModels(makeConfig())).not.toThrow()
  })

  it('throws when the judge shares a family with a producer', () => {
    const config = makeConfig({ judgeAgent: agent('judge', 'claude-opus-4') })
    expect(() => assertCrossCritiqueModels(config)).toThrow(/different model families/)
  })

  it('throws when the judge shares a family with the integrator', () => {
    const config = makeConfig({
      producers: [agent('p-claude', 'claude-sonnet-4-20250514'), agent('p-gpt', 'gpt-4o')],
      integratorAgent: agent('integrator', 'gemini-2.5-flash'),
      judgeAgent: agent('judge', 'gemini-2.5-pro'),
    })
    expect(() => assertCrossCritiqueModels(config)).toThrow(/integrator/)
  })

  it('allows producer and integrator to share a family (V1 reuses Claude)', () => {
    const config = makeConfig({
      producers: [agent('p1', 'claude-sonnet-4-20250514'), agent('p2', 'gpt-4o')],
      integratorAgent: agent('integrator', 'claude-opus-4'),
      judgeAgent: agent('judge', 'gemini-2.5-pro'),
    })
    expect(() => assertCrossCritiqueModels(config)).not.toThrow()
  })

  it('respects an injected family resolver', () => {
    // Everything collapses to one family → judge necessarily overlaps a producer.
    expect(() => assertCrossCritiqueModels(makeConfig(), () => 'one-family')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// runCrossCritiqueIteration
// ---------------------------------------------------------------------------

describe('runCrossCritiqueIteration', () => {
  it('runs a 6-call iteration and returns a full record', async () => {
    const mock = makeGateway({ producer: 0.01, critic: 0.01, integrator: 0.01 })
    const stage = makeStage({ threshold: 80, min: 1, max: 1 })
    const state = createInitialState<TextArtifact>(stage.id)

    const result = await runCrossCritiqueIteration(
      mock.gateway,
      stage,
      state,
      { brief: 'x' },
      makeJudge([90], { gateway: mock.gateway }), // judge makes the 6th gateway call
      adapter,
      { getJudgeCostUsd: () => 0.02 }
    )

    // 2 producers (requestMultiple) + 2 critics + 1 integrator + 1 judge = 6.
    expect(mock.underlyingCalls()).toBe(6)
    expect(mock.requestMultiple).toHaveBeenCalledTimes(1)

    const rec = result.iterations[0] as CrossCritiqueIterationRecord
    expect(Object.keys(rec.producerArtifacts)).toEqual(['producer-claude', 'producer-gpt'])
    expect(rec.producerArtifacts['producer-claude']).toEqual({ text: 'producer:claude-sonnet-4-20250514' })
    expect(rec.producersSucceeded).toBe(2) // both producers returned a usable draft
    expect(Object.keys(rec.critiques)).toEqual(['claude-on-gpt', 'gpt-on-claude'])
    expect(rec.integratedArtifact).toEqual({ text: 'integrated:1' })
    expect(rec.judgeGrade?.overallScore).toBe(90)
    expect(rec.grade).toBe(rec.judgeGrade) // slots into IterationRecord uniformly
    expect(result.currentArtifact).toEqual({ text: 'integrated:1' })
  })

  it('records producersSucceeded=0 when every producer parses to null (rule 9 degradation)', async () => {
    const mock = makeGateway({ producersFail: true })
    const stage = makeStage({ threshold: 80, min: 1, max: 1 })
    const state = createInitialState<TextArtifact>(stage.id)

    const result = await runCrossCritiqueIteration(
      mock.gateway,
      stage,
      state,
      { brief: 'x' },
      makeJudge([90]),
      adapter,
    )

    const rec = result.iterations[0] as CrossCritiqueIterationRecord
    expect(Object.keys(rec.producerArtifacts)).toHaveLength(0)
    expect(rec.producersSucceeded).toBe(0) // dialectic collapsed — surfaced to Gate B
    expect(Object.keys(rec.critiques)).toHaveLength(0) // no target → critics skipped
  })

  it('sums cost across all six sub-calls into the iteration + cumulative totals', async () => {
    const mock = makeGateway({ producer: 0.1, critic: 0.05, integrator: 0.15 })
    const stage = makeStage({ threshold: 80, min: 1, max: 1 })
    const state = createInitialState<TextArtifact>(stage.id)

    const result = await runCrossCritiqueIteration(
      mock.gateway,
      stage,
      state,
      {},
      makeJudge([90]),
      adapter,
      { getJudgeCostUsd: () => 0.2 }
    )

    // producers 0.1×2 + critics 0.05×2 + integrator 0.15 + judge 0.2 = 0.65
    const expected = 0.1 * 2 + 0.05 * 2 + 0.15 + 0.2
    const rec = result.iterations[0] as CrossCritiqueIterationRecord
    expect(rec.iterationCostUSD).toBeCloseTo(expected, 10)
    expect(rec.costUSD).toBeCloseTo(expected, 10)
    expect(result.cumulativeCostUSD).toBeCloseTo(expected, 10)
    expect(result.costUSD).toBeCloseTo(expected, 10)
  })

  it('terminates on budget exhaustion even when min iterations are unmet (rule 12)', async () => {
    const mock = makeGateway({ producer: 0.5, critic: 0.5, integrator: 0.5 })
    const stage = makeStage({ threshold: 95, min: 2, max: 5, maxBudgetUSD: 1.0 })
    const state = createInitialState<TextArtifact>(stage.id)

    const result = await runCrossCritiqueIteration(
      mock.gateway,
      stage,
      state,
      {},
      makeJudge([50]),
      adapter,
      { getJudgeCostUsd: () => 0.5 }
    )

    expect(result.cumulativeCostUSD).toBeCloseTo(3.0, 10) // ≥ 1.0 cap
    expect(result.loopCount).toBe(1) // min=2 NOT met, yet we stop
    expect(result.status).toBe('presenting')
    expect(result.terminationReason).toBe('budget_exhausted')
  })

  it('terminates with threshold_met only after min iterations are satisfied', async () => {
    const mock = makeGateway()
    const stage = makeStage({ threshold: 80, min: 2, max: 5 })
    let state = createInitialState<TextArtifact>(stage.id)
    const judge = makeJudge([85, 85])

    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    expect(state.status).toBe('revising') // threshold met but min=2 unmet → keep going
    expect(state.terminationReason).toBeUndefined()

    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    expect(state.status).toBe('presenting')
    expect(state.terminationReason).toBe('threshold_met')
    expect(state.loopCount).toBe(2)
  })

  it('forces revision below minIterations even when the score passes', async () => {
    const mock = makeGateway()
    const stage = makeStage({ threshold: 50, min: 3, max: 5 })
    let state = createInitialState<TextArtifact>(stage.id)
    const judge = makeJudge([90, 90])

    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    expect(state.status).toBe('revising')
    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    expect(state.status).toBe('revising') // loopCount 2 < min 3
    expect(state.terminationReason).toBeUndefined()
  })

  it('terminates with max_iterations when threshold is never met', async () => {
    const mock = makeGateway()
    const stage = makeStage({ threshold: 99, min: 1, max: 2 })
    let state = createInitialState<TextArtifact>(stage.id)
    const judge = makeJudge([50, 50])

    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    expect(state.status).toBe('revising')
    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    expect(state.status).toBe('presenting')
    expect(state.terminationReason).toBe('max_iterations')
  })

  it('tracks the best artifact across iterations (not the last)', async () => {
    const mock = makeGateway()
    const stage = makeStage({ threshold: 99, min: 1, max: 5 }) // never threshold; run several
    let state = createInitialState<TextArtifact>(stage.id)
    const judge = makeJudge([70, 85, 60])

    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    expect(state.bestGrade?.overallScore).toBe(70)
    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    expect(state.bestGrade?.overallScore).toBe(85)
    expect(state.bestArtifact).toEqual({ text: 'integrated:2' })
    state = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})
    // 3rd iteration scored 60 → best stays the 2nd iteration's integrated artifact.
    expect(state.bestGrade?.overallScore).toBe(85)
    expect(state.bestArtifact).toEqual({ text: 'integrated:2' })
    expect(state.currentArtifact).toEqual({ text: 'integrated:3' })
  })

  it('throws at iteration start when a producer and the judge share a model family', async () => {
    const mock = makeGateway()
    const config = makeConfig({ judgeAgent: agent('judge', 'claude-opus-4') }) // same family as producer-claude
    const stage = makeStage({ config })
    const state = createInitialState<TextArtifact>(stage.id)

    await expect(
      runCrossCritiqueIteration(mock.gateway, stage, state, {}, makeJudge([90]), adapter, {})
    ).rejects.toThrow(/different model families/)
    // Enforcement runs BEFORE any spend.
    expect(mock.requestMultiple).not.toHaveBeenCalled()
    expect(mock.request).not.toHaveBeenCalled()
  })

  it('respects an injected family resolver for the iteration-start guard', async () => {
    const mock = makeGateway()
    const stage = makeStage() // V1 config — passes the default classifier
    const state = createInitialState<TextArtifact>(stage.id)
    // Force every model into one family → judge overlaps producers → throws.
    await expect(
      runCrossCritiqueIteration(mock.gateway, stage, state, {}, makeJudge([90]), adapter, {
        classifyFamily: () => 'collapsed',
      })
    ).rejects.toThrow(/different model families/)
  })

  it('degrades gracefully when integration produces nothing usable (rule 9)', async () => {
    const mock = makeGateway({ integratorFails: true })
    const stage = makeStage({ threshold: 80, min: 1, max: 2 })
    const state = createInitialState<TextArtifact>(stage.id)
    const judge = vi.fn(makeJudge([90]))

    const result = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {})

    expect(judge).not.toHaveBeenCalled() // no artifact to grade
    const rec = result.iterations[0] as CrossCritiqueIterationRecord
    expect(rec.integratedArtifact).toBeNull()
    expect(rec.judgeGrade).toBeNull()
    expect(result.bestArtifact).toBeNull()
    expect(result.status).toBe('revising') // loopCount 1 < max 2; no threshold/budget
  })

  it('skips the judge when the integrated artifact fails the stage validator (rule 6)', async () => {
    const mock = makeGateway({ integrator: 0.1 })
    const stage: LoopStage<TextArtifact> = {
      ...makeStage({ threshold: 80, min: 1, max: 2 }),
      validator: () => ({ valid: false, errors: [{ code: 'too_short', message: 'nope' }] }),
    }
    const state = createInitialState<TextArtifact>(stage.id)
    const judge = vi.fn(makeJudge([95]))

    const result = await runCrossCritiqueIteration(mock.gateway, stage, state, {}, judge, adapter, {
      getJudgeCostUsd: () => 0.5,
    })

    expect(judge).not.toHaveBeenCalled() // validator rejected → never reach the judge
    const rec = result.iterations[0] as CrossCritiqueIterationRecord
    expect(rec.integratedArtifact).toEqual({ text: 'integrated:1' }) // integration ran
    expect(rec.judgeGrade).toBeNull()
    // No judge cost added — only generation cost (integrator 0.1; producers/critics 0).
    expect(rec.iterationCostUSD).toBeCloseTo(0.1, 10)
    expect(result.bestArtifact).toBeNull()
    expect(result.status).toBe('revising')
  })

  it('passes human feedback into producer context for one iteration then clears it', async () => {
    const mock = makeGateway()
    const stage = makeStage({ threshold: 99, min: 1, max: 3 })
    let state = createInitialState<TextArtifact>(stage.id)
    state = { ...state, humanFeedback: ['punch up the hook'] }

    const seen: unknown[] = []
    const spyAdapter: CrossCritiqueAdapter<TextArtifact> = {
      ...adapter,
      producerRequest: (input) => {
        seen.push(input.context)
        return adapter.producerRequest(input)
      },
    }

    state = await runCrossCritiqueIteration(mock.gateway, stage, state, { brief: 'b' }, makeJudge([50]), spyAdapter, {})
    expect(seen[0]).toMatchObject({ brief: 'b', humanFeedback: ['punch up the hook'] })
    expect(state.humanFeedback).toEqual([]) // rule 5: cleared after use
  })
})

// ---------------------------------------------------------------------------
// runLoop dispatch
// ---------------------------------------------------------------------------

describe('runLoop dispatch to cross-critique', () => {
  it('routes a cross-critique stage to the runner and never calls the AgentExecutor', async () => {
    const mock = makeGateway({ producer: 0.01 })
    const stage = makeStage({ threshold: 80, min: 1, max: 1 })
    const state = createInitialState<TextArtifact>(stage.id)
    const executor = vi.fn(async () => {
      throw new Error('AgentExecutor must not run for cross-critique')
    })

    const result = await runLoop(stage, state, {}, executor, makeJudge([90]), {
      gateway: mock.gateway,
      adapter,
      options: { getJudgeCostUsd: () => 0 },
    })

    expect(executor).not.toHaveBeenCalled()
    expect(result.iterations).toHaveLength(1)
    expect(result.status).toBe('presenting')
    expect(result.terminationReason).toBe('threshold_met')
  })

  it('throws when a cross-critique stage is run without gateway/adapter deps', async () => {
    const stage = makeStage()
    const state = createInitialState<TextArtifact>(stage.id)
    await expect(
      runLoop(stage, state, {}, vi.fn(), makeJudge([90]))
    ).rejects.toThrow(/without gateway\/adapter deps/)
  })
})
