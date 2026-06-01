// CR-7 — LinkedIn Cross-Critique (Pattern 5) wiring tests.
// A mocked ModelGateway + an injected JudgeFunction drive the domain stage (no API
// keys). These test the DOMAIN wiring (config shape, adapter prompts/parsers, no
// rubric leak to producers, budget cap, 6-call iteration); the Core runner itself
// is exhaustively covered by tests/unit/core/cross-critique.test.ts.

import { describe, it, expect, vi } from 'vitest'
import type { ModelGateway } from '../../../src/lib/core/models/gateway'
import type { GatewayRequest, GatewayResponse } from '../../../src/lib/core/models/types'
import type { GradeReport, JudgeFunction } from '../../../src/lib/core/engine/types'
import { assertCrossCritiqueModels } from '../../../src/lib/core/engine/cross-critique'
import {
  createLinkedInCrossCritiqueStage,
  runCrossCritiqueLoop,
  LINKEDIN_CROSS_CRITIQUE_CONFIG,
  catalogModelFamily,
} from '../../../src/lib/domain/workflows/creator/cross-critique-stage'
import {
  LINKEDIN_PRODUCER_SYSTEM_PROMPT,
  buildLinkedInProducerUser,
  parseLinkedInArtifact,
} from '../../../src/lib/domain/workflows/creator/agents/linkedin/producer-gpt'
import { LINKEDIN_CRITIC_SYSTEM_PROMPT } from '../../../src/lib/domain/workflows/creator/agents/linkedin/critic-claude-on-gpt'
import { LINKEDIN_INTEGRATOR_SYSTEM_PROMPT } from '../../../src/lib/domain/workflows/creator/agents/linkedin/integrator'
import { LINKEDIN_POST_RUBRIC } from '../../../src/lib/domain/workflows/creator/rubrics/linkedin-post-rubric'
import type { RepurposeContext } from '../../../src/lib/domain/workflows/creator/types'

// ─── Fixtures ───────────────────────────────────────────────────────────────
const PARA =
  'This is a concrete sentence about agentic AI loops and the tradeoffs builders actually hit. '
const VALID_POST = [
  'Here is a counter-intuitive claim about content generation.',
  'Most teams reach for the wrong loop.',
  '',
  PARA.repeat(11),
  '',
  PARA.repeat(11),
  '',
  'So which loop are you running?',
].join('\n')

const CONTEXT: RepurposeContext = {
  longFormMasterId: 'lfm-1',
  artifactType: 'linkedin_post',
  masterTitle: 'Why Sequential Cross-Critique Beats Tournament',
  ideaTitle: 'Why sequential cross-critique beats tournament for content generation',
  niches: ['agentic AI'],
  persona: {
    name: 'BuildOS Creator',
    voiceSummary: 'Conversational-expert, plain technical.',
    pointOfView: 'Show the machinery, name the tradeoffs.',
    audienceSummary: 'AI builders who ship',
    signaturePhrases: ['show you the machinery', 'here is the tradeoff'],
    signatureHooks: ['a counter-intuitive claim, then the proof'],
    doNotSay: ['game-changer', 'unleash'],
  },
  sections: [
    { heading: 'The Architecture Gap', contentMarkdown: 'Single-shot vs sequential.' },
    { heading: 'How It Works', contentMarkdown: 'Producers, critics, integrator.' },
  ],
}

function makeGrade(score: number): GradeReport {
  return {
    overallScore: score,
    passesThreshold: score >= 80,
    dimensionScores: LINKEDIN_POST_RUBRIC.dimensions.map((d) => ({
      dimensionId: d.id,
      name: d.name,
      score: score / 10,
      weight: d.weight,
      feedback: `${d.name} note`,
    })),
    recommendation: 'test',
    improvementPriorities: ['tighten the hook'],
  }
}

