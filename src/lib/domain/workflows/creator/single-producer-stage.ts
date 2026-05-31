// Single-Producer Stage (Stage 5, CR-4) assembly — Domain Workflow.
// Composes one Claude producer per artifact type (LinkedIn post / long-form
// article) with its deterministic validator into a Standard LoopStage plus a
// matching AgentExecutor + JudgeFunction for the Core Loop Engine.
//
// CR-4 ships NO LLM quality judge — that lands in CR-5, and CR-7 swaps the
// stage to the Cross-Critique pattern (Pattern 5). But the Core engine requires
// a JudgeFunction and every LoopStage requires a `rubric`. So this file injects:
//   • a placeholder STRUCTURAL rubric (one completeness dimension), and
//   • a deterministic structural PASS-judge that returns a fixed passing grade.
// runLoop only reaches the judge AFTER the validator passes (validator failure
// short-circuits to 'revising'), so the deterministic validator is CR-4's ONLY
// real quality gate; the structural judge is a no-op that lets the Standard loop
// terminate. CR-5 replaces both with the real per-type rubrics + Gemini judge.
//
// All Core machinery is INJECTED (runLoop, judge, executor). The engine never
// imports this file; this file imports Core. Every collaborator is overridable
// so the stage runs fully mocked in unit tests (no API keys required).

import type Anthropic from '@anthropic-ai/sdk'
import { createInitialState, runLoop } from '../../../core/engine/loop-engine'
import type {
  AgentConfig,
  AgentExecutor,
  DimensionScore,
  GradeReport,
  IterationRecord,
  JudgeFunction,
  LoopStage,
  LoopState,
  RubricDefinition,
} from '../../../core/engine/types'
import { calculateWeightedScore, checkThresholds } from '../../../core/agentic/grader'
import { createLinkedInProducer } from './agents/linkedin/producer-claude'
import { createArticleProducer } from './agents/article/producer-claude'
import { validateLinkedInPost } from './validators/linkedin-post-validator'
import { validateArticle } from './validators/article-validator'
import type {
  ArticleArtifact,
  ArtifactKind,
  LinkedInArtifact,
  RepurposeArtifact,
  RepurposeContext,
  RepurposeCostEvent,
} from './types'

// CR-4 tuning. Lower bar than Stage 3 — the real rubric judge + threshold ramp
// to 80 land in CR-5/CR-7. min=1: a structurally valid first draft presents.
const SINGLE_PRODUCER_THRESHOLD = 70
const SINGLE_PRODUCER_MIN_ITERATIONS = 1
const SINGLE_PRODUCER_MAX_ITERATIONS = 2

/**
 * CR-4 placeholder rubric. Satisfies the engine contract (LoopStage.rubric is
 * required; weights sum to 1.0; a completeness dimension ≥ 0.20 per Forge
 * ADOPT 6). The structural judge below ignores the anchors and returns a fixed
 * pass once the deterministic validator has passed.
 * TODO(CR-5): replace with LINKEDIN_POST_RUBRIC / LONG_FORM_ARTICLE_RUBRIC
 * (docs/02-domain/rubrics.md) and wire the real Gemini judge.
 */
export const SINGLE_PRODUCER_STRUCTURAL_RUBRIC: RubricDefinition = {
  id: 'single-producer-structural',
  name: 'Single-Producer Structural Pass (CR-4 placeholder)',
  passThreshold: SINGLE_PRODUCER_THRESHOLD,
  dimensions: [
    {
      id: 'completeness',
      name: 'Structural Completeness',
      weight: 1.0,
      passThreshold: 7,
      description:
        'Passed the deterministic Stage-5 validator (length + structure). No LLM quality judgment in CR-4.',
      criteria: {
        '1': 'Failed the structural validator.',
        '7': 'Passed the structural validator.',
      },
    },
  ],
}

// Fixed score the structural judge assigns each dimension (> pass bar 7 → a
// composite of 80, comfortably ≥ the CR-4 threshold of 70).
const STRUCTURAL_PASS_SCORE = 8

/**
 * Deterministic CR-4 judge. runLoop only invokes the judge AFTER the validator
 * passes, so a structurally valid artifact is the precondition here — we return
 * a fixed passing grade. Zero cost, no API call. CR-5 replaces this with the
 * cross-model Gemini judge that grades against the real rubric.
 */
