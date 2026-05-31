// Single-Producer Stage (Stage 5, CR-4) assembly — Domain Workflow.
// Composes one Claude producer per artifact type (LinkedIn post / long-form
// article) with its deterministic validator into a Standard LoopStage plus a
// matching AgentExecutor + JudgeFunction for the Core Loop Engine.
//
// CR-5 wires the real cross-model judge: each stage grades its artifact with a
// Gemini judge (via the MMS gateway) against the per-type rubric
// (LINKEDIN_POST_RUBRIC / LONG_FORM_ARTICLE_RUBRIC). The deterministic validator
// still runs first (runLoop short-circuits to 'revising' on validator failure,
// skipping the expensive judge). On a sub-threshold grade the producer revises
// with PRESERVE/IMPROVE feedback. CR-7 swaps the stage to Cross-Critique (P5).
//
// The deterministic structural PASS-judge + placeholder rubric remain exported
// as a zero-cost test double (no API key needed); they are no longer the stage
// default. Cross-model discipline (loop rule 7) is enforced by assertCrossModel
// at build time — producer (Claude) and judge (Gemini) must differ.
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
import type { ModelGateway } from '../../../core/models/gateway'
import { calculateWeightedScore, checkThresholds } from '../../../core/agentic/grader'
import { createLinkedInProducer } from './agents/linkedin/producer-claude'
import { createArticleProducer } from './agents/article/producer-claude'
import { createLinkedInJudge } from './agents/linkedin/judge'
import { createArticleJudge } from './agents/article/judge'
import { DEFAULT_JUDGE_MODEL, type GeminiTextJudgeDeps } from './agents/gemini-text-judge'
import { LINKEDIN_POST_RUBRIC } from './rubrics/linkedin-post-rubric'
import { LONG_FORM_ARTICLE_RUBRIC } from './rubrics/article-rubric'
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

// CR-5 tuning. The real cross-model Gemini judge now provides an improvement
// signal, so min restores to 2 (a second pass always finds something) and the
// threshold rises to 75 (ramps to 80 in CR-7 with cross-critique).
const SINGLE_PRODUCER_THRESHOLD = 75
const SINGLE_PRODUCER_MIN_ITERATIONS = 2
const SINGLE_PRODUCER_MAX_ITERATIONS = 3

/**
 * Structural placeholder rubric — retained as a zero-cost test double. Satisfies
 * the engine contract (weights sum to 1.0; a completeness dimension ≥ 0.20 per
 * Forge ADOPT 6). The stage defaults (CR-5) use the real per-type rubrics
 * (LINKEDIN_POST_RUBRIC / LONG_FORM_ARTICLE_RUBRIC) + the Gemini judge; this
 * rubric + createStructuralPassJudge let unit tests run the loop without an API.
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
 * Deterministic structural pass-judge — a zero-cost test double (no API call).
 * Returns a fixed passing grade for any artifact. The CR-5 stage default is the
 * cross-model Gemini judge; this is injected via `deps.judge` in unit tests that
 * exercise the loop without hitting the gateway.
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
  rubric: LINKEDIN_POST_RUBRIC,
  threshold: SINGLE_PRODUCER_THRESHOLD,
  maxIterations: SINGLE_PRODUCER_MAX_ITERATIONS,
  minIterations: SINGLE_PRODUCER_MIN_ITERATIONS,
  loopPattern: 'standard',
  validator: validateLinkedInPost,
}

export const SINGLE_PRODUCER_ARTICLE_STAGE: LoopStage<ArticleArtifact> = {
  id: 'single-producer-article',
  agents: SINGLE_PRODUCER_ARTICLE_AGENTS,
  rubric: LONG_FORM_ARTICLE_RUBRIC,
  threshold: SINGLE_PRODUCER_THRESHOLD,
  maxIterations: SINGLE_PRODUCER_MAX_ITERATIONS,
  minIterations: SINGLE_PRODUCER_MIN_ITERATIONS,
  loopPattern: 'standard',
  validator: validateArticle,
}

// ─── Stage factory ────────────────────────────────────────────────────────────

/**
 * Generic single-producer shape: produces an artifact T from a RepurposeContext,
 * and (CR-5) revises it from the judge's grade. `revise` is optional so a mock
 * producer that only defines `produce` still drives the loop (the executor falls
 * back to produce on revise turns).
 */
export interface Producer<T> {
  produce(args: { context: RepurposeContext }): Promise<T>
  revise?(args: { context: RepurposeContext; previous: T; grade: GradeReport }): Promise<T>
}

