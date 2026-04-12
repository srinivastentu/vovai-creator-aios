// Convenience wrapper: runs the engine's runLoop until the stage reaches a
// terminal state (presenting / approved). Emits per-iteration events.

import { createInitialState, runLoop } from '../../engine/loop-engine'
import type { IterationRecord, LoopState } from '../../engine/types'
import type { TextGenerationStage, TextStageContext } from './text-generation-stage'

export interface IterationEvent {
  version: number
  score: number
  dimensionScores: { dimensionId: string; name: string; score: number }[]
  validationFailed: boolean
}

export interface RunTextLoopArgs {
  stage: TextGenerationStage
  context: TextStageContext
  onIteration?: (event: IterationEvent) => void
}

export interface RunTextLoopResult {
  bestArtifact: string | null
  bestScore: number | null
  iterations: IterationRecord[]
  totalCostUSD: number
  finalState: LoopState<string>
}

export async function runTextLoop(args: RunTextLoopArgs): Promise<RunTextLoopResult> {
  const { stage, context, onIteration } = args

  let state = createInitialState<string>(stage.stage.id)
  // Safety net: the engine already clamps at maxIterations, but bound the outer
  // loop too so a bug can't spin forever.
  const hardCap = stage.stage.maxIterations * 2 + 4

  for (let i = 0; i < hardCap; i++) {
    state = await runLoop<string>(
      stage.stage,
      state,
      context,
      stage.executor,
      stage.judge
    )
    const latest = state.iterations[state.iterations.length - 1]
    if (latest) {
      onIteration?.({
        version: latest.version,
        score: latest.grade?.overallScore ?? 0,
        dimensionScores:
          latest.grade?.dimensionScores.map((d) => ({
            dimensionId: d.dimensionId,
            name: d.name,
            score: d.score,
          })) ?? [],
        validationFailed: false,
      })
    } else {
      // Validator failed — no iteration recorded, but status is revising.
      onIteration?.({
        version: state.loopCount,
        score: 0,
        dimensionScores: [],
        validationFailed: true,
      })
    }
    if (state.status === 'presenting' || state.status === 'approved') break
    if (state.status !== 'revising') break
  }

  return {
    bestArtifact: state.bestArtifact,
    bestScore: state.bestGrade?.overallScore ?? null,
    iterations: state.iterations,
    totalCostUSD: stage.getTotalCostUSD(),
    finalState: state,
  }
}
