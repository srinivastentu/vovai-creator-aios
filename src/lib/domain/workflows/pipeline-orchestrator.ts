// Pipeline Orchestrator — System 4 (eLearning Domain Workflow)
// DOMAIN layer: imports from core/engine and core/review. Never the reverse.
// Owns stage sequencing, advancement rules, dependency checks, gate creation.

import type {
  LoopStage,
  LoopState,
  LoopStatus,
  ReviewAction,
  AgentExecutor,
  JudgeFunction,
} from '../../core/engine/types'
import type { ReviewGate } from '../../core/review/types'
import { createInitialState, runLoop } from '../../core/engine'
import { createGate } from '../../core/review'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StageConfig extends LoopStage<unknown> {
  dependsOn?: string[]
  reviewerRoles?: string[]
  reviewGateConfig?: {
    allowedActions?: ReviewAction['type'][]
  }
}

export interface IdeationPipeline {
  id: string
  blueprintId: string
  stages: StageConfig[]
  currentStageIndex: number
  stageStates: Record<string, LoopState<unknown>>
  status: 'active' | 'complete' | 'paused'
  createdAt: Date
  updatedAt: Date
}

export interface PipelineProgress {
  total: number
  completed: number
  currentStageId: string | null
  percent: number
  stageStatuses: { stageId: string; status: LoopStatus }[]
}

// ---------------------------------------------------------------------------
// 1. createPipeline
// ---------------------------------------------------------------------------

export function createPipeline(
  id: string,
  blueprintId: string,
  stages: StageConfig[]
): IdeationPipeline {
  const stageStates: Record<string, LoopState<unknown>> = {}
  for (const stage of stages) {
    stageStates[stage.id] = createInitialState(stage.id)
  }

  const now = new Date()
  return {
    id,
    blueprintId,
    stages,
    currentStageIndex: 0,
    stageStates,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

// ---------------------------------------------------------------------------
// 2. getCurrentStage
// ---------------------------------------------------------------------------

export function getCurrentStage(pipeline: IdeationPipeline): StageConfig | null {
  if (pipeline.currentStageIndex >= pipeline.stages.length) return null
  return pipeline.stages[pipeline.currentStageIndex]
}

// ---------------------------------------------------------------------------
// 3. getCurrentState
// ---------------------------------------------------------------------------

export function getCurrentState(pipeline: IdeationPipeline): LoopState<unknown> | null {
  const stage = getCurrentStage(pipeline)
  if (!stage) return null
  return pipeline.stageStates[stage.id] ?? null
}

// ---------------------------------------------------------------------------
// 4. canAdvance
// ---------------------------------------------------------------------------

export function canAdvance(pipeline: IdeationPipeline): boolean {
  const stage = getCurrentStage(pipeline)
  if (!stage) return false

  const state = pipeline.stageStates[stage.id]
  if (!state || state.status !== 'approved') return false

  if (stage.dependsOn) {
    for (const depId of stage.dependsOn) {
      const depState = pipeline.stageStates[depId]
      if (!depState || depState.status !== 'approved') return false
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// 5. advancePipeline
// ---------------------------------------------------------------------------

export function advancePipeline(pipeline: IdeationPipeline): IdeationPipeline {
  if (!canAdvance(pipeline)) {
    throw new Error(
      'Cannot advance pipeline: current stage is not approved or dependencies are unmet'
    )
  }

  const nextIndex = pipeline.currentStageIndex + 1
  const isComplete = nextIndex >= pipeline.stages.length

  return {
    ...pipeline,
    currentStageIndex: nextIndex,
    status: isComplete ? 'complete' : pipeline.status,
    updatedAt: new Date(),
  }
}

// ---------------------------------------------------------------------------
// 6. isPipelineComplete
// ---------------------------------------------------------------------------

export function isPipelineComplete(pipeline: IdeationPipeline): boolean {
  return pipeline.status === 'complete'
}

// ---------------------------------------------------------------------------
// 7. getPipelineProgress
// ---------------------------------------------------------------------------

export function getPipelineProgress(pipeline: IdeationPipeline): PipelineProgress {
  const total = pipeline.stages.length
  const stageStatuses = pipeline.stages.map((stage) => ({
    stageId: stage.id,
    status: pipeline.stageStates[stage.id].status,
  }))
  const completed = stageStatuses.filter((s) => s.status === 'approved').length
  const currentStage = getCurrentStage(pipeline)

  return {
    total,
    completed,
    currentStageId: currentStage?.id ?? null,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
    stageStatuses,
  }
}

// ---------------------------------------------------------------------------
// 8. runCurrentStage
// ---------------------------------------------------------------------------

export async function runCurrentStage(
  pipeline: IdeationPipeline,
  context: unknown,
  agentExecutor: AgentExecutor,
  judge: JudgeFunction
): Promise<{ pipeline: IdeationPipeline; stageState: LoopState<unknown>; gate?: ReviewGate }> {
  const stage = getCurrentStage(pipeline)
  if (!stage) {
    throw new Error('Cannot run stage: pipeline is complete')
  }

  const state = getCurrentState(pipeline)
  if (!state) {
    throw new Error('Cannot run stage: no state for current stage')
  }

  const newState = await runLoop(stage, state, context, agentExecutor, judge)

  const updatedPipeline: IdeationPipeline = {
    ...pipeline,
    stageStates: {
      ...pipeline.stageStates,
      [stage.id]: newState,
    },
    updatedAt: new Date(),
  }

  let gate: ReviewGate | undefined
  if (newState.status === 'presenting') {
    gate = createGate({
      stageId: stage.id,
      artifactType: stage.id,
      allowedActions: stage.reviewGateConfig?.allowedActions,
      requiresRole: stage.reviewerRoles,
    })
  }

  return { pipeline: updatedPipeline, stageState: newState, gate }
}
