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
// Stage & state
// ---------------------------------------------------------------------------

export interface LoopStage<T> {
  id: string
  agents: AgentConfig[]
  rubric: RubricDefinition
  threshold: number
  maxIterations: number
  minIterations: number
  loopPattern: 'standard' | 'strategic' | 'tournament' | 'nested'
  validator?: (artifact: T) => ValidationResult
  /**
   * Optional hook: called after the standard threshold check when the engine
   * is about to transition to 'presenting'. Returning true forces another
   * iteration (still bounded by maxIterations). Returning false or undefined
   * preserves default behavior. Domain-agnostic — the stage decides the rule.
   */
  shouldContinue?: (state: LoopState<T>) => boolean
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
