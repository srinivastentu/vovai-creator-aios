import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInitialState } from '../../src/lib/domain/workflows/ideation/phase-manager'
import type { IdeationLoopState } from '../../src/lib/domain/workflows/ideation/phase-manager'
import {
  runIdeationStep,
  processHumanFeedback,
} from '../../src/lib/domain/workflows/ideation/loop-engine'
import type { AgentResult } from '../../src/lib/domain/workflows/agents/framework/types'
import type {
  AudienceProfile,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
  GradeReport,
  OrchestratorOutput,
  OptimizationReport,
  DevilsAdvocateReport,
} from '../../src/lib/domain/workflows/types'

// ─── Mock All Agents ─────────────────────────────────────────────────────────

vi.mock('../../src/lib/domain/workflows/agents/orchestrator', () => ({
  runOrchestrator: vi.fn(),
}))
vi.mock('../../src/lib/domain/workflows/agents/audience-analyst', () => ({
  runAudienceAnalyst: vi.fn(),
}))
vi.mock('../../src/lib/domain/workflows/agents/curriculum-strategist', () => ({
  runCurriculumStrategist: vi.fn(),
}))
vi.mock('../../src/lib/domain/workflows/agents/outcome-architect', () => ({
  runOutcomeArchitect: vi.fn(),
}))
vi.mock('../../src/lib/domain/workflows/agents/component-recommender', () => ({
  runComponentRecommender: vi.fn(),
}))
vi.mock('../../src/lib/domain/workflows/agents/structure-optimizer', () => ({
  runStructureOptimizer: vi.fn(),
}))
vi.mock('../../src/lib/domain/workflows/agents/rubric-grader', () => ({
  runRubricGrader: vi.fn(),
}))
vi.mock('../../src/lib/domain/workflows/agents/devils-advocate', () => ({
  runDevilsAdvocate: vi.fn(),
}))

// Import mocks after vi.mock declarations
import { runOrchestrator } from '../../src/lib/domain/workflows/agents/orchestrator'
import { runAudienceAnalyst } from '../../src/lib/domain/workflows/agents/audience-analyst'
import { runCurriculumStrategist } from '../../src/lib/domain/workflows/agents/curriculum-strategist'
import { runOutcomeArchitect } from '../../src/lib/domain/workflows/agents/outcome-architect'
import { runComponentRecommender } from '../../src/lib/domain/workflows/agents/component-recommender'
import { runStructureOptimizer } from '../../src/lib/domain/workflows/agents/structure-optimizer'
import { runRubricGrader } from '../../src/lib/domain/workflows/agents/rubric-grader'
import { runDevilsAdvocate } from '../../src/lib/domain/workflows/agents/devils-advocate'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeAgentResult<T>(output: T, overrides?: Partial<AgentResult<T>>): AgentResult<T> {
  return {
    agentId: 'test-agent',
    success: true,
    output,
    durationMs: 100,
    modelUsed: 'claude-sonnet-4-20250514',
    tokensIn: 500,
    tokensOut: 200,
    costUSD: 0.004,
    ...overrides,
  }
}

function makeFailedResult<T>(error: string): AgentResult<T> {
  return {
    agentId: 'test-agent',
    success: false,
    output: null,
    durationMs: 50,
    modelUsed: 'claude-sonnet-4-20250514',
    tokensIn: 100,
    tokensOut: 0,
    costUSD: 0.0003,
    error,
  }
}

const MOCK_AUDIENCE: AudienceProfile = {
  primaryAudience: {
    description: 'K-12 teachers',
    educationLevel: 'graduate',
    experienceLevel: 'intermediate',
    learningContext: 'professional development',
    motivations: ['career growth'],
    painPoints: ['time constraints'],
    technologyComfort: 'intermediate',
  },
  prerequisiteKnowledge: ['basic pedagogy'],
  learningPreferences: {
    preferredModalities: ['video', 'hands-on'],
    attentionSpan: 'medium',
    practicePreference: 'guided',
  },
}

