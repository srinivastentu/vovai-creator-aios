/**
 * Core type definitions for VOVAI eLearn AIOS
 */

// --- Artifacts ---
export interface Artifact {
  id: string
  version: number
  content: string
  stage: string
  sceneIndex?: number  // For per-scene stages
  createdAt: Date
  metadata: Record<string, unknown>
}

// --- Grading ---
export interface Grade {
  dimensions: DimensionScore[]
  compositeScore: number
  overallAssessment: string
  improvementPriorities: string[]
}

export interface DimensionScore {
  name: string
  score: number
  weight: number
  reasoning: string
}

// --- Review ---
export type ReviewAction = "approve" | "feedback" | "reject" | "use_segments" | "mix_produce"

// --- Loop ---
export interface IterationRecord {
  iteration: number
  artifact: Artifact
  grade: Grade
  outcome: "revised" | "presented" | "escalated" | "approved"
  cost: CostRecord
}

export interface CostRecord {
  model: string
  inputTokens: number
  outputTokens: number
  costUSD: number
}

// --- Pipeline ---
export interface StageConfig {
  id: number
  name: string
  ring: number
  agent: string | null
  dependencies: number[]
  reviewGate: boolean
  perScene: boolean
  tournament: boolean
  strategicPhase: boolean    // Pattern 2: run research/plan before production
  agentInnerPlanning: boolean // Pattern 4: agent uses plan-execute-replan internally
  rubric: string
  threshold: number
  maxIterations: number
  minIterations: number
}

export interface StageSession {
  id: string
  projectId: string
  stageId: number
  status: "idle" | "generating" | "evaluating" | "presenting" | "awaiting_review" | "approved"
  iterations: IterationRecord[]
  currentArtifact: Artifact | null
  bestArtifact: Artifact | null
  bestGrade: Grade | null
}

// --- Project ---
export interface Project {
  id: string
  name: string
  topic: string
  targetAudience: string
  durationMinutes: number
  status: "draft" | "in_progress" | "completed"
  currentRing: number
  totalCostUSD: number
  createdAt: Date
}

// --- SSE Events ---
export type LoopEventType = "status" | "iteration" | "result" | "error"

export interface LoopEvent {
  type: LoopEventType
  status: string
  message: string
  iteration?: number
  artifact?: Artifact
  grade?: Grade
  history?: IterationRecord[]
}
