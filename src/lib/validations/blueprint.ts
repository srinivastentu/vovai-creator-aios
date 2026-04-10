import { z } from 'zod/v4'
import { COMPONENT_REGISTRY } from '@/lib/domain/workflows'

// ─── Security Constants ──────────────────────────────────────────────────────

/** Maximum keys allowed in any JSON record field */
export const MAX_RECORD_KEYS = 50
/** Maximum items in enabledComponents array */
export const MAX_ENABLED_COMPONENTS = 20
/** Maximum learning outcomes per blueprint */
export const MAX_LEARNING_OUTCOMES = 200
/** Maximum nodes in a reorder batch */
export const MAX_REORDER_BATCH = 500
/** Maximum bulk component updates per request */
export const MAX_BULK_UPDATES = 100

// ─── Shared Enums ────────────────────────────────────────────────────────────

export const COMPONENT_TYPES = [
  'video', 'video_short', 'study_material', 'practice_worksheet',
  'flashcards', 'quiz', 'pre_assessment', 'post_assessment',
  'activity', 'scenario_exercise', 'capstone_project',
  'discussion_prompt', 'glossary', 'resource_library',
  'certificate', 'mentor_checklist',
] as const

export const ARCHETYPE_VALUES = ['k12_curriculum', 'professional_training', 'content_channel'] as const
export const IDEATION_PHASE_VALUES = ['brainstorm', 'structure', 'refinement', 'review', 'approved'] as const
export const NODE_STATUS_VALUES = ['draft', 'ideating', 'structured', 'approved', 'in_production', 'completed'] as const
export const PRIORITY_VALUES = ['core', 'recommended', 'optional'] as const

// ─── Bounded Record Helper ───────────────────────────────────────────────────

/** z.record() with a max-keys guard to prevent unbounded JSON payloads */
function boundedRecord<V extends z.ZodType>(
  valueSchema: V,
  maxKeys = MAX_RECORD_KEYS
) {
  return z.record(z.string().max(200), valueSchema).refine(
    (obj) => Object.keys(obj).length <= maxKeys,
    { message: `Record cannot have more than ${maxKeys} keys` }
  )
}

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
  projectId: z.string().min(1, 'projectId is required').max(100),
  archetype: z.enum(ARCHETYPE_VALUES).optional(),
  hierarchyLabels: boundedRecord(z.string().max(100), 10).optional(),
  targetAudience: boundedRecord(z.unknown(), MAX_RECORD_KEYS).optional(),
  enabledComponents: z.array(z.enum(COMPONENT_TYPES)).max(MAX_ENABLED_COMPONENTS).optional(),
})

export type CreateBlueprintInput = z.infer<typeof createBlueprintSchema>

// ─── Workflow Template Schema ─────────────────────────────────────────────────

const levelComponentDefaultsSchema = z.object({
  depth: z.number().int().min(0).max(10),
  label: z.string().min(1).max(100),
  enabledComponents: z.array(z.enum(COMPONENT_TYPES)).max(MAX_ENABLED_COMPONENTS),
})

export const workflowTemplateSchema = z.object({
  enabledComponents: z.array(z.enum(COMPONENT_TYPES)).max(MAX_ENABLED_COMPONENTS),
  productionOrder: z.array(z.enum(COMPONENT_TYPES)).max(MAX_ENABLED_COMPONENTS),
  levelDefaults: z.array(levelComponentDefaultsSchema).max(10),
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
  archetype: z.enum(ARCHETYPE_VALUES).optional(),
  hierarchyLabels: boundedRecord(z.string().max(100), 10).optional(),
  targetAudience: boundedRecord(z.unknown(), MAX_RECORD_KEYS).optional(),
  enabledComponents: z.array(z.enum(COMPONENT_TYPES)).max(MAX_ENABLED_COMPONENTS).optional(),
  learningOutcomes: z.array(z.unknown()).max(MAX_LEARNING_OUTCOMES).optional(),
  ideationPhase: z.enum(IDEATION_PHASE_VALUES).optional(),
  structureSummary: boundedRecord(z.unknown(), MAX_RECORD_KEYS).nullable().optional(),
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
  learningOutcomes: z.array(learningOutcomeSchema).max(MAX_LEARNING_OUTCOMES).optional(),
  status: z.enum(NODE_STATUS_VALUES).optional(),
})

export type UpdateNodeInput = z.infer<typeof updateNodeSchema>

export const reorderNodesSchema = z.array(
  z.object({
    nodeId: z.string().min(1).max(100),
    parentId: z.string().min(1).max(100).nullable(),
    sortOrder: z.number().int().min(0).max(10000),
  })
).max(MAX_REORDER_BATCH)

export type ReorderNodesInput = z.infer<typeof reorderNodesSchema>

// ─── Component Schemas ────────────────────────────────────────────────────────

export const addComponentSchema = z.object({
  nodeId: z.string().min(1, 'nodeId is required').max(100),
  componentType: z.enum(COMPONENT_TYPES),
  config: boundedRecord(z.unknown(), MAX_RECORD_KEYS).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
})

export type AddComponentInput = z.infer<typeof addComponentSchema>

// ─── Bulk Component Config Update ────────────────────────────────────────────

export const bulkUpdateComponentConfigSchema = z.object({
  updates: z.array(z.object({
    componentType: z.enum(COMPONENT_TYPES),
    config: boundedRecord(z.unknown(), MAX_RECORD_KEYS),
    /** If true, update ALL components of this type in the blueprint */
    applyToAll: z.boolean().optional(),
    /** If provided, only update components on nodes at this depth */
    filterByDepth: z.number().int().min(0).max(10).optional(),
    /** If provided, only update this specific component ID */
    componentId: z.string().max(100).optional(),
  })).min(1, 'At least one update is required').max(MAX_BULK_UPDATES),
})

export type BulkUpdateComponentConfigInput = z.infer<typeof bulkUpdateComponentConfigSchema>
