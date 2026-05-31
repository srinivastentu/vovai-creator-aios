import { describe, it, expect, vi } from 'vitest'
import type { LoopState, AgentExecutor, JudgeFunction, GradeReport } from '../../../src/lib/core/engine/types'
import type { ReviewGate } from '../../../src/lib/core/review/types'
import {
  createPipeline,
  getCurrentStage,
  getCurrentState,
  canAdvance,
  advancePipeline,
  isPipelineComplete,
  getPipelineProgress,
  runCurrentStage,
  type StageConfig,
  type IdeationPipeline,
} from '../../../src/lib/domain/workflows/pipeline-orchestrator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStage(overrides: Partial<StageConfig> & { id: string }): StageConfig {
  return {
    agents: [{ id: 'a1', name: 'Agent', model: { primary: 'claude', fallback: 'gpt' }, maxRetries: 2, timeoutMs: 5000 }],
    rubric: {
      id: 'r1',
      name: 'Rubric',
      dimensions: [{ id: 'd1', name: 'Quality', weight: 1, passThreshold: 7, description: 'Quality check', criteria: {} }],
      passThreshold: 7,
    },
    threshold: 7,
    maxIterations: 5,
    minIterations: 2,
    loopPattern: 'standard' as const,
    ...overrides,
  }
}

function makeApprovedState(stageId: string): LoopState<unknown> {
  return {
    stageId,
    status: 'approved',
    currentArtifact: { content: 'approved artifact' },
    bestArtifact: { content: 'approved artifact' },
    bestGrade: null,
    iterations: [],
    loopCount: 3,
    humanFeedback: [],
    costUSD: 0.05,
  }
}

const passingGrade: GradeReport = {
  overallScore: 9,
  passesThreshold: true,
  dimensionScores: [{ dimensionId: 'd1', name: 'Quality', score: 9, weight: 1, feedback: 'Good' }],
  recommendation: 'Present to reviewer',
  improvementPriorities: [],
}

// ---------------------------------------------------------------------------
// createPipeline
// ---------------------------------------------------------------------------