const MOCK_STRUCTURE: ProposedStructure = {
  courseTitle: 'Instructional Design Fundamentals',
  courseDescription: 'A comprehensive course on instructional design.',
  modules: [
    { title: 'Module 1', description: 'Intro', topics: [] },
    { title: 'Module 2', description: 'Advanced', topics: [] },
  ],
  sequencingRationale: 'Progressive complexity',
  alternativeStructures: [],
  confidenceScore: 0.85,
}

const MOCK_OUTCOMES: OutcomesMap = {
  courseOutcomes: [],
  nodeOutcomes: [
    { nodeTitle: 'Module 1', nodePath: '/m1', depth: 1, outcomes: [], bloomDistribution: { remember: 1, understand: 1, apply: 0, analyze: 0, evaluate: 0, create: 0 } },
  ],
  totalOutcomes: 12,
  bloomDistribution: { remember: 2, understand: 3, apply: 3, analyze: 2, evaluate: 1, create: 1 },
  coverageNotes: 'Full coverage',
}

const MOCK_COMPONENT_PLAN: ComponentPlan = {
  nodeRecommendations: [
    { nodeTitle: 'Module 1', nodePath: '/m1', depth: 1, components: [] },
  ],
  totalComponents: 15,
  componentBreakdown: { video: 8, quiz: 4, study_material: 3 },
  budgetTiers: [],
  rationale: 'Balanced mix',
}

function makeGradeReport(score: number): GradeReport {
  return {
    overallScore: score,
    passesThreshold: score >= 75,
    dimensionScores: [],
    strengths: ['Good structure'],
    weaknesses: score < 75 ? ['Weak progression'] : [],
    recommendation: score >= 85 ? 'approve' : score >= 75 ? 'revise' : 'restructure',
    specificImprovements: score < 75 ? ['Improve progression', 'Add depth'] : [],
  }
}

const MOCK_OPTIMIZATION: OptimizationReport = {
  healthScore: 82,
  criticalIssues: [],
  warnings: [],
  suggestions: [],
  actions: [],
  summary: 'Structure is healthy',
}

const MOCK_DEVILS_ADVOCATE: DevilsAdvocateReport = {
  challenges: [{ assumption: 'test', perspective: 'learner', severity: 'medium', concern: 'test concern', suggestion: 'test suggestion' }],
  overallRiskLevel: 'medium',
  topConcerns: ['Time constraints'],
  summary: 'Some risks identified',
}

// ─── State Helpers ───────────────────────────────────────────────────────────

function stateInStructure(): IdeationLoopState {
  return {
    ...createInitialState('bp-001', 'Build a teacher training course'),
    currentPhase: 'structure',
    archetype: 'professional_training',
  }
}

function stateInRefinement(): IdeationLoopState {
  return {
    ...createInitialState('bp-001', 'Build a teacher training course'),
    currentPhase: 'refinement',
    archetype: 'professional_training',
    audienceProfile: MOCK_AUDIENCE,
    proposedStructure: MOCK_STRUCTURE,
  }
}

