// Text generation stage — composes producer + judge + validators into a LoopStage.
// Domain-agnostic: any text-generation task can reuse this wiring.
// Swap producer/judge/rubric for other modalities (image, audio, video).

import type {
  AgentConfig,
  AgentExecutor,
  GradeReport,
  JudgeFunction,
  LoopStage,
  LoopState,
  RubricDefinition,
} from '../../engine/types'
import type { Artifact, ProducerAdapter } from '../adapters/types'
import { createClaudeTextAdapter } from '../adapters/text-adapter'
import { createOpenAITextJudge } from '../adapters/text-judge'
import type { JudgeCostEvent } from '../adapters/text-judge'
import { createTextFactAuditor } from '../adapters/text-fact-auditor'
import type { FactAuditorCostEvent } from '../adapters/text-fact-auditor'
import { TEXT_RUBRIC } from '../rubrics/text-rubric'
import { createTextValidators, toStageValidator } from '../validators'
import type { TextValidatorOptions, Validator } from '../validators'

export interface TextStageContext {
  goal: string
  systemPrompt: string
  maxTokens?: number
}

export interface ProducerCostEvent {
  model: string
  tokensIn: number
  tokensOut: number
  costUSD: number
  phase: 'produce' | 'revise'
  version: number
}

export interface TextStageCostEvent {
  source: 'producer' | 'judge' | 'auditor'
  model: string
  tokensIn: number
  tokensOut: number
  costUSD: number
}

export interface TextGenerationStageOptions {
  id?: string
  threshold?: number
  minIterations?: number
  maxIterations?: number
  producer?: ProducerAdapter<string>
  judge?: JudgeFunction
  rubric?: RubricDefinition
  validators?: Validator[]
  validatorOptions?: TextValidatorOptions
  agents?: AgentConfig[]
  onCost?: (event: TextStageCostEvent) => void
  /** Run a GPT-4o-mini fact auditor before the judge. Default true. */
  factAudit?: boolean
  /** If v ≥ threshold but any dimension < elevateThreshold, force one more iteration. */
  elevateThreshold?: number
  /** Cumulative cost ceiling (USD). If next iteration would exceed, skip elevate. */
  costCeilingUSD?: number
}

export interface TextGenerationStage {
  stage: LoopStage<string>
  executor: AgentExecutor
  judge: JudgeFunction
  getTotalCostUSD: () => number
}

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'text-producer',
    name: 'Claude Text Producer',
    model: {
      primary: 'claude-sonnet-4-20250514',
      fallback: 'claude-haiku-4-5-20251001',
    },
    maxRetries: 2,
    timeoutMs: 60_000,
  },
]

export function createTextGenerationStage(
  opts: TextGenerationStageOptions = {}
): TextGenerationStage {
  const id = opts.id ?? 'text-generation'
  const threshold = opts.threshold ?? 7.5
  const minIterations = opts.minIterations ?? 2
  const maxIterations = opts.maxIterations ?? 5
  const rubric = opts.rubric ?? TEXT_RUBRIC
  const validators = opts.validators ?? createTextValidators(opts.validatorOptions)
  const agents = opts.agents ?? DEFAULT_AGENTS

  let totalCostUSD = 0
  const emit = (event: TextStageCostEvent) => {
    totalCostUSD += event.costUSD
    opts.onCost?.(event)
  }

  const producer: ProducerAdapter<string> = opts.producer ?? createClaudeTextAdapter()

  const factAuditEnabled = opts.factAudit ?? true
  const auditorFn =
    !opts.judge && factAuditEnabled
      ? createTextFactAuditor({
          onCost: (e: FactAuditorCostEvent) =>
            emit({
              source: 'auditor',
              model: e.model,
              tokensIn: e.tokensIn,
              tokensOut: e.tokensOut,
              costUSD: e.costUSD,
            }),
        })
      : undefined

  const judgeFn: JudgeFunction =
    opts.judge ??
    createOpenAITextJudge({
      factAuditor: auditorFn,
      onCost: (e: JudgeCostEvent) =>
        emit({
          source: 'judge',
          model: e.model,
          tokensIn: e.tokensIn,
          tokensOut: e.tokensOut,
          costUSD: e.costUSD,
        }),
    })

  const trackProducer = (artifact: Artifact<string>, phase: 'produce' | 'revise') => {
    emit({
      source: 'producer',
      model: artifact.modelUsed,
      tokensIn: artifact.tokensIn,
      tokensOut: artifact.tokensOut,
      costUSD: artifact.costUSD,
    })
    return artifact
  }

  const executor: AgentExecutor = async (
    _agents,
    context,
    state: LoopState<unknown>
  ) => {
    const ctx = context as TextStageContext
    if (!ctx || typeof ctx.goal !== 'string' || typeof ctx.systemPrompt !== 'string') {
      throw new Error('[text-stage] context must include { goal, systemPrompt }')
    }

    const prior = state.iterations[state.iterations.length - 1] ?? null
    const priorArtifact = state.currentArtifact as string | null
    const humanFeedback =
      state.humanFeedback.length > 0 ? state.humanFeedback.join('\n') : undefined

    if (prior && prior.grade && typeof priorArtifact === 'string') {
      const revised = await producer.revise({
        goal: ctx.goal,
        systemPrompt: ctx.systemPrompt,
        maxTokens: ctx.maxTokens,
        previous: {
          id: prior.artifactId,
          version: prior.version,
          kind: 'text',
          content: priorArtifact,
          createdAt: prior.createdAt,
          modelUsed: prior.modelUsed,
          tokensIn: prior.tokensIn,
          tokensOut: prior.tokensOut,
          costUSD: prior.costUSD,
        },
        grade: prior.grade as GradeReport,
        humanFeedback,
      })
      trackProducer(revised, 'revise')
      return revised.content
    }

    const fresh = await producer.produce({
      goal: ctx.goal,
      systemPrompt: ctx.systemPrompt,
      maxTokens: ctx.maxTokens,
    })
    trackProducer(fresh, 'produce')
    return fresh.content
  }

  const elevateThreshold = opts.elevateThreshold
  const costCeilingUSD = opts.costCeilingUSD

  const shouldContinue = (state: LoopState<string>): boolean => {
    if (elevateThreshold === undefined) return false
    const last = state.iterations[state.iterations.length - 1]
    const grade = last?.grade
    if (!grade) return false
    // Only elevate if overall already passed threshold but some dim is below elevate.
    const minDim = Math.min(...grade.dimensionScores.map((d) => d.score))
    if (minDim >= elevateThreshold) return false
    // Budget check: skip elevate only if we've already hit the ceiling.
    // Accept one overrun rather than forfeit the elevate at the boundary.
    if (costCeilingUSD !== undefined && totalCostUSD >= costCeilingUSD) return false
    return true
  }

  const stage: LoopStage<string> = {
    id,
    agents,
    rubric,
    threshold,
    maxIterations,
    minIterations,
    loopPattern: 'standard',
    validator: toStageValidator<string>(validators as Validator<string>[]),
    shouldContinue,
  }

  return {
    stage,
    executor,
    judge: judgeFn,
    getTotalCostUSD: () => totalCostUSD,
  }
}
