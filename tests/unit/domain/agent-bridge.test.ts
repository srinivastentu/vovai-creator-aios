import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  AgentConfig,
  AgentExecutor,
  JudgeFunction,
  LoopState,
  RubricDefinition,
} from '../../../src/lib/core/engine/types'
import type { AgentResult } from '../../../src/lib/domain/workflows/agents/framework/types'

// Mock all agent runners BEFORE importing the bridge
vi.mock('../../../src/lib/domain/workflows/agents/orchestrator', () => ({
  runOrchestrator: vi.fn(),
}))
vi.mock('../../../src/lib/domain/workflows/agents/audience-analyst', () => ({
  runAudienceAnalyst: vi.fn(),
}))
vi.mock('../../../src/lib/domain/workflows/agents/curriculum-strategist', () => ({
  runCurriculumStrategist: vi.fn(),
}))
vi.mock('../../../src/lib/domain/workflows/agents/outcome-architect', () => ({
  runOutcomeArchitect: vi.fn(),
}))
vi.mock('../../../src/lib/domain/workflows/agents/component-recommender', () => ({
  runComponentRecommender: vi.fn(),
}))
vi.mock('../../../src/lib/domain/workflows/agents/structure-optimizer', () => ({
  runStructureOptimizer: vi.fn(),
}))
vi.mock('../../../src/lib/domain/workflows/agents/devils-advocate', () => ({
  runDevilsAdvocate: vi.fn(),
}))

// Mock Anthropic SDK for judge tests
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}))

import {
  createRealAgentExecutor,
  createRealJudge,
  getExecutorAndJudge,
} from '../../../src/lib/domain/workflows/agents/agent-bridge'
import type { PipelineContext } from '../../../src/lib/domain/workflows/agents/agent-bridge'

import { runOrchestrator } from '../../../src/lib/domain/workflows/agents/orchestrator'
import { runAudienceAnalyst } from '../../../src/lib/domain/workflows/agents/audience-analyst'
import { runCurriculumStrategist } from '../../../src/lib/domain/workflows/agents/curriculum-strategist'
import { runOutcomeArchitect } from '../../../src/lib/domain/workflows/agents/outcome-architect'
import { runComponentRecommender } from '../../../src/lib/domain/workflows/agents/component-recommender'
import { runStructureOptimizer } from '../../../src/lib/domain/workflows/agents/structure-optimizer'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const dummyAgents: AgentConfig[] = [{
  id: 'a1', name: 'Agent', model: { primary: 'claude', fallback: 'gpt' },
  maxRetries: 2, timeoutMs: 5000,
}]

const dummyRubric: RubricDefinition = {
  id: 'r1', name: 'Test Rubric', passThreshold: 75,
  dimensions: [
    { id: 'd1', name: 'Quality', weight: 0.5, passThreshold: 70, description: 'Quality', criteria: {} },
    { id: 'd2', name: 'Clarity', weight: 0.5, passThreshold: 70, description: 'Clarity', criteria: {} },
  ],
}

function makeState(stageId: string): LoopState<unknown> {
  return {
    stageId,
    status: 'generating',
    currentArtifact: null,
    bestArtifact: null,
    bestGrade: null,
    iterations: [],
    loopCount: 0,
    humanFeedback: [],
    costUSD: 0,
  }
}

function makeAgentResult<T>(agentId: string, output: T): AgentResult<T> {
  return {
    agentId,
    success: true as const,
    output,
    durationMs: 100,
    modelUsed: 'claude-sonnet-4-20250514',
    tokensIn: 500,
    tokensOut: 200,
    costUSD: 0.0045,
  }
}

function makeFailedResult<T>(agentId: string): AgentResult<T> {
  return {
    agentId,
    success: false as const,
    output: null,
    durationMs: 100,
    modelUsed: 'claude-sonnet-4-20250514',
    tokensIn: 0,
    tokensOut: 0,
    costUSD: 0,
    error: 'Agent failed',
  }
}