function stateInReview(score = 78): IdeationLoopState {
  return {
    ...stateInRefinement(),
    currentPhase: 'review',
    loopCount: 1,
    outcomesMap: MOCK_OUTCOMES,
    componentPlan: MOCK_COMPONENT_PLAN,
    gradeReport: makeGradeReport(score),
    challenges: MOCK_DEVILS_ADVOCATE.challenges,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Brainstorm Phase ────────────────────────────────────────────────────────

describe('runIdeationStep — brainstorm phase', () => {
  it('calls orchestrator with human message and returns its response', async () => {
    const state = createInitialState('bp-001', 'Build a teacher training course')
    const orchestratorOutput: OrchestratorOutput = {
      phaseAction: 'request_human_input',
      agentsToRun: [],
      humanFacingMessage: 'What is the target audience?',
    }
    vi.mocked(runOrchestrator).mockResolvedValue(makeAgentResult(orchestratorOutput, { agentId: 'orchestrator' }))

    const result = await runIdeationStep(state, 'Build a teacher training course')

    expect(runOrchestrator).toHaveBeenCalledOnce()
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toBe('What is the target audience?')
    expect(result.stepCostUSD).toBe(0.004)
  })

  it('advances to structure when orchestrator says advance_phase', async () => {
    const state = createInitialState('bp-001', 'Build a 40-hour teacher training course')
    const orchestratorOutput: OrchestratorOutput = {
      phaseAction: 'advance_phase',
      nextPhase: 'structure',
      agentsToRun: ['audience-analyst', 'curriculum-strategist'],
      humanFacingMessage: 'Detected professional training archetype. Moving to structure phase.',
      structuredProposal: { archetype: 'professional_training' },
    }
    vi.mocked(runOrchestrator).mockResolvedValue(makeAgentResult(orchestratorOutput, { agentId: 'orchestrator' }))

    const result = await runIdeationStep(state, 'Build a 40-hour teacher training course')

    expect(result.updatedState.currentPhase).toBe('structure')
    expect(result.updatedState.archetype).toBe('professional_training')
    expect(result.awaitingHuman).toBe(false)
  })

  it('stays in brainstorm when orchestrator says continue', async () => {
    const state = createInitialState('bp-001', 'I want to make a course')
    const orchestratorOutput: OrchestratorOutput = {
      phaseAction: 'continue',
      agentsToRun: [],
      humanFacingMessage: 'Can you tell me more about the subject?',
    }
    vi.mocked(runOrchestrator).mockResolvedValue(makeAgentResult(orchestratorOutput, { agentId: 'orchestrator' }))

    const result = await runIdeationStep(state, 'I want to make a course')

    expect(result.updatedState.currentPhase).toBe('brainstorm')
    expect(result.awaitingHuman).toBe(true)
  })

  it('handles orchestrator failure gracefully', async () => {
    const state = createInitialState('bp-001', 'Build a course')
    vi.mocked(runOrchestrator).mockResolvedValue(makeFailedResult('API timeout'))

    const result = await runIdeationStep(state, 'Build a course')

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('API timeout')
  })
})

// ─── Structure Phase ─────────────────────────────────────────────────────────

describe('runIdeationStep — structure phase', () => {
  it('runs audience analyst and curriculum strategist in parallel', async () => {
    const state = stateInStructure()
    vi.mocked(runAudienceAnalyst).mockResolvedValue(makeAgentResult(MOCK_AUDIENCE, { agentId: 'audience-analyst' }))
    vi.mocked(runCurriculumStrategist).mockResolvedValue(makeAgentResult(MOCK_STRUCTURE, { agentId: 'curriculum-strategist' }))

    const result = await runIdeationStep(state)

    expect(runAudienceAnalyst).toHaveBeenCalledOnce()
    expect(runCurriculumStrategist).toHaveBeenCalledOnce()
    expect(result.updatedState.audienceProfile).toEqual(MOCK_AUDIENCE)
    expect(result.updatedState.proposedStructure).toEqual(MOCK_STRUCTURE)
    expect(result.updatedState.currentPhase).toBe('refinement')
    expect(result.stepCostUSD).toBe(0.008) // 2 agents * 0.004
  })

  it('does not advance if audience analyst fails', async () => {
    const state = stateInStructure()
    vi.mocked(runAudienceAnalyst).mockResolvedValue(makeFailedResult('Model unavailable'))
    vi.mocked(runCurriculumStrategist).mockResolvedValue(makeAgentResult(MOCK_STRUCTURE))

    const result = await runIdeationStep(state)

    expect(result.updatedState.currentPhase).toBe('structure')
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Audience analysis failed')
  })

  it('does not advance if curriculum strategist fails', async () => {
    const state = stateInStructure()
    vi.mocked(runAudienceAnalyst).mockResolvedValue(makeAgentResult(MOCK_AUDIENCE))
    vi.mocked(runCurriculumStrategist).mockResolvedValue(makeFailedResult('Parse error'))

    const result = await runIdeationStep(state)

    expect(result.updatedState.currentPhase).toBe('structure')
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Curriculum design failed')
  })

  it('returns error when archetype is missing', async () => {
    const state = {
      ...createInitialState('bp-001', 'Build a course'),
      currentPhase: 'structure' as const,
    }

    const result = await runIdeationStep(state)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('archetype')
    expect(result.stepCostUSD).toBe(0)
  })
})

// ─── Refinement Phase ────────────────────────────────────────────────────────

describe('runIdeationStep — refinement phase', () => {
  function mockAllRefinementAgents(gradeScore: number) {
    vi.mocked(runOutcomeArchitect).mockResolvedValue(makeAgentResult(MOCK_OUTCOMES, { agentId: 'outcome-architect' }))
    vi.mocked(runComponentRecommender).mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN, { agentId: 'component-recommender' }))
    vi.mocked(runStructureOptimizer).mockResolvedValue(makeAgentResult(MOCK_OPTIMIZATION, { agentId: 'structure-optimizer' }))
    vi.mocked(runRubricGrader).mockResolvedValue(makeAgentResult(makeGradeReport(gradeScore), { agentId: 'rubric-grader' }))
    vi.mocked(runDevilsAdvocate).mockResolvedValue(makeAgentResult(MOCK_DEVILS_ADVOCATE, { agentId: 'devils-advocate' }))
  }

  it('advances to review when grade >= 75', async () => {
    const state = stateInRefinement()
    mockAllRefinementAgents(82)

    const result = await runIdeationStep(state)

    expect(result.updatedState.currentPhase).toBe('review')
    expect(result.updatedState.gradeReport?.overallScore).toBe(82)
    expect(result.updatedState.loopCount).toBe(1)
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('threshold')
  })

  it('auto-refines when grade < 75 and loopCount < maxLoops', async () => {
    const state = stateInRefinement()
    mockAllRefinementAgents(60)

    const result = await runIdeationStep(state)

    expect(result.updatedState.currentPhase).toBe('refinement')
    expect(result.updatedState.loopCount).toBe(1)
    expect(result.awaitingHuman).toBe(false)
    expect(result.humanMessage).toContain('auto-refining')
  })

  it('forces human review after maxLoops even if score < 75', async () => {
    const state = { ...stateInRefinement(), loopCount: 4 }
    mockAllRefinementAgents(60)

    const result = await runIdeationStep(state)

    // loopCount was 4, now 5 (== maxLoops) → force review
    expect(result.updatedState.currentPhase).toBe('review')
    expect(result.updatedState.loopCount).toBe(5)
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('maximum')
  })

  it('creates a version snapshot after each refinement', async () => {
    const state = stateInRefinement()
    mockAllRefinementAgents(82)

    const result = await runIdeationStep(state)

    expect(result.updatedState.versions).toHaveLength(1)
    expect(result.updatedState.versions[0].version).toBe(1)
    expect(result.updatedState.versions[0].gradeReport?.overallScore).toBe(82)
  })

  it('accumulates versions across loops', async () => {
    const state = {
      ...stateInRefinement(),
      versions: [{ version: 1, phase: 'refinement' as const, gradeReport: makeGradeReport(50), snapshot: {}, createdAt: new Date() }],
    }
    mockAllRefinementAgents(82)

    const result = await runIdeationStep(state)

    expect(result.updatedState.versions).toHaveLength(2)
    expect(result.updatedState.versions[1].version).toBe(2)
  })

  it('tracks cost across all agents', async () => {
    const state = stateInRefinement()
    mockAllRefinementAgents(82)

    const result = await runIdeationStep(state)

    // 5 agents * 0.004 each = 0.020
    expect(result.stepCostUSD).toBeCloseTo(0.020, 3)
  })

  it('fails gracefully when outcome architect fails', async () => {
    const state = stateInRefinement()
    vi.mocked(runOutcomeArchitect).mockResolvedValue(makeFailedResult('Timeout'))

    const result = await runIdeationStep(state)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Outcome mapping failed')
  })

  it('fails gracefully when rubric grader fails', async () => {
    const state = stateInRefinement()
    vi.mocked(runOutcomeArchitect).mockResolvedValue(makeAgentResult(MOCK_OUTCOMES))
    vi.mocked(runComponentRecommender).mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN))
    vi.mocked(runStructureOptimizer).mockResolvedValue(makeAgentResult(MOCK_OPTIMIZATION))
    vi.mocked(runRubricGrader).mockResolvedValue(makeFailedResult('Parse error'))
    vi.mocked(runDevilsAdvocate).mockResolvedValue(makeAgentResult(MOCK_DEVILS_ADVOCATE))

    const result = await runIdeationStep(state)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Rubric grading failed')
  })

  it('salvages optimizer and devil results when only one agent throws', async () => {
    const state = stateInRefinement()
    vi.mocked(runOutcomeArchitect).mockResolvedValue(makeAgentResult(MOCK_OUTCOMES))
    vi.mocked(runComponentRecommender).mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN))
    // Optimizer throws (rejected promise) — should NOT block grading
    vi.mocked(runStructureOptimizer).mockRejectedValue(new Error('Optimizer crashed'))
    vi.mocked(runRubricGrader).mockResolvedValue(makeAgentResult(makeGradeReport(82)))
    vi.mocked(runDevilsAdvocate).mockResolvedValue(makeAgentResult(MOCK_DEVILS_ADVOCATE))

    const result = await runIdeationStep(state)

    // Grader succeeded → should advance to review despite optimizer crash
    expect(result.updatedState.currentPhase).toBe('review')
    expect(result.updatedState.gradeReport?.overallScore).toBe(82)
    expect(result.humanMessage).toContain('optimizer encountered an error')
    // Devil's advocate result still applied
    expect(result.updatedState.challenges).toEqual(MOCK_DEVILS_ADVOCATE.challenges)
  })

  it('salvages grader result when devil advocate throws', async () => {
    const state = stateInRefinement()
    vi.mocked(runOutcomeArchitect).mockResolvedValue(makeAgentResult(MOCK_OUTCOMES))
    vi.mocked(runComponentRecommender).mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN))
    vi.mocked(runStructureOptimizer).mockResolvedValue(makeAgentResult(MOCK_OPTIMIZATION))
    vi.mocked(runRubricGrader).mockResolvedValue(makeAgentResult(makeGradeReport(78)))
    vi.mocked(runDevilsAdvocate).mockRejectedValue(new Error('Network timeout'))

    const result = await runIdeationStep(state)

    expect(result.updatedState.currentPhase).toBe('review')
    expect(result.humanMessage).toContain("Devil's advocate encountered an error")
    // Challenges should remain whatever was on state before (null for fresh refinement)
    expect(result.updatedState.challenges).toBeNull()
  })

  it('fails when grader throws (rejected promise)', async () => {
    const state = stateInRefinement()
    vi.mocked(runOutcomeArchitect).mockResolvedValue(makeAgentResult(MOCK_OUTCOMES))
    vi.mocked(runComponentRecommender).mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN))
    vi.mocked(runStructureOptimizer).mockResolvedValue(makeAgentResult(MOCK_OPTIMIZATION))
    vi.mocked(runRubricGrader).mockRejectedValue(new Error('API key expired'))
    vi.mocked(runDevilsAdvocate).mockResolvedValue(makeAgentResult(MOCK_DEVILS_ADVOCATE))

    const result = await runIdeationStep(state)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Rubric grading failed')
    // Advisory agents still ran — devil's advocate result salvaged into state
    expect(result.updatedState.challenges).toEqual(MOCK_DEVILS_ADVOCATE.challenges)
  })

  it('returns error when prerequisites are missing', async () => {
    const state = {
      ...createInitialState('bp-001', 'Build a course'),
      currentPhase: 'refinement' as const,
    }

    const result = await runIdeationStep(state)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('missing')
    expect(result.stepCostUSD).toBe(0)
  })
})

