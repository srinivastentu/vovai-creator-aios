/**
 * Tree Validator — validates blueprint tree integrity.
 *
 * Pure functions. No database imports. Operates on typed arrays.
 * Returns structured errors with codes for programmatic handling.
 */

import type { ProjectNodeType, AttachedComponentType, ProjectArchetype } from '../types'
import { COMPONENT_REGISTRY } from '../component-registry'
import { getArchetype } from '../archetypes'

// ─── Types ─────────────────────────────────────────────────────────────────

export type ValidationErrorCode =
  | 'ORPHAN_NODE'
  | 'CIRCULAR_REFERENCE'
  | 'DEPTH_EXCEEDED'
  | 'INVALID_COMPONENT_LEVEL'
  | 'MISSING_DEPENDENCY'
  | 'DUPLICATE_PATH'
  | 'PATH_MISMATCH'

export interface ValidationError {
  code: ValidationErrorCode
  nodeId?: string
  componentId?: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// ─── Individual Checks ─────────────────────────────────────────────────────

/**
 * 1. No orphan nodes — every parentId must reference an existing node or be null.
 */
function checkOrphanNodes(nodes: ProjectNodeType[]): ValidationError[] {
  const nodeIds = new Set(nodes.map(n => n.id))
  const errors: ValidationError[] = []

  for (const node of nodes) {
    if (node.parentId !== null && !nodeIds.has(node.parentId)) {
      errors.push({
        code: 'ORPHAN_NODE',
        nodeId: node.id,
        message: `Node "${node.title}" references non-existent parent "${node.parentId}"`,
      })
    }
  }

  return errors
}

/**
 * 2. No circular parent references — following parentId chain must always reach null.
 */
function checkCircularReferences(nodes: ProjectNodeType[]): ValidationError[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const errors: ValidationError[] = []

  for (const node of nodes) {
    const visited = new Set<string>()
    let current: ProjectNodeType | undefined = node

    while (current && current.parentId !== null) {
      if (visited.has(current.id)) {
        errors.push({
          code: 'CIRCULAR_REFERENCE',
          nodeId: node.id,
          message: `Circular parent reference detected involving node "${node.title}"`,
        })
        break
      }
      visited.add(current.id)
      current = nodeMap.get(current.parentId)
    }
  }

  return errors
}

/**
 * 3. Depth doesn't exceed archetype maxDepth.
 */
function checkMaxDepth(nodes: ProjectNodeType[], archetype: ProjectArchetype): ValidationError[] {
  const { maxDepth } = getArchetype(archetype)
  const errors: ValidationError[] = []

  for (const node of nodes) {
    if (node.depth > maxDepth) {
      errors.push({
        code: 'DEPTH_EXCEEDED',
        nodeId: node.id,
        message: `Node "${node.title}" at depth ${node.depth} exceeds max depth ${maxDepth} for archetype "${archetype}"`,
      })
    }
  }

  return errors
}

/**
 * 4. Components are valid for their node's depth (check registry attachableAt).
 */
function checkComponentLevels(
  nodes: ProjectNodeType[],
  components: AttachedComponentType[]
): ValidationError[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const errors: ValidationError[] = []

  for (const comp of components) {
    const node = nodeMap.get(comp.nodeId)
    if (!node) continue // orphan component — not this check's concern

    const def = COMPONENT_REGISTRY[comp.componentType]
    if (!def) {
      errors.push({
        code: 'INVALID_COMPONENT_LEVEL',
        nodeId: node.id,
        componentId: comp.id,
        message: `Unknown component type "${comp.componentType}" on node "${node.title}"`,
      })
      continue
    }

    if (!def.attachableAt.includes(node.depth)) {
      errors.push({
        code: 'INVALID_COMPONENT_LEVEL',
        nodeId: node.id,
        componentId: comp.id,
        message: `Component "${def.name}" cannot attach at depth ${node.depth} (allowed: ${def.attachableAt.join(', ')}) on node "${node.title}"`,
      })
    }
  }

  return errors
}

/**
 * 5. Component dependencies are met — e.g. post_assessment needs quiz on same node.
 */
function checkComponentDependencies(
  nodes: ProjectNodeType[],
  components: AttachedComponentType[]
): ValidationError[] {
  const errors: ValidationError[] = []

  // Group components by nodeId
  const componentsByNode = new Map<string, AttachedComponentType[]>()
  for (const comp of components) {
    const existing = componentsByNode.get(comp.nodeId) ?? []
    existing.push(comp)
    componentsByNode.set(comp.nodeId, existing)
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  for (const comp of components) {
    const def = COMPONENT_REGISTRY[comp.componentType]
    if (!def || def.dependsOn.length === 0) continue

    const nodeComps = componentsByNode.get(comp.nodeId) ?? []
    const nodeCompTypes = new Set(nodeComps.map(c => c.componentType))
    const node = nodeMap.get(comp.nodeId)
    const nodeTitle = node?.title ?? comp.nodeId

    for (const dep of def.dependsOn) {
      if (!nodeCompTypes.has(dep)) {
        errors.push({
          code: 'MISSING_DEPENDENCY',
          nodeId: comp.nodeId,
          componentId: comp.id,
          message: `Component "${def.name}" on node "${nodeTitle}" requires "${dep}" which is not attached to the same node`,
        })
      }
    }
  }

  return errors
}

/**
 * 6. No duplicate paths within the same blueprint.
 */
function checkDuplicatePaths(nodes: ProjectNodeType[]): ValidationError[] {
  const pathMap = new Map<string, ProjectNodeType[]>()
  const errors: ValidationError[] = []

  for (const node of nodes) {
    const existing = pathMap.get(node.path) ?? []
    existing.push(node)
    pathMap.set(node.path, existing)
  }

  for (const [path, dupes] of pathMap) {
    if (dupes.length > 1) {
      errors.push({
        code: 'DUPLICATE_PATH',
        nodeId: dupes[1].id,
        message: `Duplicate path "${path}" shared by nodes: ${dupes.map(n => `"${n.title}"`).join(', ')}`,
      })
    }
  }

  return errors
}

/**
 * 7. Materialized paths match actual parent chain.
 * Skips nodes involved in circular references (caught by check 2).
 */
function checkPathConsistency(nodes: ProjectNodeType[]): ValidationError[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const errors: ValidationError[] = []

  for (const node of nodes) {
    // Build expected path by walking up the parent chain
    const slugChain: string[] = []
    const visited = new Set<string>()
    let current: ProjectNodeType | undefined = node
    let hasCycle = false

    while (current) {
      if (visited.has(current.id)) {
        hasCycle = true
        break
      }
      visited.add(current.id)
      slugChain.unshift(current.slug)
      current = current.parentId ? nodeMap.get(current.parentId) : undefined
    }

    // Skip path check for nodes in circular chains — already caught by check 2
    if (hasCycle) continue

    const expectedPath = '/' + slugChain.join('/')

    if (node.path !== expectedPath) {
      errors.push({
        code: 'PATH_MISMATCH',
        nodeId: node.id,
        message: `Node "${node.title}" has path "${node.path}" but expected "${expectedPath}" based on parent chain`,
      })
    }
  }

  return errors
}

// ─── Main Validator ────────────────────────────────────────────────────────

/**
 * Validates a blueprint's tree structure for integrity.
 *
 * Runs all 7 checks and returns a combined result. Checks are independent
 * — all run even if earlier ones find errors, so you get a complete picture.
 */
export function validateTree(
  archetype: ProjectArchetype,
  nodes: ProjectNodeType[],
  components: AttachedComponentType[]
): ValidationResult {
  const errors: ValidationError[] = [
    ...checkOrphanNodes(nodes),
    ...checkCircularReferences(nodes),
    ...checkMaxDepth(nodes, archetype),
    ...checkComponentLevels(nodes, components),
    ...checkComponentDependencies(nodes, components),
    ...checkDuplicatePaths(nodes),
    ...checkPathConsistency(nodes),
  ]

  return { valid: errors.length === 0, errors }
}
