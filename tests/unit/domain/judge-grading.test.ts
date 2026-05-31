import { describe, it, expect } from 'vitest'
import type { ModelGateway } from '../../../src/lib/core/models/gateway'
import type { GatewayResponse } from '../../../src/lib/core/models/types'
import {
  LINKEDIN_POST_RUBRIC,
  validateLinkedInRubric,
} from '../../../src/lib/domain/workflows/creator/rubrics/linkedin-post-rubric'
import {
  LONG_FORM_ARTICLE_RUBRIC,
  validateArticleRubric,
} from '../../../src/lib/domain/workflows/creator/rubrics/article-rubric'
import {
  buildGeminiTextJudgeSystemPrompt,
  DEFAULT_JUDGE_MODEL,
} from '../../../src/lib/domain/workflows/creator/agents/gemini-text-judge'
import { createLinkedInJudge } from '../../../src/lib/domain/workflows/creator/agents/linkedin/judge'
import { createArticleJudge } from '../../../src/lib/domain/workflows/creator/agents/article/judge'
import {
  assertCrossModel,
  createLinkedInStage,
  createArticleStage,
} from '../../../src/lib/domain/workflows/creator/single-producer-stage'
import type {
  ArticleArtifact,
  LinkedInArtifact,
  RepurposeCostEvent,
} from '../../../src/lib/domain/workflows/creator/types'

// ─── Fake gateway ──────────────────────────────────────────────────────────────
// The judge only calls gateway.request(); the rest of ModelGateway is unused.

function fakeGateway(
  content: string,
  opts: { success?: boolean; error?: string; costUsd?: number } = {}
): ModelGateway {
  const response: GatewayResponse = {
    success: opts.success ?? true,
    modelId: DEFAULT_JUDGE_MODEL,
    providerId: 'google-gemini',
    capability: 'text-scoring',
    result: opts.success === false ? {} : { content },
    cost: { costUsd: opts.costUsd ?? 0.01, tokensIn: 1200, tokensOut: 300, durationMs: 12, unit: '1k-tokens-in' },
    ...(opts.error ? { error: opts.error } : {}),
    metadata: {},
  }
  return { request: async () => response } as unknown as ModelGateway
}

const LINKEDIN_ARTIFACT: LinkedInArtifact = {
  text: 'A counter-intuitive claim.\n\nThe machinery, then the tradeoff.\n\nSo which loop are you running?',
  charCount: 96,
}
const ARTICLE_ARTIFACT: ArticleArtifact = {
  title: 'Why Sequential Cross-Critique Wins',
  markdown: '# Title\n\nIntro.\n\n## Body\ntext\n\n## Conclusion\nend',
  wordCount: 1400,
}

// dimensionScores with varied scores so the composite formula is exercised.
const LINKEDIN_JUDGE_JSON = JSON.stringify({
  reasoning: 'The hook is specific; the close is single.',
  dimensionScores: [
    { dimensionId: 'personaFit', score: 8, feedback: 'on-voice; uses the POV thesis' },
    { dimensionId: 'audienceFit', score: 7, feedback: 'right level for builders' },
    { dimensionId: 'platformFit', score: 9, feedback: 'clean breaks, feed-native' },
    { dimensionId: 'hookStrength', score: 8, feedback: 'first line is a specific claim' },
    { dimensionId: 'structuralQuality', score: 7, feedback: 'one through-line, single close' },
    { dimensionId: 'completeness', score: 8, feedback: 'in band, hook + breaks present' },
  ],
  recommendation: 'Strong; minor audience tightening.',
  improvementPriorities: ['sharpen audience framing'],
})

// ─── Rubric authoring rules (rubrics.md) ────────────────────────────────────────

describe('LINKEDIN_POST_RUBRIC + LONG_FORM_ARTICLE_RUBRIC', () => {
  it('LinkedIn rubric: 6 dims, weights sum to 1.0, completeness ≥ 0.20', () => {
    expect(LINKEDIN_POST_RUBRIC.dimensions).toHaveLength(6)
    const sum = LINKEDIN_POST_RUBRIC.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(0.001)
    expect(validateLinkedInRubric().valid).toBe(true)
    const completeness = LINKEDIN_POST_RUBRIC.dimensions.find((d) => d.id === 'completeness')
    expect(completeness?.weight).toBeGreaterThanOrEqual(0.2)
  })

  it('Article rubric: 6 dims, weights sum to 1.0, completeness ≥ 0.20', () => {
    expect(LONG_FORM_ARTICLE_RUBRIC.dimensions).toHaveLength(6)
    const sum = LONG_FORM_ARTICLE_RUBRIC.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(0.001)
    expect(validateArticleRubric().valid).toBe(true)
  })

  it('both rubrics set threshold 80 (Gate B bar)', () => {
    expect(LINKEDIN_POST_RUBRIC.passThreshold).toBe(80)
    expect(LONG_FORM_ARTICLE_RUBRIC.passThreshold).toBe(80)
  })
})

// ─── Reasoning-first judge prompt (rubrics.md Rule 3) ───────────────────────────

describe('buildGeminiTextJudgeSystemPrompt', () => {
  const spec = {
    callerTag: 'linkedin-judge',
    serialize: (a: unknown) => String(a),
    artifactNoun: 'LinkedIn post',
  }

  it('forces reasoning before scoring', () => {
    const prompt = buildGeminiTextJudgeSystemPrompt(LINKEDIN_POST_RUBRIC, spec)
    expect(prompt).toMatch(/reasoning BEFORE any scores/i)
    expect(prompt.toLowerCase()).toContain('reasoning first')
  })

  it('includes every rubric dimension id and the JSON output contract', () => {
    const prompt = buildGeminiTextJudgeSystemPrompt(LINKEDIN_POST_RUBRIC, spec)
    for (const d of LINKEDIN_POST_RUBRIC.dimensions) expect(prompt).toContain(d.id)
    expect(prompt).toContain('"dimensionScores"')
  })

  it('renders the supplied persona context when present', () => {
    const prompt = buildGeminiTextJudgeSystemPrompt(LINKEDIN_POST_RUBRIC, spec, 'Voice: plain technical')
    expect(prompt).toContain('Voice: plain technical')
  })
})

