import { describe, it, expect, vi } from 'vitest'
import type {
  GradeReport,
  JudgeFunction,
  RubricDefinition,
} from '../../engine/types'
import type { Artifact, ProducerAdapter } from '../adapters/types'
import { TEXT_RUBRIC } from '../rubrics/text-rubric'
import {
  createTextGenerationStage,
  type TextStageContext,
} from './text-generation-stage'
import { runTextLoop } from './run-text-loop'

// ─── Helpers ──────────────────────────────────────────────────────────────

function fakeArtifact(version: number, content: string): Artifact<string> {
  return {
    id: `art_${version}`,
    version,
    kind: 'text',
    content,
    createdAt: new Date(),
    modelUsed: 'claude-mock',
    tokensIn: 200,
    tokensOut: 400,
    costUSD: 0.005,
  }
}

function fakeGrade(score: number, rubric: RubricDefinition = TEXT_RUBRIC): GradeReport {
  return {
    overallScore: score,
    passesThreshold: score >= rubric.passThreshold,
    dimensionScores: rubric.dimensions.map((d) => ({
      dimensionId: d.id,
      name: d.name,
      score,
      weight: d.weight,
      feedback: `scored ${score}`,
    })),
    recommendation: 'ok',
    improvementPriorities: [],
  }
}

// A body that passes every validator (>=200 words, ends with '.', no placeholders).
const LONG_BODY =
  ('Solar panels turn sunlight into electricity using the photovoltaic effect. ' +
    'Photons strike silicon and knock electrons loose, creating a current that flows through an external circuit. ')
    .repeat(25) + 'Done.'

// ─── Mock integration tests ──────────────────────────────────────────────

