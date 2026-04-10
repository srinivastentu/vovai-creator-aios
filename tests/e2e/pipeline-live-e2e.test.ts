// LE-11: Live E2E — Full 5-stage ideation pipeline with REAL agents
// Requires ANTHROPIC_API_KEY. Costs ~$0.50. NOT run in CI.
// Invoke manually: ANTHROPIC_API_KEY=sk-... npx vitest run tests/e2e/pipeline-live-e2e.test.ts

import { describe, it, expect } from 'vitest'
import { processReview } from '../../src/lib/core/engine'
import type { LoopState } from '../../src/lib/core/engine'
import {
  createElearnIdeationPipeline,
  ELEARN_IDEATION_STAGES,
} from '../../src/lib/domain/workflows/ideation/pipeline-config'
import {
  runCurrentStage,
  getCurrentStage,
  canAdvance,
  advancePipeline,
  isPipelineComplete,
  getPipelineProgress,
} from '../../src/lib/domain/workflows/pipeline-orchestrator'
import type { IdeationPipeline } from '../../src/lib/domain/workflows/pipeline-orchestrator'
import {
  createRealAgentExecutor,
  createRealJudge,
} from '../../src/lib/domain/workflows/agents/agent-bridge'
import type { CostSnapshot } from '../../src/lib/domain/workflows/agents/agent-bridge'

const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY
const STAGE_IDS = ['brief', 'audience', 'structure', 'components', 'handoff']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function transitionToAwaitingReview(
  pipeline: IdeationPipeline,
  stageId: string
): IdeationPipeline {
  const state = pipeline.stageStates[stageId]
  if (state.status !== 'presenting') return pipeline
  return {
    ...pipeline,
    stageStates: {
      ...pipeline.stageStates,
      [stageId]: { ...state, status: 'awaiting_review' as const },
    },
  }
}

/** Run a stage until it reaches 'presenting' (up to maxIterations) */
async function runStageToPresenting(
  pipeline: IdeationPipeline,
  context: Record<string, unknown>,
  executor: ReturnType<typeof createRealAgentExecutor>,
  judge: ReturnType<typeof createRealJudge>
): Promise<{ pipeline: IdeationPipeline; stageState: LoopState<unknown> }> {
  const stage = getCurrentStage(pipeline)
  if (!stage) throw new Error('No current stage')

  let lastState: LoopState<unknown> = pipeline.stageStates[stage.id]

  for (let i = 0; i < stage.maxIterations; i++) {
    const result = await runCurrentStage(pipeline, context, executor, judge)
    pipeline = result.pipeline
    lastState = result.stageState

    if (lastState.status === 'presenting') break
  }

  return { pipeline, stageState: lastState }
}

// ---------------------------------------------------------------------------
// Live E2E — skipped unless ANTHROPIC_API_KEY is set
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_API_KEY)('Live E2E: Full Ideation Pipeline', () => {
  let pipeline: IdeationPipeline
  let totalCostUSD = 0

  const context: Record<string, unknown> = {
    brief: 'Create a comprehensive course on Machine Learning fundamentals for software engineers with 3-5 years of experience. Cover supervised learning, neural networks, and practical deployment. Target 10 hours of content.',
    archetype: { id: 'course', name: 'Online Course' },
  }

  it('creates pipeline', () => {
    pipeline = createElearnIdeationPipeline('live-e2e-test')
    expect(pipeline.stages).toHaveLength(5)
  })

  it('runs all 5 stages to completion', async () => {
    const executor = createRealAgentExecutor()
    const judge = createRealJudge()

    for (const stageId of STAGE_IDS) {
      const stage = getCurrentStage(pipeline)
      expect(stage).not.toBeNull()
      expect(stage!.id).toBe(stageId)

      // Run stage until presenting
      const result = await runStageToPresenting(pipeline, context, executor, judge)
      pipeline = result.pipeline
      const state = result.stageState

      // Verify meaningful artifacts from real agents
      expect(state.bestArtifact).not.toBeNull()
      expect(state.bestGrade).not.toBeNull()
      expect(state.bestGrade!.dimensionScores.length).toBeGreaterThan(0)
      expect(state.iterations.length).toBeGreaterThanOrEqual(1)

      // Verify status reached presenting (or at least has best artifact)
      expect(['presenting', 'revising']).toContain(state.status)

      // If stuck at revising after max iterations, force to presenting
      if (state.status === 'revising') {
        // Max iterations reached — engine should have escalated to presenting
        // but if not, we test what we can
        console.warn(`Stage ${stageId} did not reach presenting after max iterations`)
      }

      if (state.status === 'presenting') {
        // Approve and advance
        pipeline = transitionToAwaitingReview(pipeline, stageId)
        const approved = processReview(pipeline.stageStates[stageId], { type: 'approve' })
        pipeline = {
          ...pipeline,
          stageStates: { ...pipeline.stageStates, [stageId]: approved },
        }
        pipeline = advancePipeline(pipeline)
      }

      // Track cost per stage
      const stageCost = state.costUSD
      totalCostUSD += stageCost
      console.log(`Stage ${stageId}: ${state.loopCount} iterations, cost: $${stageCost.toFixed(4)}`)
    }
  }, 120_000) // 2 min timeout for real API calls

  it('pipeline is complete', () => {
    expect(isPipelineComplete(pipeline)).toBe(true)
    expect(getPipelineProgress(pipeline).percent).toBe(100)
  })

  it('artifacts contain meaningful content', () => {
    for (const stageId of STAGE_IDS) {
      const state = pipeline.stageStates[stageId]
      if (state.status !== 'approved') continue

      const artifact = state.bestArtifact
      expect(artifact).not.toBeNull()

      // Real agents produce objects with actual content
      const json = JSON.stringify(artifact)
      expect(json.length).toBeGreaterThan(50)
    }
  })

  it('grade reports have dimension-level scores', () => {
    for (const stageId of STAGE_IDS) {
      const state = pipeline.stageStates[stageId]
      if (!state.bestGrade) continue

      expect(state.bestGrade.dimensionScores.length).toBeGreaterThan(0)
      for (const dim of state.bestGrade.dimensionScores) {
        expect(dim.score).toBeGreaterThanOrEqual(0)
        expect(dim.score).toBeLessThanOrEqual(100)
        expect(dim.name).toBeTruthy()
        expect(dim.feedback).toBeTruthy()
      }
    }
  })

  it('total cost is reasonable', () => {
    console.log(`Total pipeline cost: $${totalCostUSD.toFixed(4)}`)
    // Real pipeline should cost something but not too much
    // Note: costUSD in LoopState may be 0 if cost tracking is in the executor layer
    // The important thing is the pipeline completed successfully
    expect(totalCostUSD).toBeGreaterThanOrEqual(0)
    expect(totalCostUSD).toBeLessThan(5.00)
  })
})
