import { describe, it, expect } from 'vitest'
import type OpenAI from 'openai'
import type {
  GradeReport,
  JudgeFunction,
  RubricDefinition,
} from '../../../src/lib/core/engine/types'
import type {
  WebSearchRun,
  WebSearchRunner,
} from '../../../src/lib/core/agentic/adapters/web-search-adapter'
import {
  RESEARCH_RUBRIC,
  validateResearchRubric,
} from '../../../src/lib/domain/workflows/creator/rubrics/research-rubric'
import {
  validateDossier,
  isValidUrl,
  MIN_SOURCES,
} from '../../../src/lib/domain/workflows/creator/validators/research-validator'
import { dedupeSources } from '../../../src/lib/domain/workflows/creator/agents/source-curator'
import { createResearchJudge } from '../../../src/lib/domain/workflows/creator/agents/research-judge'
import {
  createResearchStage,
  runResearchLoop,
} from '../../../src/lib/domain/workflows/creator/research-stage'
import type {
  DossierSource,
  ResearchContext,
  ResearchDossier,
} from '../../../src/lib/domain/workflows/creator/types'
import type { SourceCurator as Curator } from '../../../src/lib/domain/workflows/creator/agents/source-curator'

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CONTEXT: ResearchContext = {
  ideaId: 'idea-1',
  ideaTitle: 'Why cross-critique beats tournament',
  ideaDescription: 'A thesis about content-generation loops.',
  niches: ['agentic AI'],
  audienceSummary: 'AI builders',
}

function makeSource(i: number): DossierSource {
  return {
    url: `https://example.com/article-${i}`,
    title: `Source ${i}`,
    snippet: `Excerpt ${i}`,
    type: 'web',
    pageAge: null,
  }
}

function makeDossier(n: number): ResearchDossier {
  return {
    ideaId: 'idea-1',
    query: 'q',
    summary: 'A grounded synthesis.',
    sources: Array.from({ length: n }, (_, i) => makeSource(i + 1)),
    searchCount: n,
  }
}

function webSearchReturning(n: number, costUSD: number): WebSearchRunner {
  return async (): Promise<WebSearchRun> => ({
    text: 'A grounded synthesis.',
    sources: Array.from({ length: n }, (_, i) => ({
      url: `https://example.com/article-${i + 1}`,
      title: `Source ${i + 1}`,
      pageAge: null,
      snippet: `Excerpt ${i + 1}`,
    })),
    searchCount: 3,
    tokensIn: 1000,
    tokensOut: 500,
    costUSD,
    modelUsed: 'claude-sonnet-4-20250514',
  })
}

// Passthrough curator — keeps sources as produced so the stage logic is the
// only thing under test.
const passthroughCurator: Curator = {
  async curate(dossier: ResearchDossier): Promise<ResearchDossier> {
    return dossier
  },
}

function passingJudge(overall = 80): JudgeFunction {
  return async (_artifact, rubric): Promise<GradeReport> => ({
    overallScore: overall,
    passesThreshold: true,
    dimensionScores: rubric.dimensions.map((d) => ({
      dimensionId: d.id,
      name: d.name,
      score: 8,
      weight: d.weight,
      feedback: 'ok',
    })),
    recommendation: 'pass',
    improvementPriorities: [],
  })
}

// ─── Validator ───────────────────────────────────────────────────────────────

describe('validateDossier', () => {
  it(`rejects fewer than ${MIN_SOURCES} sources`, () => {
    const result = validateDossier(makeDossier(2))
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('too_few_sources')
  })

  it('accepts exactly the minimum with valid URLs', () => {
    expect(validateDossier(makeDossier(3)).valid).toBe(true)
  })

  it('rejects malformed URLs', () => {
    const d = makeDossier(3)
    d.sources[0].url = 'not a url'
    const result = validateDossier(d)
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('invalid_url')
  })
})

describe('isValidUrl', () => {
  it('accepts http(s) and rejects everything else', () => {
    expect(isValidUrl('https://a.com')).toBe(true)
    expect(isValidUrl('http://a.com/x?y=1')).toBe(true)
    expect(isValidUrl('ftp://a.com')).toBe(false)
    expect(isValidUrl('a.com')).toBe(false)
    expect(isValidUrl('')).toBe(false)
  })
})

// ─── Rubric ─────────────────────────────────────────────────────────────────

