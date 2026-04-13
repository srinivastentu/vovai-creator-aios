import { describe, it, expect, vi } from 'vitest'
import {
  createInitialState,
  produce,
  evaluate,
  runLoop,
  processReview,
} from '../../../src/lib/core/engine/loop-engine'
import type {
  LoopStage,
  LoopState,
  RubricDefinition,
  AgentExecutor,
  JudgeFunction,
  GradeReport,
} from '../../../src/lib/core/engine/types'

// ---------------------------------------------------------------------------
// Test artifact type
// ---------------------------------------------------------------------------

interface TestArtifact {
  title: string
  content: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestRubric(): RubricDefinition {
  return {
    id: 'test-rubric',
    name: 'Test Rubric',
    passThreshold: 75,
    dimensions: [
      {
        id: 'd1',
        name: 'Quality',
        weight: 1.0,
        passThreshold: 70,
        description: 'Overall quality',
        criteria: { excellent: 'Very good', poor: 'Needs work' },
      },
    ],
  }
}

function createTestStage(
  overrides?: Partial<LoopStage<TestArtifact>>
): LoopStage<TestArtifact> {
  return {
    id: 'test-stage',
    agents: [
      {
        id: 'agent-1',
        name: 'Test Agent',
        model: { primary: 'claude', fallback: 'gpt-4o' },
        maxRetries: 2,
        timeoutMs: 30000,
      },
    ],
    rubric: createTestRubric(),
    threshold: 75,
    maxIterations: 5,
    minIterations: 2,
    loopPattern: 'standard',
    ...overrides,
  }
}

function createMockJudge(score: number): JudgeFunction {
  return async (artifact, rubric) => ({
    overallScore: score,
    passesThreshold: score >= rubric.passThreshold,
    dimensionScores: [
      {
        dimensionId: 'd1',
        name: 'Quality',
        score,
        weight: 1.0,
        feedback: `Score: ${score}`,
      },
    ],
    recommendation: score >= rubric.passThreshold ? 'Approve' : 'Revise',
    improvementPriorities:
      score < rubric.passThreshold ? ['Improve quality'] : [],
  })
}

const mockArtifact: TestArtifact = {
  title: 'Mock Artifact',
  content: 'generated content',
}

const mockAgentExecutor: AgentExecutor = async () => mockArtifact

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
  it('a. returns status idle', () => {
    const state = createInitialState<TestArtifact>('stage-1')
    expect(state.status).toBe('idle')
  })

  it('b. loopCount is 0', () => {
    const state = createInitialState<TestArtifact>('stage-1')
    expect(state.loopCount).toBe(0)
  })

  it('c. costUSD is 0', () => {
    const state = createInitialState<TestArtifact>('stage-1')
    expect(state.costUSD).toBe(0)
  })

  it('d. iterations is empty array', () => {
    const state = createInitialState<TestArtifact>('stage-1')
    expect(state.iterations).toEqual([])
  })

  it('e. stageId matches input', () => {
    const state = createInitialState<TestArtifact>('my-stage')
    expect(state.stageId).toBe('my-stage')
  })
})

// ---------------------------------------------------------------------------
// produce
// ---------------------------------------------------------------------------

describe('produce', () => {
  it('a. calls agentExecutor with correct args', async () => {
    const stage = createTestStage()
    const state = createInitialState<TestArtifact>('stage-1')
    const context = { projectId: 'p1' }
    const spy = vi.fn<AgentExecutor>(async () => mockArtifact)

    await produce(stage, state, context, spy)

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(stage.agents, context, state)
  })

  it('b. returns the artifact from agentExecutor', async () => {
    const stage = createTestStage()
    const state = createInitialState<TestArtifact>('stage-1')
    const result = await produce(stage, state, {}, mockAgentExecutor)

    expect(result).toEqual(mockArtifact)
  })

  it('c. passes humanFeedback in context when present', async () => {
    const stage = createTestStage()
    const state: LoopState<TestArtifact> = {
      ...createInitialState<TestArtifact>('stage-1'),
      humanFeedback: ['fix the intro'],
    }
    let capturedContext: unknown = null
    const spyExecutor: AgentExecutor = async (agents, context, st) => {
      capturedContext = context
      return mockArtifact
    }

    await produce(stage, state, { projectId: 'p1' }, spyExecutor)

    expect(capturedContext).toEqual({
      projectId: 'p1',
      humanFeedback: ['fix the intro'],
    })
  })
})

