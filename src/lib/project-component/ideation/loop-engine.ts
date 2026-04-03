/**
 * Ideation Loop Engine — Phase 0 execution core.
 *
 * Follows the Strategic + Production loop pattern:
 *   [Strategic Phase] Agents brainstorm + propose (brainstorm → structure)
 *   [Production Phase] Build structure + evaluate + refine (refinement → review)
 *
 * Runs ONE step at a time — the caller drives the loop.
 * Auto-refines when grader score < 75 and loopCount < maxLoops.
 * Forces human review after maxLoops (5) even if score is below threshold.
 *
 * Level 1 (Engine) — orchestrates agents but doesn't know eLearning specifics.
 */

import type { AgentResult } from '../agents/framework/types'
import type {
  IdeationPhase,
  ProjectArchetype,
  AudienceProfile,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
  GradeReport,
  OrchestratorOutput,
  OptimizationReport,
  DevilsAdvocateReport,
} from '../types'
import {
  getNextPhase,
  canTransition,
} from './phase-manager'
import type { IdeationLoopState, BlueprintVersion } from './phase-manager'
import { runOrchestrator } from '../agents/orchestrator'
import { runAudienceAnalyst } from '../agents/audience-analyst'
import { runCurriculumStrategist } from '../agents/curriculum-strategist'
import { runOutcomeArchitect } from '../agents/outcome-architect'
import { runComponentRecommender } from '../agents/component-recommender'
import { runStructureOptimizer } from '../agents/structure-optimizer'
import { runRubricGrader } from '../agents/rubric-grader'
import { runDevilsAdvocate } from '../agents/devils-advocate'

// ─── Result Type ──────────────────────────────────────────────────────────────

/** Result of a single ideation step. */
export interface IdeationStepResult {
  /** Updated state after this step completes. */
  updatedState: IdeationLoopState
  /** True when the engine needs human input before proceeding. */
  awaitingHuman: boolean
  /** Message to display to the human (from orchestrator or engine). */
  humanMessage: string
  /** Cost in USD for all agent calls in this step. */
  stepCostUSD: number
}

/** Human feedback payload for processHumanFeedback. */
export interface HumanFeedback {
  action: 'approve' | 'feedback' | 'restructure'
  message: string
}

// ─── Agent Runners by Phase ──────────────────────────────────────────────────

/**
 * Run the brainstorm phase agents.
 *
 * Calls the orchestrator with the human's latest message to detect
 * archetype, ask clarifying questions, or advance to structure.
 */
async function runBrainstormPhase(
  state: IdeationLoopState,
  humanMessage: string
): Promise<{ state: IdeationLoopState; awaitingHuman: boolean; message: string; cost: number }> {
  const result = await runOrchestrator({
    humanMessage,
    currentPhase: state.currentPhase,
    context: {
      brief: state.brief,
      archetype: state.archetype ?? undefined,
      conversationHistory: state.conversationHistory,
    },
  })

  let cost = result.costUSD
  const output = result.output

  if (!result.success || !output) {
    return {
      state,
      awaitingHuman: true,
      message: result.error ?? 'Orchestrator failed — please try again.',
      cost,
    }
  }

  // Apply orchestrator decisions to state
  const next = { ...state }

  // Detect archetype from structured proposal
  if (output.structuredProposal?.archetype) {
    next.archetype = output.structuredProposal.archetype as ProjectArchetype
  }

  // If orchestrator wants to advance, validate and transition
  if (output.phaseAction === 'advance_phase' && output.nextPhase) {
    if (canTransition(state.currentPhase, output.nextPhase)) {
      next.currentPhase = output.nextPhase
    }
  }

  const awaitingHuman = output.phaseAction === 'request_human_input'
    || output.phaseAction === 'continue'

  return { state: next, awaitingHuman, message: output.humanFacingMessage, cost }
}

/**
 * Structure phase step 1: Run audience analyst only.
 * Returns awaitingHuman: true so user can confirm the profile.
 */
async function runStructurePhaseAudience(
  state: IdeationLoopState
): Promise<{ state: IdeationLoopState; awaitingHuman: boolean; message: string; cost: number }> {
  if (!state.archetype) {
    return {
      state,
      awaitingHuman: true,
      message: 'Cannot run structure phase without a detected archetype. Please provide more details about your project.',
      cost: 0,
    }
  }

  const audienceResult = await runAudienceAnalyst(state.brief, state.archetype)
  const next = { ...state }

  if (audienceResult.success && audienceResult.output) {
    next.audienceProfile = audienceResult.output
    next.awaitingAudienceConfirmation = true
    return {
      state: next,
      awaitingHuman: true,
      message: 'Audience profile ready. Please review and confirm before I design the course structure.',
      cost: audienceResult.costUSD,
    }
  }

  return {
    state: next,
    awaitingHuman: true,
    message: `Audience analysis failed: ${audienceResult.error ?? 'unknown error'}`,
    cost: audienceResult.costUSD,
  }
}

