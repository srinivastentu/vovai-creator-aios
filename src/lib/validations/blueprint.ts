import { z } from 'zod/v4'
import { COMPONENT_REGISTRY } from '@/lib/project-component'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function formatZodError(
  error: { issues: Array<{ path: PropertyKey[]; message: string }> }
): string {
  return error.issues
    .map(i => (i.path.length ? `${i.path.map(String).join('.')}: ${i.message}` : i.message))
    .join(', ')
}

// ─── Blueprint Schemas ────────────────────────────────────────────────────────

export const createBlueprintSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  archetype: z.enum(['k12_curriculum', 'professional_training', 'content_channel']).optional(),
  hierarchyLabels: z.record(z.string(), z.string()).optional(),
  targetAudience: z.record(z.string(), z.unknown()).optional(),
  enabledComponents: z.array(z.string()).optional(),
})

export type CreateBlueprintInput = z.infer<typeof createBlueprintSchema>

// ─── Workflow Template Schema ─────────────────────────────────────────────────

const levelComponentDefaultsSchema = z.object({
  depth: z.number().int().min(0),
  label: z.string().min(1),
  enabledComponents: z.array(z.string()),
})

export const workflowTemplateSchema = z.object({
  enabledComponents: z.array(z.string()),
  productionOrder: z.array(z.string()),
  levelDefaults: z.array(levelComponentDefaultsSchema),
}).superRefine((data, ctx) => {
  const enabledSet = new Set(data.enabledComponents)
  const orderSet = new Set(data.productionOrder)

  // productionOrder must be a permutation of enabledComponents
  if (enabledSet.size !== orderSet.size || ![...enabledSet].every(c => orderSet.has(c))) {
    ctx.addIssue({
      code: 'custom',
      message: 'productionOrder must contain exactly the same items as enabledComponents',
      path: ['productionOrder'],
    })
  }

  // All component types must exist in COMPONENT_REGISTRY
  for (const type of data.enabledComponents) {
    if (!COMPONENT_REGISTRY[type]) {
      ctx.addIssue({
        code: 'custom',
        message: `Unknown component type: "${type}"`,
        path: ['enabledComponents'],
      })
    }
  }

  // levelDefaults[].enabledComponents must be subsets of enabledComponents
  for (let i = 0; i < data.levelDefaults.length; i++) {
    for (const type of data.levelDefaults[i].enabledComponents) {
      if (!enabledSet.has(type)) {
        ctx.addIssue({
          code: 'custom',
          message: `Level ${data.levelDefaults[i].depth} contains "${type}" which is not in enabledComponents`,
          path: ['levelDefaults', i, 'enabledComponents'],
        })
      }
    }
  }
})

export const updateBlueprintSchema = z.object({
  archetype: z.enum(['k12_curriculum', 'professional_training', 'content_channel']).optional(),
  hierarchyLabels: z.record(z.string(), z.string()).optional(),
  targetAudience: z.record(z.string(), z.unknown()).optional(),
  enabledComponents: z.array(z.string()).optional(),
  learningOutcomes: z.array(z.unknown()).optional(),
  ideationPhase: z.enum(['brainstorm', 'structure', 'refinement', 'review', 'approved']).optional(),
  structureSummary: z.record(z.string(), z.unknown()).nullable().optional(),
  workflowTemplate: workflowTemplateSchema.nullable().optional(),
})

export type UpdateBlueprintInput = z.infer<typeof updateBlueprintSchema>

// ─── Node Schemas ─────────────────────────────────────────────────────────────

export const createNodeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  parentId: z.string().min(1).nullable().optional(),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export type CreateNodeInput = z.infer<typeof createNodeSchema>

const learningOutcomeSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(1000),
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']),
  measurable: z.boolean(),
  status: z.enum(['draft', 'validated', 'mapped']),
})

export const updateNodeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  learningOutcomes: z.array(learningOutcomeSchema).optional(),
  status: z.enum(['draft', 'ideating', 'structured', 'approved', 'in_production', 'completed']).optional(),
})

export type UpdateNodeInput = z.infer<typeof updateNodeSchema>

export const reorderNodesSchema = z.array(
  z.object({
    nodeId: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    sortOrder: z.number().int().min(0),
  })
)

export type ReorderNodesInput = z.infer<typeof reorderNodesSchema>

// ─── Component Schemas ────────────────────────────────────────────────────────

export const addComponentSchema = z.object({
  nodeId: z.string().min(1, 'nodeId is required'),
  componentType: z.enum([
    'video', 'video_short', 'study_material', 'practice_worksheet',
    'flashcards', 'quiz', 'pre_assessment', 'post_assessment',
    'activity', 'scenario_exercise', 'capstone_project',
    'discussion_prompt', 'glossary', 'resource_library',
    'certificate', 'mentor_checklist',
  ]),
  config: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(['core', 'recommended', 'optional']).optional(),
})

export type AddComponentInput = z.infer<typeof addComponentSchema>

// ─── Bulk Component Config Update ────────────────────────────────────────────

export const bulkUpdateComponentConfigSchema = z.object({
  updates: z.array(z.object({
    componentType: z.string().min(1),
    config: z.record(z.string(), z.unknown()),
    /** If true, update ALL components of this type in the blueprint */
    applyToAll: z.boolean().optional(),
    /** If provided, only update components on nodes at this depth */
    filterByDepth: z.number().int().min(0).optional(),
    /** If provided, only update this specific component ID */
    componentId: z.string().optional(),
  })).min(1, 'At least one update is required'),
})

export type BulkUpdateComponentConfigInput = z.infer<typeof bulkUpdateComponentConfigSchema>
