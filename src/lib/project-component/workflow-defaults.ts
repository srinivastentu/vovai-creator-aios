/**
 * Workflow Defaults — generates default WorkflowTemplate from archetype + registry.
 *
 * The production order follows the pipeline phase dependency chain:
 * documents → assessments → videos → activities → capstone → meta
 */

import type { ArchetypeDefinition, ComponentDefinition, WorkflowTemplate } from './types'

// ─── Pipeline Phase Ordering ───────────────────────────────────────────────

/** Sort index for each pipeline type — lower runs first */
export const PIPELINE_PHASE_ORDER: Record<string, number> = {
  document: 0,
  assessment: 1,
  video: 2,
  activity: 3,
  capstone: 4,
  meta: 5,
}

// ─── Utilities ─────────────────────────────────────────────────────────────

/**
 * Sort component type IDs by their pipeline phase order.
 * Components with the same phase are kept in their original relative order.
 */
export function getRecommendedProductionOrder(
  componentTypes: string[],
  registry: Record<string, ComponentDefinition>,
): string[] {
  return [...componentTypes].sort((a, b) => {
    const defA = registry[a]
    const defB = registry[b]
    const orderA = defA ? (PIPELINE_PHASE_ORDER[defA.pipelineType] ?? 99) : 99
    const orderB = defB ? (PIPELINE_PHASE_ORDER[defB.pipelineType] ?? 99) : 99
    return orderA - orderB
  })
}

/**
 * Build a default WorkflowTemplate from an archetype definition.
 *
 * - enabledComponents = archetype's defaultComponents
 * - productionOrder = enabledComponents sorted by pipeline phase
 * - levelDefaults = for each depth, components whose attachableAt includes that depth
 */
export function buildDefaultWorkflowTemplate(
  archetype: ArchetypeDefinition,
  registry: Record<string, ComponentDefinition>,
): WorkflowTemplate {
  const enabled = archetype.defaultComponents

  const productionOrder = getRecommendedProductionOrder(enabled, registry)

  const levelDefaults = Array.from(
    { length: archetype.maxDepth + 1 },
    (_, depth) => ({
      depth,
      label: archetype.hierarchy[depth] ?? `Level ${depth}`,
      enabledComponents: enabled.filter(type => {
        const def = registry[type]
        return def ? def.attachableAt.includes(depth) : false
      }),
    }),
  )

  return { enabledComponents: enabled, productionOrder, levelDefaults }
}