function artifactResponse(modelId: string, costUsd: number): GatewayResponse {
  return {
    success: true,
    modelId,
    providerId: 'test',
    capability: 'text-generation',
    result: { content: JSON.stringify({ content: VALID_POST }) },
    cost: { costUsd, durationMs: 1, unit: '1k-tokens-in' },
    metadata: {},
  }
}

interface MockGateway {
  gateway: ModelGateway
  underlying: () => number
}

function makeGateway(genCost: number): MockGateway {
  let underlying = 0
  const requestMultiple = vi.fn(async (_req: GatewayRequest, modelIds: string[]) => {
    underlying += modelIds.length
    return modelIds.map((id) => artifactResponse(id, genCost))
  })
  const request = vi.fn(async (req: GatewayRequest) => {
    underlying += 1
    if (req.capability === 'text-scoring') return artifactResponse('gemini-2.5-pro', 0)
    return artifactResponse(req.preferences.modelId ?? '', genCost)
  })
  const gateway = {
    request,
    requestMultiple,
    getAvailableModels: vi.fn(() => []),
    getCostSummary: vi.fn(),
    getCostTable: vi.fn(() => []),
    getHealthDashboard: vi.fn(() => new Map()),
  } as unknown as ModelGateway
  return { gateway, underlying: () => underlying }
}

/** Judge returning successive scores; makes the 6th (text-scoring) gateway call. */
function makeJudge(scores: number[], gateway: ModelGateway): JudgeFunction {
  let i = 0
  return async () => {
    const score = scores[Math.min(i, scores.length - 1)]
    i += 1
    await gateway.request({
      capability: 'text-scoring',
      params: {},
      preferences: { modelId: 'gemini-2.5-pro' },
      context: {},
    })
    return makeGrade(score)
  }
}

// ─── Rule 11: producers/critics/integrator never see the rubric ───────────────
describe('Pattern-5 rule 11 — no rubric text reaches producers/critics/integrator', () => {
  const rubricStrings = [
    LINKEDIN_POST_RUBRIC.name,
    ...LINKEDIN_POST_RUBRIC.dimensions.flatMap((d) => Object.values(d.criteria)),
  ]

  it('producer system prompt contains no rubric name or criteria text', () => {
    for (const s of rubricStrings) expect(LINKEDIN_PRODUCER_SYSTEM_PROMPT).not.toContain(s)
  })

  it('critic + integrator system prompts contain no rubric name or criteria text', () => {
    for (const s of rubricStrings) {
      expect(LINKEDIN_CRITIC_SYSTEM_PROMPT).not.toContain(s)
      expect(LINKEDIN_INTEGRATOR_SYSTEM_PROMPT).not.toContain(s)
    }
  })

  it('producer user message carries persona + master + PRESERVE/IMPROVE, not the rubric', () => {
    const feedback = '- Hook Strength (5/10): tighten the first line.'
    const msg = buildLinkedInProducerUser(CONTEXT, feedback)
    expect(msg).toContain('BuildOS Creator')
    expect(msg).toContain('The Architecture Gap') // master section
    expect(msg).toContain('tighten the first line') // PRESERVE/IMPROVE feedback
    for (const s of rubricStrings) expect(msg).not.toContain(s)
  })
})

// ─── Config + family guard (rule 10) ──────────────────────────────────────────
describe('LINKEDIN_CROSS_CRITIQUE_CONFIG', () => {
  it('is the V1 shape (Claude + GPT producers, cross-model critics, Claude integrator, Gemini judge)', () => {
    const cfg = LINKEDIN_CROSS_CRITIQUE_CONFIG
    expect(cfg.producers.map((p) => p.model.primary)).toEqual([
      'claude-sonnet-4-20250514',
      'gpt-4o',
    ])
    expect(cfg.integratorAgent.model.primary).toBe('claude-sonnet-4-20250514')
    expect(cfg.judgeAgent.model.primary).toBe('gemini-2.5-flash')
    // Each critic reads the OTHER model's draft.
    expect(cfg.criticAssignments['linkedin-critic-claude-on-gpt']).toBe('linkedin-producer-gpt')
    expect(cfg.criticAssignments['linkedin-critic-gpt-on-claude']).toBe('linkedin-producer-claude')
  })

  it('passes the rule-10 guard with the catalog-backed family classifier', () => {
    expect(() => assertCrossCritiqueModels(LINKEDIN_CROSS_CRITIQUE_CONFIG, catalogModelFamily)).not.toThrow()
  })

  it('catalogModelFamily maps V1 models to disjoint providers', () => {
    expect(catalogModelFamily('claude-sonnet-4-20250514')).toBe('anthropic')
    expect(catalogModelFamily('gpt-4o')).toBe('openai')
    expect(catalogModelFamily('gemini-2.5-pro')).toBe('google-gemini')
  })
})

