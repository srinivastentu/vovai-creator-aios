/**
 * Tree Utility Functions — Pure, No Side Effects
 *
 * Operate on arrays of ProjectNodeType. No database imports.
 * All functions are referentially transparent.
 */

import type { ProjectNodeType, AttachedComponentType } from '../types'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TreeStats {
  totalNodes: number
  maxDepth: number
  componentBreakdown: Record<string, number>
}

// ─── 1. buildTree ──────────────────────────────────────────────────────────

/**
 * Convert a flat array of nodes into a nested tree with children populated.
 * Children are sorted by sortOrder ascending.
 */
export function buildTree(flatNodes: ProjectNodeType[]): ProjectNodeType[] {
  const nodeMap = new Map<string, ProjectNodeType>()
  const roots: ProjectNodeType[] = []

  // Clone nodes with empty children arrays
  for (const node of flatNodes) {
    nodeMap.set(node.id, { ...node, children: [], components: [...node.components] })
  }

  // Wire parent → child relationships
  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      roots.push(node)
    } else {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(node)
      }
    }
  }

  // Sort children by sortOrder at every level
  const sortChildren = (nodes: ProjectNodeType[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder)
    for (const node of nodes) {
      sortChildren(node.children)
    }
  }
  sortChildren(roots)

  return roots
}

// ─── 2. flattenTree ────────────────────────────────────────────────────────

/**
 * Convert a nested tree back to a flat array. Children arrays are emptied.
 * Uses depth-first pre-order traversal.
 */
export function flattenTree(rootNodes: ProjectNodeType[]): ProjectNodeType[] {
  const result: ProjectNodeType[] = []

  const walk = (nodes: ProjectNodeType[]) => {
    for (const node of nodes) {
      const { children, ...rest } = node
      result.push({ ...rest, children: [], components: [...node.components] })
      walk(children)
    }
  }
  walk(rootNodes)

  return result
}

// ─── 3. findNode ───────────────────────────────────────────────────────────

/**
 * Recursive search for a node by ID in a nested tree. Returns node or null.
 */
export function findNode(tree: ProjectNodeType[], nodeId: string): ProjectNodeType | null {
  for (const node of tree) {
    if (node.id === nodeId) return node
    const found = findNode(node.children, nodeId)
    if (found) return found
  }
  return null
}

// ─── 4. getAncestors ──────────────────────────────────────────────────────

/**
 * Returns the ancestor chain from root → immediate parent.
 * Operates on a flat array (uses parentId traversal).
 */
export function getAncestors(flatNodes: ProjectNodeType[], nodeId: string): ProjectNodeType[] {
  const nodeMap = new Map<string, ProjectNodeType>()
  for (const node of flatNodes) {
    nodeMap.set(node.id, node)
  }

  const ancestors: ProjectNodeType[] = []
  let current = nodeMap.get(nodeId)
  if (!current) return ancestors

  while (current.parentId !== null) {
    const parent = nodeMap.get(current.parentId)
    if (!parent) break
    ancestors.unshift(parent)
    current = parent
  }

  return ancestors
}

// ─── 5. getDescendants ────────────────────────────────────────────────────

/**
 * Returns all descendants of a node recursively (from a nested tree).
 * Does NOT include the node itself.
 */
export function getDescendants(tree: ProjectNodeType[], nodeId: string): ProjectNodeType[] {
  const target = findNode(tree, nodeId)
  if (!target) return []

  const result: ProjectNodeType[] = []
  const collect = (nodes: ProjectNodeType[]) => {
    for (const node of nodes) {
      result.push(node)
      collect(node.children)
    }
  }
  collect(target.children)

  return result
}

// ─── 6. getSiblings ───────────────────────────────────────────────────────

/**
 * Returns nodes sharing the same parent. Excludes the node itself.
 * Operates on a flat array.
 */
export function getSiblings(flatNodes: ProjectNodeType[], nodeId: string): ProjectNodeType[] {
  const node = flatNodes.find(n => n.id === nodeId)
  if (!node) return []

  return flatNodes.filter(n => n.parentId === node.parentId && n.id !== nodeId)
}

// ─── 7. addNode ────────────────────────────────────────────────────────────

/**
 * Adds a new node under parentId. Auto-calculates depth, sortOrder, and path.
 * Returns a new flat array (does not mutate input).
 */
export function addNode(
  flatNodes: ProjectNodeType[],
  newNode: ProjectNodeType,
  parentId: string | null
): ProjectNodeType[] {
  const parent = parentId ? flatNodes.find(n => n.id === parentId) : null
  if (parentId && !parent) {
    throw new Error(`Parent node "${parentId}" not found`)
  }

  const siblings = flatNodes.filter(n => n.parentId === parentId)
  const maxSortOrder = siblings.length > 0
    ? Math.max(...siblings.map(s => s.sortOrder))
    : -1

  const depth = parent ? parent.depth + 1 : 0
  const path = parent
    ? `${parent.path}/${newNode.slug}`
    : `/${newNode.slug}`

  const nodeToAdd: ProjectNodeType = {
    ...newNode,
    parentId,
    depth,
    sortOrder: maxSortOrder + 1,
    path,
    children: [],
  }

  return [...flatNodes, nodeToAdd]
}

