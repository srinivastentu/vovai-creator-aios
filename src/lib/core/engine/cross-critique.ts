// Cross-Critique Loop Pattern (Pattern 5) — runtime.
//
// Two (or more) producers generate in parallel from the SAME task, differing
// only by model (sent via gateway.requestMultiple). Each critic reads ONE
// producer's output and critiques it (parallel, individual requests — the
// targets differ). An integrator synthesizes all producer outputs + critiques
// into one artifact (sequential). A judge — a different model family from every
// producer and the integrator — grades it. The cycle repeats until threshold,
// budget, or max iterations, whichever fires first.
//
// Zero imports from core/agentic/, core/review/, or domain/. The gateway type is
// Core (core/models) — a Core→Core import, the same one tournament.ts makes. The
// PROMPTS and PARSING are injected via CrossCritiqueAdapter so the engine never
// knows what a "LinkedIn post" is: it owns orchestration, cost, the cross-model
// guard, and termination; the domain owns what each role says (wired in CR-7).

import type { ModelGateway } from '../models/gateway'
import type {
  Capability,
  GatewayContext,
  GatewayRequestParams,
  GatewayResponse,
} from '../models/types'
import type {
  CrossCritiqueConfig,
  CrossCritiqueIterationRecord,
  GradeReport,
  JudgeFunction,
  LoopStage,
  LoopState,
} from './types'

// ---------------------------------------------------------------------------
// Model-family classification + cross-model guard (Pattern-5 rule 10)
// ---------------------------------------------------------------------------

/**
 * Structural model-family classifier. Lifts the domain-local `modelFamily`
 * (single-producer-stage.ts, TODO(CR-6)) into Core so there is one definition.
 *
 * This is the default. CR-7 can inject a catalog-backed resolver
 * (CrossCritiqueRunnerOptions.classifyFamily) that compares MMS `providerId`s
 * (per the CR-5 sign-off follow-up) instead of substring matching.
 */
export function classifyModelFamily(modelId: string): string {
  const m = modelId.toLowerCase()
  if (m.includes('claude') || m.startsWith('anthropic')) return 'anthropic'
  if (m.includes('gemini') || m.startsWith('google') || m.includes('imagen')) return 'google'
  if (
    m.includes('gpt') ||
    m.includes('openai') ||
    m.includes('dall-e') ||
    m.startsWith('o1') ||
    m.startsWith('o3') ||
    m.startsWith('o4')
  ) {
    return 'openai'
  }
  return m
}

/**
 * Pattern-5 rule 10: the JUDGE must be a different model family from every
 * producer AND the integrator (self-preference bias — a model inflates its own
 * family's output). Producers and the integrator MAY share a family: V1 uses
 * Claude as both Producer A and the integrator, which is intentional. Throws on
 * any judge/producer or judge/integrator overlap. Called at iteration start,
 * before any spend.
 */
export function assertCrossCritiqueModels(
  config: CrossCritiqueConfig,
  familyOf: (modelId: string) => string = classifyModelFamily,
): void {
  const judgeModel = config.judgeAgent.model.primary
  const judgeFamily = familyOf(judgeModel)

  for (const producer of config.producers) {
    if (familyOf(producer.model.primary) === judgeFamily) {
      throw new Error(
        `[cross-critique] judge (${judgeModel}) and producer (${producer.model.primary}) ` +
          'must be different model families (Pattern-5 rule 10 — no self-preference bias)',
      )
    }
  }

  const integratorModel = config.integratorAgent.model.primary
  if (familyOf(integratorModel) === judgeFamily) {
    throw new Error(
      `[cross-critique] judge (${judgeModel}) and integrator (${integratorModel}) ` +
        'must be different model families (Pattern-5 rule 10 — no self-preference bias)',
    )
  }
}

// ---------------------------------------------------------------------------
// Injected adapter — the domain seam (prompts + parsing). Zero domain words.
// ---------------------------------------------------------------------------

export interface CrossCritiqueProducerInput {
  /** Stage context (LFM, persona, etc.) the domain assembled. Opaque to the engine. */
  context: unknown
  /** PRESERVE/IMPROVE feedback from the best grade so far (rule 11: never the rubric). */
  feedback: string | null
  /** 1-based iteration number. */
  iteration: number
}

export interface CrossCritiqueCriticInput<T> {
  context: unknown
  /** The critic doing the critique. */
  criticId: string
  /** The producer whose output is being critiqued. */
  targetProducerId: string
  /** That producer's artifact this iteration. */
  targetArtifact: T
}

export interface CrossCritiqueIntegratorInput<T> {
  context: unknown
  /** producerAgentId → artifact. */
  producerArtifacts: Record<string, T>
  /** criticAgentId → critique text. */
  critiques: Record<string, string>
  feedback: string | null
}

/** A built gateway call: the params the role sends, plus an optional timeout.
 *  `params` is GatewayRequestParams (the same shape the gateway expects) so named
 *  keys (prompt, content, …) stay typed end-to-end, not flattened to a bag. */
export interface CrossCritiqueCallSpec {
  params: GatewayRequestParams
  timeoutMs?: number
}

