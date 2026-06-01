// CR-7 — Long-Form Article Cross-Critique (Pattern 5) wiring tests.
// Mocked ModelGateway + injected JudgeFunction drive the domain stage (no keys).

import { describe, it, expect, vi } from 'vitest'
import type { ModelGateway } from '../../../src/lib/core/models/gateway'
import type { GatewayRequest, GatewayResponse } from '../../../src/lib/core/models/types'
import type { GradeReport, JudgeFunction } from '../../../src/lib/core/engine/types'
import { assertCrossCritiqueModels } from '../../../src/lib/core/engine/cross-critique'
import {
  createArticleCrossCritiqueStage,
  runCrossCritiqueLoop,
  ARTICLE_CROSS_CRITIQUE_CONFIG,
  catalogModelFamily,
} from '../../../src/lib/domain/workflows/creator/cross-critique-stage'
import {
  ARTICLE_PRODUCER_SYSTEM_PROMPT,
  parseArticleArtifact,
} from '../../../src/lib/domain/workflows/creator/agents/article/producer-gpt'
import { ARTICLE_INTEGRATOR_SYSTEM_PROMPT } from '../../../src/lib/domain/workflows/creator/agents/article/integrator'
import { LONG_FORM_ARTICLE_RUBRIC } from '../../../src/lib/domain/workflows/creator/rubrics/article-rubric'
import { articleWordCount } from '../../../src/lib/domain/workflows/creator/validators/article-validator'
import type { RepurposeContext } from '../../../src/lib/domain/workflows/creator/types'

const SENT =
  'Sequential cross critique synthesizes strengths across producers while tournament selection discards the losers entirely. '
function words(n: number): string {
  return SENT.repeat(n)
}
const VALID_ARTICLE_MD = [
  '# Why Sequential Cross-Critique Wins',
  '',
  'This intro runs well over twenty-five words because it must clear the intro gate and frame the central tension before any heading appears, explaining plainly why the loop choice matters for builders shipping real systems today.',
  '',
  '## The Architecture Gap',
  words(45),
  '',
  '## How It Works',
  words(45),
  '',
  '## The Takeaway',
  `${words(4)} The upshot is clear.`,
].join('\n')

const CONTEXT: RepurposeContext = {
  longFormMasterId: 'lfm-1',
  artifactType: 'long_form_article',
  masterTitle: 'Why Sequential Cross-Critique Beats Tournament',
  ideaTitle: 'Why sequential cross-critique beats tournament for content generation',
  niches: ['agentic AI'],
  persona: {
    name: 'BuildOS Creator',
    voiceSummary: 'Conversational-expert, plain technical.',
    pointOfView: 'Show the machinery, name the tradeoffs.',
    audienceSummary: 'AI builders who ship',
    signaturePhrases: ['show you the machinery'],
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
    dimensionScores: LONG_FORM_ARTICLE_RUBRIC.dimensions.map((d) => ({
      dimensionId: d.id,
      name: d.name,
      score: score / 10,
      weight: d.weight,
      feedback: `${d.name} note`,
    })),
    recommendation: 'test',
    improvementPriorities: [],
  }
}

function artifactResponse(modelId: string, costUsd: number): GatewayResponse {
  return {
    success: true,
    modelId,
    providerId: 'test',
    capability: 'text-generation',
    result: {
      content: JSON.stringify({ title: 'Why Sequential Cross-Critique Wins', markdown: VALID_ARTICLE_MD }),
    },
    cost: { costUsd, durationMs: 1, unit: '1k-tokens-in' },
    metadata: {},
  }
}

function makeGateway(genCost: number): { gateway: ModelGateway; underlying: () => number } {
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

describe('ARTICLE_CROSS_CRITIQUE_CONFIG', () => {
  it('is the V1 shape and passes the rule-10 family guard', () => {
    const cfg = ARTICLE_CROSS_CRITIQUE_CONFIG
    expect(cfg.producers.map((p) => p.model.primary)).toEqual(['claude-sonnet-4-20250514', 'gpt-4o'])
    expect(cfg.integratorAgent.model.primary).toBe('claude-sonnet-4-20250514')
    expect(cfg.judgeAgent.model.primary).toBe('gemini-2.5-pro')
    expect(cfg.criticAssignments['article-critic-claude-on-gpt']).toBe('article-producer-gpt')
    expect(cfg.criticAssignments['article-critic-gpt-on-claude']).toBe('article-producer-claude')
    expect(() => assertCrossCritiqueModels(cfg, catalogModelFamily)).not.toThrow()
  })
})

describe('Pattern-5 rule 11 — article producer/integrator carry no rubric text', () => {
  const rubricStrings = [
    LONG_FORM_ARTICLE_RUBRIC.name,
    ...LONG_FORM_ARTICLE_RUBRIC.dimensions.flatMap((d) => Object.values(d.criteria)),
  ]
  it('producer + integrator system prompts contain no rubric name or criteria text', () => {
    for (const s of rubricStrings) {
      expect(ARTICLE_PRODUCER_SYSTEM_PROMPT).not.toContain(s)
      expect(ARTICLE_INTEGRATOR_SYSTEM_PROMPT).not.toContain(s)
    }
  })
})

describe('parseArticleArtifact', () => {
  it('parses {title, markdown} and recomputes wordCount', () => {
    const a = parseArticleArtifact(
      JSON.stringify({ title: 'T', markdown: VALID_ARTICLE_MD }),
      'fallback',
    )
    expect(a?.title).toBe('T')
    expect(a?.wordCount).toBe(articleWordCount(VALID_ARTICLE_MD))
  })

  it('derives the title from the H1 when omitted, and rejects empty markdown', () => {
    const a = parseArticleArtifact(JSON.stringify({ markdown: VALID_ARTICLE_MD }), 'fallback')
    expect(a?.title).toBe('Why Sequential Cross-Critique Wins')
    expect(parseArticleArtifact(JSON.stringify({ markdown: '' }), 'fallback')).toBeNull()
  })
})

describe('runCrossCritiqueLoop (article, mocked)', () => {
  it('runs a 6-call iteration and presents the integrated article on threshold', async () => {
    const mock = makeGateway(0.02)
    const stage = createArticleCrossCritiqueStage({
      gateway: mock.gateway,
      judge: makeJudge([88], mock.gateway),
      minIterations: 1,
      maxIterations: 1,
    })
    const result = await runCrossCritiqueLoop({ stage, context: CONTEXT })
    expect(mock.underlying()).toBe(6)
    expect(result.bestScore).toBe(88)
    expect(result.bestArtifact?.markdown).toBe(VALID_ARTICLE_MD)
    expect(result.terminationReason).toBe('threshold_met')
  })
})