// ---------------------------------------------------------------------------
// evaluate
// ---------------------------------------------------------------------------

describe('evaluate', () => {
  it('a. calls judge with artifact and rubric', async () => {
    const rubric = createTestRubric()
    const judgeSpy = vi.fn<JudgeFunction>(createMockJudge(80))

    await evaluate(mockArtifact, rubric, judgeSpy)

    expect(judgeSpy).toHaveBeenCalledOnce()
    expect(judgeSpy).toHaveBeenCalledWith(mockArtifact, rubric, undefined)
  })

  it('b. returns GradeReport from judge', async () => {
    const rubric = createTestRubric()
    const judge = createMockJudge(85)

    const report = await evaluate(mockArtifact, rubric, judge)

    expect(report.overallScore).toBe(85)
    expect(report.passesThreshold).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// runLoop
// ---------------------------------------------------------------------------

describe('runLoop', () => {
  it('d. score above threshold + minIterations met → presenting', async () => {
    const stage = createTestStage({ minIterations: 2 })
    // Start with loopCount 1 so after this iteration loopCount = 2 = minIterations
    let state: LoopState<TestArtifact> = {
      ...createInitialState<TestArtifact>('stage-1'),
      loopCount: 1,
      status: 'revising',
    }

    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(90))

    expect(state.status).toBe('presenting')
  })

  it('e. score above threshold + before minIterations → revising (rule 1)', async () => {
    const stage = createTestStage({ minIterations: 2 })
    // loopCount 0, after iteration = 1, still < minIterations (2)
    let state = createInitialState<TestArtifact>('stage-1')

    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(90))

    expect(state.status).toBe('revising')
  })

  it('f. score below threshold → revising', async () => {
    const stage = createTestStage()
    let state = createInitialState<TestArtifact>('stage-1')

    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(50))

    expect(state.status).toBe('revising')
  })

  it('g. at maxIterations → presenting (escalation)', async () => {
    const stage = createTestStage({ maxIterations: 3 })
    let state: LoopState<TestArtifact> = {
      ...createInitialState<TestArtifact>('stage-1'),
      loopCount: 2,
      status: 'revising',
    }

    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(50))

    expect(state.status).toBe('presenting')
  })

  it('h. bestArtifact tracking across 3 sequential iterations', async () => {
    const stage = createTestStage({ minIterations: 1, maxIterations: 5 })
    let state = createInitialState<TestArtifact>('stage-1')

    // Iteration 1: score 60
    const artifact1: TestArtifact = { title: 'V1', content: 'version 1' }
    const executor1: AgentExecutor = async () => artifact1
    state = await runLoop(stage, state, {}, executor1, createMockJudge(60))
    expect(state.loopCount).toBe(1)

    // Iteration 2: score 85 — should become bestArtifact
    const artifact2: TestArtifact = { title: 'V2', content: 'version 2' }
    const executor2: AgentExecutor = async () => artifact2
    state = await runLoop(stage, state, {}, executor2, createMockJudge(85))
    expect(state.loopCount).toBe(2)

    // Iteration 3: score 70 — bestArtifact should still be V2
    const artifact3: TestArtifact = { title: 'V3', content: 'version 3' }
    const executor3: AgentExecutor = async () => artifact3
    state = await runLoop(stage, state, {}, executor3, createMockJudge(70))
    expect(state.loopCount).toBe(3)

    expect(state.bestArtifact).toEqual(artifact2)
    expect(state.bestGrade?.overallScore).toBe(85)
    expect(state.iterations).toHaveLength(3)
  })

  it('i. validator fails → revising, judge never called', async () => {
    const judgeSpy = vi.fn<JudgeFunction>(createMockJudge(90))
    const stage = createTestStage({
      validator: () => ({
        valid: false,
        errors: [{ code: 'FORMAT', message: 'Bad format' }],
      }),
    })
    let state = createInitialState<TestArtifact>('stage-1')

    state = await runLoop(stage, state, {}, mockAgentExecutor, judgeSpy)

    expect(state.status).toBe('revising')
    expect(judgeSpy).not.toHaveBeenCalled()
  })

  it('j. humanFeedback cleared after use (rule 5)', async () => {
    const stage = createTestStage()
    let state: LoopState<TestArtifact> = {
      ...createInitialState<TestArtifact>('stage-1'),
      humanFeedback: ['fix the intro'],
    }

    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(80))

    expect(state.humanFeedback).toEqual([])
  })

  it('k. loopCount increments each iteration', async () => {
    const stage = createTestStage()
    let state = createInitialState<TestArtifact>('stage-1')

    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(50))
    expect(state.loopCount).toBe(1)

    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(50))
    expect(state.loopCount).toBe(2)
  })

  it('l. iteration record added with grade and version', async () => {
    const stage = createTestStage()
    let state = createInitialState<TestArtifact>('stage-1')

    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(80))

    expect(state.iterations).toHaveLength(1)
    const record = state.iterations[0]
    expect(record.version).toBe(1)
    expect(record.grade).not.toBeNull()
    expect(record.grade?.overallScore).toBe(80)
  })

  it('shouldContinue hook forces another iteration even when threshold met', async () => {
    const stage = createTestStage({
      threshold: 75,
      minIterations: 1,
      maxIterations: 3,
      shouldContinue: (s) => s.loopCount < 2,
    })
    let state = createInitialState<TestArtifact>('stage-1')
    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(90))
    // loopCount=1, threshold met, but shouldContinue says keep going.
    expect(state.status).toBe('revising')
    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(90))
    // loopCount=2, shouldContinue now returns false → presenting.
    expect(state.status).toBe('presenting')
  })

  it('shouldContinue still respects maxIterations', async () => {
    const stage = createTestStage({
      threshold: 75,
      minIterations: 1,
      maxIterations: 2,
      shouldContinue: () => true, // always wants more
    })
    let state = createInitialState<TestArtifact>('stage-1')
    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(90))
    state = await runLoop(stage, state, {}, mockAgentExecutor, createMockJudge(90))
    // Max hit → presenting regardless.
    expect(state.status).toBe('presenting')
  })
})