/**
 * The domain-supplied prompts + parsers for one cross-critique stage. The engine
 * builds the GatewayRequest from these specs and routes the call; it never reads
 * the params or the artifact shape. CR-7 implements this per artifact type
 * (LinkedIn post, long-form article).
 */
export interface CrossCritiqueAdapter<T> {
  /** Producer task params — shared across all producer models (requestMultiple). */
  producerRequest(input: CrossCritiqueProducerInput): CrossCritiqueCallSpec
  /** Critic params for one critic reading its target producer's artifact. */
  criticRequest(input: CrossCritiqueCriticInput<T>): CrossCritiqueCallSpec
  /** Integrator params reading all producer artifacts + critiques. */
  integratorRequest(input: CrossCritiqueIntegratorInput<T>): CrossCritiqueCallSpec
  /** Parse a producer / integrator text response into an artifact. Null = unusable. */
  parseArtifact(response: GatewayResponse): T | null
  /** Parse a critic text response into critique text. */
  parseCritique(response: GatewayResponse): string
  /** PRESERVE/IMPROVE feedback derived from the judge grade (rule 4 + rule 11). */
  feedbackFromGrade(grade: GradeReport): string
}

export interface CrossCritiqueRunnerOptions {
  /**
   * Maps a modelId → family key for the cross-model guard. Defaults to the
   * structural `classifyModelFamily`. CR-7 can inject a catalog-backed resolver
   * (MMS providerId) per the CR-5 follow-up.
   */
  classifyFamily?: (modelId: string) => string
  /**
   * The judge returns a GradeReport, not a cost — supply its USD cost for this
   * iteration so the budget cap (rule 12) accounts for it. The gateway already
   * recorded it in the ledger; this just feeds the in-loop accumulator.
   */
  getJudgeCostUsd?: () => number
  /** Base gateway context (callerTag, projectId). stageId + iterationNumber are added. */
  context?: Partial<GatewayContext>
  /** Capability for producer/critic/integrator text calls. Default 'text-generation'. */
  textCapability?: Capability
}

/** Bundle of cross-critique-only deps passed through runLoop to the runner. */
export interface CrossCritiqueDeps<T> {
  gateway: ModelGateway
  adapter: CrossCritiqueAdapter<T>
  options?: CrossCritiqueRunnerOptions
}

// ---------------------------------------------------------------------------
// runCrossCritiqueIteration — ONE iteration. The caller loops externally,
// exactly like runLoop's standard path (the engine never loops internally).
// ---------------------------------------------------------------------------

