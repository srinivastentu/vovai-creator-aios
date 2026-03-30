import { describe, it, expect } from 'vitest'
import {
  getRecommendedProductionOrder,
  buildDefaultWorkflowTemplate,
  validateDependencyOrder,
  PIPELINE_PHASE_ORDER,
} from '../../src/lib/project-component/workflow-defaults'
import { COMPONENT_REGISTRY } from '../../src/lib/project-component/component-registry'
import { PROJECT_ARCHETYPES } from '../../src/lib/project-component/archetypes'
import { generateWizardSteps } from '../../src/components/project-component/wizard/wizard-stepper'
import type { ComponentDefinition, WorkflowTemplate } from '../../src/lib/project-component/types'

// ─── getRecommendedProductionOrder ────────────────────────────────────────

describe('getRecommendedProductionOrder', () => {
  it('sorts components by pipeline phase order', () => {
    const input = ['video', 'quiz', 'study_material', 'capstone_project', 'activity']
    const result = getRecommendedProductionOrder(input, COMPONENT_REGISTRY)

    // study_material=document(0), quiz=assessment(1), video=video(2), activity=activity(3), capstone=capstone(4)
    expect(result).toEqual([
      'study_material',
      'quiz',
      'video',
      'activity',
      'capstone_project',
    ])
  })

  it('preserves relative order within the same phase', () => {
    // practice_worksheet and study_material are both pipelineType: 'document'
    const input = ['practice_worksheet', 'study_material']
    const result = getRecommendedProductionOrder(input, COMPONENT_REGISTRY)

    // Both are phase 0 (document), so input order is preserved
    expect(result).toEqual(['practice_worksheet', 'study_material'])
  })

  it('returns empty array for empty input', () => {
    expect(getRecommendedProductionOrder([], COMPONENT_REGISTRY)).toEqual([])
  })

  it('sorts unknown types to the end', () => {
    const input = ['unknown_type', 'video']
    const result = getRecommendedProductionOrder(input, COMPONENT_REGISTRY)

    expect(result).toEqual(['video', 'unknown_type'])
  })

  it('returns single component as-is', () => {
    expect(getRecommendedProductionOrder(['quiz'], COMPONENT_REGISTRY)).toEqual(['quiz'])
  })

  it('handles all 16 component types without error', () => {
    const allTypes = Object.keys(COMPONENT_REGISTRY)
    const result = getRecommendedProductionOrder(allTypes, COMPONENT_REGISTRY)

    expect(result).toHaveLength(allTypes.length)
    // First components should be document-phase
    const firstDef = COMPONENT_REGISTRY[result[0]]
    expect(PIPELINE_PHASE_ORDER[firstDef.pipelineType]).toBe(0)
  })
})

// ─── buildDefaultWorkflowTemplate ─────────────────────────────────────────

