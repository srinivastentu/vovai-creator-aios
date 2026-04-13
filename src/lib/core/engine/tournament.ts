// Tournament Loop Pattern — parallel multi-model competition with judge ranking.
// Zero imports from core/agentic/, core/review/, or domain/.
// All dependencies (gateway, judge, validators, rubric) are injected.

import type { ModelGateway } from '../models/gateway'
import type { GatewayContext } from '../models/types'
import type {
  GradeReport,
  ImageArtifact,
  JudgeFunction,
  RubricDefinition,
  TournamentConfig,
  TournamentEntry,
  TournamentEvent,
  TournamentResult,
  TournamentRound,
  TournamentRunner,
  TournamentRunnerOptions,
  TournamentValidator,
  ValidatorOutcome,
} from './tournament-types'

const PRESERVE_MIN_SCORE = 8

function runValidatorsOnEntry(
  artifact: ImageArtifact,
  validators: TournamentValidator[]
): ValidatorOutcome {
  const results = validators.map((v) => v(artifact))
  const failures = results.filter((r) => !r.pass)
  return {
    passed: failures.length === 0,
    errors: failures.map((f) => `${f.name}: ${f.message}`),
  }
}

export function buildRefinedPrompt(
  originalPrompt: string,
  bestGrade: GradeReport,
  rubric: RubricDefinition
): string {
  const byId = new Map(rubric.dimensions.map((d) => [d.id, d]))
  const preserve: string[] = []
  const improve: string[] = []

  for (const dim of bestGrade.dimensionScores) {
    const meta = byId.get(dim.dimensionId)
    const displayName = meta?.name ?? dim.name
    if (dim.score >= PRESERVE_MIN_SCORE) {
      preserve.push(`- ${displayName}: scored ${dim.score} — maintain this`)
    } else {
      const feedback = dim.feedback?.trim() || 'improve this dimension'
      improve.push(`- ${displayName}: scored ${dim.score} — ${feedback}`)
    }
  }

  const sections: string[] = [originalPrompt, '', 'QUALITY GUIDANCE (from previous generation):']
  if (preserve.length > 0) {
    sections.push('PRESERVE (these aspects were strong):', ...preserve)
  }
  if (improve.length > 0) {
    if (preserve.length > 0) sections.push('')
    sections.push('IMPROVE (focus on these):', ...improve)
  }
  return sections.join('\n')
}

function compareByScoreDesc(a: TournamentEntry, b: TournamentEntry): number {
  const as = a.grade?.overallScore ?? -Infinity
  const bs = b.grade?.overallScore ?? -Infinity
  return bs - as
}

function buildEntry(
  modelId: string,
  round: number,
  prompt: string,
  response: import('../models/types').GatewayResponse
): TournamentEntry {
  const filePath = response.result?.filePath
  const artifact: ImageArtifact = {
    imagePath: typeof filePath === 'string' ? filePath : '',
    prompt,
  }
  return {
    modelId,
    round,
    artifact,
    gatewayResponse: response,
    validatorResult: null,
    grade: null,
  }
}

