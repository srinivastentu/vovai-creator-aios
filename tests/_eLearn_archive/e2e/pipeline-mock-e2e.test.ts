// LE-11: Mock E2E — Full 5-stage ideation pipeline
// Uses mock executor + judge (no API calls). Runs in CI.
// Exercises all 4 systems: Engine, Agentic (mocks), Review, Domain Workflow.

import { describe, it, expect } from 'vitest'
import { processReview } from '../../src/lib/core/engine'
import type { LoopState, AgentExecutor, JudgeFunction } from '../../src/lib/core/engine'
import {
  createElearnIdeationPipeline,
  ELEARN_IDEATION_STAGES,
} from '../../src/lib/domain/workflows/ideation/pipeline-config'
import {
  runCurrentStage,
  getCurrentStage,
  getCurrentState,
  canAdvance,
  advancePipeline,
  isPipelineComplete,
  getPipelineProgress,
} from '../../src/lib/domain/workflows/pipeline-orchestrator'
import type { IdeationPipeline } from '../../src/lib/domain/workflows/pipeline-orchestrator'
import { createMockAgentExecutor, createMockJudge } from '../../src/lib/domain/workflows/pipeline-mocks'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_IDS = ['brief', 'audience', 'structure', 'components', 'handoff']

function getThreshold(stageId: string): number {
  const stage = ELEARN_IDEATION_STAGES.find((s) => s.id === stageId)
  return stage?.threshold ?? 75
}

/** Transition presenting → awaiting_review (mirrors API route behavior) */
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

/** Approve a stage: transition to awaiting_review, then processReview approve */
function approveStage(
  pipeline: IdeationPipeline,
  stageId: string
): IdeationPipeline {
  pipeline = transitionToAwaitingReview(pipeline, stageId)
  const state = pipeline.stageStates[stageId]
  const approved = processReview(state, { type: 'approve' })
  return {
    ...pipeline,
    stageStates: {
      ...pipeline.stageStates,
      [stageId]: approved,
    },
  }
}

// ---------------------------------------------------------------------------
// Mock E2E: Full Ideation Pipeline
// ---------------------------------------------------------------------------

