import { describe, it, expect } from 'vitest'
import {
  createMockAgentExecutor,
  createMockJudge,
} from '../../../src/lib/domain/workflows/pipeline-mocks'
import type { AgentConfig, RubricDefinition, LoopState } from '../../../src/lib/core/engine/types'

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
    stageId, status: 'generating', currentArtifact: null, bestArtifact: null,
    bestGrade: null, iterations: [], loopCount: 0, humanFeedback: [], costUSD: 0,
  }
}

describe('createMockAgentExecutor', () => {
  it('returns artifact with correct shape for brief stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('brief'))
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('goals')
    expect(result).toHaveProperty('constraints')
    expect(result).toHaveProperty('audience_hint')
  })

  it('returns artifact with correct shape for audience stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('audience'))
    expect(result).toHaveProperty('description')
    expect(result).toHaveProperty('experience_level')
    expect(result).toHaveProperty('modality_prefs')
  })

  it('returns artifact with correct shape for structure stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('structure'))
    expect(result).toHaveProperty('modules')
    expect(result).toHaveProperty('topic_count')
    expect(result).toHaveProperty('outcome_count')
  })

  it('returns artifact with correct shape for components stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('components'))
    expect(result).toHaveProperty('assignments')
    expect(result).toHaveProperty('total_components')
  })

  it('returns artifact with correct shape for handoff stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('handoff'))
    expect(result).toHaveProperty('ready')
    expect(result).toHaveProperty('cost_estimate')
    expect(result).toHaveProperty('timeline')
  })

  it('returns fallback artifact for unknown stage', async () => {
    const executor = createMockAgentExecutor()
    const result = await executor(dummyAgents, {}, makeState('unknown'))
    expect(result).toHaveProperty('mock')
  })
})

describe('createMockJudge', () => {
  it('returns score 65 on first call for a stage', async () => {
    const judge = createMockJudge()
    const grade = await judge({ content: 'test' }, dummyRubric)
    expect(grade.overallScore).toBe(65)
    expect(grade.passesThreshold).toBe(false)
  })

  it('returns score 80 on second call for same stage', async () => {
    const judge = createMockJudge()
    await judge({ content: 'test' }, dummyRubric)
    const grade = await judge({ content: 'test' }, dummyRubric)
    expect(grade.overallScore).toBe(80)
    expect(grade.passesThreshold).toBe(true)
  })

  it('resets counter per rubric (separate stages get independent counters)', async () => {
    const judge = createMockJudge()
    await judge({ content: 'test' }, dummyRubric)
    await judge({ content: 'test' }, dummyRubric)
    const otherRubric: RubricDefinition = { ...dummyRubric, id: 'r2', name: 'Other' }
    const grade = await judge({ content: 'test' }, otherRubric)
    expect(grade.overallScore).toBe(65)
  })

  it('returns dimension scores matching rubric dimensions', async () => {
    const judge = createMockJudge()
    const grade = await judge({ content: 'test' }, dummyRubric)
    expect(grade.dimensionScores).toHaveLength(2)
    expect(grade.dimensionScores[0].dimensionId).toBe('d1')
    expect(grade.dimensionScores[1].dimensionId).toBe('d2')
  })
})
