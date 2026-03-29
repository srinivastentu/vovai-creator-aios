/**
 * Tree Serializer — snapshot and restore blueprint state.
 *
 * Converts a blueprint + nodes + components into a JSON-serializable
 * snapshot and back. Used for BlueprintVersion storage.
 *
 * Pure functions. No database imports.
 */

import type {
  ProjectBlueprintType,
  ProjectNodeType,
  AttachedComponentType,
} from '../types'

// ─── Snapshot Types ────────────────────────────────────────────────────────

export interface BlueprintSnapshot {
  version: number
  createdAt: string
  blueprint: SerializedBlueprint
  nodes: SerializedNode[]
  components: SerializedComponent[]
}

export interface SerializedBlueprint {
  id: string
  projectId: string
  archetype: string
  hierarchyLabels: Record<string, string>
  targetAudience: Record<string, unknown>
  learningOutcomes: unknown[]
  enabledComponents: string[]
  ideationPhase: string
  ideationScore: number | null
  structureSummary: Record<string, unknown> | null
}

export interface SerializedNode {
  id: string
  blueprintId: string
  parentId: string | null
  title: string
  slug: string
  description: string | null
  notes: string | null
  depth: number
  sortOrder: number
  learningOutcomes: unknown[]
  status: string
  agentConfidence: number | null
  path: string
}

export interface SerializedComponent {
  id: string
  nodeId: string
  componentType: string
  config: Record<string, unknown>
  priority: string
  status: string
  relevanceScore: number | null
  pipelineJobId: string | null
}

// ─── Serialize ─────────────────────────────────────────────────────────────

/**
 * Serialize a blueprint with its nodes and components into a JSON snapshot.
 * Strips Date objects and children arrays — only stores flat, portable data.
 */
export function serializeBlueprint(
  blueprint: ProjectBlueprintType,
  nodes: ProjectNodeType[],
  components: AttachedComponentType[]
): BlueprintSnapshot {
  return {
    version: 0, // caller sets the actual version number
    createdAt: new Date().toISOString(),
    blueprint: {
      id: blueprint.id,
      projectId: blueprint.projectId,
      archetype: blueprint.archetype,
      hierarchyLabels: blueprint.hierarchyLabels,
      targetAudience: blueprint.targetAudience as unknown as Record<string, unknown>,
      learningOutcomes: blueprint.learningOutcomes,
      enabledComponents: blueprint.enabledComponents,
      ideationPhase: blueprint.ideationPhase,
      ideationScore: blueprint.ideationScore,
      structureSummary: blueprint.structureSummary,
    },
    nodes: nodes.map(n => ({
      id: n.id,
      blueprintId: n.blueprintId,
      parentId: n.parentId,
      title: n.title,
      slug: n.slug,
      description: n.description,
      notes: n.notes,
      depth: n.depth,
      sortOrder: n.sortOrder,
      learningOutcomes: n.learningOutcomes,
      status: n.status,
      agentConfidence: n.agentConfidence,
      path: n.path,
    })),
    components: components.map(c => ({
      id: c.id,
      nodeId: c.nodeId,
      componentType: c.componentType,
      config: c.config,
      priority: c.priority,
      status: c.status,
      relevanceScore: c.relevanceScore,
      pipelineJobId: c.pipelineJobId,
    })),
  }
}

// ─── Deserialize ───────────────────────────────────────────────────────────

/**
 * Deserialize a snapshot back into typed blueprint, nodes, and components.
 * Restores Date objects and empty children arrays for tree compatibility.
 */
export function deserializeBlueprint(snapshot: BlueprintSnapshot): {
  blueprint: ProjectBlueprintType
  nodes: ProjectNodeType[]
  components: AttachedComponentType[]
} {
  const now = new Date()
  const snapshotDate = new Date(snapshot.createdAt)

  const components: AttachedComponentType[] = snapshot.components.map(c => ({
    id: c.id,
    nodeId: c.nodeId,
    componentType: c.componentType,
    config: c.config,
    priority: c.priority as AttachedComponentType['priority'],
    status: c.status as AttachedComponentType['status'],
    relevanceScore: c.relevanceScore,
    pipelineJobId: c.pipelineJobId,
    createdAt: snapshotDate,
    updatedAt: now,
  }))

  // Group components by nodeId for attaching to nodes
  const componentsByNode = new Map<string, AttachedComponentType[]>()
  for (const comp of components) {
    const existing = componentsByNode.get(comp.nodeId) ?? []
    existing.push(comp)
    componentsByNode.set(comp.nodeId, existing)
  }

  const nodes: ProjectNodeType[] = snapshot.nodes.map(n => ({
    id: n.id,
    blueprintId: n.blueprintId,
    parentId: n.parentId,
    title: n.title,
    slug: n.slug,
    description: n.description,
    notes: n.notes,
    depth: n.depth,
    sortOrder: n.sortOrder,
    learningOutcomes: n.learningOutcomes as ProjectNodeType['learningOutcomes'],
    status: n.status as ProjectNodeType['status'],
    agentConfidence: n.agentConfidence,
    path: n.path,
    createdAt: snapshotDate,
    updatedAt: now,
    children: [],
    components: componentsByNode.get(n.id) ?? [],
  }))

  const bp = snapshot.blueprint
  const blueprint: ProjectBlueprintType = {
    id: bp.id,
    projectId: bp.projectId,
    archetype: bp.archetype as ProjectBlueprintType['archetype'],
    hierarchyLabels: bp.hierarchyLabels,
    targetAudience: bp.targetAudience as unknown as ProjectBlueprintType['targetAudience'],
    learningOutcomes: bp.learningOutcomes as ProjectBlueprintType['learningOutcomes'],
    enabledComponents: bp.enabledComponents,
    ideationPhase: bp.ideationPhase as ProjectBlueprintType['ideationPhase'],
    ideationScore: bp.ideationScore,
    structureSummary: bp.structureSummary,
    createdAt: snapshotDate,
    updatedAt: now,
    nodes,
  }

  return { blueprint, nodes, components }
}
