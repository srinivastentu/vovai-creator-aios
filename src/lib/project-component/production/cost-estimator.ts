/**
 * Cost Estimator — estimates production cost from blueprint components.
 *
 * Uses COMPONENT_REGISTRY.estimatedCost per type to produce min/max
 * estimates broken down by pipeline phase and component type.
 */

import { COMPONENT_REGISTRY } from '../component-registry'
import { PIPELINE_PHASE_ORDER } from '../workflow-defaults'
import type { ComponentDefinition } from '../types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CostRange {
  min: number
  max: number
  currency: 'USD'
}

export interface PhaseCostEstimate {
  phase: string
  phaseOrder: number
  componentCount: number
  cost: CostRange
}

export interface TypeCostEstimate {
  componentType: string
  name: string
  count: number
  costPerUnit: CostRange
  totalCost: CostRange
}

export interface CostEstimate {
  byPhase: PhaseCostEstimate[]
  byType: TypeCostEstimate[]
  total: CostRange
  totalComponents: number
}

// ─── Phase label mapping ────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  document: 'Documents',
  assessment: 'Assessments',
  video: 'Videos',
  activity: 'Activities',
  capstone: 'Capstone',
  meta: 'Meta',
}

// ─── Estimator ──────────────────────────────────────────────────────────────

/**
 * Estimate total production cost from a list of component types.
 *
 * @param componentTypes - flat array of component type IDs (one per attached component)
 */
export function estimateProjectCost(componentTypes: string[]): CostEstimate {
  // Count occurrences of each type
  const typeCounts = new Map<string, number>()
  for (const ct of componentTypes) {
    typeCounts.set(ct, (typeCounts.get(ct) ?? 0) + 1)
  }

  // Build per-type estimates
  const byType: TypeCostEstimate[] = []
  for (const [type, count] of typeCounts) {
    const def: ComponentDefinition | undefined = COMPONENT_REGISTRY[type]
    if (!def) continue
    byType.push({
      componentType: type,
      name: def.name,
      count,
      costPerUnit: { ...def.estimatedCost },
      totalCost: {
        min: def.estimatedCost.min * count,
        max: def.estimatedCost.max * count,
        currency: 'USD',
      },
    })
  }

  // Aggregate per phase
  const phaseMap = new Map<string, { count: number; min: number; max: number }>()
  for (const entry of byType) {
    const def = COMPONENT_REGISTRY[entry.componentType]
    if (!def) continue
    const phase = def.pipelineType
    const existing = phaseMap.get(phase) ?? { count: 0, min: 0, max: 0 }
    existing.count += entry.count
    existing.min += entry.totalCost.min
    existing.max += entry.totalCost.max
    phaseMap.set(phase, existing)
  }

  const byPhase: PhaseCostEstimate[] = [...phaseMap.entries()]
    .map(([phase, data]) => ({
      phase: PHASE_LABELS[phase] ?? phase,
      phaseOrder: PIPELINE_PHASE_ORDER[phase] ?? 99,
      componentCount: data.count,
      cost: { min: data.min, max: data.max, currency: 'USD' as const },
    }))
    .sort((a, b) => a.phaseOrder - b.phaseOrder)

  // Totals
  const totalMin = byType.reduce((sum, t) => sum + t.totalCost.min, 0)
  const totalMax = byType.reduce((sum, t) => sum + t.totalCost.max, 0)

  return {
    byPhase,
    byType,
    total: { min: totalMin, max: totalMax, currency: 'USD' },
    totalComponents: componentTypes.length,
  }
}