describe('buildDefaultWorkflowTemplate', () => {
  it('builds correct template for k12_curriculum', () => {
    const archetype = PROJECT_ARCHETYPES.k12_curriculum
    const template = buildDefaultWorkflowTemplate(archetype, COMPONENT_REGISTRY)

    expect(template.enabledComponents).toEqual(['video'])
    expect(template.productionOrder).toEqual(['video'])

    // maxDepth=4 → 5 level entries (depths 0-4)
    expect(template.levelDefaults).toHaveLength(5)

    // video attachableAt: [2, 3] — so only depths 2 and 3 should include it
    expect(template.levelDefaults[0].enabledComponents).toEqual([])
    expect(template.levelDefaults[1].enabledComponents).toEqual([])
    expect(template.levelDefaults[2].enabledComponents).toEqual(['video'])
    expect(template.levelDefaults[3].enabledComponents).toEqual(['video'])
    expect(template.levelDefaults[4].enabledComponents).toEqual([])
  })

  it('builds correct template for professional_training', () => {
    const archetype = PROJECT_ARCHETYPES.professional_training
    const template = buildDefaultWorkflowTemplate(archetype, COMPONENT_REGISTRY)

    // Default: video, study_material, quiz, activity, capstone_project
    expect(template.enabledComponents).toEqual([
      'video', 'study_material', 'quiz', 'activity', 'capstone_project',
    ])

    // Sorted by pipeline phase: document(study_material) < assessment(quiz) < video < activity < capstone
    expect(template.productionOrder).toEqual([
      'study_material', 'quiz', 'video', 'activity', 'capstone_project',
    ])

    // maxDepth=3 → 4 level entries (depths 0-3)
    expect(template.levelDefaults).toHaveLength(4)

    // Labels from hierarchy
    expect(template.levelDefaults[0].label).toBe('Course')
    expect(template.levelDefaults[1].label).toBe('Module')
    expect(template.levelDefaults[2].label).toBe('Topic')
    expect(template.levelDefaults[3].label).toBe('Subtopic')

    // capstone_project attachableAt: [0, 1] — only at Course and Module
    const capstoneAtDepth0 = template.levelDefaults[0].enabledComponents.includes('capstone_project')
    const capstoneAtDepth1 = template.levelDefaults[1].enabledComponents.includes('capstone_project')
    const capstoneAtDepth2 = template.levelDefaults[2].enabledComponents.includes('capstone_project')
    expect(capstoneAtDepth0).toBe(true)
    expect(capstoneAtDepth1).toBe(true)
    expect(capstoneAtDepth2).toBe(false)
  })

  it('builds correct template for content_channel', () => {
    const archetype = PROJECT_ARCHETYPES.content_channel
    const template = buildDefaultWorkflowTemplate(archetype, COMPONENT_REGISTRY)

    expect(template.enabledComponents).toEqual(['video'])
    expect(template.productionOrder).toEqual(['video'])

    // maxDepth=3 → 4 level entries (depths 0-3)
    expect(template.levelDefaults).toHaveLength(4)

    // Labels
    expect(template.levelDefaults[0].label).toBe('Channel')
    expect(template.levelDefaults[3].label).toBe('Episode')
  })

  it('filters components by attachableAt', () => {
    const archetype = PROJECT_ARCHETYPES.professional_training
    const template = buildDefaultWorkflowTemplate(archetype, COMPONENT_REGISTRY)

    // quiz attachableAt: [1, 2, 3] — NOT at depth 0 (Course)
    const quizAtDepth0 = template.levelDefaults[0].enabledComponents.includes('quiz')
    const quizAtDepth1 = template.levelDefaults[1].enabledComponents.includes('quiz')
    expect(quizAtDepth0).toBe(false)
    expect(quizAtDepth1).toBe(true)
  })

  it('falls back to "Level N" for missing hierarchy labels', () => {
    const fakeArchetype = {
      ...PROJECT_ARCHETYPES.k12_curriculum,
      hierarchy: { 0: 'Root' },
      maxDepth: 2,
    }
    const template = buildDefaultWorkflowTemplate(fakeArchetype, COMPONENT_REGISTRY)

    expect(template.levelDefaults[0].label).toBe('Root')
    expect(template.levelDefaults[1].label).toBe('Level 1')
    expect(template.levelDefaults[2].label).toBe('Level 2')
  })
})

// ─── validateDependencyOrder ──────────────────────────────────────────────

