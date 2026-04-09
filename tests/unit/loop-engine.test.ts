import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInitialState } from '../../src/lib/project-component/ideation/phase-manager'
import type { IdeationLoopState } from '../../src/lib/project-component/ideation/phase-manager'
import {
  runIdeationStep,
  processHumanFeedback,
} from '../../src/lib/project-component/ideation/loop-engine'
import type { IdeationAgentRunners } from '../../src/lib/project-component/ideation/loop-engine'
import type { AgentResult } from '../../src/lib/project-component/agents/framework/types'
import type {
  AudienceProfile,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
  GradeReport,
  OrchestratorOutput,
  OptimizationReport,
  DevilsAdvocateReport,
} from '../../src/lib/project-component/types'

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
    { title: 'Module 1', description: 'Intro to ID', topics: [
      { title: 'What is Instructional Design?', description: 'Overview of ID', keyConcepts: ['ADDIE'], estimatedMinutes: 30, subtopics: [], difficulty: 'beginner', bloomLevel: 'understand' },
    ] },
    { title: 'Module 2', description: 'Advanced Techniques', topics: [
      { title: 'Learner Analysis', description: 'Analyzing target audience', keyConcepts: ['personas'], estimatedMinutes: 45, subtopics: [], difficulty: 'intermediate', bloomLevel: 'apply' },
    ] },
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

// ─── Mock Runners ───────────────────────────────────────────────────────────
// Build mock IdeationAgentRunners directly — no vi.mock needed.
// Tests pass these via the `runners` parameter, bypassing DEFAULT_RUNNERS.

const mockOrchestrator = vi.fn()
const mockAudienceAnalyst = vi.fn()
const mockCurriculumStrategist = vi.fn()
const mockOutcomeArchitect = vi.fn()
const mockComponentRecommender = vi.fn()
const mockStructureOptimizer = vi.fn()
const mockRubricGrader = vi.fn()
const mockDevilsAdvocate = vi.fn()

const mockRunners: IdeationAgentRunners = {
  orchestrator: mockOrchestrator,
  audienceAnalyst: mockAudienceAnalyst,
  curriculumStrategist: mockCurriculumStrategist,
  outcomeArchitect: mockOutcomeArchitect,
  componentRecommender: mockComponentRecommender,
  structureOptimizer: mockStructureOptimizer,
  rubricGrader: mockRubricGrader,
  devilsAdvocate: mockDevilsAdvocate,
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
    mockOrchestrator.mockResolvedValue(makeAgentResult(orchestratorOutput, { agentId: 'orchestrator' }))

    const result = await runIdeationStep(state, 'Build a teacher training course', mockRunners)

    expect(mockOrchestrator).toHaveBeenCalledOnce()
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
    mockOrchestrator.mockResolvedValue(makeAgentResult(orchestratorOutput, { agentId: 'orchestrator' }))

    const result = await runIdeationStep(state, 'Build a 40-hour teacher training course', mockRunners)

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
    mockOrchestrator.mockResolvedValue(makeAgentResult(orchestratorOutput, { agentId: 'orchestrator' }))

    const result = await runIdeationStep(state, 'I want to make a course', mockRunners)

    expect(result.updatedState.currentPhase).toBe('brainstorm')
    expect(result.awaitingHuman).toBe(true)
  })

  it('handles orchestrator failure gracefully', async () => {
    const state = createInitialState('bp-001', 'Build a course')
    mockOrchestrator.mockResolvedValue(makeFailedResult('API timeout'))

    const result = await runIdeationStep(state, 'Build a course', mockRunners)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('API timeout')
  })
})

// ─── Structure Phase ─────────────────────────────────────────────────────────

