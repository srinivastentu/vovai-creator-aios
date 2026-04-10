// Agent Bridge — Domain layer adapter
// Maps eLearning stage IDs to actual agent runner functions.
// Creates AgentExecutor and JudgeFunction that conform to core interfaces.
// DOMAIN: imports from core (types) and domain agents. Never imported by core.

import Anthropic from '@anthropic-ai/sdk'
import type {
  AgentExecutor,
  JudgeFunction,
  LoopState,
  AgentConfig,
} from '../../../core/engine/types'
import type { AgentResult } from './framework/types'
import { createJudgeFunction } from '../../../core/agentic/grader'
import { createMockAgentExecutor, createMockJudge } from '../pipeline-mocks'

import { runOrchestrator } from './orchestrator'
import { runAudienceAnalyst } from './audience-analyst'
import { runCurriculumStrategist } from './curriculum-strategist'
import { runOutcomeArchitect } from './outcome-architect'
import { runComponentRecommender } from './component-recommender'
import { runStructureOptimizer } from './structure-optimizer'
import { runDevilsAdvocate } from './devils-advocate'

import type {
  ProjectArchetype,
  AudienceProfile,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
} from '../types'

// ---------------------------------------------------------------------------
// Cost tracker — side-channel to capture cost from agent calls
// ---------------------------------------------------------------------------

export interface CostSnapshot {
  tokensIn: number
  tokensOut: number
  costUSD: number
  modelUsed: string
}

function createCostTracker() {
  let accumulated: CostSnapshot = { tokensIn: 0, tokensOut: 0, costUSD: 0, modelUsed: '' }

  return {
    record(result: AgentResult<unknown>) {
      accumulated = {
        tokensIn: accumulated.tokensIn + result.tokensIn,
        tokensOut: accumulated.tokensOut + result.tokensOut,
        costUSD: accumulated.costUSD + result.costUSD,
        modelUsed: result.modelUsed,
      }
    },
    get(): CostSnapshot {
      return { ...accumulated }
    },
    reset() {
      accumulated = { tokensIn: 0, tokensOut: 0, costUSD: 0, modelUsed: '' }
    },
  }
}

// ---------------------------------------------------------------------------
// Pipeline context — passed through context: unknown from the route
// ---------------------------------------------------------------------------

export interface PipelineContext {
  brief: string
  archetype: ProjectArchetype
  audienceProfile?: AudienceProfile
  structure?: ProposedStructure
  outcomesMap?: OutcomesMap
  componentPlan?: ComponentPlan
  humanMessage?: string
  currentPhase?: string
}

// ---------------------------------------------------------------------------
// Stage → agent mapping
// ---------------------------------------------------------------------------

async function runBriefStage(
  ctx: PipelineContext,
  _agents: AgentConfig[],
  _state: LoopState<unknown>
): Promise<AgentResult<unknown>> {
  return runOrchestrator({
    humanMessage: ctx.humanMessage ?? ctx.brief,
    currentPhase: (ctx.currentPhase ?? 'brainstorm') as 'brainstorm',
    context: {
      brief: ctx.brief,
      archetype: ctx.archetype,
      conversationHistory: [],
    },
  })
}

async function runAudienceStage(
  ctx: PipelineContext
): Promise<AgentResult<unknown>> {
  return runAudienceAnalyst(ctx.brief, ctx.archetype)
}

async function runStructureStage(
  ctx: PipelineContext
): Promise<AgentResult<unknown>[]> {
  // Multi-agent: Curriculum Strategist produces structure,
  // then Outcome Architect enriches with learning outcomes
  const structureResult = await runCurriculumStrategist(
    ctx.brief,
    ctx.archetype,
    ctx.audienceProfile!
  )

  if (!structureResult.success || !structureResult.output) {
    return [structureResult]
  }

  const outcomeResult = await runOutcomeArchitect(
    ctx.brief,
    ctx.archetype,
    structureResult.output as ProposedStructure,
    ctx.audienceProfile!
  )

  return [structureResult, outcomeResult]
}

async function runComponentsStage(
  ctx: PipelineContext
): Promise<AgentResult<unknown>[]> {
  // Multi-agent: Component Recommender assigns components,
  // then Structure Optimizer validates and refines
  const componentResult = await runComponentRecommender(
    ctx.brief,
    ctx.archetype,
    ctx.structure!,
    ctx.outcomesMap!,
    ctx.audienceProfile!
  )

  if (!componentResult.success || !componentResult.output) {
    return [componentResult]
  }

  const optimizerResult = await runStructureOptimizer(
    ctx.brief,
    ctx.archetype,
    ctx.structure!,
    ctx.outcomesMap!,
    componentResult.output as ComponentPlan,
    ctx.audienceProfile!
  )

  return [componentResult, optimizerResult]
}

