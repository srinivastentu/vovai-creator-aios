import { describe, it, expect } from 'vitest'
import {
  buildTree,
  flattenTree,
  findNode,
  getAncestors,
  getDescendants,
  getSiblings,
  addNode,
  removeNode,
  moveNode,
  updatePaths,
  getTreeStats,
} from '../../src/lib/project-component/tree/tree-utils'
import type { ProjectNodeType, AttachedComponentType } from '../../src/lib/project-component/types'

// ─── Test Helpers ──────────────────────────────────────────────────────────

const now = new Date('2026-03-29T00:00:00Z')

function makeComponent(overrides: Partial<AttachedComponentType> = {}): AttachedComponentType {
  return {
    id: `comp-${Math.random().toString(36).slice(2, 8)}`,
    nodeId: '',
    componentType: 'video',
    config: {},
    priority: 'core',
    status: 'planned',
    relevanceScore: null,
    pipelineJobId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeNode(overrides: Partial<ProjectNodeType> = {}): ProjectNodeType {
  return {
    id: `node-${Math.random().toString(36).slice(2, 8)}`,
    blueprintId: 'bp-1',
    parentId: null,
    title: 'Untitled',
    slug: 'untitled',
    description: null,
    notes: null,
    depth: 0,
    sortOrder: 0,
    learningOutcomes: [],
    status: 'draft',
    agentConfidence: null,
    path: '/untitled',
    createdAt: now,
    updatedAt: now,
    children: [],
    components: [],
    ...overrides,
  }
}

// ─── Sample Tree ───────────────────────────────────────────────────────────
// 3 modules, 2 topics each, 4 subtopics (2 under m1-t1, 1 under m2-t1, 1 under m3-t2)

const m1 = makeNode({ id: 'm1', title: 'Module 1', slug: 'module-1', depth: 0, sortOrder: 0, path: '/module-1', components: [makeComponent({ nodeId: 'm1', componentType: 'study_material' })] })
const m2 = makeNode({ id: 'm2', title: 'Module 2', slug: 'module-2', depth: 0, sortOrder: 1, path: '/module-2' })
const m3 = makeNode({ id: 'm3', title: 'Module 3', slug: 'module-3', depth: 0, sortOrder: 2, path: '/module-3' })

const m1t1 = makeNode({ id: 'm1-t1', parentId: 'm1', title: 'M1 Topic 1', slug: 'topic-1', depth: 1, sortOrder: 0, path: '/module-1/topic-1', components: [makeComponent({ nodeId: 'm1-t1', componentType: 'video' }), makeComponent({ nodeId: 'm1-t1', componentType: 'quiz' })] })
const m1t2 = makeNode({ id: 'm1-t2', parentId: 'm1', title: 'M1 Topic 2', slug: 'topic-2', depth: 1, sortOrder: 1, path: '/module-1/topic-2', components: [makeComponent({ nodeId: 'm1-t2', componentType: 'video' })] })
const m2t1 = makeNode({ id: 'm2-t1', parentId: 'm2', title: 'M2 Topic 1', slug: 'topic-1', depth: 1, sortOrder: 0, path: '/module-2/topic-1', components: [makeComponent({ nodeId: 'm2-t1', componentType: 'video' })] })
const m2t2 = makeNode({ id: 'm2-t2', parentId: 'm2', title: 'M2 Topic 2', slug: 'topic-2', depth: 1, sortOrder: 1, path: '/module-2/topic-2' })
const m3t1 = makeNode({ id: 'm3-t1', parentId: 'm3', title: 'M3 Topic 1', slug: 'topic-1', depth: 1, sortOrder: 0, path: '/module-3/topic-1' })
const m3t2 = makeNode({ id: 'm3-t2', parentId: 'm3', title: 'M3 Topic 2', slug: 'topic-2', depth: 1, sortOrder: 1, path: '/module-3/topic-2' })

const m1t1s1 = makeNode({ id: 'm1-t1-s1', parentId: 'm1-t1', title: 'M1T1 Sub 1', slug: 'sub-1', depth: 2, sortOrder: 0, path: '/module-1/topic-1/sub-1' })
const m1t1s2 = makeNode({ id: 'm1-t1-s2', parentId: 'm1-t1', title: 'M1T1 Sub 2', slug: 'sub-2', depth: 2, sortOrder: 1, path: '/module-1/topic-1/sub-2' })
const m2t1s1 = makeNode({ id: 'm2-t1-s1', parentId: 'm2-t1', title: 'M2T1 Sub 1', slug: 'sub-1', depth: 2, sortOrder: 0, path: '/module-2/topic-1/sub-1' })
const m3t2s1 = makeNode({ id: 'm3-t2-s1', parentId: 'm3-t2', title: 'M3T2 Sub 1', slug: 'sub-1', depth: 2, sortOrder: 0, path: '/module-3/topic-2/sub-1' })

const flatSample: ProjectNodeType[] = [
  m1, m2, m3,
  m1t1, m1t2, m2t1, m2t2, m3t1, m3t2,
  m1t1s1, m1t1s2, m2t1s1, m3t2s1,
]

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('buildTree', () => {
  it('builds 3 root nodes from flat array', () => {
    const tree = buildTree(flatSample)
    expect(tree).toHaveLength(3)
    expect(tree.map(n => n.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('populates children at each level', () => {
    const tree = buildTree(flatSample)
    const mod1 = tree[0]
    expect(mod1.children).toHaveLength(2)
    expect(mod1.children[0].id).toBe('m1-t1')
    expect(mod1.children[0].children).toHaveLength(2)
    expect(mod1.children[0].children.map(n => n.id)).toEqual(['m1-t1-s1', 'm1-t1-s2'])
  })

  it('sorts children by sortOrder ascending', () => {
    const reversed = [...flatSample].reverse()
    const tree = buildTree(reversed)
    expect(tree.map(n => n.id)).toEqual(['m1', 'm2', 'm3'])
    expect(tree[0].children.map(n => n.id)).toEqual(['m1-t1', 'm1-t2'])
  })

  it('preserves components on nodes', () => {
    const tree = buildTree(flatSample)
    expect(tree[0].components).toHaveLength(1)
    expect(tree[0].components[0].componentType).toBe('study_material')
    expect(tree[0].children[0].components).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(buildTree([])).toEqual([])
  })
})

describe('flattenTree', () => {
  it('flattens nested tree to flat array', () => {
    const tree = buildTree(flatSample)
    const flat = flattenTree(tree)
    expect(flat).toHaveLength(13)
  })

  it('uses depth-first pre-order traversal', () => {
    const tree = buildTree(flatSample)
    const flat = flattenTree(tree)
    expect(flat.map(n => n.id)).toEqual([
      'm1', 'm1-t1', 'm1-t1-s1', 'm1-t1-s2', 'm1-t2',
      'm2', 'm2-t1', 'm2-t1-s1', 'm2-t2',
      'm3', 'm3-t1', 'm3-t2', 'm3-t2-s1',
    ])
  })

  it('clears children arrays on flattened nodes', () => {
    const tree = buildTree(flatSample)
    const flat = flattenTree(tree)
    for (const node of flat) {
      expect(node.children).toEqual([])
    }
  })
})

describe('buildTree ↔ flattenTree round-trip', () => {
  it('preserves node count', () => {
    const tree = buildTree(flatSample)
    const flat = flattenTree(tree)
    expect(flat).toHaveLength(flatSample.length)
  })

  it('preserves all node IDs', () => {
    const tree = buildTree(flatSample)
    const flat = flattenTree(tree)
    const originalIds = new Set(flatSample.map(n => n.id))
    const roundTripIds = new Set(flat.map(n => n.id))
    expect(roundTripIds).toEqual(originalIds)
  })

  it('preserves parentId relationships', () => {
    const tree = buildTree(flatSample)
    const flat = flattenTree(tree)
    const flatMap = new Map(flat.map(n => [n.id, n]))
    for (const original of flatSample) {
      expect(flatMap.get(original.id)?.parentId).toBe(original.parentId)
    }
  })

  it('double round-trip produces same result', () => {
    const tree1 = buildTree(flatSample)
    const flat1 = flattenTree(tree1)
    const tree2 = buildTree(flat1)
    const flat2 = flattenTree(tree2)
    expect(flat2.map(n => n.id)).toEqual(flat1.map(n => n.id))
  })
})

describe('findNode', () => {
  it('finds root node', () => {
    const tree = buildTree(flatSample)
    expect(findNode(tree, 'm2')?.title).toBe('Module 2')
  })

  it('finds deeply nested node', () => {
    const tree = buildTree(flatSample)
    expect(findNode(tree, 'm1-t1-s2')?.title).toBe('M1T1 Sub 2')
  })

  it('returns null for missing node', () => {
    const tree = buildTree(flatSample)
    expect(findNode(tree, 'nonexistent')).toBeNull()
  })

  it('returns null for empty tree', () => {
    expect(findNode([], 'm1')).toBeNull()
  })
})

describe('getAncestors', () => {
  it('returns root → parent chain for deeply nested node', () => {
    const ancestors = getAncestors(flatSample, 'm1-t1-s1')
    expect(ancestors.map(n => n.id)).toEqual(['m1', 'm1-t1'])
  })

  it('returns single parent for topic-level node', () => {
    const ancestors = getAncestors(flatSample, 'm2-t1')
    expect(ancestors.map(n => n.id)).toEqual(['m2'])
  })

  it('returns empty array for root node', () => {
    expect(getAncestors(flatSample, 'm1')).toEqual([])
  })

  it('returns empty array for missing node', () => {
    expect(getAncestors(flatSample, 'nonexistent')).toEqual([])
  })
})

describe('getDescendants', () => {
  it('returns all descendants of a module', () => {
    const tree = buildTree(flatSample)
    const desc = getDescendants(tree, 'm1')
    expect(desc.map(n => n.id)).toEqual(['m1-t1', 'm1-t1-s1', 'm1-t1-s2', 'm1-t2'])
  })

  it('returns direct subtopics for a topic', () => {
    const tree = buildTree(flatSample)
    const desc = getDescendants(tree, 'm1-t1')
    expect(desc.map(n => n.id)).toEqual(['m1-t1-s1', 'm1-t1-s2'])
  })

  it('returns empty for leaf node', () => {
    const tree = buildTree(flatSample)
    expect(getDescendants(tree, 'm1-t1-s1')).toEqual([])
  })

  it('returns empty for missing node', () => {
    const tree = buildTree(flatSample)
    expect(getDescendants(tree, 'nonexistent')).toEqual([])
  })
})

describe('getSiblings', () => {
  it('returns sibling modules (excludes self)', () => {
    const siblings = getSiblings(flatSample, 'm1')
    expect(siblings.map(n => n.id)).toEqual(['m2', 'm3'])
  })

  it('returns sibling topics within same module', () => {
    const siblings = getSiblings(flatSample, 'm1-t1')
    expect(siblings.map(n => n.id)).toEqual(['m1-t2'])
  })

  it('returns empty for only child', () => {
    const siblings = getSiblings(flatSample, 'm2-t1-s1')
    expect(siblings).toEqual([])
  })

  it('returns empty for missing node', () => {
    expect(getSiblings(flatSample, 'nonexistent')).toEqual([])
  })
})

describe('addNode', () => {
  it('adds a node under a parent with auto depth and sortOrder', () => {
    const newNode = makeNode({ id: 'new-topic', title: 'New Topic', slug: 'new-topic' })
    const result = addNode(flatSample, newNode, 'm1')
    const added = result.find(n => n.id === 'new-topic')!
    expect(added.parentId).toBe('m1')
    expect(added.depth).toBe(1)
    expect(added.sortOrder).toBe(2) // m1 has 2 topics at sortOrder 0,1
    expect(added.path).toBe('/module-1/new-topic')
  })

  it('adds a root node with null parent', () => {
    const newNode = makeNode({ id: 'new-mod', title: 'Module 4', slug: 'module-4' })
    const result = addNode(flatSample, newNode, null)
    const added = result.find(n => n.id === 'new-mod')!
    expect(added.parentId).toBeNull()
    expect(added.depth).toBe(0)
    expect(added.sortOrder).toBe(3) // 3 existing root modules
    expect(added.path).toBe('/module-4')
  })

  it('does not mutate original array', () => {
    const originalLength = flatSample.length
    const newNode = makeNode({ id: 'tmp', slug: 'tmp' })
    addNode(flatSample, newNode, 'm1')
    expect(flatSample).toHaveLength(originalLength)
  })

  it('throws for missing parent', () => {
    const newNode = makeNode({ id: 'orphan', slug: 'orphan' })
    expect(() => addNode(flatSample, newNode, 'nonexistent')).toThrow('Parent node "nonexistent" not found')
  })
})

describe('removeNode', () => {
  it('removes a leaf node', () => {
    const result = removeNode(flatSample, 'm1-t1-s1')
    expect(result).toHaveLength(12)
    expect(result.find(n => n.id === 'm1-t1-s1')).toBeUndefined()
  })

  it('removes a node and all descendants (cascade)', () => {
    const result = removeNode(flatSample, 'm1')
    expect(result).toHaveLength(8) // removed m1, m1-t1, m1-t2, m1-t1-s1, m1-t1-s2
    const removedIds = ['m1', 'm1-t1', 'm1-t2', 'm1-t1-s1', 'm1-t1-s2']
    for (const id of removedIds) {
      expect(result.find(n => n.id === id)).toBeUndefined()
    }
  })

  it('preserves unrelated nodes', () => {
    const result = removeNode(flatSample, 'm1')
    expect(result.find(n => n.id === 'm2')).toBeDefined()
    expect(result.find(n => n.id === 'm3-t2-s1')).toBeDefined()
  })

  it('does not mutate original array', () => {
    const originalLength = flatSample.length
    removeNode(flatSample, 'm1')
    expect(flatSample).toHaveLength(originalLength)
  })

  it('returns full array when removing nonexistent node', () => {
    const result = removeNode(flatSample, 'nonexistent')
    expect(result).toHaveLength(flatSample.length)
  })
})

describe('moveNode', () => {
  it('moves a topic to a different module', () => {
    const result = moveNode(flatSample, 'm1-t2', 'm2', 2)
    const moved = result.find(n => n.id === 'm1-t2')!
    expect(moved.parentId).toBe('m2')
    expect(moved.depth).toBe(1)
    expect(moved.sortOrder).toBe(2)
    expect(moved.path).toBe('/module-2/topic-2')
  })

  it('updates descendant paths after move', () => {
    const result = moveNode(flatSample, 'm1-t1', 'm3', 0)
    const movedTopic = result.find(n => n.id === 'm1-t1')!
    const sub1 = result.find(n => n.id === 'm1-t1-s1')!
    const sub2 = result.find(n => n.id === 'm1-t1-s2')!
    expect(movedTopic.path).toBe('/module-3/topic-1')
    expect(sub1.path).toBe('/module-3/topic-1/sub-1')
    expect(sub2.path).toBe('/module-3/topic-1/sub-2')
    expect(sub1.depth).toBe(2)
  })

  it('moves a node to root level', () => {
    const result = moveNode(flatSample, 'm1-t1', null, 3)
    const moved = result.find(n => n.id === 'm1-t1')!
    expect(moved.parentId).toBeNull()
    expect(moved.depth).toBe(0)
    expect(moved.path).toBe('/topic-1')
  })

  it('throws for missing node', () => {
    expect(() => moveNode(flatSample, 'nonexistent', 'm2', 0)).toThrow('Node "nonexistent" not found')
  })

  it('throws for missing parent', () => {
    expect(() => moveNode(flatSample, 'm1-t1', 'nonexistent', 0)).toThrow('Parent node "nonexistent" not found')
  })
})

describe('updatePaths', () => {
  it('recalculates all paths from scratch', () => {
    // Corrupt some paths
    const corrupted = flatSample.map(n => ({ ...n, path: '/wrong', children: [], components: [...n.components] }))
    const fixed = updatePaths(corrupted)

    const m1Node = fixed.find(n => n.id === 'm1')!
    const topicNode = fixed.find(n => n.id === 'm1-t1')!
    const subNode = fixed.find(n => n.id === 'm1-t1-s1')!

    expect(m1Node.path).toBe('/module-1')
    expect(topicNode.path).toBe('/module-1/topic-1')
    expect(subNode.path).toBe('/module-1/topic-1/sub-1')
  })

  it('recalculates depths correctly', () => {
    const corrupted = flatSample.map(n => ({ ...n, depth: 99, children: [], components: [...n.components] }))
    const fixed = updatePaths(corrupted)

    expect(fixed.find(n => n.id === 'm1')!.depth).toBe(0)
    expect(fixed.find(n => n.id === 'm1-t1')!.depth).toBe(1)
    expect(fixed.find(n => n.id === 'm1-t1-s1')!.depth).toBe(2)
  })

  it('handles all root nodes', () => {
    const roots = [
      makeNode({ id: 'r1', slug: 'root-1', parentId: null }),
      makeNode({ id: 'r2', slug: 'root-2', parentId: null }),
    ]
    const fixed = updatePaths(roots)
    expect(fixed.find(n => n.id === 'r1')!.path).toBe('/root-1')
    expect(fixed.find(n => n.id === 'r2')!.path).toBe('/root-2')
  })
})

describe('getTreeStats', () => {
  it('counts total nodes', () => {
    const tree = buildTree(flatSample)
    const stats = getTreeStats(tree)
    expect(stats.totalNodes).toBe(13)
  })

  it('reports correct max depth', () => {
    const tree = buildTree(flatSample)
    const stats = getTreeStats(tree)
    expect(stats.maxDepth).toBe(2)
  })

  it('breaks down components by type', () => {
    const tree = buildTree(flatSample)
    const stats = getTreeStats(tree)
    expect(stats.componentBreakdown).toEqual({
      study_material: 1,
      video: 3,
      quiz: 1,
    })
  })

  it('returns zeros for empty tree', () => {
    const stats = getTreeStats([])
    expect(stats.totalNodes).toBe(0)
    expect(stats.maxDepth).toBe(0)
    expect(stats.componentBreakdown).toEqual({})
  })

  it('handles flat tree (all roots, no nesting)', () => {
    const roots = [
      makeNode({ id: 'a', depth: 0 }),
      makeNode({ id: 'b', depth: 0 }),
    ]
    const stats = getTreeStats(roots)
    expect(stats.totalNodes).toBe(2)
    expect(stats.maxDepth).toBe(0)
  })
})
