/**
 * Phase Manager — State machine controlling Phase 0 ideation loop behavior.
 *
 * Engine-level code (Level 1). Knows phases and transitions, not what
 * "eLearning" means. Determines valid state transitions, auto-routes
 * based on grade scores, and manages the IdeationLoopState lifecycle.
 */

import type {
  IdeationPhase,
  ProjectArchetype,
  AudienceProfile,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
  GradeReport,
  Challenge,
  IdeationMessageType,
} from '../types'

// ─── Phase Transitions ────────────────────────────────────────────────────────

/** Valid transitions from each phase. Human review decides between review → approved | refinement. */
export const PHASE_TRANSITIONS: Record<IdeationPhase, IdeationPhase[]> = {
  brainstorm: ['structure'],
  structure: ['refinement'],
  refinement: ['review'],
  review: ['approved', 'refinement'],
  approved: [],
}

// ─── Transition Guards ────────────────────────────────────────────────────────

/** Check whether a transition from `from` to `to` is valid. */
export function canTransition(from: IdeationPhase, to: IdeationPhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to)
}

/**
 * Determine the next phase based on current phase and optional grade report.
 *
 * Auto-routing rules:
 * - brainstorm → structure (always)
 * - structure → refinement (always)
 * - refinement: score >= 75 → review, else → refinement (stay for another loop)
 * - review / approved: requires human decision — cannot auto-route
 */
export function getNextPhase(
  current: IdeationPhase,
  gradeReport?: GradeReport
): IdeationPhase {
  switch (current) {
    case 'brainstorm':
      return 'structure'

    case 'structure':
      return 'refinement'

    case 'refinement': {
      if (!gradeReport) {
        return 'refinement'
      }
      return gradeReport.overallScore >= 75 ? 'review' : 'refinement'
    }

    case 'review':
      throw new Error(
        'Cannot auto-route from review — requires human decision (approve or feedback)'
      )

    case 'approved':
      throw new Error(
        'Cannot advance from approved — terminal state'
      )
  }
}

// ─── Ideation Loop State ──────────────────────────────────────────────────────

/** Human feedback entry — action taken + optional message */
export interface HumanFeedbackEntry {
  action: 'approve' | 'feedback' | 'restructure'
  message: string
  timestamp: Date
}

/** Blueprint version snapshot — captured after each refinement cycle */
export interface BlueprintVersion {
  version: number
  phase: IdeationPhase
  gradeReport: GradeReport | null
  snapshot: Record<string, unknown>
  createdAt: Date
}

/**
 * Full state of a Phase 0 ideation session.
 *
 * Accumulated context builds up across phases as agents contribute.
 * The loop engine reads this to decide what to produce/evaluate next.
 */
export interface IdeationLoopState {
  blueprintId: string
  currentPhase: IdeationPhase
  loopCount: number
  maxLoops: number

  // Source input
  brief: string
  archetype: ProjectArchetype | null

  // Accumulated context (built up across phases)
  audienceProfile: AudienceProfile | null
  proposedStructure: ProposedStructure | null
  outcomesMap: OutcomesMap | null
  componentPlan: ComponentPlan | null
  gradeReport: GradeReport | null
  challenges: Challenge[] | null

  // History
  conversationHistory: IdeationMessageType[]
  humanFeedback: HumanFeedbackEntry[]
  versions: BlueprintVersion[]
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a fresh ideation loop state for a new project. */
export function createInitialState(
  blueprintId: string,
  brief: string
): IdeationLoopState {
  return {
    blueprintId,
    currentPhase: 'brainstorm',
    loopCount: 0,
    maxLoops: 5,
    brief,
    archetype: null,
    audienceProfile: null,
    proposedStructure: null,
    outcomesMap: null,
    componentPlan: null,
    gradeReport: null,
    challenges: null,
    conversationHistory: [],
    humanFeedback: [],
    versions: [],
  }
}