// ─── Review Phase ────────────────────────────────────────────────────────────

describe('runIdeationStep — review phase', () => {
  it('presents blueprint and awaits human', async () => {
    const state = stateInReview(82)

    const result = await runIdeationStep(state)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Blueprint Review')
    expect(result.humanMessage).toContain('82/100')
    expect(result.stepCostUSD).toBe(0)
  })

  it('includes structure info in review presentation', async () => {
    const state = stateInReview(82)

    const result = await runIdeationStep(state)

    expect(result.humanMessage).toContain('Instructional Design Fundamentals')
    expect(result.humanMessage).toContain('Modules')
    expect(result.humanMessage).toContain('Approve')
    expect(result.humanMessage).toContain('Feedback')
    expect(result.humanMessage).toContain('Restructure')
  })
})

// ─── Approved Phase ──────────────────────────────────────────────────────────

describe('runIdeationStep — approved phase', () => {
  it('returns ready message and does not await human', async () => {
    const state = { ...stateInReview(90), currentPhase: 'approved' as const }

    const result = await runIdeationStep(state)

    expect(result.awaitingHuman).toBe(false)
    expect(result.humanMessage).toContain('approved')
    expect(result.stepCostUSD).toBe(0)
  })
})

// ─── processHumanFeedback ────────────────────────────────────────────────────