describe('createPipeline', () => {
  const stages = [makeStage({ id: 'brief' }), makeStage({ id: 'audience' }), makeStage({ id: 'structure' })]

  it('creates pipeline with correct stage count', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    expect(pipeline.stages).toHaveLength(3)
  })

  it('currentStageIndex starts at 0', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    expect(pipeline.currentStageIndex).toBe(0)
  })

  it('stageStates initialized for every stage with idle status', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    expect(Object.keys(pipeline.stageStates)).toHaveLength(3)
    for (const stage of stages) {
      expect(pipeline.stageStates[stage.id].status).toBe('idle')
      expect(pipeline.stageStates[stage.id].stageId).toBe(stage.id)
    }
  })

  it('pipeline status is active', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    expect(pipeline.status).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// getCurrentStage
// ---------------------------------------------------------------------------

describe('getCurrentStage', () => {
  const stages = [makeStage({ id: 'brief' }), makeStage({ id: 'audience' })]

  it('returns first stage when index is 0', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    expect(getCurrentStage(pipeline)?.id).toBe('brief')
  })

  it('returns null when pipeline is complete', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    const completed: IdeationPipeline = { ...pipeline, currentStageIndex: 2, status: 'complete' }
    expect(getCurrentStage(completed)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getCurrentState
// ---------------------------------------------------------------------------

describe('getCurrentState', () => {
  const stages = [makeStage({ id: 'brief' }), makeStage({ id: 'audience' })]

  it('returns state for current stage', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    const state = getCurrentState(pipeline)
    expect(state).not.toBeNull()
    expect(state!.stageId).toBe('brief')
  })

  it('returns null when pipeline is complete', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    const completed: IdeationPipeline = { ...pipeline, currentStageIndex: 2, status: 'complete' }
    expect(getCurrentState(completed)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// canAdvance
// ---------------------------------------------------------------------------

describe('canAdvance', () => {
  const stages = [
    makeStage({ id: 'brief' }),
    makeStage({ id: 'audience', dependsOn: ['brief'] }),
  ]

  it('returns false when current stage not approved', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    expect(canAdvance(pipeline)).toBe(false)
  })

  it('returns true when current stage is approved', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    pipeline.stageStates['brief'] = makeApprovedState('brief')
    expect(canAdvance(pipeline)).toBe(true)
  })

  it('returns false when dependency stage not approved', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    // Move to second stage manually, but dependency (brief) is not approved
    const atSecond: IdeationPipeline = {
      ...pipeline,
      currentStageIndex: 1,
      stageStates: {
        ...pipeline.stageStates,
        'audience': makeApprovedState('audience'),
      },
    }
    expect(canAdvance(atSecond)).toBe(false)
  })

  it('returns true when all dependencies approved', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    const atSecond: IdeationPipeline = {
      ...pipeline,
      currentStageIndex: 1,
      stageStates: {
        ...pipeline.stageStates,
        'brief': makeApprovedState('brief'),
        'audience': makeApprovedState('audience'),
      },
    }
    expect(canAdvance(atSecond)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// advancePipeline
// ---------------------------------------------------------------------------

describe('advancePipeline', () => {
  const stages = [makeStage({ id: 'brief' }), makeStage({ id: 'audience' })]

  it('increments currentStageIndex', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    pipeline.stageStates['brief'] = makeApprovedState('brief')
    const advanced = advancePipeline(pipeline)
    expect(advanced.currentStageIndex).toBe(1)
  })

  it('sets status to complete when advancing past last stage', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    pipeline.stageStates['brief'] = makeApprovedState('brief')
    const atSecond = advancePipeline(pipeline)
    atSecond.stageStates['audience'] = makeApprovedState('audience')
    const completed = advancePipeline(atSecond)
    expect(completed.status).toBe('complete')
    expect(completed.currentStageIndex).toBe(2)
  })

  it('throws when canAdvance is false', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    expect(() => advancePipeline(pipeline)).toThrow('Cannot advance pipeline')
  })

  it('returns new pipeline object (immutability)', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    pipeline.stageStates['brief'] = makeApprovedState('brief')
    const advanced = advancePipeline(pipeline)
    expect(advanced).not.toBe(pipeline)
    expect(pipeline.currentStageIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// isPipelineComplete
// ---------------------------------------------------------------------------

describe('isPipelineComplete', () => {
  const stages = [makeStage({ id: 'brief' })]

  it('returns false when stages remain', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    expect(isPipelineComplete(pipeline)).toBe(false)
  })

  it('returns true when all stages approved and index past end', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    pipeline.stageStates['brief'] = makeApprovedState('brief')
    const completed = advancePipeline(pipeline)
    expect(isPipelineComplete(completed)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getPipelineProgress
// ---------------------------------------------------------------------------

describe('getPipelineProgress', () => {
  const stages = [makeStage({ id: 'brief' }), makeStage({ id: 'audience' }), makeStage({ id: 'structure' })]

  it('returns correct total, completed count, percent', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    pipeline.stageStates['brief'] = makeApprovedState('brief')
    const progress = getPipelineProgress(pipeline)
    expect(progress.total).toBe(3)
    expect(progress.completed).toBe(1)
    expect(progress.percent).toBe(33)
  })

  it('returns all stage statuses', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    const progress = getPipelineProgress(pipeline)
    expect(progress.stageStatuses).toHaveLength(3)
    expect(progress.stageStatuses[0]).toEqual({ stageId: 'brief', status: 'idle' })
    expect(progress.stageStatuses[1]).toEqual({ stageId: 'audience', status: 'idle' })
    expect(progress.stageStatuses[2]).toEqual({ stageId: 'structure', status: 'idle' })
  })

  it('currentStageId is null when complete', () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    // Approve all and advance past end
    for (const stage of stages) {
      pipeline.stageStates[stage.id] = makeApprovedState(stage.id)
    }
    const completed: IdeationPipeline = { ...pipeline, currentStageIndex: 3, status: 'complete' }
    const progress = getPipelineProgress(completed)
    expect(progress.currentStageId).toBeNull()
    expect(progress.percent).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// runCurrentStage
// ---------------------------------------------------------------------------

describe('runCurrentStage', () => {
  const stages = [makeStage({ id: 'brief' }), makeStage({ id: 'audience' })]

  const mockAgentExecutor: AgentExecutor = vi.fn().mockResolvedValue({ content: 'generated' })

  const mockJudgePresenting: JudgeFunction = vi.fn().mockResolvedValue(passingGrade)

  const mockJudgeRevising: JudgeFunction = vi.fn().mockResolvedValue({
    ...passingGrade,
    overallScore: 5,
    passesThreshold: false,
  })

  it('calls core runLoop with correct stage and state', async () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    await runCurrentStage(pipeline, { topic: 'AI' }, mockAgentExecutor, mockJudgeRevising)
    expect(mockAgentExecutor).toHaveBeenCalled()
    expect(mockJudgeRevising).toHaveBeenCalled()
  })

  it('updates stageStates with returned state', async () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    const { pipeline: updated } = await runCurrentStage(pipeline, {}, mockAgentExecutor, mockJudgeRevising)
    expect(updated.stageStates['brief'].status).not.toBe('idle')
    expect(updated.stageStates['brief'].loopCount).toBe(1)
  })

  it('returns updated pipeline', async () => {
    const pipeline = createPipeline('p1', 'bp1', stages)
    const { pipeline: updated } = await runCurrentStage(pipeline, {}, mockAgentExecutor, mockJudgeRevising)
    expect(updated).not.toBe(pipeline)
    expect(updated.stageStates['brief'].iterations).toHaveLength(1)
  })

  it('creates review gate when state reaches presenting', async () => {
    // Need minIterations=1 so first passing run goes to presenting
    const presentingStages = [makeStage({ id: 'brief', minIterations: 1, reviewerRoles: ['SME'] })]
    const pipeline = createPipeline('p1', 'bp1', presentingStages)
    const { gate } = await runCurrentStage(pipeline, {}, mockAgentExecutor, mockJudgePresenting)
    expect(gate).toBeDefined()
    expect(gate!.stageId).toBe('brief')
    expect(gate!.artifactType).toBe('brief')
    expect(gate!.requiresRole).toEqual(['SME'])
  })

  it('does not advance pipeline (caller responsibility)', async () => {
    const presentingStages = [makeStage({ id: 'brief', minIterations: 1 }), makeStage({ id: 'audience' })]
    const pipeline = createPipeline('p1', 'bp1', presentingStages)
    const { pipeline: updated } = await runCurrentStage(pipeline, {}, mockAgentExecutor, mockJudgePresenting)
    expect(updated.currentStageIndex).toBe(0)
    expect(updated.status).toBe('active')
  })
})
