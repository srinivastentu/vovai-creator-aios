// Long-Form Master Stage (Stage 3) assembly — Domain Workflow.
// Composes the Long-Form Synthesizer (Claude, structured output) and the Master
// Judge (GPT-4o) into a Standard LoopStage and a matching AgentExecutor +
// JudgeFunction for the Core Loop Engine.
//
// All Core machinery is INJECTED (runLoop, judge, executor). The engine never
// imports this file; this file imports Core. Every collaborator is overridable
// so the stage runs fully mocked in unit tests (no API keys required).

import type Anthropic from '@anthropic-ai/sdk'
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
import { createLongFormSynthesizer } from './agents/long-form-synthesizer'
import type { LongFormSynthesizer } from './agents/long-form-synthesizer'
import { createMasterJudge } from './agents/long-form-master-judge'
import { LONG_FORM_MASTER_RUBRIC } from './rubrics/long-form-master-rubric'
import { validateMaster, masterWordCount } from './validators/long-form-master-validator'
import type { MasterArtifact, MasterContext, MasterCostEvent } from './types'

const MASTER_THRESHOLD = 80
const MASTER_MIN_ITERATIONS = 2
const MASTER_MAX_ITERATIONS = 4

/** AgentConfig metadata for the stage (executor does the real work). */
export const LONG_FORM_MASTER_AGENTS: AgentConfig[] = [
  {
    id: 'long-form-synthesizer',
    name: 'Long-Form Master Synthesizer (Claude)',
    model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
    maxRetries: 2,
    timeoutMs: 120_000,
  },
]

/** Static stage definition (no live deps) — re-exported by pipeline-config. */
export const LONG_FORM_MASTER_STAGE: LoopStage<MasterArtifact> = {
  id: 'long-form-master',
  agents: LONG_FORM_MASTER_AGENTS,
  rubric: LONG_FORM_MASTER_RUBRIC,
  threshold: MASTER_THRESHOLD,
  maxIterations: MASTER_MAX_ITERATIONS,
  minIterations: MASTER_MIN_ITERATIONS,
  loopPattern: 'standard',
  validator: validateMaster,
}

export interface MasterStageDeps {
  agent?: LongFormSynthesizer
  judge?: JudgeFunction
  /**
   * Transport for the internally-built synthesizer (injectable for tests, like
   * the research stage's `webSearch`). Ignored when `agent` is supplied.
   */
  client?: Anthropic
  /** Target voice for the default judge's personaAlignment dimension. */
  personaVoice?: string
  threshold?: number
  minIterations?: number
  maxIterations?: number
  onCost?: (event: MasterCostEvent) => void
}

export interface MasterStage {
  stage: LoopStage<MasterArtifact>
  executor: AgentExecutor
  judge: JudgeFunction
  getTotalCostUSD: () => number
}

export function createMasterStage(deps: MasterStageDeps = {}): MasterStage {
  let totalCostUSD = 0
  const emit = (event: MasterCostEvent) => {
    totalCostUSD += event.costUSD
    deps.onCost?.(event)
  }

  const agent =
    deps.agent ?? createLongFormSynthesizer({ client: deps.client, onCost: emit })
  const judge =
    deps.judge ?? createMasterJudge({ onCost: emit, personaVoice: deps.personaVoice })

  const executor: AgentExecutor = async (
    _agents,
    context,
    state: LoopState<unknown>
  ): Promise<MasterArtifact> => {
    const ctx = context as MasterContext
    if (
      !ctx ||
      typeof ctx.longFormMasterId !== 'string' ||
      typeof ctx.ideaTitle !== 'string' ||
      !Array.isArray(ctx.sources)
    ) {
      throw new Error('[long-form-master-stage] context must be a MasterContext')
    }

    const prior = state.iterations[state.iterations.length - 1] ?? null
    const priorArtifact = state.currentArtifact as MasterArtifact | null

    return prior?.grade && priorArtifact
      ? agent.revise({ context: ctx, previous: priorArtifact, grade: prior.grade as GradeReport })
      : agent.produce({ context: ctx })
  }

  const stage: LoopStage<MasterArtifact> = {
    ...LONG_FORM_MASTER_STAGE,
    threshold: deps.threshold ?? MASTER_THRESHOLD,
    minIterations: deps.minIterations ?? MASTER_MIN_ITERATIONS,
    maxIterations: deps.maxIterations ?? MASTER_MAX_ITERATIONS,
  }

  return { stage, executor, judge, getTotalCostUSD: () => totalCostUSD }
}

// ---------------------------------------------------------------------------
// Persistence mapping — pure, so it can be unit-tested without a DB.
// Maps a graded MasterArtifact into the shape the CLI writes via Prisma:
// the Master's new title + Gate-A status, and ordered sections each carrying
// their SourceRefs (section → ResearchSource links).
// ---------------------------------------------------------------------------

export interface MasterPersistenceSection {
  order: number
  heading: string
  contentMarkdown: string
  sourceRefs: { researchSourceId: string; relevanceSnippet: string }[]
}

export interface MasterPersistencePayload {
  title: string
  status: 'gate_a_pending'
  sections: MasterPersistenceSection[]
}

export function buildMasterPersistence(master: MasterArtifact): MasterPersistencePayload {
  return {
    title: master.title,
    status: 'gate_a_pending',
    sections: master.sections.map((s) => ({
      order: s.order,
      heading: s.heading,
      contentMarkdown: s.contentMarkdown,
      sourceRefs: s.sourceRefs.map((r) => ({
        researchSourceId: r.researchSourceId,
        relevanceSnippet: r.relevanceSnippet,
      })),
    })),
  }
}

// ---------------------------------------------------------------------------
// Loop driver — runs the engine to a terminal state. Mirrors runResearchLoop.
// ---------------------------------------------------------------------------

export interface MasterIterationEvent {
  version: number
  score: number
  dimensionScores: { dimensionId: string; name: string; score: number }[]
  validationFailed: boolean
  sectionCount: number
  wordCount: number
}

export interface RunMasterLoopArgs {
  stage: MasterStage
  context: MasterContext
  onIteration?: (event: MasterIterationEvent) => void
}

export interface RunMasterLoopResult {
  bestArtifact: MasterArtifact | null
  bestScore: number | null
  iterations: IterationRecord[]
  totalCostUSD: number
  finalState: LoopState<MasterArtifact>
  error?: { iteration: number; message: string }
}

export async function runMasterLoop(args: RunMasterLoopArgs): Promise<RunMasterLoopResult> {
  const { stage, context, onIteration } = args
  let state = createInitialState<MasterArtifact>(stage.stage.id)
  const hardCap = stage.stage.maxIterations * 2 + 4

  let error: { iteration: number; message: string } | undefined
  for (let i = 0; i < hardCap; i++) {
    try {
      state = await runLoop<MasterArtifact>(
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
    const master = state.currentArtifact as MasterArtifact | null
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
        sectionCount: master?.sections.length ?? 0,
        wordCount: master ? masterWordCount(master) : 0,
      })
    } else {
      onIteration?.({
        version: state.loopCount,
        score: 0,
        dimensionScores: [],
        validationFailed: true,
        sectionCount: master?.sections.length ?? 0,
        wordCount: master ? masterWordCount(master) : 0,
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