/**
 * Structure phase step 2: Run curriculum strategist with confirmed audience.
 * Called after user confirms the audience profile.
 */
async function runStructurePhaseStructure(
  state: IdeationLoopState
): Promise<{ state: IdeationLoopState; awaitingHuman: boolean; message: string; cost: number }> {
  if (!state.archetype || !state.audienceProfile) {
    return {
      state,
      awaitingHuman: true,
      message: 'Cannot design structure without archetype and confirmed audience profile.',
      cost: 0,
    }
  }

  const curriculumResult = await runCurriculumStrategist(
    state.brief,
    state.archetype,
    state.audienceProfile
  )

  const next = { ...state, awaitingAudienceConfirmation: false }
  if (curriculumResult.success && curriculumResult.output) {
    next.proposedStructure = curriculumResult.output
    next.currentPhase = getNextPhase('structure')
    return {
      state: next,
      awaitingHuman: false,
      message: `Course structure proposed: "${curriculumResult.output.courseTitle}" with ${curriculumResult.output.modules.length} modules. Advancing to refinement.`,
      cost: curriculumResult.costUSD,
    }
  }

  return {
    state: next,
    awaitingHuman: true,
    message: `Curriculum design failed: ${curriculumResult.error ?? 'unknown error'}`,
    cost: curriculumResult.costUSD,
  }
}

/**
 * Run the refinement phase agents.
 *
 * Runs outcome-architect + component-recommender, then
 * structure-optimizer + rubric-grader + devil's-advocate.
 * Auto-refines if score < 75 and loopCount < maxLoops.
 * Forces human review after maxLoops.
 */