describe('processHumanFeedback', () => {
  it('approve: transitions to approved phase', async () => {
    const state = stateInReview(85)

    const result = await processHumanFeedback(state, {
      action: 'approve',
      message: 'Looks great!',
    })

    expect(result.currentPhase).toBe('approved')
    expect(result.humanFeedback).toHaveLength(1)
    expect(result.humanFeedback[0].action).toBe('approve')
  })

  it('feedback: transitions to refinement phase', async () => {
    const state = stateInReview(78)

    const result = await processHumanFeedback(state, {
      action: 'feedback',
      message: 'Module 3 needs more depth',
    })

    expect(result.currentPhase).toBe('refinement')
    expect(result.humanFeedback).toHaveLength(1)
    expect(result.humanFeedback[0].message).toBe('Module 3 needs more depth')
  })

  it('restructure: resets to brainstorm, preserves brief + audience', async () => {
    const state = stateInReview(60)

    const result = await processHumanFeedback(state, {
      action: 'restructure',
      message: 'Start over with a different approach',
    })

    expect(result.currentPhase).toBe('brainstorm')
    expect(result.loopCount).toBe(0)
    expect(result.brief).toBe(state.brief)
    expect(result.archetype).toBe(state.archetype)
    expect(result.audienceProfile).toEqual(MOCK_AUDIENCE)
    // Cleared fields
    expect(result.proposedStructure).toBeNull()
    expect(result.outcomesMap).toBeNull()
    expect(result.componentPlan).toBeNull()
    expect(result.gradeReport).toBeNull()
    expect(result.challenges).toBeNull()
    // History preserved
    expect(result.versions).toEqual(state.versions)
    expect(result.humanFeedback).toHaveLength(1)
  })

  it('throws if not in review phase', async () => {
    const state = stateInRefinement()

    await expect(
      processHumanFeedback(state, { action: 'approve', message: '' })
    ).rejects.toThrow('processHumanFeedback requires review phase')
  })

  it('accumulates feedback entries across multiple calls', async () => {
    const state = stateInReview(70)

    const afterFeedback = await processHumanFeedback(state, {
      action: 'feedback',
      message: 'Add more activities',
    })

    // Simulate returning to review after refinement
    const backInReview: IdeationLoopState = {
      ...afterFeedback,
      currentPhase: 'review',
    }

    const afterSecondFeedback = await processHumanFeedback(backInReview, {
      action: 'approve',
      message: 'Now it looks good',
    })

    expect(afterSecondFeedback.humanFeedback).toHaveLength(2)
    expect(afterSecondFeedback.humanFeedback[0].action).toBe('feedback')
    expect(afterSecondFeedback.humanFeedback[1].action).toBe('approve')
  })
})
