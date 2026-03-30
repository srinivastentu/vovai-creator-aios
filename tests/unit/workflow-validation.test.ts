import { describe, it, expect } from 'vitest'
import { workflowTemplateSchema } from '../../src/lib/validations/blueprint'

// ─── Helper ──────────────────────────────────────────────────────────────────

function validTemplate() {
  return {
    enabledComponents: ['video', 'study_material'],
    productionOrder: ['study_material', 'video'],
    levelDefaults: [
      { depth: 0, label: 'Course', enabledComponents: [] },
      { depth: 1, label: 'Module', enabledComponents: ['study_material'] },
      { depth: 2, label: 'Topic', enabledComponents: ['video', 'study_material'] },
    ],
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('workflowTemplateSchema', () => {
  it('accepts a valid template', () => {
    const result = workflowTemplateSchema.safeParse(validTemplate())
    expect(result.success).toBe(true)
  })

  it('rejects empty enabledComponents', () => {
    const result = workflowTemplateSchema.safeParse({
      ...validTemplate(),
      enabledComponents: [],
      productionOrder: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects productionOrder with different items than enabledComponents', () => {
    const result = workflowTemplateSchema.safeParse({
      ...validTemplate(),
      enabledComponents: ['video', 'study_material'],
      productionOrder: ['video', 'quiz'], // quiz not in enabledComponents
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message).join(', ')
      expect(messages).toContain('productionOrder must contain exactly the same items')
    }
  })

  it('rejects productionOrder missing an enabled component', () => {
    const result = workflowTemplateSchema.safeParse({
      ...validTemplate(),
      enabledComponents: ['video', 'study_material'],
      productionOrder: ['video'], // missing study_material
    })
    expect(result.success).toBe(false)
  })

  it('rejects productionOrder with extra component', () => {
    const result = workflowTemplateSchema.safeParse({
      ...validTemplate(),
      enabledComponents: ['video'],
      productionOrder: ['video', 'study_material'], // study_material not enabled
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown component types in enabledComponents', () => {
    const result = workflowTemplateSchema.safeParse({
      enabledComponents: ['totally_fake_component'],
      productionOrder: ['totally_fake_component'],
      levelDefaults: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message).join(', ')
      expect(messages).toContain('Unknown component type')
    }
  })

  it('rejects levelDefaults containing components not in enabledComponents', () => {
    const result = workflowTemplateSchema.safeParse({
      enabledComponents: ['video'],
      productionOrder: ['video'],
      levelDefaults: [
        { depth: 0, label: 'Course', enabledComponents: ['quiz'] }, // quiz not enabled
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message).join(', ')
      expect(messages).toContain('not in enabledComponents')
    }
  })

  it('accepts template with empty levelDefaults', () => {
    const result = workflowTemplateSchema.safeParse({
      enabledComponents: ['video'],
      productionOrder: ['video'],
      levelDefaults: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a minimal single-component template', () => {
    const result = workflowTemplateSchema.safeParse({
      enabledComponents: ['video'],
      productionOrder: ['video'],
      levelDefaults: [
        { depth: 2, label: 'Topic', enabledComponents: ['video'] },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts all 16 component types when valid', () => {
    const allTypes = [
      'video', 'video_short', 'study_material', 'practice_worksheet',
      'flashcards', 'quiz', 'pre_assessment', 'post_assessment',
      'activity', 'scenario_exercise', 'capstone_project',
      'discussion_prompt', 'glossary', 'resource_library',
      'certificate', 'mentor_checklist',
    ]
    const result = workflowTemplateSchema.safeParse({
      enabledComponents: allTypes,
      productionOrder: allTypes,
      levelDefaults: [],
    })
    expect(result.success).toBe(true)
  })
})