export async function runCrossCritiqueIteration<T>(
  gateway: ModelGateway,
  stage: LoopStage<T>,
  state: LoopState<T>,
  context: unknown,
  judge: JudgeFunction,
  adapter: CrossCritiqueAdapter<T>,
  options: CrossCritiqueRunnerOptions = {},
): Promise<LoopState<T>> {
  const config = stage.crossCritique
  if (!config) {
    throw new Error(
      `[cross-critique] stage ${stage.id} has loopPattern 'cross-critique' but no crossCritique config`,
    )
  }

  // Rule 10: enforce model disjointness BEFORE any spend.
  assertCrossCritiqueModels(config, options.classifyFamily)

  const capability: Capability = options.textCapability ?? 'text-generation'
  const baseContext: Partial<GatewayContext> = options.context ?? {}
  const iterationNumber = state.loopCount + 1
  const callContext: GatewayContext = { ...baseContext, stageId: stage.id, iterationNumber }

  // Rule 5: human feedback (from review) is injected into context for this one
  // iteration, then cleared — mirrors the standard loop's produce().
  const effectiveContext =
    state.humanFeedback.length > 0
      ? { ...(context as Record<string, unknown>), humanFeedback: state.humanFeedback }
      : context

  // Rule 4 + 11: producers revise against PRESERVE/IMPROVE from the best grade so
  // far (never the rubric text). Null on the first iteration.
  const feedback = state.bestGrade ? adapter.feedbackFromGrade(state.bestGrade) : null

  let iterationCostUSD = 0

  // ── 1. Producers — parallel, same params, different models (requestMultiple). ──
  const producerSpec = adapter.producerRequest({
    context: effectiveContext,
    feedback,
    iteration: iterationNumber,
  })
  const producerModelIds = config.producers.map((p) => p.model.primary)
  const producerResponses = await gateway.requestMultiple(
    {
      capability,
      params: producerSpec.params,
      preferences: { timeoutMs: producerSpec.timeoutMs },
      context: callContext,
    },
    producerModelIds,
  )

  const producerArtifacts: Record<string, T> = {}
  for (let i = 0; i < producerResponses.length; i++) {
    const response = producerResponses[i]
    iterationCostUSD += response.cost?.costUsd ?? 0
    const artifact = adapter.parseArtifact(response)
    if (artifact !== null) producerArtifacts[config.producers[i].id] = artifact
  }

  // ── 2. Critics — parallel; each reads ONE producer's artifact (distinct params,
  //       so individual gateway.request calls via Promise.all). ──
  const criticEntries = config.critics.map((critic) => ({
    critic,
    targetProducerId: config.criticAssignments[critic.id],
  }))
  const criticResponses = await Promise.all(
    criticEntries.map(({ critic, targetProducerId }) => {
      const targetArtifact = targetProducerId ? producerArtifacts[targetProducerId] : undefined
      // Skip a critic whose target produced nothing usable (rule 9).
      if (targetArtifact === undefined) return Promise.resolve<GatewayResponse | null>(null)
      const spec = adapter.criticRequest({
        context: effectiveContext,
        criticId: critic.id,
        targetProducerId,
        targetArtifact,
      })
      return gateway.request({
        capability,
        params: spec.params,
        preferences: { modelId: critic.model.primary, timeoutMs: spec.timeoutMs },
        context: callContext,
      })
    }),
  )

  const critiques: Record<string, string> = {}
  for (let i = 0; i < criticResponses.length; i++) {
    const response = criticResponses[i]
    if (response === null) continue
    iterationCostUSD += response.cost?.costUsd ?? 0
    critiques[criticEntries[i].critic.id] = adapter.parseCritique(response)
  }

  // ── 3. Integrator — sequential, single call. ──
  const integratorSpec = adapter.integratorRequest({
    context: effectiveContext,
    producerArtifacts,
    critiques,
    feedback,
  })
  const integratorResponse = await gateway.request({
    capability,
    params: integratorSpec.params,
    preferences: { modelId: config.integratorAgent.model.primary, timeoutMs: integratorSpec.timeoutMs },
    context: callContext,
  })
  iterationCostUSD += integratorResponse.cost?.costUsd ?? 0
  const integratedArtifact = adapter.parseArtifact(integratorResponse)

  // ── 4. Judge — sequential, fresh context (injected). Skipped when integration
  //       produced nothing usable (rule 9) OR the deterministic validator rejects
  //       the integrated artifact (rule 6: validators run BEFORE the costly judge,
  //       so we never pay the judge for a structurally invalid artifact). Either
  //       way judgeGrade stays null and the loop falls through to 'revising'. ──
  let judgeGrade: GradeReport | null = null
  if (integratedArtifact !== null) {
    const validation = stage.validator ? stage.validator(integratedArtifact) : null
    if (validation === null || validation.valid) {
      judgeGrade = await judge(integratedArtifact, stage.rubric)
      iterationCostUSD += options.getJudgeCostUsd ? options.getJudgeCostUsd() : 0
    }
  }

  // ── 5. Record the iteration (immutable). grade = judgeGrade and
  //       costUSD = iterationCostUSD so it slots into LoopState.iterations like
  //       any IterationRecord. ──
  const version = state.iterations.length + 1
  const record: CrossCritiqueIterationRecord = {
    artifactId: `${stage.id}-cc-v${version}`,
    version,
    grade: judgeGrade,
    modelUsed: config.integratorAgent.model.primary,
    tokensIn: 0,
    tokensOut: 0,
    costUSD: iterationCostUSD,
    createdAt: new Date(),
    producerArtifacts,
    critiques,
    integratedArtifact,
    judgeGrade,
    iterationCostUSD,
    // Dialectic-degradation signal (CR-7 follow-up): how many producers parsed to
    // a usable artifact. < config.producers.length means a producer dropped out
    // (rule 9) and the integration leaned on fewer voices than designed.
    producersSucceeded: Object.keys(producerArtifacts).length,
  }

  let current: LoopState<T> = {
    ...state,
    status: 'evaluating',
    currentArtifact: integratedArtifact,
    iterations: [...state.iterations, record],
    loopCount: state.loopCount + 1,
    cumulativeCostUSD: state.cumulativeCostUSD + iterationCostUSD,
    costUSD: state.costUSD + iterationCostUSD,
    humanFeedback: [], // rule 5: cleared after use
  }

  // ── 6. Best-artifact tracking (rule 2): the integrated artifact is presented. ──
  if (
    integratedArtifact !== null &&
    judgeGrade !== null &&
    (current.bestGrade === null || judgeGrade.overallScore > current.bestGrade.overallScore)
  ) {
    current = { ...current, bestArtifact: integratedArtifact, bestGrade: judgeGrade }
  }

  // ── 7. Termination (Pattern-5 order: threshold → budget [hard] → max iter). ──
  const meetsThreshold = judgeGrade !== null && judgeGrade.overallScore >= stage.threshold
  const meetsMinIterations = current.loopCount >= stage.minIterations
  const atMaxIterations = current.loopCount >= stage.maxIterations
  const budgetExhausted =
    typeof stage.maxBudgetUSD === 'number' && current.cumulativeCostUSD >= stage.maxBudgetUSD

  if (meetsThreshold && meetsMinIterations) {
    current = { ...current, status: 'presenting', terminationReason: 'threshold_met' }
  } else if (budgetExhausted) {
    // Rule 12: hard cap — terminate even if min iterations are unmet.
    current = { ...current, status: 'presenting', terminationReason: 'budget_exhausted' }
  } else if (atMaxIterations) {
    current = { ...current, status: 'presenting', terminationReason: 'max_iterations' }
  } else {
    current = { ...current, status: 'revising' }
  }

  return current
}