export function createStructuralPassJudge(): JudgeFunction {
  return async (_artifact, rubric): Promise<GradeReport> => {
    const dimensionScores: DimensionScore[] = rubric.dimensions.map((d) => ({
      dimensionId: d.id,
      name: d.name,
      score: STRUCTURAL_PASS_SCORE,
      weight: d.weight,
      feedback: 'Structural validation passed (CR-4 has no LLM quality judge).',
    }))
    // Same composite formula as the real judges (rubrics.md Rule 4), by code.
    const overallScore = Math.round(calculateWeightedScore(dimensionScores) * 10 * 100) / 100
    const draft: GradeReport = {
      overallScore,
      passesThreshold: false,
      dimensionScores,
      recommendation: 'Structurally valid (CR-4 structural pass).',
      improvementPriorities: [],
    }
    draft.passesThreshold = checkThresholds(draft, rubric).passes
    return draft
  }
}

// ─── Agent metadata (executor does the real work) ─────────────────────────────

export const SINGLE_PRODUCER_LINKEDIN_AGENTS: AgentConfig[] = [
  {
    id: 'linkedin-producer-claude',
    name: 'LinkedIn Post Producer (Claude)',
    model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
    maxRetries: 2,
    timeoutMs: 120_000,
  },
]

export const SINGLE_PRODUCER_ARTICLE_AGENTS: AgentConfig[] = [
  {
    id: 'article-producer-claude',
    name: 'Long-Form Article Producer (Claude)',
    model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
    maxRetries: 2,
    timeoutMs: 120_000,
  },
]

// ─── Static stage definitions (no live deps) — re-exported by pipeline-config ──

export const SINGLE_PRODUCER_LINKEDIN_STAGE: LoopStage<LinkedInArtifact> = {
  id: 'single-producer-linkedin',
  agents: SINGLE_PRODUCER_LINKEDIN_AGENTS,
  rubric: SINGLE_PRODUCER_STRUCTURAL_RUBRIC,
  threshold: SINGLE_PRODUCER_THRESHOLD,
  maxIterations: SINGLE_PRODUCER_MAX_ITERATIONS,
  minIterations: SINGLE_PRODUCER_MIN_ITERATIONS,
  loopPattern: 'standard',
  validator: validateLinkedInPost,
}

export const SINGLE_PRODUCER_ARTICLE_STAGE: LoopStage<ArticleArtifact> = {
  id: 'single-producer-article',
  agents: SINGLE_PRODUCER_ARTICLE_AGENTS,
  rubric: SINGLE_PRODUCER_STRUCTURAL_RUBRIC,
  threshold: SINGLE_PRODUCER_THRESHOLD,
  maxIterations: SINGLE_PRODUCER_MAX_ITERATIONS,
  minIterations: SINGLE_PRODUCER_MIN_ITERATIONS,
  loopPattern: 'standard',
  validator: validateArticle,
}

// ─── Stage factory ────────────────────────────────────────────────────────────

/** Generic single-producer shape: produces an artifact T from a RepurposeContext. */
export interface Producer<T> {
  produce(args: { context: RepurposeContext }): Promise<T>
}

/** Wiring spec per artifact type — keeps the factory DRY across both stages. */
interface ProducerStageSpec<T> {
  staticStage: LoopStage<T>
  createProducer: (deps: {
    client?: Anthropic
    onCost?: (event: RepurposeCostEvent) => void
  }) => Producer<T>
}

const LINKEDIN_SPEC: ProducerStageSpec<LinkedInArtifact> = {
  staticStage: SINGLE_PRODUCER_LINKEDIN_STAGE,
  createProducer: (deps) => createLinkedInProducer(deps),
}

const ARTICLE_SPEC: ProducerStageSpec<ArticleArtifact> = {
  staticStage: SINGLE_PRODUCER_ARTICLE_STAGE,
  createProducer: (deps) => createArticleProducer(deps),
}

export interface SingleProducerStageDeps<T> {
  /** Inject a fully-built producer (tests). Ignored when omitted — one is built. */
  producer?: Producer<T>
  /** Override the judge (tests). Defaults to the deterministic structural pass-judge. */
  judge?: JudgeFunction
  /** Transport for the internally-built producer (injectable for tests). */
  client?: Anthropic
  threshold?: number
  minIterations?: number
  maxIterations?: number
  onCost?: (event: RepurposeCostEvent) => void
}

export interface SingleProducerStage<T> {
  stage: LoopStage<T>
  executor: AgentExecutor
  judge: JudgeFunction
  getTotalCostUSD: () => number
}