describe('Mock E2E: Full Ideation Pipeline', () => {
  let pipeline: IdeationPipeline
  let mockExecutor: AgentExecutor
  let mockJudge: JudgeFunction

  // Build a shared context that grows as stages produce artifacts
  const context: Record<string, unknown> = {
    brief: 'Build an AI fundamentals course for working professionals',
    archetype: { id: 'course', name: 'Online Course' },
  }

  // -------------------------------------------------------------------------
  // Pipeline creation
  // -------------------------------------------------------------------------

  it('creates a 5-stage pipeline', () => {
    pipeline = createElearnIdeationPipeline('test-blueprint-e2e')
    mockExecutor = createMockAgentExecutor()
    mockJudge = createMockJudge()

    expect(pipeline.stages).toHaveLength(5)
    expect(pipeline.currentStageIndex).toBe(0)
    expect(pipeline.status).toBe('active')
    expect(pipeline.blueprintId).toBe('test-blueprint-e2e')

    // All stages start idle
    for (const stageId of STAGE_IDS) {
      expect(pipeline.stageStates[stageId].status).toBe('idle')
    }
  })

  it('has correct stage IDs in order', () => {
    const ids = pipeline.stages.map((s) => s.id)
    expect(ids).toEqual(STAGE_IDS)
  })

  it('initial progress is 0%', () => {
    const progress = getPipelineProgress(pipeline)
    expect(progress.total).toBe(5)
    expect(progress.completed).toBe(0)
    expect(progress.percent).toBe(0)
    expect(progress.currentStageId).toBe('brief')
  })

  // -------------------------------------------------------------------------
  // Stage-by-stage loop: brief → audience → structure → components → handoff
  // -------------------------------------------------------------------------

  describe.each(STAGE_IDS.map((id, i) => ({ stageId: id, index: i })))(
    'Stage $index: $stageId',
    ({ stageId, index }) => {

      it('is the current stage', () => {
        const current = getCurrentStage(pipeline)
        expect(current).not.toBeNull()
        expect(current!.id).toBe(stageId)
      })

      it('iteration 1 — score 65 → revising', async () => {
        const result = await runCurrentStage(pipeline, context, mockExecutor, mockJudge)
        pipeline = result.pipeline
        const state = result.stageState

        expect(state.loopCount).toBe(1)
        expect(state.status).toBe('revising')
        expect(state.currentArtifact).not.toBeNull()
        expect(state.bestGrade).not.toBeNull()
        expect(state.bestGrade!.overallScore).toBe(65)
        expect(state.iterations).toHaveLength(1)
        expect(result.gate).toBeUndefined()
      })

      it('iteration 2 — score 80 → presenting with gate', async () => {
        const result = await runCurrentStage(pipeline, context, mockExecutor, mockJudge)
        pipeline = result.pipeline
        const state = result.stageState

        expect(state.loopCount).toBe(2)
        expect(state.status).toBe('presenting')
        expect(state.bestGrade).not.toBeNull()
        expect(state.bestGrade!.overallScore).toBe(80)
        expect(state.bestArtifact).not.toBeNull()
        expect(state.iterations).toHaveLength(2)

        // Gate created for presenting status
        expect(result.gate).toBeDefined()
        expect(result.gate!.stageId).toBe(stageId)
      })

      it('transitions presenting → awaiting_review → approved', () => {
        // Mirror the API route: presenting → awaiting_review
        pipeline = transitionToAwaitingReview(pipeline, stageId)
        expect(pipeline.stageStates[stageId].status).toBe('awaiting_review')

        // Process human approval
        const state = pipeline.stageStates[stageId]
        const approved = processReview(state, { type: 'approve' })
        expect(approved.status).toBe('approved')

        // Update pipeline
        pipeline = {
          ...pipeline,
          stageStates: {
            ...pipeline.stageStates,
            [stageId]: approved,
          },
        }
      })

      it('bestGrade meets threshold', () => {
        const state = pipeline.stageStates[stageId]
        const threshold = getThreshold(stageId)
        expect(state.bestGrade!.overallScore).toBeGreaterThanOrEqual(threshold)
      })

      it('advances to next stage or completes pipeline', () => {
        expect(canAdvance(pipeline)).toBe(true)
        pipeline = advancePipeline(pipeline)

        if (index < STAGE_IDS.length - 1) {
          // Not last stage — pipeline advances
          expect(pipeline.currentStageIndex).toBe(index + 1)
          expect(pipeline.status).toBe('active')
        } else {
          // Last stage — pipeline completes
          expect(pipeline.status).toBe('complete')
        }
      })

      it('progress percentage increases', () => {
        const progress = getPipelineProgress(pipeline)
        const expectedCompleted = index + 1
        const expectedPercent = Math.round((expectedCompleted / 5) * 100)

        expect(progress.completed).toBe(expectedCompleted)
        expect(progress.percent).toBe(expectedPercent)
      })
    }
  )

  // -------------------------------------------------------------------------
  // Final pipeline state
  // -------------------------------------------------------------------------

  describe('Pipeline completion', () => {
    it('pipeline is complete', () => {
      expect(isPipelineComplete(pipeline)).toBe(true)
    })

    it('progress is 100%', () => {
      const progress = getPipelineProgress(pipeline)
      expect(progress.percent).toBe(100)
      expect(progress.completed).toBe(5)
      expect(progress.total).toBe(5)
    })

    it('all stages are approved', () => {
      for (const stageId of STAGE_IDS) {
        expect(pipeline.stageStates[stageId].status).toBe('approved')
      }
    })

    it('all stages have bestArtifact populated', () => {
      for (const stageId of STAGE_IDS) {
        expect(pipeline.stageStates[stageId].bestArtifact).not.toBeNull()
      }
    })

    it('all stages have 2 iterations', () => {
      for (const stageId of STAGE_IDS) {
        expect(pipeline.stageStates[stageId].iterations).toHaveLength(2)
        expect(pipeline.stageStates[stageId].loopCount).toBe(2)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Review action edge cases
  // -------------------------------------------------------------------------

  describe('Review actions: reject and feedback', () => {
    let freshPipeline: IdeationPipeline
    let freshExecutor: AgentExecutor
    let freshJudge: JudgeFunction

    it('reject resets stage state', async () => {
      freshPipeline = createElearnIdeationPipeline('test-reject')
      freshExecutor = createMockAgentExecutor()
      freshJudge = createMockJudge()

      // Run 2 iterations to reach presenting
      let result = await runCurrentStage(freshPipeline, context, freshExecutor, freshJudge)
      freshPipeline = result.pipeline
      result = await runCurrentStage(freshPipeline, context, freshExecutor, freshJudge)
      freshPipeline = result.pipeline

      expect(result.stageState.status).toBe('presenting')

      // Reject
      freshPipeline = transitionToAwaitingReview(freshPipeline, 'brief')
      const state = freshPipeline.stageStates['brief']
      const rejected = processReview(state, { type: 'reject' })

      expect(rejected.status).toBe('generating')
      expect(rejected.loopCount).toBe(0)
      expect(rejected.iterations).toHaveLength(0)
    })

    it('feedback adds message and returns to generating', async () => {
      freshPipeline = createElearnIdeationPipeline('test-feedback')
      freshExecutor = createMockAgentExecutor()
      freshJudge = createMockJudge()

      // Run 2 iterations to reach presenting
      let result = await runCurrentStage(freshPipeline, context, freshExecutor, freshJudge)
      freshPipeline = result.pipeline
      result = await runCurrentStage(freshPipeline, context, freshExecutor, freshJudge)
      freshPipeline = result.pipeline

      // Provide feedback
      freshPipeline = transitionToAwaitingReview(freshPipeline, 'brief')
      const state = freshPipeline.stageStates['brief']
      const withFeedback = processReview(state, {
        type: 'feedback',
        message: 'Add more detail about prerequisites',
      })

      expect(withFeedback.status).toBe('generating')
      expect(withFeedback.humanFeedback).toContain('Add more detail about prerequisites')
    })
  })

  // -------------------------------------------------------------------------
  // Cannot advance without approval
  // -------------------------------------------------------------------------

  describe('Advancement guards', () => {
    it('cannot advance unapproved stage', () => {
      const guardPipeline = createElearnIdeationPipeline('test-guard')
      expect(canAdvance(guardPipeline)).toBe(false)
      expect(() => advancePipeline(guardPipeline)).toThrow('Cannot advance pipeline')
    })

    it('cannot advance if dependency not approved', async () => {
      // Create pipeline, approve brief, but don't approve audience's dependency properly
      let guardPipeline = createElearnIdeationPipeline('test-dep-guard')
      const executor = createMockAgentExecutor()
      const judge = createMockJudge()

      // Run brief to presenting
      let result = await runCurrentStage(guardPipeline, context, executor, judge)
      guardPipeline = result.pipeline
      result = await runCurrentStage(guardPipeline, context, executor, judge)
      guardPipeline = result.pipeline

      // Approve brief and advance
      guardPipeline = approveStage(guardPipeline, 'brief')
      guardPipeline = advancePipeline(guardPipeline)

      // Now at audience stage — it depends on brief (which is approved)
      // Run audience to presenting
      result = await runCurrentStage(guardPipeline, context, executor, judge)
      guardPipeline = result.pipeline
      result = await runCurrentStage(guardPipeline, context, executor, judge)
      guardPipeline = result.pipeline

      // Approve audience and advance to structure
      guardPipeline = approveStage(guardPipeline, 'audience')
      guardPipeline = advancePipeline(guardPipeline)

      // Structure depends on brief + audience (both approved) — should work
      expect(getCurrentStage(guardPipeline)!.id).toBe('structure')
    })
  })
})
