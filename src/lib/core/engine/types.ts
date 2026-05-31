// Loop Engine Types — System 1
// Zero imports. Completely self-contained.

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type LoopStatus =
  | 'idle'
  | 'generating'
  | 'validating'
  | 'evaluating'
  | 'revising'
  | 'presenting'
  | 'awaiting_review'
  | 'approved'

// ---------------------------------------------------------------------------
// Agent config
// ---------------------------------------------------------------------------

export interface AgentConfig {
  id: string
  name: string
  model: { primary: string; fallback: string }
  maxRetries: number
  timeoutMs: number
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean
  errors: { code: string; message: string }[]
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export interface DimensionScore {
  dimensionId: string
  name: string
  score: number
  weight: number
  feedback: string
}

export interface GradeReport {
  overallScore: number
  passesThreshold: boolean
  dimensionScores: DimensionScore[]
  recommendation: string
  improvementPriorities: string[]
}

// ---------------------------------------------------------------------------
// Rubric
// ---------------------------------------------------------------------------

export interface RubricDimension {
  id: string
  name: string
  weight: number
  passThreshold: number
  description: string
  criteria: Record<string, string>
}

export interface RubricDefinition {
  id: string
  name: string
  dimensions: RubricDimension[]
  passThreshold: number
}

// ---------------------------------------------------------------------------
// Iteration tracking
// ---------------------------------------------------------------------------

export interface IterationRecord {
  artifactId: string
  version: number
  grade: GradeReport | null
  modelUsed: string
  tokensIn: number
  tokensOut: number
  costUSD: number
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Cross-Critique (Pattern 5) — shared, gateway-independent types
//
// Kept here (not in cross-critique.ts) so this module stays self-contained:
// these reference only AgentConfig / GradeReport / IterationRecord, all local.
// The gateway-coupled runner types (adapter, options) live in cross-critique.ts,
// mirroring how tournament-types.ts isolates its GatewayResponse import.
// ---------------------------------------------------------------------------

/**
 * Why a cross-critique loop stopped. Surfaced on LoopState so the UI can show
 * the reason (the engine presents bestArtifact, not the last iteration's output).
 */
export type TerminationReason = 'threshold_met' | 'max_iterations' | 'budget_exhausted'

/**
 * Per-stage configuration for the cross-critique pattern. Producers generate in
 * parallel; each critic critiques one producer's output; one integrator
 * synthesizes; one judge grades. Every role is an AgentConfig so the engine can
 * resolve its model for the cross-model guard (Pattern-5 rule 10) and for gateway
 * routing.
 *
 * `critics` is explicit (the doc's original sketch omitted it): the engine needs
 * each critic's own model id to make the gateway call — it cannot be inferred
 * from `criticAssignments`, which only maps critic → target.
 */
export interface CrossCritiqueConfig {
  /** V1: 2 producers (Claude + GPT-4o). Sent the same task; differ by model. */
  producers: AgentConfig[]
  /** Critic agents; each `id` is a key in `criticAssignments`. */
  critics: AgentConfig[]
  /** criticAgentId → targetProducerAgentId (the producer output this critic reads). */
  criticAssignments: Record<string, string>
  /** Synthesizes the producer outputs + critiques into one artifact (sequential). */
  integratorAgent: AgentConfig
  /** Grades the integrated artifact. MUST be a different model family from every
   *  producer and the integrator (rule 10) — throws at iteration start otherwise. */
  judgeAgent: AgentConfig
}

/**
 * One cross-critique iteration's full record. Extends IterationRecord so it slots
 * into LoopState.iterations uniformly (grade = judgeGrade, costUSD = iterationCostUSD),
 * while preserving the per-role sub-artifacts for the Gate-B iteration-history panel.
 */
export interface CrossCritiqueIterationRecord extends IterationRecord {
  /** producerAgentId → that producer's artifact this iteration. */
  producerArtifacts: Record<string, unknown>
  /** criticAgentId → critique text. */
  critiques: Record<string, string>
  /** The integrator's synthesized output (the artifact that gets judged + presented).
   *  Null only when integration produced nothing usable (rule 9, graceful degradation). */
  integratedArtifact: unknown
  /** The judge's grade of the integrated artifact. Null when integration failed
   *  (no artifact to grade) — mirrors IterationRecord.grade. */
  judgeGrade: GradeReport | null
  /** Sum of all 6 sub-call costs (producers ×2 + critics ×2 + integrator + judge). */
  iterationCostUSD: number
}

// ---------------------------------------------------------------------------
// Stage & state
// ---------------------------------------------------------------------------

export type LoopPattern =
  | 'standard'
  | 'strategic'
  | 'tournament'
  | 'nested'
  | 'cross-critique'

export interface LoopStage<T> {
  id: string
  agents: AgentConfig[]
  rubric: RubricDefinition
  threshold: number
  maxIterations: number
  minIterations: number
  loopPattern: LoopPattern
  validator?: (artifact: T) => ValidationResult
  /**
   * Optional hook: called after the standard threshold check when the engine
   * is about to transition to 'presenting'. Returning true forces another
   * iteration (still bounded by maxIterations). Returning false or undefined
   * preserves default behavior. Domain-agnostic — the stage decides the rule.
   */
  shouldContinue?: (state: LoopState<T>) => boolean
  /**
   * Cross-critique (Pattern 5): hard cumulative-cost cap for the stage. When
   * `cumulativeCostUSD >= maxBudgetUSD`, the loop terminates immediately with
   * `terminationReason: 'budget_exhausted'` — even if min iterations are unmet
   * (rule 12). Ignored by the other patterns.
   */
  maxBudgetUSD?: number
  /** Cross-critique (Pattern 5): required when `loopPattern === 'cross-critique'`. */
  crossCritique?: CrossCritiqueConfig
}

export interface LoopState<T> {
  stageId: string
  status: LoopStatus
  currentArtifact: T | null
  bestArtifact: T | null
  bestGrade: GradeReport | null
  iterations: IterationRecord[]
  loopCount: number
  humanFeedback: string[]
  costUSD: number
  /**
   * Cross-critique (Pattern 5): cumulative spend across all iterations, summed
   * per iteration (producers + critics + integrator + judge). Drives the hard
   * budget cap. Initialized to 0; the standard loop leaves it untouched.
   */
  cumulativeCostUSD: number
  /**
   * Set when the loop transitions to 'presenting' so the UI can show why it
   * stopped (the engine surfaces bestArtifact, not the last output). Undefined
   * until termination.
   */
  terminationReason?: TerminationReason
}

// ---------------------------------------------------------------------------
// Human review
// ---------------------------------------------------------------------------

export interface ReviewAction {
  type: 'approve' | 'reject' | 'feedback' | 'use_segments' | 'mix_produce'
  message?: string
  editedArtifact?: unknown
}

// ---------------------------------------------------------------------------
// Injected dependencies — the engine calls these, never imports them
// ---------------------------------------------------------------------------

export type AgentExecutor = (
  agents: AgentConfig[],
  context: unknown,
  state: LoopState<unknown>
) => Promise<unknown>

export interface JudgeContext {
  previous?: {
    artifact: unknown
    grade: GradeReport
  }
}

export type JudgeFunction = (
  artifact: unknown,
  rubric: RubricDefinition,
  context?: JudgeContext
) => Promise<GradeReport>