describe('validateDependencyOrder', () => {
  it('returns empty record when all deps are correctly ordered', () => {
    // study_material has no deps, quiz depends on study_material
    const order = ['study_material', 'quiz']
    const enabled = ['study_material', 'quiz']
    const warnings = validateDependencyOrder(order, enabled, COMPONENT_REGISTRY)

    expect(Object.keys(warnings)).toHaveLength(0)
  })

  it('warns when component is ordered before its dependency', () => {
    // quiz depends on study_material, but quiz comes first
    const order = ['quiz', 'study_material']
    const enabled = ['quiz', 'study_material']
    const warnings = validateDependencyOrder(order, enabled, COMPONENT_REGISTRY)

    expect(warnings['quiz']).toBeDefined()
    expect(warnings['quiz']).toContain('ordered after it')
  })

  it('warns when a dependency is not enabled', () => {
    // quiz depends on study_material, but study_material is not enabled
    const order = ['quiz']
    const enabled = ['quiz']
    const warnings = validateDependencyOrder(order, enabled, COMPONENT_REGISTRY)

    expect(warnings['quiz']).toBeDefined()
    expect(warnings['quiz']).toContain('not enabled')
  })

  it('produces no warnings for components with empty dependsOn', () => {
    // video and study_material have no dependencies
    const order = ['video', 'study_material']
    const enabled = ['video', 'study_material']
    const warnings = validateDependencyOrder(order, enabled, COMPONENT_REGISTRY)

    expect(Object.keys(warnings)).toHaveLength(0)
  })

  it('handles empty input', () => {
    expect(validateDependencyOrder([], [], COMPONENT_REGISTRY)).toEqual({})
  })

  it('handles unknown component types gracefully', () => {
    const order = ['nonexistent_type']
    const enabled = ['nonexistent_type']
    const warnings = validateDependencyOrder(order, enabled, COMPONENT_REGISTRY)

    expect(Object.keys(warnings)).toHaveLength(0)
  })

  it('detects multiple violations', () => {
    // capstone_project depends on study_material and quiz
    // Neither is enabled
    const order = ['capstone_project']
    const enabled = ['capstone_project']
    const warnings = validateDependencyOrder(order, enabled, COMPONENT_REGISTRY)

    expect(warnings['capstone_project']).toBeDefined()
  })
})

// ─── generateWizardSteps ──────────────────────────────────────────────────

describe('generateWizardSteps', () => {
  const videoDef = COMPONENT_REGISTRY['video']
  const studyDef = COMPONENT_REGISTRY['study_material']
  const quizDef = COMPONENT_REGISTRY['quiz']

  it('always includes Overview, Workflow, and Review bookend steps', () => {
    const steps = generateWizardSteps([], [], {})
    expect(steps).toHaveLength(3)
    expect(steps[0].id).toBe('overview')
    expect(steps[1].id).toBe('workflow')
    expect(steps[steps.length - 1].id).toBe('review')
  })

  it('adds component steps between bookends', () => {
    const counts: Record<string, number> = { video: 5, study_material: 3 }
    const steps = generateWizardSteps(
      ['video', 'study_material'],
      [videoDef, studyDef],
      counts,
    )

    // Overview + Workflow + video + study_material + Review = 5
    expect(steps).toHaveLength(5)
    expect(steps[2].id).toBe('video')
    expect(steps[2].instanceCount).toBe(5)
    expect(steps[3].id).toBe('study_material')
    expect(steps[3].instanceCount).toBe(3)
  })

  it('follows productionOrder from workflow template', () => {
    const counts: Record<string, number> = { video: 5, quiz: 2 }
    const template: WorkflowTemplate = {
      enabledComponents: ['video', 'quiz'],
      productionOrder: ['quiz', 'video'], // quiz before video
      levelDefaults: [],
    }
    const steps = generateWizardSteps(
      ['video', 'quiz'],
      [videoDef, quizDef],
      counts,
      template,
    )

    expect(steps[2].id).toBe('quiz')
    expect(steps[3].id).toBe('video')
  })

  it('skips components with 0 instances', () => {
    const counts: Record<string, number> = { video: 5, study_material: 0 }
    const steps = generateWizardSteps(
      ['video', 'study_material'],
      [videoDef, studyDef],
      counts,
    )

    // Only video appears (study_material has 0 instances)
    const componentSteps = steps.filter(s => s.componentType)
    expect(componentSteps).toHaveLength(1)
    expect(componentSteps[0].id).toBe('video')
  })

  it('handles no enabled components', () => {
    const steps = generateWizardSteps([], [], {})
    expect(steps).toHaveLength(3) // Overview + Workflow + Review
  })
})