async function runRefinementPhase(
  state: IdeationLoopState
): Promise<{ state: IdeationLoopState; awaitingHuman: boolean; message: string; cost: number }> {
  const { archetype, audienceProfile, proposedStructure } = state
  if (!archetype || !audienceProfile || !proposedStructure) {
    return {
      state,
      awaitingHuman: true,
      message: 'Cannot run refinement — missing archetype, audience profile, or proposed structure.',
      cost: 0,
    }
  }

  let totalCost = 0
  const next = { ...state }
  const messages: string[] = []

  // ── Step 1: Outcomes + Components (parallel) ──────────────────────────────

  const [outcomesResult, componentResult] = await Promise.all([
    runOutcomeArchitect(
      next.brief,
      archetype,
      proposedStructure,
      audienceProfile
    ),
    // Component recommender needs outcomesMap, but we run in parallel with a
    // fallback: if outcomesMap exists from a prior loop, use it. Otherwise
    // we'll re-run component recommender after outcomes complete.
    next.outcomesMap
      ? runComponentRecommender(
          next.brief,
          archetype,
          proposedStructure,
          next.outcomesMap,
          audienceProfile
        )
      : Promise.resolve(null),
  ])

  totalCost += outcomesResult.costUSD

  if (outcomesResult.success && outcomesResult.output) {
    next.outcomesMap = outcomesResult.output
    messages.push(`Outcomes mapped: ${outcomesResult.output.totalOutcomes} learning outcomes across ${outcomesResult.output.nodeOutcomes.length} nodes.`)
  } else {
    return {
      state: next,
      awaitingHuman: true,
      message: `Outcome mapping failed: ${outcomesResult.error ?? 'unknown error'}`,
      cost: totalCost,
    }
  }

  // If component recommender didn't run in parallel, run it now with fresh outcomes
  let compResult = componentResult
  if (!compResult) {
    compResult = await runComponentRecommender(
      next.brief,
      archetype,
      proposedStructure,
      next.outcomesMap,
      audienceProfile
    )
  }

  totalCost += compResult.costUSD

  if (compResult.success && compResult.output) {
    next.componentPlan = compResult.output
    messages.push(`Components recommended: ${compResult.output.totalComponents} across ${compResult.output.nodeRecommendations.length} nodes.`)
  } else {
    return {
      state: next,
      awaitingHuman: true,
      message: `Component recommendation failed: ${compResult.error ?? 'unknown error'}`,
      cost: totalCost,
    }
  }

  // ── Step 2: Optimizer + Grader + Devil's Advocate (parallel) ──────────────

  // These are guaranteed non-null by the success checks above
  const outcomesMap = next.outcomesMap!
  const componentPlan = next.componentPlan!

  // Use allSettled so one agent failure doesn't discard the others' work.
  // Only the grader is a hard gate — optimizer and devil's advocate are advisory.
  const [optimizerSettled, graderSettled, devilSettled] = await Promise.allSettled([
    runStructureOptimizer(next.brief, archetype, proposedStructure, outcomesMap, componentPlan, audienceProfile),
    runRubricGrader(next.brief, archetype, proposedStructure, outcomesMap, componentPlan, audienceProfile),
    runDevilsAdvocate(next.brief, archetype, proposedStructure, outcomesMap, componentPlan, audienceProfile),
  ])

  const optimizerResult = optimizerSettled.status === 'fulfilled' ? optimizerSettled.value : null
  const graderResult = graderSettled.status === 'fulfilled' ? graderSettled.value : null
  const devilResult = devilSettled.status === 'fulfilled' ? devilSettled.value : null

  totalCost += (optimizerResult?.costUSD ?? 0) + (graderResult?.costUSD ?? 0) + (devilResult?.costUSD ?? 0)

  if (optimizerResult?.success && optimizerResult.output) {
    messages.push(`Structure health score: ${optimizerResult.output.healthScore}/100.`)
  } else if (optimizerSettled.status === 'rejected') {
    messages.push('Structure optimizer encountered an error — skipping (advisory only).')
  }

  if (devilResult?.success && devilResult.output) {
    next.challenges = devilResult.output.challenges
    messages.push(`Devil's advocate raised ${devilResult.output.challenges.length} challenges (risk level: ${devilResult.output.overallRiskLevel}).`)
  } else if (devilSettled.status === 'rejected') {
    messages.push("Devil's advocate encountered an error — skipping (advisory only).")
  }

  // Grading is the gate — must succeed for the loop to continue
  if (!graderResult || !graderResult.success || !graderResult.output) {
    const reason = graderSettled.status === 'rejected'
      ? String(graderSettled.reason)
      : (graderResult?.error ?? 'unknown error')
    return {
      state: next,
      awaitingHuman: true,
      message: `Rubric grading failed: ${reason}`,
      cost: totalCost,
    }
  }

  next.gradeReport = graderResult.output
  next.loopCount += 1

  // Snapshot this version
  next.versions = [
    ...next.versions,
    createVersion(next),
  ]

  messages.push(`Grade: ${graderResult.output.overallScore}/100 (${graderResult.output.recommendation}). Loop ${next.loopCount}/${next.maxLoops}.`)

  // ── Step 3: Auto-routing decision ─────────────────────────────────────────

  const nextPhase = getNextPhase('refinement', next.gradeReport)

  if (nextPhase === 'review') {
    // Score >= 75 — advance to human review
    next.currentPhase = 'review'
    messages.push('Score meets threshold. Presenting blueprint for your review.')
    return { state: next, awaitingHuman: true, message: messages.join('\n\n'), cost: totalCost }
  }

  // Score < 75 — check loop budget
  if (next.loopCount >= next.maxLoops) {
    // Force human review after maxLoops
    next.currentPhase = 'review'
    messages.push(`Reached maximum ${next.maxLoops} refinement loops. Presenting best result for your review.`)
    return { state: next, awaitingHuman: true, message: messages.join('\n\n'), cost: totalCost }
  }

  // Auto-refine: stay in refinement, don't await human
  messages.push(`Score below 75 — auto-refining (loop ${next.loopCount}/${next.maxLoops}). Improvements needed: ${graderResult.output.specificImprovements.join(', ')}.`)
  return { state: next, awaitingHuman: false, message: messages.join('\n\n'), cost: totalCost }
}

// ─── Version Snapshot ─────────────────────────────────────────────────────────

