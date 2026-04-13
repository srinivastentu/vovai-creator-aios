// Tournament Loop Pattern — type definitions.
// Zero imports from core/agentic/, core/review/, or domain/.
// Engine layer: machinery only, portable across AIOS deployments.

import type { GradeReport, JudgeFunction, RubricDefinition } from './types'
import type { GatewayContext, GatewayResponse } from '../models/types'

// Local structural artifact shape. Matches Phase 4.2's ImageJudgeArtifact
// but defined here to keep engine/ free of agentic/ imports.
export interface ImageArtifact {
  imagePath: string
  prompt: string
}

export interface TournamentConfig {
  modelIds: string[]
  maxRounds: number
  threshold: number
  topN: number
  timeoutPerModelMs: number
  width?: number
  height?: number
}

export interface ValidatorOutcome {
  passed: boolean
  errors: string[]
}

export interface TournamentEntry {
  modelId: string
  round: number
  artifact: ImageArtifact
  gatewayResponse: GatewayResponse
  validatorResult: ValidatorOutcome | null
  grade: GradeReport | null
}

export interface TournamentRound {
  round: number
  entries: TournamentEntry[]
  refinedPrompt?: string
}

export type TournamentMethod = 'threshold_met' | 'escalation' | 'all_failed'

export interface TournamentResult {
  winner: TournamentEntry | null
  allEntries: TournamentEntry[]
  rounds: TournamentRound[]
  bestEntry: TournamentEntry | null
  totalCostUsd: number
  method: TournamentMethod
}

export type TournamentEventType =
  | 'tournament:round-start'
  | 'tournament:generation-complete'
  | 'tournament:generation-failed'
  | 'tournament:validation-complete'
  | 'tournament:entry-judged'
  | 'tournament:round-complete'
  | 'tournament:winner-selected'
  | 'tournament:escalation'
  | 'tournament:all-failed'

export interface TournamentEventData {
  modelId?: string
  score?: number
  grade?: GradeReport
  entry?: TournamentEntry
  totalEntries?: number
  passedValidation?: number
  failedGeneration?: number
  refinedPrompt?: string
  costSoFar?: number
}

export interface TournamentEvent {
  type: TournamentEventType
  round: number
  data: TournamentEventData
}

// Structural validator shape mirroring agentic/validators/text-validators.ts
// without importing across the boundary.
export interface TournamentValidatorResult {
  pass: boolean
  name: string
  message: string
}

export type TournamentValidator<T = unknown> = (artifact: T) => TournamentValidatorResult

export interface TournamentRunnerOptions {
  getJudgeCostUsd?: () => number
  context?: Partial<GatewayContext>
}

export type TournamentRunner = (
  prompt: string,
  config: TournamentConfig,
  context?: Partial<GatewayContext>
) => AsyncGenerator<TournamentEvent, TournamentResult, void>

// Re-export the injected-dep judge type for callers that import from here.
export type { JudgeFunction, RubricDefinition, GradeReport }
