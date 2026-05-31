import { describe, it, expect } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import type OpenAI from 'openai'
import type {
  GradeReport,
  JudgeFunction,
} from '../../../src/lib/core/engine/types'
import {
  LONG_FORM_MASTER_RUBRIC,
  validateLongFormMasterRubric,
} from '../../../src/lib/domain/workflows/creator/rubrics/long-form-master-rubric'
import {
  validateMaster,
  masterWordCount,
  MIN_SECTIONS,
  MIN_WORDS,
} from '../../../src/lib/domain/workflows/creator/validators/long-form-master-validator'
import { createMasterJudge } from '../../../src/lib/domain/workflows/creator/agents/long-form-master-judge'
import {
  createMasterStage,
  runMasterLoop,
  buildMasterPersistence,
} from '../../../src/lib/domain/workflows/creator/long-form-master-stage'
import type { LongFormSynthesizer } from '../../../src/lib/domain/workflows/creator/agents/long-form-synthesizer'
import type {
  MasterArtifact,
  MasterContext,
  MasterSourceInput,
} from '../../../src/lib/domain/workflows/creator/types'

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeSources(n: number): MasterSourceInput[] {
  return Array.from({ length: n }, (_, i) => ({
    researchSourceId: `rs-${i + 1}`,
    url: `https://example.com/${i + 1}`,
    title: `Source ${i + 1}`,
    snippet: `Excerpt ${i + 1}`,
  }))
}

const LONG_BODY = Array.from({ length: 300 }, () => 'insight').join(' ')
const SOURCES = makeSources(3)

function makeMaster(
  sectionCount: number,
  sources: MasterSourceInput[],
  body: string = LONG_BODY
): MasterArtifact {
  return {
    title: 'Master Title',
    sources,
    sections: Array.from({ length: sectionCount }, (_, i) => ({
      order: i + 1,
      heading: `Heading ${i + 1}`,
      contentMarkdown: body,
      sourceRefs: [
        { researchSourceId: sources[0].researchSourceId, relevanceSnippet: 'why it matters' },
      ],
    })),
  }
}

const CONTEXT: MasterContext = {
  longFormMasterId: 'lfm-1',
  ideaTitle: 'Why cross-critique beats tournament',
  ideaDescription: 'A thesis about content-generation loops.',
  niches: ['agentic AI'],
  persona: {
    name: 'BuildOS Creator',
    voiceSummary: 'Conversational-expert, plain technical.',
    pointOfView: 'Show the machinery, name the tradeoffs.',
    audienceSummary: 'AI builders who ship',
    doNotSay: ['unleash', 'game-changer'],
  },
  sources: SOURCES,
}

function passingJudge(overall = 85): JudgeFunction {
  return async (_artifact, rubric): Promise<GradeReport> => ({
    overallScore: overall,
    passesThreshold: true,
    dimensionScores: rubric.dimensions.map((d) => ({
      dimensionId: d.id,
      name: d.name,
      score: 9,
      weight: d.weight,
      feedback: 'ok',
    })),
    recommendation: 'pass',
    improvementPriorities: [],
  })
}

// ─── Validator ───────────────────────────────────────────────────────────────

describe('validateMaster', () => {
  it(`rejects fewer than ${MIN_SECTIONS} sections (sectionless output)`, () => {
    const result = validateMaster(makeMaster(2, SOURCES))
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('too_few_sections')
  })

  it('rejects a master with zero sections', () => {
    const empty: MasterArtifact = { title: 't', sections: [], sources: SOURCES }
    const result = validateMaster(empty)
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('too_few_sections')
  })

  it('accepts 3 well-formed, traced, long-enough sections', () => {
    expect(validateMaster(makeMaster(3, SOURCES)).valid).toBe(true)
  })

  it('rejects a section without any SourceRef', () => {
    const m = makeMaster(3, SOURCES)
    m.sections[0].sourceRefs = []
    const result = validateMaster(m)
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('untraced_section')
  })

  it('rejects a section missing heading or content', () => {
    const m = makeMaster(3, SOURCES)
    m.sections[0].heading = '   '
    m.sections[1].contentMarkdown = ''
    const codes = validateMaster(m).errors.map((e) => e.code)
    expect(codes).toContain('missing_heading')
    expect(codes).toContain('missing_content')
  })

  it('rejects a SourceRef that does not resolve to a dossier source', () => {
    const m = makeMaster(3, SOURCES)
    m.sections[0].sourceRefs = [{ researchSourceId: 'not-in-dossier', relevanceSnippet: 'x' }]
    const result = validateMaster(m)
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('unresolved_source_ref')
  })

  it(`rejects a master under ${MIN_WORDS} words`, () => {
    const result = validateMaster(makeMaster(3, SOURCES, 'short body here'))
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('too_short')
  })
})

describe('masterWordCount', () => {
  it('counts words across headings + bodies', () => {
    expect(masterWordCount(makeMaster(3, SOURCES))).toBeGreaterThanOrEqual(MIN_WORDS)
  })
})

// ─── Rubric ─────────────────────────────────────────────────────────────────

describe('LONG_FORM_MASTER_RUBRIC', () => {
  it('has weights summing to 1.0', () => {
    const sum = LONG_FORM_MASTER_RUBRIC.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(0.001)
  })

  it('has 5 dimensions and a completeness dimension ≥ 0.20 weight', () => {
    expect(LONG_FORM_MASTER_RUBRIC.dimensions).toHaveLength(5)
    const completeness = LONG_FORM_MASTER_RUBRIC.dimensions.find((d) => d.id === 'completeness')
    expect(completeness?.weight).toBeGreaterThanOrEqual(0.2)
  })

  it('passes its own structural validator; threshold is 80 (Gate A bar)', () => {
    expect(validateLongFormMasterRubric().valid).toBe(true)
    expect(LONG_FORM_MASTER_RUBRIC.passThreshold).toBe(80)
  })
})

