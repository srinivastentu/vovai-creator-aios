// Research Stage (Stage 2) assembly — Domain Workflow.
// Composes the Research Agent (Claude + web_search), the Source Curator
// (Claude), and the Research Judge (GPT-4o) into a Standard LoopStage and a
// matching AgentExecutor + JudgeFunction for the Core Loop Engine.
//
// All Core machinery is INJECTED (runLoop, judge, executor). The engine never
// imports this file; this file imports Core. Every collaborator is overridable
// so the stage runs fully mocked in unit tests (no API keys required).

import { createInitialState, runLoop } from '../../../core/engine/loop-engine'
import type {
  AgentConfig,
  AgentExecutor,
  GradeReport,
  IterationRecord,
  JudgeFunction,
  LoopStage,
  LoopState,
} from '../../../core/engine/types'
import { createWebSearchClient } from '../../../core/agentic/adapters/web-search-adapter'
import type { WebSearchRunner } from '../../../core/agentic/adapters/web-search-adapter'
import { createResearchAgent } from './agents/research-agent'
import type { ResearchAgent } from './agents/research-agent'
import { createSourceCurator } from './agents/source-curator'
import type { SourceCurator } from './agents/source-curator'
import { createResearchJudge } from './agents/research-judge'
import { RESEARCH_RUBRIC } from './rubrics/research-rubric'
import { validateDossier } from './validators/research-validator'
import type { ResearchContext, ResearchCostEvent, ResearchDossier } from './types'

const RESEARCH_THRESHOLD = 75
const RESEARCH_MIN_ITERATIONS = 2
const RESEARCH_MAX_ITERATIONS = 3

/** AgentConfig metadata for the stage (executor does the real work). */
export const RESEARCH_AGENTS: AgentConfig[] = [
  {
    id: 'research-agent',
    name: 'Research Agent (Claude + web_search)',
    model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
    maxRetries: 2,
    timeoutMs: 120_000,
  },
  {
    id: 'source-curator',
    name: 'Source Curator (Claude)',
    model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
    maxRetries: 2,
    timeoutMs: 60_000,
  },
]

/** Static stage definition (no live deps) — re-exported by pipeline-config. */
export const RESEARCH_STAGE: LoopStage<ResearchDossier> = {
  id: 'research',
  agents: RESEARCH_AGENTS,
  rubric: RESEARCH_RUBRIC,
  threshold: RESEARCH_THRESHOLD,
  maxIterations: RESEARCH_MAX_ITERATIONS,
  minIterations: RESEARCH_MIN_ITERATIONS,
  loopPattern: 'standard',
  validator: validateDossier,
}

export interface ResearchStageDeps {
  webSearch?: WebSearchRunner
  agent?: ResearchAgent
  curator?: SourceCurator
  judge?: JudgeFunction
  threshold?: number
  minIterations?: number
  maxIterations?: number
  maxSearches?: number
  maxSources?: number
  onCost?: (event: ResearchCostEvent) => void
}

export interface ResearchStage {
  stage: LoopStage<ResearchDossier>
  executor: AgentExecutor
  judge: JudgeFunction
  getTotalCostUSD: () => number
}

export function createResearchStage(deps: ResearchStageDeps = {}): ResearchStage {
  let totalCostUSD = 0
  const emit = (event: ResearchCostEvent) => {
    totalCostUSD += event.costUSD
    deps.onCost?.(event)
  }

  const agent =
    deps.agent ??
    createResearchAgent({
      webSearch: deps.webSearch ?? createWebSearchClient(),
      onCost: emit,
      maxSearches: deps.maxSearches,
    })

  const curator =
    deps.curator ?? createSourceCurator({ onCost: emit, maxSources: deps.maxSources })

  const judge = deps.judge ?? createResearchJudge({ onCost: emit })

  const executor: AgentExecutor = async (
    _agents,
    context,
    state: LoopState<unknown>
  ): Promise<ResearchDossier> => {
    const ctx = context as ResearchContext
    if (
      !ctx ||
      typeof ctx.ideaId !== 'string' ||
      typeof ctx.ideaTitle !== 'string' ||
      !Array.isArray(ctx.niches)
    ) {
      throw new Error('[research-stage] context must be a ResearchContext')
    }

    const prior = state.iterations[state.iterations.length - 1] ?? null
    const priorArtifact = state.currentArtifact as ResearchDossier | null

    const raw =
      prior?.grade && priorArtifact
        ? await agent.revise({
            context: ctx,
            previous: priorArtifact,
            grade: prior.grade as GradeReport,
          })
        : await agent.produce({ context: ctx })

    return curator.curate(raw, ctx)
  }

  const stage: LoopStage<ResearchDossier> = {
    ...RESEARCH_STAGE,
    threshold: deps.threshold ?? RESEARCH_THRESHOLD,
    minIterations: deps.minIterations ?? RESEARCH_MIN_ITERATIONS,
    maxIterations: deps.maxIterations ?? RESEARCH_MAX_ITERATIONS,
  }

  return { stage, executor, judge, getTotalCostUSD: () => totalCostUSD }
}

// ---------------------------------------------------------------------------
// Loop driver — runs the engine to a terminal state. Mirrors run-text-loop.
// ---------------------------------------------------------------------------

export interface ResearchIterationEvent {
  version: number
  score: number
  dimensionScores: { dimensionId: string; name: string; score: number }[]
  validationFailed: boolean
  sourceCount: number
}

export interface RunResearchLoopArgs {
  stage: ResearchStage
  context: ResearchContext
  onIteration?: (event: ResearchIterationEvent) => void
}

export interface RunResearchLoopResult {
  bestArtifact: ResearchDossier | null
  bestScore: number | null
  iterations: IterationRecord[]
  totalCostUSD: number
  finalState: LoopState<ResearchDossier>
  error?: { iteration: number; message: string }
}

export async function runResearchLoop(
  args: RunResearchLoopArgs
): Promise<RunResearchLoopResult> {
  const { stage, context, onIteration } = args
  let state = createInitialState<ResearchDossier>(stage.stage.id)
  const hardCap = stage.stage.maxIterations * 2 + 4

  let error: { iteration: number; message: string } | undefined
  for (let i = 0; i < hardCap; i++) {
    try {
      state = await runLoop<ResearchDossier>(
        stage.stage,
        state,
        context,
        stage.executor,
        stage.judge
      )
    } catch (err) {
      error = {
        iteration: state.iterations.length + 1,
        message: err instanceof Error ? err.message : String(err),
      }
      if (state.bestArtifact === null) throw err
      state = { ...state, status: 'presenting' }
      break
    }

    const latest = state.iterations[state.iterations.length - 1]
    const dossier = state.currentArtifact as ResearchDossier | null
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
        sourceCount: dossier?.sources.length ?? 0,
      })
    } else {
      onIteration?.({
        version: state.loopCount,
        score: 0,
        dimensionScores: [],
        validationFailed: true,
        sourceCount: dossier?.sources.length ?? 0,
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
    ...(error ? { error } : {}),
  }
}