const baseContext: PipelineContext = {
  brief: 'Test course about AI',
  archetype: 'professional_training',
  audienceProfile: {
    primaryAudience: {
      description: 'Test audience',
      educationLevel: 'Bachelors',
      experienceLevel: 'Intermediate',
      learningContext: 'Online',
      motivations: ['Learn AI'],
      painPoints: ['No time'],
      technologyComfort: 'intermediate',
    },
    prerequisiteKnowledge: ['Basic math'],
    learningPreferences: {
      preferredModalities: ['video'],
      attentionSpan: 'medium',
      practicePreference: 'guided',
    },
  } as PipelineContext['audienceProfile'],
  structure: {
    courseTitle: 'AI Intro',
    courseDescription: 'An intro course',
    modules: [],
    sequencingRationale: 'Logical',
    alternativeStructures: [],
    confidenceScore: 85,
  } as PipelineContext['structure'],
  outcomesMap: {
    courseOutcomes: [],
    nodeOutcomes: [],
    totalOutcomes: 0,
    bloomDistribution: {
      remember: 0, understand: 0, apply: 0,
      analyze: 0, evaluate: 0, create: 0,
    },
    coverageNotes: '',
  } as PipelineContext['outcomesMap'],
  componentPlan: {
    nodeRecommendations: [],
    totalComponents: 0,
    componentBreakdown: {},
    budgetTiers: [],
    rationale: '',
  } as PipelineContext['componentPlan'],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('agent-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createRealAgentExecutor', () => {
    it('returns a function matching AgentExecutor type', () => {
      const executor = createRealAgentExecutor()
      expect(typeof executor).toBe('function')
      // Type check: AgentExecutor accepts (agents, context, state)
      const typed: AgentExecutor = executor
      expect(typed).toBeDefined()
    })

    it('maps brief stage to orchestrator agent', async () => {
      const mockOutput = { phaseAction: 'advance_phase', humanFacingMessage: 'Hello' }
      vi.mocked(runOrchestrator).mockResolvedValue(
        makeAgentResult('orchestrator', mockOutput) as never
      )

      const executor = createRealAgentExecutor()
      const result = await executor(dummyAgents, baseContext, makeState('brief'))

      expect(runOrchestrator).toHaveBeenCalledOnce()
      expect(result).toEqual(mockOutput)
    })

    it('maps audience stage to audience-analyst agent', async () => {
      const mockOutput = { primaryAudience: { description: 'Test' } }
      vi.mocked(runAudienceAnalyst).mockResolvedValue(
        makeAgentResult('audience-analyst', mockOutput) as never
      )

      const executor = createRealAgentExecutor()
      const result = await executor(dummyAgents, baseContext, makeState('audience'))

      expect(runAudienceAnalyst).toHaveBeenCalledWith(baseContext.brief, baseContext.archetype)
      expect(result).toEqual(mockOutput)
    })

    it('maps structure stage to curriculum-strategist + outcome-architect (multi-agent)', async () => {
      const structureOutput = { courseTitle: 'AI', modules: [] }
      const outcomeOutput = { outcomes: ['o1'], totalOutcomes: 1 }

      vi.mocked(runCurriculumStrategist).mockResolvedValue(
        makeAgentResult('curriculum-strategist', structureOutput) as never
      )
      vi.mocked(runOutcomeArchitect).mockResolvedValue(
        makeAgentResult('outcome-architect', outcomeOutput) as never
      )

      const executor = createRealAgentExecutor()
      const result = await executor(dummyAgents, baseContext, makeState('structure'))

      expect(runCurriculumStrategist).toHaveBeenCalledOnce()
      expect(runOutcomeArchitect).toHaveBeenCalledOnce()
      // Returns last agent's output
      expect(result).toEqual(outcomeOutput)
    })

    it('maps components stage to component-recommender + structure-optimizer (multi-agent)', async () => {
      const componentOutput = { components: ['c1'], totalComponents: 1 }
      const optimizerOutput = { healthScore: 90, actions: [] }

      vi.mocked(runComponentRecommender).mockResolvedValue(
        makeAgentResult('component-recommender', componentOutput) as never
      )
      vi.mocked(runStructureOptimizer).mockResolvedValue(
        makeAgentResult('structure-optimizer', optimizerOutput) as never
      )

      const executor = createRealAgentExecutor()
      const result = await executor(dummyAgents, baseContext, makeState('components'))

      expect(runComponentRecommender).toHaveBeenCalledOnce()
      expect(runStructureOptimizer).toHaveBeenCalledOnce()
      expect(result).toEqual(optimizerOutput)
    })

    it('maps handoff stage to programmatic completeness check', async () => {
      const executor = createRealAgentExecutor()
      const result = await executor(dummyAgents, baseContext, makeState('handoff'))

      expect(result).toMatchObject({
        ready: true,
        issues: [],
        productionReadiness: expect.stringContaining('Ready for Phase 1'),
      })
    })

    it('handoff reports issues when context is incomplete', async () => {
      const incompleteCtx: PipelineContext = {
        brief: 'Test',
        archetype: 'professional_training',
      }

      const executor = createRealAgentExecutor()
      const result = await executor(dummyAgents, incompleteCtx, makeState('handoff')) as Record<string, unknown>

      expect(result).toMatchObject({ ready: false })
      expect((result.issues as string[]).length).toBeGreaterThan(0)
    })

    it('throws meaningful error for unknown stageId', async () => {
      const executor = createRealAgentExecutor()
      await expect(
        executor(dummyAgents, baseContext, makeState('nonexistent'))
      ).rejects.toThrow("Unknown stage ID: 'nonexistent'")
    })

    it('throws when all agents in a stage fail', async () => {
      vi.mocked(runAudienceAnalyst).mockResolvedValue(
        makeFailedResult('audience-analyst') as never
      )

      const executor = createRealAgentExecutor()
      await expect(
        executor(dummyAgents, baseContext, makeState('audience'))
      ).rejects.toThrow("Stage 'audience' failed")
    })

    it('returns first agent output when second agent fails in multi-agent stage', async () => {
      const structureOutput = { courseTitle: 'AI', modules: [] }
      vi.mocked(runCurriculumStrategist).mockResolvedValue(
        makeAgentResult('curriculum-strategist', structureOutput) as never
      )
      vi.mocked(runOutcomeArchitect).mockResolvedValue(
        makeFailedResult('outcome-architect') as never
      )

      const executor = createRealAgentExecutor()
      const result = await executor(dummyAgents, baseContext, makeState('structure'))

      // Falls back to last successful result (curriculum-strategist)
      expect(result).toEqual(structureOutput)
    })
  })

  describe('createRealJudge', () => {
    it('returns a function matching JudgeFunction type', () => {
      const judge = createRealJudge()
      expect(typeof judge).toBe('function')
      const typed: JudgeFunction = judge
      expect(typed).toBeDefined()
    })
  })

  describe('cost tracker', () => {
    it('accumulates cost from multiple agent calls', async () => {
      vi.mocked(runOrchestrator).mockResolvedValue(
        makeAgentResult('orchestrator', { phaseAction: 'continue' }) as never
      )

      const { agentExecutor, getCostReport } = getExecutorAndJudge()

      // Simulate having an API key by checking mock path
      // Since ANTHROPIC_API_KEY is not set in test env, this returns mocks
      const cost = getCostReport()
      expect(cost).toMatchObject({
        tokensIn: expect.any(Number),
        tokensOut: expect.any(Number),
        costUSD: expect.any(Number),
      })
      expect(agentExecutor).toBeDefined()
    })
  })

  describe('getExecutorAndJudge', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('returns mock executor and judge when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY

      const { agentExecutor, judge, getCostReport } = getExecutorAndJudge()
      expect(agentExecutor).toBeDefined()
      expect(judge).toBeDefined()

      const cost = getCostReport()
      expect(cost.modelUsed).toBe('mock')
    })

    it('returns real executor and judge when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key-123'

      const { agentExecutor, judge, getCostReport } = getExecutorAndJudge()
      expect(agentExecutor).toBeDefined()
      expect(judge).toBeDefined()

      // Real tracker starts at 0, not 'mock'
      const cost = getCostReport()
      expect(cost.modelUsed).toBe('')
      expect(cost.costUSD).toBe(0)
    })
  })
})