// ---------------------------------------------------------------------------
// processReview
// ---------------------------------------------------------------------------

describe('processReview', () => {
  function reviewableState(): LoopState<TestArtifact> {
    return {
      stageId: 'stage-1',
      status: 'presenting',
      currentArtifact: mockArtifact,
      bestArtifact: mockArtifact,
      bestGrade: {
        overallScore: 80,
        passesThreshold: true,
        dimensionScores: [],
        recommendation: 'Approve',
        improvementPriorities: [],
      },
      iterations: [
        {
          artifactId: 'a1',
          version: 1,
          grade: null,
          modelUsed: 'claude',
          tokensIn: 100,
          tokensOut: 200,
          costUSD: 0.01,
          createdAt: new Date(),
        },
      ],
      loopCount: 2,
      humanFeedback: [],
      costUSD: 0.01,
    }
  }

  it('m. approve → status approved', () => {
    const state = reviewableState()
    const result = processReview(state, { type: 'approve' })
    expect(result.status).toBe('approved')
  })

  it('n. reject → generating, iterations cleared, loopCount reset', () => {
    const state = reviewableState()
    const result = processReview(state, { type: 'reject' })
    expect(result.status).toBe('generating')
    expect(result.iterations).toEqual([])
    expect(result.loopCount).toBe(0)
    expect(result.humanFeedback).toEqual([])
  })

  it('o. feedback → generating, message added to humanFeedback', () => {
    const state = reviewableState()
    const result = processReview(state, {
      type: 'feedback',
      message: 'Make it shorter',
    })
    expect(result.status).toBe('generating')
    expect(result.humanFeedback).toContain('Make it shorter')
  })

  it('p. editedArtifact updates currentArtifact before action proceeds', () => {
    const state = reviewableState()
    const edited: TestArtifact = { title: 'Edited', content: 'edited content' }
    const result = processReview(state, {
      type: 'approve',
      editedArtifact: edited,
    })
    expect(result.status).toBe('approved')
    expect(result.currentArtifact).toEqual(edited)
  })

  it('q. use_segments → generating', () => {
    const state = reviewableState()
    const result = processReview(state, { type: 'use_segments' })
    expect(result.status).toBe('generating')
  })

  it('r. mix_produce → generating', () => {
    const state = reviewableState()
    const result = processReview(state, { type: 'mix_produce' })
    expect(result.status).toBe('generating')
  })
})