async function runHandoffStage(
  ctx: PipelineContext
): Promise<AgentResult<unknown>> {
  // Lightweight handoff checker: aggregates prior stage outputs
  // and validates completeness programmatically
  const issues: string[] = []

  if (!ctx.brief) issues.push('Missing project brief')
  if (!ctx.archetype) issues.push('Missing archetype')
  if (!ctx.audienceProfile) issues.push('Missing audience profile')
  if (!ctx.structure) issues.push('Missing course structure')
  if (!ctx.outcomesMap) issues.push('Missing learning outcomes')
  if (!ctx.componentPlan) issues.push('Missing component plan')

  const ready = issues.length === 0

  const handoffPackage = {
    ready,
    issues,
    summary: {
      archetype: ctx.archetype,
      brief: ctx.brief?.slice(0, 200),
      hasAudienceProfile: !!ctx.audienceProfile,
      hasStructure: !!ctx.structure,
      hasOutcomes: !!ctx.outcomesMap,
      hasComponents: !!ctx.componentPlan,
    },
    productionReadiness: ready
      ? 'All ideation stages complete. Ready for Phase 1 production.'
      : `Blocked: ${issues.join(', ')}`,
  }

  return {
    agentId: 'handoff-checker',
    success: true,
    output: handoffPackage,
    durationMs: 0,
    modelUsed: 'none',
    tokensIn: 0,
    tokensOut: 0,
    costUSD: 0,
  }
}

// ---------------------------------------------------------------------------
// createRealAgentExecutor
// ---------------------------------------------------------------------------

export function createRealAgentExecutor(
  costTracker?: ReturnType<typeof createCostTracker>
): AgentExecutor {
  return async (
    agents: AgentConfig[],
    context: unknown,
    state: LoopState<unknown>
  ): Promise<unknown> => {
    const ctx = context as PipelineContext
    const stageId = state.stageId

    let results: AgentResult<unknown>[]

    switch (stageId) {
      case 'brief': {
        const result = await runBriefStage(ctx, agents, state)
        results = [result]
        break
      }
      case 'audience': {
        const result = await runAudienceStage(ctx)
        results = [result]
        break
      }
      case 'structure': {
        results = await runStructureStage(ctx)
        break
      }
      case 'components': {
        results = await runComponentsStage(ctx)
        break
      }
      case 'handoff': {
        const result = await runHandoffStage(ctx)
        results = [result]
        break
      }
      default:
        throw new Error(`Unknown stage ID: '${stageId}'. Valid stages: brief, audience, structure, components, handoff`)
    }

    // Track cost from all agent results
    if (costTracker) {
      for (const r of results) {
        costTracker.record(r)
      }
    }

    // Return the last successful agent's output as the artifact
    const lastSuccessful = [...results].reverse().find(r => r.success)
    if (!lastSuccessful || lastSuccessful.output === null) {
      const lastError = results[results.length - 1]?.error ?? 'Unknown error'
      throw new Error(`Stage '${stageId}' failed: ${lastError}`)
    }

    return lastSuccessful.output
  }
}

// ---------------------------------------------------------------------------
// createRealJudge — uses Anthropic Haiku for cross-model judging
// ---------------------------------------------------------------------------

const JUDGE_MODEL = 'claude-haiku-4-5-20251001'

export function createRealJudge(): JudgeFunction {
  const callJudgeModel = async (prompt: string): Promise<string> => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set — cannot run judge')
    }

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    if (!textBlock) {
      throw new Error('Judge model returned no text content')
    }

    return textBlock.text
  }

  return createJudgeFunction(callJudgeModel)
}

// ---------------------------------------------------------------------------
// getExecutorAndJudge — auto-detects API key, falls back to mocks
// ---------------------------------------------------------------------------

export interface ExecutorAndJudge {
  agentExecutor: AgentExecutor
  judge: JudgeFunction
  getCostReport: () => CostSnapshot
}

export function getExecutorAndJudge(): ExecutorAndJudge {
  if (process.env.ANTHROPIC_API_KEY) {
    const tracker = createCostTracker()
    return {
      agentExecutor: createRealAgentExecutor(tracker),
      judge: createRealJudge(),
      getCostReport: () => tracker.get(),
    }
  }

  return {
    agentExecutor: createMockAgentExecutor(),
    judge: createMockJudge(),
    getCostReport: () => ({ tokensIn: 0, tokensOut: 0, costUSD: 0, modelUsed: 'mock' }),
  }
}
