import { describe, it, expect } from 'vitest'
import { COMPONENT_REGISTRY } from '../../src/lib/domain/workflows/component-registry'
import { workflowTemplateSchema } from '../../src/lib/validations/blueprint'

// ─── Registry Guardrails ────────────────────────────────────────────────────

describe('COMPONENT_REGISTRY configurability', () => {
  it('every component has required: false', () => {
    for (const [id, def] of Object.entries(COMPONENT_REGISTRY)) {
      expect(def.required, `${id} should have required: false`).toBe(false)
    }
  })

  it('registry contains exactly 16 components', () => {
    expect(Object.keys(COMPONENT_REGISTRY)).toHaveLength(16)
  })
})

// ─── Schema Guardrails ──────────────────────────────────────────────────────

describe('workflowTemplateSchema allows full configurability', () => {
  it('accepts empty enabledComponents and productionOrder', () => {
    const result = workflowTemplateSchema.safeParse({
      enabledComponents: [],
      productionOrder: [],
      levelDefaults: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts levelDefaults with empty enabledComponents at every depth', () => {
    const result = workflowTemplateSchema.safeParse({
      enabledComponents: ['video'],
      productionOrder: ['video'],
      levelDefaults: [
        { depth: 0, label: 'Course', enabledComponents: [] },
        { depth: 1, label: 'Module', enabledComponents: [] },
        { depth: 2, label: 'Topic', enabledComponents: [] },
        { depth: 3, label: 'Subtopic', enabledComponents: [] },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a structure-only project with no components at any level', () => {
    const result = workflowTemplateSchema.safeParse({
      enabledComponents: [],
      productionOrder: [],
      levelDefaults: [
        { depth: 0, label: 'Course', enabledComponents: [] },
        { depth: 1, label: 'Module', enabledComponents: [] },
        { depth: 2, label: 'Topic', enabledComponents: [] },
      ],
    })
    expect(result.success).toBe(true)
  })
})