function createVersion(state: IdeationLoopState): BlueprintVersion {
  return {
    version: state.versions.length + 1,
    phase: state.currentPhase,
    gradeReport: state.gradeReport,
    snapshot: {
      proposedStructure: state.proposedStructure,
      outcomesMap: state.outcomesMap,
      componentPlan: state.componentPlan,
      challenges: state.challenges,
    },
    createdAt: new Date(),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run ONE step of the ideation loop.
 *
 * Selects agents based on currentPhase, executes them, updates state,
 * and determines whether the next move requires human input.
 *
 * @param state - Current ideation loop state
 * @param humanMessage - Latest human message (required for brainstorm, optional otherwise)
 * @returns Updated state, whether human input is needed, and a display message
 */
export async function runIdeationStep(
  state: IdeationLoopState,
  humanMessage = ''
): Promise<IdeationStepResult> {
  switch (state.currentPhase) {
    case 'brainstorm': {
      const result = await runBrainstormPhase(state, humanMessage)
      return {
        updatedState: result.state,
        awaitingHuman: result.awaitingHuman,
        humanMessage: result.message,
        stepCostUSD: result.cost,
      }
    }

    case 'structure': {
      // Step 1: audience analysis (if no audience yet)
      if (!state.audienceProfile) {
        const result = await runStructurePhaseAudience(state)
        return {
          updatedState: result.state,
          awaitingHuman: result.awaitingHuman,
          humanMessage: result.message,
          stepCostUSD: result.cost,
        }
      }
      // Step 2: curriculum design (audience confirmed)
      if (!state.awaitingAudienceConfirmation) {
        const result = await runStructurePhaseStructure(state)
        return {
          updatedState: result.state,
          awaitingHuman: result.awaitingHuman,
          humanMessage: result.message,
          stepCostUSD: result.cost,
        }
      }
      // Awaiting confirmation — should not reach here normally
      return {
        updatedState: state,
        awaitingHuman: true,
        humanMessage: 'Please review and confirm the audience profile to proceed.',
        stepCostUSD: 0,
      }
    }

    case 'refinement': {
      const result = await runRefinementPhase(state)
      return {
        updatedState: result.state,
        awaitingHuman: result.awaitingHuman,
        humanMessage: result.message,
        stepCostUSD: result.cost,
      }
    }

    case 'review':
      // Review phase is human-only — engine presents and waits
      return {
        updatedState: state,
        awaitingHuman: true,
        humanMessage: formatReviewPresentation(state),
        stepCostUSD: 0,
      }

    case 'approved':
      return {
        updatedState: state,
        awaitingHuman: false,
        humanMessage: 'Blueprint approved. Ready for configuration wizard.',
        stepCostUSD: 0,
      }
  }
}

/**
 * Process human feedback during the review phase.
 *
 * Handles three actions:
 * - approve: Lock blueprint, advance to approved
 * - feedback: Inject feedback context, return to refinement
 * - restructure: Fresh start from brainstorm (keep brief + audience)
 *
 * @param state - Current state (must be in review phase)
 * @param feedback - Human's action and message
 * @returns Updated state after applying the feedback
 */
export async function processHumanFeedback(
  state: IdeationLoopState,
  feedback: HumanFeedback
): Promise<IdeationLoopState> {
  if (state.currentPhase !== 'review') {
    throw new Error(
      `processHumanFeedback requires review phase, got ${state.currentPhase}`
    )
  }

  const entry = {
    action: feedback.action,
    message: feedback.message,
    timestamp: new Date(),
  }

  switch (feedback.action) {
    case 'approve': {
      if (!canTransition('review', 'approved')) {
        throw new Error('Invalid transition: review → approved')
      }
      return {
        ...state,
        currentPhase: 'approved',
        humanFeedback: [...state.humanFeedback, entry],
      }
    }

    case 'feedback': {
      if (!canTransition('review', 'refinement')) {
        throw new Error('Invalid transition: review → refinement')
      }
      return {
        ...state,
        currentPhase: 'refinement',
        humanFeedback: [...state.humanFeedback, entry],
      }
    }

    case 'restructure': {
      // Fresh start: keep brief + audience profile, clear structure
      return {
        ...state,
        currentPhase: 'brainstorm',
        loopCount: 0,
        proposedStructure: null,
        outcomesMap: null,
        componentPlan: null,
        gradeReport: null,
        challenges: null,
        humanFeedback: [...state.humanFeedback, entry],
        // Keep: brief, archetype, audienceProfile, conversationHistory, versions
      }
    }
  }
}

// ─── Review Presentation ──────────────────────────────────────────────────────

function formatReviewPresentation(state: IdeationLoopState): string {
  const sections: string[] = []

  sections.push('## Blueprint Review')

  if (state.proposedStructure) {
    sections.push(`**Course:** ${state.proposedStructure.courseTitle}`)
    sections.push(`**Modules:** ${state.proposedStructure.modules.length}`)
  }

  if (state.gradeReport) {
    sections.push(`**Grade:** ${state.gradeReport.overallScore}/100 (${state.gradeReport.recommendation})`)

    if (state.gradeReport.strengths.length > 0) {
      sections.push(`**Strengths:** ${state.gradeReport.strengths.join(', ')}`)
    }
    if (state.gradeReport.weaknesses.length > 0) {
      sections.push(`**Weaknesses:** ${state.gradeReport.weaknesses.join(', ')}`)
    }
  }

  if (state.outcomesMap) {
    sections.push(`**Learning outcomes:** ${state.outcomesMap.totalOutcomes}`)
  }

  if (state.componentPlan) {
    sections.push(`**Components:** ${state.componentPlan.totalComponents}`)
  }

  if (state.challenges && state.challenges.length > 0) {
    const highRisk = state.challenges.filter(c => c.severity === 'high')
    if (highRisk.length > 0) {
      sections.push(`**High-risk challenges:** ${highRisk.length}`)
    }
  }

  sections.push(`\nLoop ${state.loopCount}/${state.maxLoops}. Actions: **Approve** | **Feedback** | **Restructure**`)

  return sections.join('\n')
}