describe('runIdeationStep — structure phase', () => {
  it('runs audience analyst first, then curriculum strategist after confirmation', async () => {
    // Step 1: audience analysis (no audienceProfile yet)
    const state = stateInStructure()
    mockAudienceAnalyst.mockResolvedValue(makeAgentResult(MOCK_AUDIENCE, { agentId: 'audience-analyst' }))

    const step1 = await runIdeationStep(state, '', mockRunners)

    expect(mockAudienceAnalyst).toHaveBeenCalledOnce()
    expect(mockCurriculumStrategist).not.toHaveBeenCalled()
    expect(step1.updatedState.audienceProfile).toEqual(MOCK_AUDIENCE)
    expect(step1.updatedState.awaitingAudienceConfirmation).toBe(true)
    expect(step1.awaitingHuman).toBe(true)
    expect(step1.stepCostUSD).toBe(0.004)

    // Step 2: curriculum design (after audience confirmed — flag cleared)
    const confirmedState: IdeationLoopState = {
      ...step1.updatedState,
      awaitingAudienceConfirmation: false,
    }
    mockCurriculumStrategist.mockResolvedValue(makeAgentResult(MOCK_STRUCTURE, { agentId: 'curriculum-strategist' }))

    const step2 = await runIdeationStep(confirmedState, '', mockRunners)

    expect(mockCurriculumStrategist).toHaveBeenCalledOnce()
    expect(step2.updatedState.proposedStructure).toEqual(MOCK_STRUCTURE)
    expect(step2.updatedState.currentPhase).toBe('refinement')
    expect(step2.stepCostUSD).toBe(0.004)
  })

  it('does not advance if audience analyst fails', async () => {
    const state = stateInStructure()
    mockAudienceAnalyst.mockResolvedValue(makeFailedResult('Model unavailable'))
    mockCurriculumStrategist.mockResolvedValue(makeAgentResult(MOCK_STRUCTURE))

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.updatedState.currentPhase).toBe('structure')
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Audience analysis failed')
  })

  it('does not advance if curriculum strategist fails', async () => {
    // State with audience already confirmed — goes directly to curriculum step
    const state: IdeationLoopState = {
      ...stateInStructure(),
      audienceProfile: MOCK_AUDIENCE,
      awaitingAudienceConfirmation: false,
    }
    mockCurriculumStrategist.mockResolvedValue(makeFailedResult('Parse error'))

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.updatedState.currentPhase).toBe('structure')
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Curriculum design failed')
  })

  it('returns error when archetype is missing', async () => {
    const state = {
      ...createInitialState('bp-001', 'Build a course'),
      currentPhase: 'structure' as const,
    }

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('archetype')
    expect(result.stepCostUSD).toBe(0)
  })
})

// ─── Refinement Phase ────────────────────────────────────────────────────────