function buildStage<T>(
  spec: ProducerStageSpec<T>,
  deps: SingleProducerStageDeps<T>
): SingleProducerStage<T> {
  let totalCostUSD = 0
  const emit = (event: RepurposeCostEvent) => {
    totalCostUSD += event.costUSD
    deps.onCost?.(event)
  }

  const producer = deps.producer ?? spec.createProducer({ client: deps.client, onCost: emit })
  const judge = deps.judge ?? createStructuralPassJudge()

  const executor: AgentExecutor = async (_agents, context): Promise<T> => {
    const ctx = context as RepurposeContext
    if (
      !ctx ||
      typeof ctx.longFormMasterId !== 'string' ||
      typeof ctx.artifactType !== 'string' ||
      !Array.isArray(ctx.sections)
    ) {
      throw new Error('[single-producer-stage] context must be a RepurposeContext')
    }
    // CR-4 is produce-only: with no quality judge there is no PRESERVE/IMPROVE
    // revise signal. A validator failure re-produces a fresh draft (the engine
    // skips the judge and loops). Cross-critique revision lands in CR-7.
    return producer.produce({ context: ctx })
  }

  const stage: LoopStage<T> = {
    ...spec.staticStage,
    threshold: deps.threshold ?? spec.staticStage.threshold,
    minIterations: deps.minIterations ?? spec.staticStage.minIterations,
    maxIterations: deps.maxIterations ?? spec.staticStage.maxIterations,
  }

  return { stage, executor, judge, getTotalCostUSD: () => totalCostUSD }
}

export function createLinkedInStage(
  deps: SingleProducerStageDeps<LinkedInArtifact> = {}
): SingleProducerStage<LinkedInArtifact> {
  return buildStage(LINKEDIN_SPEC, deps)
}

export function createArticleStage(
  deps: SingleProducerStageDeps<ArticleArtifact> = {}
): SingleProducerStage<ArticleArtifact> {
  return buildStage(ARTICLE_SPEC, deps)
}

// ─── Loop driver — runs the engine to a terminal state. Mirrors runMasterLoop ──

export interface ProducerIterationEvent {
  version: number
  score: number
  validationFailed: boolean
}

export interface RunProducerLoopArgs<T> {
  stage: SingleProducerStage<T>
  context: RepurposeContext
  onIteration?: (event: ProducerIterationEvent) => void
}

export interface RunProducerLoopResult<T> {
  bestArtifact: T | null
  bestScore: number | null
  iterations: IterationRecord[]
  totalCostUSD: number
  finalState: LoopState<T>
  error?: { iteration: number; message: string }
}

export async function runProducerLoop<T>(
  args: RunProducerLoopArgs<T>
): Promise<RunProducerLoopResult<T>> {
  const { stage, context, onIteration } = args
  let state = createInitialState<T>(stage.stage.id)
  const hardCap = stage.stage.maxIterations * 2 + 4

  let error: { iteration: number; message: string } | undefined
  for (let i = 0; i < hardCap; i++) {
    const prevCount = state.iterations.length
    try {
      state = await runLoop<T>(stage.stage, state, context, stage.executor, stage.judge)
    } catch (err) {
      error = {
        iteration: state.iterations.length + 1,
        message: err instanceof Error ? err.message : String(err),
      }
      if (state.bestArtifact === null) throw err
      state = { ...state, status: 'presenting' }
      break
    }

    // A validator failure short-circuits before an iteration record is pushed.
    const produced = state.iterations.length > prevCount
    const latest = state.iterations[state.iterations.length - 1]
    onIteration?.({
      version: state.loopCount,
      score: produced ? (latest?.grade?.overallScore ?? 0) : 0,
      validationFailed: !produced,
    })

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

// ─── Persistence mapping — pure, so it can be unit-tested without a DB ─────────
// Maps a produced artifact into the shape the CLI writes via Prisma as an
// Artifact row.

export interface ArtifactPersistencePayload {
  artifactType: ArtifactKind
  content: RepurposeArtifact
  // CR-4 marks every artifact 'cross_critique' for forward-compat (entities.md
  // reconciliation: enum members are underscored). It becomes literally true
  // once CR-7 wires the Cross-Critique pattern.
  derivedVia: 'cross_critique'
  parentArtifactIds: string[]
  status: 'awaiting_review'
  // CR-4 has no LLM quality judge, so there is no real quality score to persist.
  // CR-5 fills this from the Gemini judge's composite.
  bestScore: number | null
  costUSD: number
}

export function buildArtifactPersistence(
  artifactType: ArtifactKind,
  artifact: RepurposeArtifact,
  costUSD: number,
  bestScore: number | null = null
): ArtifactPersistencePayload {
  return {
    artifactType,
    content: artifact,
    derivedVia: 'cross_critique',
    parentArtifactIds: [],
    status: 'awaiting_review',
    bestScore,
    costUSD,
  }
}
