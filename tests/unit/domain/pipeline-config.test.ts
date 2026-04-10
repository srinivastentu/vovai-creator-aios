import { describe, it, expect } from 'vitest'
import {
  ELEARN_IDEATION_STAGES,
  createElearnIdeationPipeline,
} from '../../../src/lib/domain/workflows/ideation/pipeline-config'

// ---------------------------------------------------------------------------
// ELEARN_IDEATION_STAGES
// ---------------------------------------------------------------------------

describe('ELEARN_IDEATION_STAGES', () => {
  // a
  it('has exactly 5 stages', () => {
    expect(ELEARN_IDEATION_STAGES).toHaveLength(5)
  })

  // b
  it('stage IDs are: brief, audience, structure, components, handoff', () => {
    const ids = ELEARN_IDEATION_STAGES.map((s) => s.id)
    expect(ids).toEqual(['brief', 'audience', 'structure', 'components', 'handoff'])
  })

  // c
  it('each stage has a valid rubric (passThreshold > 0, dimensions.length > 0)', () => {
    for (const stage of ELEARN_IDEATION_STAGES) {
      expect(stage.rubric.passThreshold).toBeGreaterThan(0)
      expect(stage.rubric.dimensions.length).toBeGreaterThan(0)
    }
  })

  // d
  it('brief stage has no dependsOn', () => {
    const brief = ELEARN_IDEATION_STAGES.find((s) => s.id === 'brief')!
    expect(brief.dependsOn).toBeUndefined()
  })

  // e
  it("audience depends on ['brief']", () => {
    const audience = ELEARN_IDEATION_STAGES.find((s) => s.id === 'audience')!
    expect(audience.dependsOn).toEqual(['brief'])
  })

  // f
  it("structure depends on ['brief', 'audience']", () => {
    const structure = ELEARN_IDEATION_STAGES.find((s) => s.id === 'structure')!
    expect(structure.dependsOn).toEqual(['brief', 'audience'])
  })

  // g
  it("components depends on ['brief', 'audience', 'structure']", () => {
    const components = ELEARN_IDEATION_STAGES.find((s) => s.id === 'components')!
    expect(components.dependsOn).toEqual(['brief', 'audience', 'structure'])
  })

  // h
  it("handoff depends on ['brief', 'audience', 'structure', 'components']", () => {
    const handoff = ELEARN_IDEATION_STAGES.find((s) => s.id === 'handoff')!
    expect(handoff.dependsOn).toEqual(['brief', 'audience', 'structure', 'components'])
  })

  // i
  it("structure uses 'strategic' pattern, others use 'standard'", () => {
    for (const stage of ELEARN_IDEATION_STAGES) {
      if (stage.id === 'structure') {
        expect(stage.loopPattern).toBe('strategic')
      } else {
        expect(stage.loopPattern).toBe('standard')
      }
    }
  })

  // j
  it('handoff threshold is 80, others are 75', () => {
    for (const stage of ELEARN_IDEATION_STAGES) {
      if (stage.id === 'handoff') {
        expect(stage.threshold).toBe(80)
      } else {
        expect(stage.threshold).toBe(75)
      }
    }
  })

  // k
  it('each stage has at least 1 agent config', () => {
    for (const stage of ELEARN_IDEATION_STAGES) {
      expect(stage.agents.length).toBeGreaterThanOrEqual(1)
    }
  })

  // l
  it('all agent configs have id, name, model with primary and fallback', () => {
    for (const stage of ELEARN_IDEATION_STAGES) {
      for (const agent of stage.agents) {
        expect(agent.id).toBeTruthy()
        expect(agent.name).toBeTruthy()
        expect(agent.model.primary).toBeTruthy()
        expect(agent.model.fallback).toBeTruthy()
      }
    }
  })

  // m
  it('handoff minIterations is 1, others are 2', () => {
    for (const stage of ELEARN_IDEATION_STAGES) {
      if (stage.id === 'handoff') {
        expect(stage.minIterations).toBe(1)
      } else {
        expect(stage.minIterations).toBe(2)
      }
    }
  })

  // n
  it('all stages have reviewerRoles (non-empty array)', () => {
    for (const stage of ELEARN_IDEATION_STAGES) {
      expect(stage.reviewerRoles).toBeDefined()
      expect(stage.reviewerRoles!.length).toBeGreaterThan(0)
    }
  })

  // o
  it('all stages have reviewGateConfig with allowedActions', () => {
    for (const stage of ELEARN_IDEATION_STAGES) {
      expect(stage.reviewGateConfig).toBeDefined()
      expect(stage.reviewGateConfig!.allowedActions).toBeDefined()
      expect(stage.reviewGateConfig!.allowedActions!.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// createElearnIdeationPipeline
// ---------------------------------------------------------------------------

describe('createElearnIdeationPipeline', () => {
  const pipeline = createElearnIdeationPipeline('bp-123')

  // p
  it('returns IdeationPipeline with correct blueprintId', () => {
    expect(pipeline.blueprintId).toBe('bp-123')
    expect(pipeline.id).toBe('elearn-ideation-bp-123')
  })

  // q
  it('pipeline has 5 stages', () => {
    expect(pipeline.stages).toHaveLength(5)
  })

  // r
  it("pipeline status is 'active'", () => {
    expect(pipeline.status).toBe('active')
  })

  // s
  it("all stageStates initialized to 'idle'", () => {
    for (const stage of pipeline.stages) {
      expect(pipeline.stageStates[stage.id]).toBeDefined()
      expect(pipeline.stageStates[stage.id].status).toBe('idle')
    }
  })

  // t
  it('currentStageIndex is 0', () => {
    expect(pipeline.currentStageIndex).toBe(0)
  })
})