// ─── 8. removeNode ─────────────────────────────────────────────────────────

/**
 * Removes a node and all its descendants. Returns a new flat array.
 */
export function removeNode(flatNodes: ProjectNodeType[], nodeId: string): ProjectNodeType[] {
  const idsToRemove = new Set<string>()

  const collectDescendants = (id: string) => {
    idsToRemove.add(id)
    for (const node of flatNodes) {
      if (node.parentId === id) {
        collectDescendants(node.id)
      }
    }
  }
  collectDescendants(nodeId)

  return flatNodes.filter(n => !idsToRemove.has(n.id))
}

// ─── 9. moveNode ───────────────────────────────────────────────────────────

/**
 * Moves a node to a new parent with a new sortOrder.
 * Recalculates paths for the moved node and all its descendants.
 * Returns a new flat array.
 */
export function moveNode(
  flatNodes: ProjectNodeType[],
  nodeId: string,
  newParentId: string | null,
  newSortOrder: number
): ProjectNodeType[] {
  const node = flatNodes.find(n => n.id === nodeId)
  if (!node) throw new Error(`Node "${nodeId}" not found`)

  const newParent = newParentId ? flatNodes.find(n => n.id === newParentId) : null
  if (newParentId && !newParent) {
    throw new Error(`Parent node "${newParentId}" not found`)
  }

  const newDepth = newParent ? newParent.depth + 1 : 0
  const newPath = newParent
    ? `${newParent.path}/${node.slug}`
    : `/${node.slug}`

  // Build updated flat array with the moved node's new parent/depth/path/sortOrder
  let result = flatNodes.map(n => {
    if (n.id === nodeId) {
      return { ...n, parentId: newParentId, depth: newDepth, path: newPath, sortOrder: newSortOrder }
    }
    return { ...n }
  })

  // Recalculate paths for all descendants of the moved node
  result = updateDescendantPaths(result, nodeId)

  return result
}

/**
 * Recalculates paths for all descendants of a given node.
 */
function updateDescendantPaths(flatNodes: ProjectNodeType[], parentId: string): ProjectNodeType[] {
  const nodeMap = new Map<string, ProjectNodeType>()
  for (const node of flatNodes) {
    nodeMap.set(node.id, node)
  }

  const recalc = (id: string) => {
    const parent = nodeMap.get(id)
    if (!parent) return
    for (const node of nodeMap.values()) {
      if (node.parentId === id) {
        node.path = `${parent.path}/${node.slug}`
        node.depth = parent.depth + 1
        recalc(node.id)
      }
    }
  }
  recalc(parentId)

  return Array.from(nodeMap.values())
}

// ─── 10. updatePaths ───────────────────────────────────────────────────────

/**
 * Recalculates ALL materialized paths from scratch.
 * Builds from root nodes down. Returns a new flat array.
 */
export function updatePaths(flatNodes: ProjectNodeType[]): ProjectNodeType[] {
  const nodeMap = new Map<string, ProjectNodeType>()
  for (const node of flatNodes) {
    nodeMap.set(node.id, { ...node })
  }

  // Process roots first, then children
  const processed = new Set<string>()

  const recalc = (id: string, parentPath: string, depth: number) => {
    const node = nodeMap.get(id)
    if (!node) return
    node.path = `${parentPath}/${node.slug}`
    node.depth = depth
    processed.add(id)

    // Find children and process them
    for (const child of nodeMap.values()) {
      if (child.parentId === id) {
        recalc(child.id, node.path, depth + 1)
      }
    }
  }

  // Start from root nodes
  for (const node of nodeMap.values()) {
    if (node.parentId === null && !processed.has(node.id)) {
      recalc(node.id, '', 0)
    }
  }

  return Array.from(nodeMap.values())
}

// ─── 11. getTreeStats ──────────────────────────────────────────────────────

/**
 * Computes statistics from a nested tree: totalNodes, maxDepth, componentBreakdown.
 */
export function getTreeStats(tree: ProjectNodeType[]): TreeStats {
  let totalNodes = 0
  let maxDepth = 0
  const componentBreakdown: Record<string, number> = {}

  const walk = (nodes: ProjectNodeType[]) => {
    for (const node of nodes) {
      totalNodes++
      if (node.depth > maxDepth) maxDepth = node.depth
      for (const comp of node.components) {
        componentBreakdown[comp.componentType] = (componentBreakdown[comp.componentType] ?? 0) + 1
      }
      walk(node.children)
    }
  }
  walk(tree)

  return { totalNodes, maxDepth, componentBreakdown }
}