// ─── Persistence mapping ──────────────────────────────────────────────────────

describe('buildMasterPersistence', () => {
  it('maps a MasterArtifact to ordered sections with their SourceRefs', () => {
    const payload = buildMasterPersistence(makeMaster(3, SOURCES))
    expect(payload.title).toBe('Master Title')
    expect(payload.status).toBe('gate_a_pending')
    expect(payload.sections).toHaveLength(3)
    expect(payload.sections.map((s) => s.order)).toEqual([1, 2, 3])
  })

  it('wires each SourceRef with its researchSourceId + relevanceSnippet', () => {
    const master = makeMaster(2, SOURCES)
    master.sections[1].sourceRefs = [
      { researchSourceId: 'rs-2', relevanceSnippet: 'second source matters here' },
    ]
    const payload = buildMasterPersistence(master)
    expect(payload.sections[0].sourceRefs[0]).toEqual({
      researchSourceId: 'rs-1',
      relevanceSnippet: 'why it matters',
    })
    expect(payload.sections[1].sourceRefs[0]).toEqual({
      researchSourceId: 'rs-2',
      relevanceSnippet: 'second source matters here',
    })
  })
})

// ─── Stage loop (mocked) ──────────────────────────────────────────────────────

describe('createMasterStage + runMasterLoop', () => {
  it('one iteration produces a graded master (mocked synthesizer + judge)', async () => {
    const fixed = makeMaster(3, SOURCES)
    const mockAgent: LongFormSynthesizer = {
      async produce() {
        return fixed
      },
      async revise() {
        return fixed
      },
    }
    const stage = createMasterStage({
      agent: mockAgent,
      judge: passingJudge(85),
      minIterations: 1,
      maxIterations: 1,
    })
    const result = await runMasterLoop({ stage, context: CONTEXT })

    expect(result.bestArtifact).not.toBeNull()
    expect(result.bestArtifact?.sections).toHaveLength(3)
    expect(result.bestScore).toBe(85)
    expect(result.finalState.status).toBe('presenting')
  })

  it('tracks cost per iteration (one synthesizer call each)', async () => {
    const masterJson = {
      title: 'Synthesized Master',
      sections: Array.from({ length: 3 }, (_, i) => ({
        heading: `H${i + 1}`,
        contentMarkdown: LONG_BODY,
        sourceRefs: [{ sourceId: 'S1', relevanceSnippet: 'finding' }],
      })),
    }
    // claude-sonnet pricing: (1000/1e6)*3 + (800/1e6)*15 = 0.015 per call.
    const fakeAnthropic = {
      messages: {
        create: async () => ({
          content: [{ type: 'text', text: JSON.stringify(masterJson) }],
          usage: { input_tokens: 1000, output_tokens: 800 },
        }),
      },
    } as unknown as Anthropic

    const stage = createMasterStage({
      client: fakeAnthropic,
      judge: passingJudge(85),
      minIterations: 2,
      maxIterations: 3,
    })
    const result = await runMasterLoop({ stage, context: CONTEXT })

    // minIterations=2 forces a produce + a revise → two synthesizer calls.
    expect(result.iterations.length).toBeGreaterThanOrEqual(2)
    expect(result.bestArtifact?.sections).toHaveLength(3)
    // Each section's S1 handle resolved to the first dossier source id.
    expect(result.bestArtifact?.sections[0].sourceRefs[0].researchSourceId).toBe('rs-1')
    expect(stage.getTotalCostUSD()).toBeCloseTo(0.015 * result.iterations.length, 5)
  })
})

// ─── Judge scale (rubrics.md Rule 4: 1–10 dims → 0–100 composite) ─────────────

function fakeOpenAI(dimScores: Record<string, number>): Pick<OpenAI, 'chat'> {
  const body = {
    reasoning: 'r',
    dimensionScores: LONG_FORM_MASTER_RUBRIC.dimensions.map((d) => ({
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

describe('createMasterJudge composite scoring', () => {
  it('computes a 0–100 composite (Σ score·weight·10) and passes at ≥80', async () => {
    const allEights: Record<string, number> = {
      comprehensiveness: 8,
      accuracy: 8,
      personaAlignment: 8,
      traceabilityCompleteness: 8,
      completeness: 8,
    }
    const judge = createMasterJudge({ client: fakeOpenAI(allEights) })
    const grade = await judge(makeMaster(3, SOURCES), LONG_FORM_MASTER_RUBRIC)
    expect(grade.overallScore).toBe(80)
    expect(grade.passesThreshold).toBe(true)
  })

  it('fails the gate when a dimension is below its pass bar despite a high composite', async () => {
    // comprehensiveness=7 (bar 8), the rest 9 → composite (7+9+9+9+9)·0.2·10 = 86,
    // above the 80 threshold, but comprehensiveness 7 < 8 so the gate must fail.
    const judge = createMasterJudge({
      client: fakeOpenAI({
        comprehensiveness: 7,
        accuracy: 9,
        personaAlignment: 9,
        traceabilityCompleteness: 9,
        completeness: 9,
      }),
    })
    const grade = await judge(makeMaster(3, SOURCES), LONG_FORM_MASTER_RUBRIC)
    expect(grade.overallScore).toBe(86)
    expect(grade.passesThreshold).toBe(false)
  })
})