describe('RESEARCH_RUBRIC', () => {
  it('has weights summing to 1.0', () => {
    const sum = RESEARCH_RUBRIC.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(0.001)
  })

  it('has 5 dimensions and a completeness dimension ≥ 0.20 weight', () => {
    expect(RESEARCH_RUBRIC.dimensions).toHaveLength(5)
    const completeness = RESEARCH_RUBRIC.dimensions.find((d) => d.id === 'completeness')
    expect(completeness?.weight).toBeGreaterThanOrEqual(0.2)
  })

  it('passes its own structural validator; threshold is 75', () => {
    expect(validateResearchRubric().valid).toBe(true)
    expect(RESEARCH_RUBRIC.passThreshold).toBe(75)
  })
})

// ─── Curator dedupe ──────────────────────────────────────────────────────────

describe('dedupeSources', () => {
  it('de-duplicates by normalized URL (trailing slash, host case)', () => {
    const sources: DossierSource[] = [
      { url: 'https://A.com/x', title: '1', snippet: '', type: 'web' },
      { url: 'https://a.com/x/', title: '2', snippet: '', type: 'web' },
      { url: 'https://a.com/y', title: '3', snippet: '', type: 'web' },
    ]
    expect(dedupeSources(sources)).toHaveLength(2)
  })
})

// ─── Stage loop (mocked) ──────────────────────────────────────────────────────

describe('createResearchStage + runResearchLoop', () => {
  it('one iteration produces a curated dossier (mocked web search + judge)', async () => {
    const stage = createResearchStage({
      webSearch: webSearchReturning(10, 0.05),
      curator: passthroughCurator,
      judge: passingJudge(80),
      minIterations: 1,
      maxIterations: 1,
    })
    const result = await runResearchLoop({ stage, context: CONTEXT })

    expect(result.bestArtifact).not.toBeNull()
    expect(result.bestArtifact?.sources).toHaveLength(10)
    expect(result.bestScore).toBe(80)
    expect(result.finalState.status).toBe('presenting')
  })

  it('tracks cost per iteration (one web-search call each)', async () => {
    const stage = createResearchStage({
      webSearch: webSearchReturning(10, 0.05),
      curator: passthroughCurator,
      judge: passingJudge(80),
      minIterations: 2,
      maxIterations: 3,
    })
    const result = await runResearchLoop({ stage, context: CONTEXT })

    // minIterations=2 forces a produce + a revise → two web-search calls.
    expect(result.iterations.length).toBeGreaterThanOrEqual(2)
    expect(stage.getTotalCostUSD()).toBeCloseTo(0.05 * result.iterations.length, 5)
  })
})

// ─── Judge scale (rubrics.md Rule 4: 1–10 dims → 0–100 composite) ─────────────

function fakeOpenAI(dimScores: Record<string, number>): Pick<OpenAI, 'chat'> {
  const body = {
    reasoning: 'r',
    dimensionScores: RESEARCH_RUBRIC.dimensions.map((d) => ({
      dimensionId: d.id,
      score: dimScores[d.id],
      feedback: 'f',
    })),
    recommendation: 'ok',
    improvementPriorities: [],
  }
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify(body) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      },
    },
  } as unknown as Pick<OpenAI, 'chat'>
}

describe('createResearchJudge composite scoring', () => {
  const allEights: Record<string, number> = {
    relevance: 8,
    coverage: 8,
    sourceQuality: 8,
    factualGrounding: 8,
    completeness: 8,
  }

  it('computes a 0–100 composite (Σ score·weight·10) and passes at ≥75', async () => {
    const judge = createResearchJudge({ client: fakeOpenAI(allEights) })
    const grade = await judge(makeDossier(8), RESEARCH_RUBRIC)
    expect(grade.overallScore).toBe(80)
    expect(grade.passesThreshold).toBe(true)
  })

  it('fails the gate when a single dimension is below its pass bar', async () => {
    // 9,9,9,9,6 → composite (9·0.2·4 + 6·0.2)·10 = 84, above the 75 threshold,
    // but completeness (6) < its pass bar (7), so the gate must still fail.
    const judge = createResearchJudge({
      client: fakeOpenAI({
        relevance: 9,
        coverage: 9,
        sourceQuality: 9,
        factualGrounding: 9,
        completeness: 6,
      }),
    })
    const grade = await judge(makeDossier(8), RESEARCH_RUBRIC)
    expect(grade.overallScore).toBe(84)
    expect(grade.passesThreshold).toBe(false)
  })
})