/** Wiring spec per artifact type — keeps the factory DRY across both stages. */
interface ProducerStageSpec<T> {
  staticStage: LoopStage<T>
  createProducer: (deps: {
    client?: Anthropic
    onCost?: (event: RepurposeCostEvent) => void
  }) => Producer<T>
  createJudge: (deps: GeminiTextJudgeDeps) => JudgeFunction
}

const LINKEDIN_SPEC: ProducerStageSpec<LinkedInArtifact> = {
  staticStage: SINGLE_PRODUCER_LINKEDIN_STAGE,
  createProducer: (deps) => createLinkedInProducer(deps),
  createJudge: (deps) => createLinkedInJudge(deps),
}

const ARTICLE_SPEC: ProducerStageSpec<ArticleArtifact> = {
  staticStage: SINGLE_PRODUCER_ARTICLE_STAGE,
  createProducer: (deps) => createArticleProducer(deps),
  createJudge: (deps) => createArticleJudge(deps),
}

/**
 * Model-family classification for the cross-model guard. Generic, but domain-
 * local in CR-5; TODO(CR-6): the Core engine centralizes this at cross-critique
 * iteration start.
 */
function modelFamily(modelId: string): string {
  const m = modelId.toLowerCase()
  if (m.includes('claude')) return 'anthropic'
  if (m.includes('gemini') || m.startsWith('google')) return 'google'
  if (m.includes('gpt') || m.startsWith('o1') || m.startsWith('o3')) return 'openai'
  return m
}

/**
 * Cross-model enforcement (loop rule 7 / Pattern-5 rule 10): the producer and
 * the judge MUST be different model families. Throws at stage-build time on
 * overlap — an agent cannot grade its own output.
 */
export function assertCrossModel(producerModel: string, judgeModel: string): void {
  if (modelFamily(producerModel) === modelFamily(judgeModel)) {
    throw new Error(
      `[single-producer-stage] producer (${producerModel}) and judge (${judgeModel}) ` +
        'must be different model families (loop rule 7 / Pattern-5 rule 10)'
    )
  }
}

export interface SingleProducerStageDeps<T> {
  /** Inject a fully-built producer (tests). Ignored when omitted — one is built. */
  producer?: Producer<T>
  /** Inject the judge (tests). Defaults to the cross-model Gemini judge. */
  judge?: JudgeFunction
  /** Transport for the internally-built producer (injectable for tests). */
  client?: Anthropic
  /** MMS gateway the default judge routes through (injectable for tests). */
  gateway?: ModelGateway
  /** Judge model id (cross-model vs the Claude producer). Default gemini-2.5-pro. */
  judgeModelId?: string
  /** Persona voice + audience block for the judge's personaFit / audienceFit dims. */
  personaContext?: string
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

  // Build the judge first — its cross-model guard (assertCrossModel) validates
  // the producer/judge family split before anything else is constructed.
  let judge: JudgeFunction
  if (deps.judge) {
    judge = deps.judge
  } else {
    const producerModel = spec.staticStage.agents[0]?.model.primary ?? ''
    const judgeModelId = deps.judgeModelId ?? DEFAULT_JUDGE_MODEL
    assertCrossModel(producerModel, judgeModelId)
    judge = spec.createJudge({
      gateway: deps.gateway,
      modelId: judgeModelId,
      personaContext: deps.personaContext,
      onCost: emit,
    })
  }

  const producer = deps.producer ?? spec.createProducer({ client: deps.client, onCost: emit })

  const executor: AgentExecutor = async (
    _agents,
    context,
    state: LoopState<unknown>
  ): Promise<T> => {
    const ctx = context as RepurposeContext
    if (
      !ctx ||
      typeof ctx.longFormMasterId !== 'string' ||
      typeof ctx.artifactType !== 'string' ||
      !Array.isArray(ctx.sections)
    ) {
      throw new Error('[single-producer-stage] context must be a RepurposeContext')
    }
    // On a graded prior iteration, revise with PRESERVE/IMPROVE (loop rule 4);
    // otherwise produce a fresh draft. A validator failure short-circuits before
    // a grade exists, so it re-produces. (Mock producers without revise also
    // re-produce.)
    const prior = state.iterations[state.iterations.length - 1] ?? null
    const priorArtifact = state.currentArtifact as T | null
    if (prior?.grade && priorArtifact && producer.revise) {
      return producer.revise({
        context: ctx,
        previous: priorArtifact,
        grade: prior.grade as GradeReport,
      })
    }
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
  /** Per-dimension judge scores for this iteration (empty on validator failure). */
  dimensionScores: { dimensionId: string; name: string; score: number }[]
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
      dimensionScores:
        produced && latest?.grade
          ? latest.grade.dimensionScores.map((d) => ({
              dimensionId: d.dimensionId,
              name: d.name,
              score: d.score,
            }))
          : [],
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