describe('runIdeationStep — refinement phase', () => {
  function mockAllRefinementAgents(gradeScore: number) {
    mockOutcomeArchitect.mockResolvedValue(makeAgentResult(MOCK_OUTCOMES, { agentId: 'outcome-architect' }))
    mockComponentRecommender.mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN, { agentId: 'component-recommender' }))
    mockStructureOptimizer.mockResolvedValue(makeAgentResult(MOCK_OPTIMIZATION, { agentId: 'structure-optimizer' }))
    mockRubricGrader.mockResolvedValue(makeAgentResult(makeGradeReport(gradeScore), { agentId: 'rubric-grader' }))
    mockDevilsAdvocate.mockResolvedValue(makeAgentResult(MOCK_DEVILS_ADVOCATE, { agentId: 'devils-advocate' }))
  }

  it('enforces minimum 2 iterations before advancing to review', async () => {
    const state = stateInRefinement() // loopCount starts at 0
    mockAllRefinementAgents(82)

    // First iteration: score >= 75 but loopCount=1 < minIterations(2) → stay in refinement
    const result1 = await runIdeationStep(state, '', mockRunners)
    expect(result1.updatedState.currentPhase).toBe('refinement')
    expect(result1.updatedState.loopCount).toBe(1)
    expect(result1.awaitingHuman).toBe(false)
    expect(result1.humanMessage).toContain('minimum')
  })

  it('advances to review when grade >= 75 and min iterations met', async () => {
    const state = { ...stateInRefinement(), loopCount: 1 } // already did 1 loop
    mockAllRefinementAgents(82)

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.updatedState.currentPhase).toBe('review')
    expect(result.updatedState.gradeReport?.overallScore).toBe(82)
    expect(result.updatedState.loopCount).toBe(2)
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('threshold')
  })

  it('auto-refines when grade < 75 and loopCount < maxLoops', async () => {
    const state = stateInRefinement()
    mockAllRefinementAgents(60)

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.updatedState.currentPhase).toBe('refinement')
    expect(result.updatedState.loopCount).toBe(1)
    expect(result.awaitingHuman).toBe(false)
    expect(result.humanMessage).toContain('auto-refining')
  })

  it('forces human review after maxLoops even if score < 75', async () => {
    const state = { ...stateInRefinement(), loopCount: 4 }
    mockAllRefinementAgents(60)

    const result = await runIdeationStep(state, '', mockRunners)

    // loopCount was 4, now 5 (== maxLoops) → force review
    expect(result.updatedState.currentPhase).toBe('review')
    expect(result.updatedState.loopCount).toBe(5)
    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('maximum')
    expect(result.humanMessage).toContain('Best score')
  })

  it('creates a version snapshot after each refinement', async () => {
    const state = { ...stateInRefinement(), loopCount: 1 } // min iterations met after this loop
    mockAllRefinementAgents(82)

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.updatedState.versions).toHaveLength(1)
    expect(result.updatedState.versions[0].version).toBe(1)
    expect(result.updatedState.versions[0].gradeReport?.overallScore).toBe(82)
  })

  it('tracks best grade report across iterations', async () => {
    // First iteration: score 60
    const state = stateInRefinement()
    mockAllRefinementAgents(60)
    const result1 = await runIdeationStep(state, '', mockRunners)
    expect(result1.updatedState.bestGradeReport?.overallScore).toBe(60)

    // Second iteration: score 72 (higher)
    mockAllRefinementAgents(72)
    const result2 = await runIdeationStep(result1.updatedState, '', mockRunners)
    expect(result2.updatedState.bestGradeReport?.overallScore).toBe(72)

    // Third iteration: score 65 (regression) — best should still be 72
    mockAllRefinementAgents(65)
    const result3 = await runIdeationStep(result2.updatedState, '', mockRunners)
    expect(result3.updatedState.bestGradeReport?.overallScore).toBe(72)
    expect(result3.updatedState.gradeReport?.overallScore).toBe(65) // current is lower
  })

  it('accumulates versions across loops', async () => {
    const state = {
      ...stateInRefinement(),
      loopCount: 1,
      versions: [{ version: 1, phase: 'refinement' as const, gradeReport: makeGradeReport(50), snapshot: {}, createdAt: new Date() }],
    }
    mockAllRefinementAgents(82)

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.updatedState.versions).toHaveLength(2)
    expect(result.updatedState.versions[1].version).toBe(2)
  })

  it('tracks cost across all agents', async () => {
    const state = { ...stateInRefinement(), loopCount: 1 }
    mockAllRefinementAgents(82)

    const result = await runIdeationStep(state, '', mockRunners)

    // 5 agents * 0.004 each = 0.020
    expect(result.stepCostUSD).toBeCloseTo(0.020, 3)
  })

  it('fails gracefully when outcome architect fails', async () => {
    const state = stateInRefinement()
    mockOutcomeArchitect.mockResolvedValue(makeFailedResult('Timeout'))

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Outcome mapping failed')
  })

  it('fails gracefully when rubric grader fails', async () => {
    const state = stateInRefinement()
    mockOutcomeArchitect.mockResolvedValue(makeAgentResult(MOCK_OUTCOMES))
    mockComponentRecommender.mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN))
    mockStructureOptimizer.mockResolvedValue(makeAgentResult(MOCK_OPTIMIZATION))
    mockRubricGrader.mockResolvedValue(makeFailedResult('Parse error'))
    mockDevilsAdvocate.mockResolvedValue(makeAgentResult(MOCK_DEVILS_ADVOCATE))

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Rubric grading failed')
  })

  it('salvages optimizer and devil results when only one agent throws', async () => {
    const state = { ...stateInRefinement(), loopCount: 1 }
    mockOutcomeArchitect.mockResolvedValue(makeAgentResult(MOCK_OUTCOMES))
    mockComponentRecommender.mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN))
    // Optimizer throws (rejected promise) — should NOT block grading
    mockStructureOptimizer.mockRejectedValue(new Error('Optimizer crashed'))
    mockRubricGrader.mockResolvedValue(makeAgentResult(makeGradeReport(82)))
    mockDevilsAdvocate.mockResolvedValue(makeAgentResult(MOCK_DEVILS_ADVOCATE))

    const result = await runIdeationStep(state, '', mockRunners)

    // Grader succeeded → should advance to review despite optimizer crash
    expect(result.updatedState.currentPhase).toBe('review')
    expect(result.updatedState.gradeReport?.overallScore).toBe(82)
    expect(result.humanMessage).toContain('optimizer encountered an error')
    // Devil's advocate result still applied
    expect(result.updatedState.challenges).toEqual(MOCK_DEVILS_ADVOCATE.challenges)
  })

  it('salvages grader result when devil advocate throws', async () => {
    const state = stateInRefinement()
    mockOutcomeArchitect.mockResolvedValue(makeAgentResult(MOCK_OUTCOMES))
    mockComponentRecommender.mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN))
    mockStructureOptimizer.mockResolvedValue(makeAgentResult(MOCK_OPTIMIZATION))
    mockRubricGrader.mockResolvedValue(makeAgentResult(makeGradeReport(78)))
    mockDevilsAdvocate.mockRejectedValue(new Error('Network timeout'))

    const result = await runIdeationStep(state, '', mockRunners)

    // loopCount=0 → after grading loopCount=1, but min iterations=2, so stays in refinement
    // Wait — score >= 75 but loopCount(1) < MIN_ITERATIONS(2) → stays in refinement
    expect(result.updatedState.currentPhase).toBe('refinement')
    expect(result.humanMessage).toContain("Devil's advocate encountered an error")
    // Challenges should remain whatever was on state before (null for fresh refinement)
    expect(result.updatedState.challenges).toBeNull()
  })

  it('fails when grader throws (rejected promise)', async () => {
    const state = stateInRefinement()
    mockOutcomeArchitect.mockResolvedValue(makeAgentResult(MOCK_OUTCOMES))
    mockComponentRecommender.mockResolvedValue(makeAgentResult(MOCK_COMPONENT_PLAN))
    mockStructureOptimizer.mockResolvedValue(makeAgentResult(MOCK_OPTIMIZATION))
    mockRubricGrader.mockRejectedValue(new Error('API key expired'))
    mockDevilsAdvocate.mockResolvedValue(makeAgentResult(MOCK_DEVILS_ADVOCATE))

    const result = await runIdeationStep(state, '', mockRunners)

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

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('missing')
    expect(result.stepCostUSD).toBe(0)
  })
})

// ─── Review Phase ────────────────────────────────────────────────────────────

describe('runIdeationStep — review phase', () => {
  it('presents blueprint and awaits human', async () => {
    const state = stateInReview(82)

    const result = await runIdeationStep(state, '', mockRunners)

    expect(result.awaitingHuman).toBe(true)
    expect(result.humanMessage).toContain('Blueprint Review')
    expect(result.humanMessage).toContain('82/100')
    expect(result.stepCostUSD).toBe(0)
  })

  it('includes structure info in review presentation', async () => {
    const state = stateInReview(82)

    const result = await runIdeationStep(state, '', mockRunners)

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

    const result = await runIdeationStep(state, '', mockRunners)

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
    expect(result.bestGradeReport).toBeNull()
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