export function createTournamentRunner(
  gateway: ModelGateway,
  judge: JudgeFunction,
  validators: TournamentValidator[],
  rubric: RubricDefinition,
  options: TournamentRunnerOptions = {}
): TournamentRunner {
  const getJudgeCostUsd = options.getJudgeCostUsd
  const baseContext = options.context ?? {}

  return async function* tournament(
    initialPrompt: string,
    config: TournamentConfig,
    callContext: Partial<GatewayContext> = {}
  ): AsyncGenerator<TournamentEvent, TournamentResult, void> {
    const mergedContext: GatewayContext = { ...baseContext, ...callContext }
    const allEntries: TournamentEntry[] = []
    const rounds: TournamentRound[] = []
    let generationCostUsd = 0

    const finalize = (
      method: TournamentResult['method'],
      winner: TournamentEntry | null,
      bestEntry: TournamentEntry | null
    ): TournamentResult => {
      const judgeCost = getJudgeCostUsd ? getJudgeCostUsd() : 0
      return {
        winner,
        allEntries,
        rounds,
        bestEntry,
        totalCostUsd: generationCostUsd + judgeCost,
        method,
      }
    }

    if (!config.modelIds || config.modelIds.length === 0) {
      yield {
        type: 'tournament:all-failed',
        round: 1,
        data: { totalEntries: 0, failedGeneration: 0 },
      }
      return finalize('all_failed', null, null)
    }

    let currentPrompt = initialPrompt
    let modelsForRound = [...config.modelIds]

    for (let round = 1; round <= config.maxRounds; round++) {
      const roundRecord: TournamentRound = {
        round,
        entries: [],
        ...(round > 1 ? { refinedPrompt: currentPrompt } : {}),
      }

      yield {
        type: 'tournament:round-start',
        round,
        data: {
          totalEntries: modelsForRound.length,
          ...(round > 1 ? { refinedPrompt: currentPrompt } : {}),
        },
      }

      // 1. Generate in parallel.
      const responses = await gateway.requestMultiple(
        {
          capability: 'image-generation',
          params: { prompt: currentPrompt },
          preferences: { timeoutMs: config.timeoutPerModelMs },
          context: { ...mergedContext, tournamentRound: round },
        },
        modelsForRound
      )

      let failedGeneration = 0
      const roundEntries: TournamentEntry[] = []
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i]
        const modelId = modelsForRound[i]
        generationCostUsd += response.cost?.costUsd ?? 0
        const entry = buildEntry(modelId, round, currentPrompt, response)
        roundEntries.push(entry)
        const hasUsableFile =
          response.success && typeof response.result?.filePath === 'string' && response.result.filePath.length > 0
        if (!hasUsableFile) {
          failedGeneration += 1
          yield {
            type: 'tournament:generation-failed',
            round,
            data: { modelId, costSoFar: generationCostUsd },
          }
        }
      }
      roundRecord.entries = roundEntries
      rounds.push(roundRecord)
      allEntries.push(...roundEntries)

      yield {
        type: 'tournament:generation-complete',
        round,
        data: {
          totalEntries: roundEntries.length,
          failedGeneration,
          costSoFar: generationCostUsd,
        },
      }

      // 2. Validate survivors (entries with a usable file path).
      let passedValidation = 0
      for (const entry of roundEntries) {
        if (!entry.artifact.imagePath) {
          entry.validatorResult = { passed: false, errors: ['Missing imagePath from generation'] }
          continue
        }
        const outcome = runValidatorsOnEntry(entry.artifact, validators)
        entry.validatorResult = outcome
        if (outcome.passed) passedValidation += 1
      }
      yield {
        type: 'tournament:validation-complete',
        round,
        data: { totalEntries: roundEntries.length, passedValidation },
      }

      // 3. Judge sequentially (vision API is rate-limited and expensive).
      for (const entry of roundEntries) {
        if (!entry.validatorResult || !entry.validatorResult.passed) continue
        const grade = await judge(entry.artifact, rubric)
        entry.grade = grade
        yield {
          type: 'tournament:entry-judged',
          round,
          data: { modelId: entry.modelId, score: grade.overallScore, grade, entry },
        }
      }

      yield { type: 'tournament:round-complete', round, data: {} }

      // 4. Rank across ALL rounds.
      const judgedEntries = allEntries.filter((e) => e.grade !== null)
      judgedEntries.sort(compareByScoreDesc)
      const topOverall = judgedEntries[0] ?? null

      // 5. Decide.
      if (topOverall && (topOverall.grade?.overallScore ?? -Infinity) >= config.threshold) {
        yield {
          type: 'tournament:winner-selected',
          round,
          data: {
            modelId: topOverall.modelId,
            score: topOverall.grade?.overallScore,
            entry: topOverall,
          },
        }
        return finalize('threshold_met', topOverall, topOverall)
      }

      const isFinalRound = round === config.maxRounds
      if (isFinalRound) {
        if (topOverall) {
          yield {
            type: 'tournament:escalation',
            round,
            data: {
              modelId: topOverall.modelId,
              score: topOverall.grade?.overallScore,
              entry: topOverall,
            },
          }
          return finalize('escalation', null, topOverall)
        }
        yield {
          type: 'tournament:all-failed',
          round,
          data: { totalEntries: allEntries.length, failedGeneration },
        }
        return finalize('all_failed', null, null)
      }

      // 6. Prepare next round.
      // Best-version tracking: refine from the current overall best, or the
      // best of this round if nothing else is judged yet. If no entry has a
      // grade at all, we cannot refine — fall back to original prompt.
      const refinementSource = topOverall ?? null
      if (refinementSource && refinementSource.grade) {
        currentPrompt = buildRefinedPrompt(initialPrompt, refinementSource.grade, rubric)
      }

      const roundJudged = roundEntries
        .filter((e) => e.grade !== null)
        .sort(compareByScoreDesc)
      const advancing = (roundJudged.length > 0 ? roundJudged : roundEntries).slice(0, config.topN)
      modelsForRound = advancing.map((e) => e.modelId)

      if (modelsForRound.length === 0) {
        // No survivors to advance — short-circuit to all_failed.
        yield {
          type: 'tournament:all-failed',
          round,
          data: { totalEntries: allEntries.length, failedGeneration },
        }
        return finalize('all_failed', null, null)
      }
    }

    // Should never reach here — maxRounds loop always returns. Defensive:
    const judged = allEntries.filter((e) => e.grade !== null).sort(compareByScoreDesc)
    const best = judged[0] ?? null
    if (best) {
      return finalize('escalation', null, best)
    }
    return finalize('all_failed', null, null)
  }
}