// ─── Adapter parsing ───────────────────────────────────────────────────────────
describe('parseLinkedInArtifact', () => {
  it('parses content JSON and recomputes charCount', () => {
    const a = parseLinkedInArtifact(JSON.stringify({ content: VALID_POST }))
    expect(a?.text).toBe(VALID_POST)
    expect(a?.charCount).toBe(VALID_POST.length)
  })

  it('returns null on empty content or garbage', () => {
    expect(parseLinkedInArtifact(JSON.stringify({ content: '' }))).toBeNull()
    expect(parseLinkedInArtifact('not json')).toBeNull()
  })
})

// ─── End-to-end via mocks ──────────────────────────────────────────────────────
describe('runCrossCritiqueLoop (LinkedIn, mocked)', () => {
  it('runs a 6-call iteration, judges the integrated artifact, tracks best', async () => {
    const mock = makeGateway(0.01)
    const stage = createLinkedInCrossCritiqueStage({
      gateway: mock.gateway,
      judge: makeJudge([90], mock.gateway),
      minIterations: 1,
      maxIterations: 1,
    })
    const events: number[] = []
    const result = await runCrossCritiqueLoop({
      stage,
      context: CONTEXT,
      onIteration: (e) => events.push(e.producers.length),
    })

    // 2 producers + 2 critics + 1 integrator + 1 judge = 6 gateway calls.
    expect(mock.underlying()).toBe(6)
    expect(events[0]).toBe(2) // two producer drafts surfaced in the history
    expect(result.bestScore).toBe(90)
    expect(result.bestArtifact?.text).toBe(VALID_POST)
    expect(result.iterations).toHaveLength(1)
    expect(result.integratedArtifacts).toHaveLength(1)
    expect(result.terminationReason).toBe('threshold_met')
  })

  it('terminates with budget_exhausted even below min iterations (rule 12)', async () => {
    const mock = makeGateway(0.1) // 5 generation calls × 0.1 = 0.5 ≥ cap
    const stage = createLinkedInCrossCritiqueStage({
      gateway: mock.gateway,
      judge: makeJudge([40], mock.gateway),
      minIterations: 2,
      maxIterations: 4,
      maxBudgetUSD: 0.5,
    })
    const result = await runCrossCritiqueLoop({ stage, context: CONTEXT })
    expect(result.finalState.loopCount).toBe(1) // min=2 not met, yet we stop
    expect(result.terminationReason).toBe('budget_exhausted')
    expect(result.totalCostUSD).toBeGreaterThanOrEqual(0.5)
  })

  it('tracks the best integrated artifact across iterations (not the last)', async () => {
    const mock = makeGateway(0)
    const stage = createLinkedInCrossCritiqueStage({
      gateway: mock.gateway,
      judge: makeJudge([70, 85, 60], mock.gateway),
      minIterations: 1,
      maxIterations: 3,
      threshold: 99, // never met → runs to max
    })
    const result = await runCrossCritiqueLoop({ stage, context: CONTEXT })
    expect(result.iterations).toHaveLength(3)
    expect(result.bestScore).toBe(85)
    expect(result.terminationReason).toBe('max_iterations')
  })
})