// ─── Composite score computed by code (rubrics.md Rule 4) ───────────────────────

describe('createLinkedInJudge (gateway-routed Gemini)', () => {
  it('computes composite = Σ(score · weight · 10) from the LLM dimension scores', async () => {
    const judge = createLinkedInJudge({ gateway: fakeGateway(LINKEDIN_JUDGE_JSON) })
    const grade = await judge(LINKEDIN_ARTIFACT, LINKEDIN_POST_RUBRIC)
    // 10·(8·.18 + 7·.16 + 9·.16 + 8·.15 + 7·.15 + 8·.20) = 78.5
    expect(grade.overallScore).toBe(78.5)
    expect(grade.dimensionScores).toHaveLength(6)
    expect(grade.passesThreshold).toBe(false) // 78.5 < 80
    expect(grade.recommendation).toMatch(/Strong/)
    expect(grade.improvementPriorities).toContain('sharpen audience framing')
  })

  it('emits the gateway-reported cost as a judge cost event', async () => {
    const events: RepurposeCostEvent[] = []
    const judge = createLinkedInJudge({
      gateway: fakeGateway(LINKEDIN_JUDGE_JSON, { costUsd: 0.0042 }),
      onCost: (e) => events.push(e),
    })
    await judge(LINKEDIN_ARTIFACT, LINKEDIN_POST_RUBRIC)
    expect(events).toHaveLength(1)
    expect(events[0].source).toBe('judge')
    expect(events[0].costUSD).toBeCloseTo(0.0042, 6)
  })

  it('defaults a missing dimension score to 4', async () => {
    const partial = JSON.stringify({
      reasoning: 'partial',
      dimensionScores: [{ dimensionId: 'personaFit', score: 9, feedback: 'great voice' }],
    })
    const judge = createLinkedInJudge({ gateway: fakeGateway(partial) })
    const grade = await judge(LINKEDIN_ARTIFACT, LINKEDIN_POST_RUBRIC)
    expect(grade.dimensionScores.find((d) => d.dimensionId === 'personaFit')?.score).toBe(9)
    const audience = grade.dimensionScores.find((d) => d.dimensionId === 'audienceFit')
    expect(audience?.score).toBe(4)
  })

  it('returns a synthetic failing grade (score 4) on gateway failure', async () => {
    const judge = createLinkedInJudge({
      gateway: fakeGateway('', { success: false, error: 'provider down' }),
    })
    const grade = await judge(LINKEDIN_ARTIFACT, LINKEDIN_POST_RUBRIC)
    expect(grade.overallScore).toBe(40) // every dim = 4 → 10·4·1.0
    expect(grade.passesThreshold).toBe(false)
    expect(grade.recommendation).toMatch(/provider down/)
  })

  it('returns a synthetic failing grade on unparseable judge output', async () => {
    const judge = createLinkedInJudge({ gateway: fakeGateway('not json at all') })
    const grade = await judge(LINKEDIN_ARTIFACT, LINKEDIN_POST_RUBRIC)
    expect(grade.overallScore).toBe(40)
    expect(grade.recommendation).toMatch(/unparseable/)
  })
})

describe('createArticleJudge (gateway-routed Gemini)', () => {
  it('grades an article against the article rubric', async () => {
    const json = JSON.stringify({
      reasoning: 'Solid arc.',
      dimensionScores: LONG_FORM_ARTICLE_RUBRIC.dimensions.map((d) => ({
        dimensionId: d.id,
        score: 8,
        feedback: 'good',
      })),
    })
    const judge = createArticleJudge({ gateway: fakeGateway(json) })
    const grade = await judge(ARTICLE_ARTIFACT, LONG_FORM_ARTICLE_RUBRIC)
    expect(grade.overallScore).toBe(80) // 8 across all dims → 10·8·1.0
    expect(grade.passesThreshold).toBe(true) // 80 ≥ 80, all dims ≥ pass bar
  })
})

// ─── Producer ≠ Judge enforcement (loop rule 7 / Pattern-5 rule 10) ─────────────

describe('assertCrossModel', () => {
  it('throws when producer and judge share a model family', () => {
    expect(() => assertCrossModel('claude-sonnet-4-20250514', 'claude-haiku-4-5')).toThrow(
      /different model families/
    )
  })

  it('passes when producer (Claude) and judge (Gemini) differ', () => {
    expect(() => assertCrossModel('claude-sonnet-4-20250514', 'gemini-2.5-pro')).not.toThrow()
  })

  it('createLinkedInStage throws if the judge model collides with the Claude producer', () => {
    expect(() => createLinkedInStage({ judgeModelId: 'claude-sonnet-4-20250514' })).toThrow(
      /different model families/
    )
  })

  it('createArticleStage builds with a Gemini judge by default (no overlap)', () => {
    // Inject a stub producer so the build needs no ANTHROPIC_API_KEY; the point
    // is that the Gemini judge does not collide with the Claude producer family.
    const stub = {
      async produce(): Promise<ArticleArtifact> {
        return { title: '', markdown: '', wordCount: 0 }
      },
    }
    expect(() =>
      createArticleStage({ producer: stub, judgeModelId: 'gemini-2.5-flash' })
    ).not.toThrow()
  })
})