describe('createTextGenerationStage (mock)', () => {
  function setup() {
    const produced: { phase: string; version: number }[] = []
    const producer: ProducerAdapter<string> = {
      produce: vi.fn(async () => {
        produced.push({ phase: 'produce', version: 1 })
        return fakeArtifact(1, LONG_BODY + ' v1.')
      }),
      revise: vi.fn(async ({ previous, grade }) => {
        produced.push({ phase: 'revise', version: previous.version + 1 })
        // Return different text each revision so we can prove flow
        return fakeArtifact(
          previous.version + 1,
          LONG_BODY + ` v${previous.version + 1} (from grade ${grade.overallScore}).`
        )
      }),
    }

    // Scripted judge: v1=6.0, v2=7.0, v3=8.0 (crosses threshold)
    const judgeScores = [6.0, 7.0, 8.0, 8.5, 9.0]
    let judgeCall = 0
    const judge: JudgeFunction = vi.fn(async () => {
      const score = judgeScores[judgeCall] ?? 8.5
      judgeCall += 1
      return fakeGrade(score)
    })

    const costEvents: unknown[] = []
    const tg = createTextGenerationStage({
      producer,
      judge,
      threshold: 7.5,
      minIterations: 2,
      maxIterations: 5,
      onCost: (e) => costEvents.push(e),
    })
    return { tg, producer, judge, produced, costEvents }
  }

  it('runs at least minIterations (2) even if v1 passes, and tracks best', async () => {
    // First iteration scores 9 — but min=2 should force another.
    const producer: ProducerAdapter<string> = {
      produce: async () => fakeArtifact(1, LONG_BODY + ' A.'),
      revise: async ({ previous }) => fakeArtifact(previous.version + 1, LONG_BODY + ' B.'),
    }
    const scores = [9.0, 6.0]
    let i = 0
    const judge: JudgeFunction = async () => fakeGrade(scores[i++] ?? 6)
    const tg = createTextGenerationStage({
      producer,
      judge,
      threshold: 7.5,
      minIterations: 2,
      maxIterations: 5,
    })
    const ctx: TextStageContext = { goal: 'x', systemPrompt: 'y' }
    const result = await runTextLoop({ stage: tg, context: ctx })
    expect(result.iterations.length).toBeGreaterThanOrEqual(2)
    expect(result.bestScore).toBe(9.0)
    expect(result.bestArtifact).toContain(' A.')
  })

  it('wires producer → judge and passes prior grade into revise (PRESERVE/IMPROVE flow)', async () => {
    const { tg, producer } = setup()
    const ctx: TextStageContext = { goal: 'explain solar', systemPrompt: 'be pedagogical' }
    await runTextLoop({ stage: tg, context: ctx })

    // Revise must receive a grade with dimensionScores — that's how PRESERVE/IMPROVE flows.
    const revise = producer.revise as ReturnType<typeof vi.fn>
    expect(revise).toHaveBeenCalled()
    const firstReviseCall = revise.mock.calls[0][0]
    expect(firstReviseCall.grade.dimensionScores.length).toBeGreaterThan(0)
    expect(firstReviseCall.goal).toBe('explain solar')
  })

  it('accumulates cost across producer + judge', async () => {
    const { tg, costEvents } = setup()
    await runTextLoop({
      stage: tg,
      context: { goal: 'g', systemPrompt: 's' },
    })
    expect(costEvents.length).toBeGreaterThan(0)
    expect(tg.getTotalCostUSD()).toBeGreaterThan(0)
    const sources = new Set(costEvents.map((e) => (e as { source: string }).source))
    expect(sources.has('producer')).toBe(true)
  })

  it('terminates at presenting once threshold + min iterations met', async () => {
    const { tg } = setup()
    const result = await runTextLoop({
      stage: tg,
      context: { goal: 'g', systemPrompt: 's' },
    })
    expect(result.finalState.status).toBe('presenting')
    // v1=6, v2=7, v3=8 → stops at v3 (≥7.5, min=2 already met).
    expect(result.iterations).toHaveLength(3)
    expect(result.bestScore).toBeGreaterThanOrEqual(7.5)
  })

  it('validator runs before judge: truncated output skips judging', async () => {
    let produceCall = 0
    const producer: ProducerAdapter<string> = {
      produce: async () => {
        produceCall += 1
        return produceCall === 1
          ? fakeArtifact(1, 'too short.')
          : fakeArtifact(1, LONG_BODY + ' recovered.')
      },
      revise: async ({ previous }) =>
        fakeArtifact(previous.version + 1, LONG_BODY + ' revised.'),
    }
    const judge: JudgeFunction = vi.fn(async () => fakeGrade(9))
    const tg = createTextGenerationStage({
      producer,
      judge,
      threshold: 7.5,
      minIterations: 2,
      maxIterations: 5,
    })
    const result = await runTextLoop({
      stage: tg,
      context: { goal: 'g', systemPrompt: 's' },
    })
    // First attempt must NOT have been judged (validator caught it).
    expect((judge as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThan(3)
    // Best artifact must come from a judged iteration.
    expect(result.bestArtifact ?? '').toContain('recovered')
  })

  it('throws when context is malformed', async () => {
    const tg = createTextGenerationStage({
      producer: {
        produce: async () => fakeArtifact(1, LONG_BODY),
        revise: async ({ previous }) => fakeArtifact(previous.version + 1, LONG_BODY),
      },
      judge: async () => fakeGrade(8),
    })
    await expect(
      tg.executor(
        [],
        { wrong: 'shape' } as unknown as TextStageContext,
        {
          stageId: 'x',
          status: 'generating',
          currentArtifact: null,
          bestArtifact: null,
          bestGrade: null,
          iterations: [],
          loopCount: 0,
          humanFeedback: [],
          costUSD: 0,
        }
      )
    ).rejects.toThrow(/context must include/)
  })
})

// ─── Live smoke test (manual only) ───────────────────────────────────────

const runLive = process.env.RUN_LIVE_TESTS === '1'
;(runLive ? describe : describe.skip)('text generation stage — LIVE', () => {
  it(
    'improves article quality across iterations',
    async () => {
      const tg = createTextGenerationStage({
        threshold: 7.5,
        minIterations: 2,
        maxIterations: 5,
      })
      const ctx: TextStageContext = {
        goal: 'How solar panels convert sunlight to electricity',
        systemPrompt:
          'You are an expert educational writer. Produce a clear, engaging, accurate article (~400–600 words) for a curious general audience. Use concrete detail. End with a complete sentence.',
      }
      const iterationScores: number[] = []
      const result = await runTextLoop({
        stage: tg,
        context: ctx,
        onIteration: (e) => {
          if (!e.validationFailed) {
            iterationScores.push(e.score)
            // eslint-disable-next-line no-console
            console.log(
              `[live] v${e.version} score=${e.score.toFixed(2)} — ` +
                e.dimensionScores.map((d) => `${d.dimensionId}=${d.score}`).join(' ')
            )
          } else {
            // eslint-disable-next-line no-console
            console.log(`[live] v${e.version} VALIDATION FAILED`)
          }
        },
      })
      // eslint-disable-next-line no-console
      console.log(
        `[live] RESULT best=${result.bestScore?.toFixed(2)} iters=${
          result.iterations.length
        } cost=$${result.totalCostUSD.toFixed(4)}`
      )
      // eslint-disable-next-line no-console
      console.log(
        `[live] best artifact (first 500 chars):\n${(result.bestArtifact ?? '').slice(0, 500)}`
      )
      expect(iterationScores.length).toBeGreaterThanOrEqual(2)
      expect(result.bestScore ?? 0).toBeGreaterThan(iterationScores[0])
    },
    5 * 60_000
  )
})
