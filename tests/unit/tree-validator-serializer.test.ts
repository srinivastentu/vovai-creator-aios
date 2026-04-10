import { describe, it, expect } from 'vitest'
import { validateTree } from '../../src/lib/domain/workflows/tree/tree-validator'
import {
  serializeBlueprint,
  deserializeBlueprint,
} from '../../src/lib/domain/workflows/tree/tree-serializer'
import type {
  ProjectNodeType,
  AttachedComponentType,
  ProjectBlueprintType,
} from '../../src/lib/domain/workflows/types'

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

function makeBlueprint(overrides: Partial<ProjectBlueprintType> = {}): ProjectBlueprintType {
  return {
    id: 'bp-1',
    projectId: 'proj-1',
    archetype: 'professional_training',
    hierarchyLabels: { level0: 'Course', level1: 'Module', level2: 'Topic', level3: 'Subtopic' },
    targetAudience: { primaryAudience: { description: 'Test audience' } } as ProjectBlueprintType['targetAudience'],
    learningOutcomes: [],
    enabledComponents: ['video', 'study_material', 'quiz'],
    workflowTemplate: null,
    ideationPhase: 'structure',
    ideationScore: null,
    structureSummary: null,
    createdAt: now,
    updatedAt: now,
    nodes: [],
    ...overrides,
  }
}

// ─── Sample Data ──────────────────────────────────────────────────────────

const course = makeNode({ id: 'course', title: 'Course', slug: 'course', depth: 0, path: '/course' })
const mod1 = makeNode({ id: 'mod1', parentId: 'course', title: 'Module 1', slug: 'module-1', depth: 1, sortOrder: 0, path: '/course/module-1' })
const mod2 = makeNode({ id: 'mod2', parentId: 'course', title: 'Module 2', slug: 'module-2', depth: 1, sortOrder: 1, path: '/course/module-2' })
const topic1 = makeNode({ id: 'topic1', parentId: 'mod1', title: 'Topic 1', slug: 'topic-1', depth: 2, sortOrder: 0, path: '/course/module-1/topic-1' })
const topic2 = makeNode({ id: 'topic2', parentId: 'mod1', title: 'Topic 2', slug: 'topic-2', depth: 2, sortOrder: 1, path: '/course/module-1/topic-2' })
const topic3 = makeNode({ id: 'topic3', parentId: 'mod2', title: 'Topic 3', slug: 'topic-3', depth: 2, sortOrder: 0, path: '/course/module-2/topic-3' })

const validNodes: ProjectNodeType[] = [course, mod1, mod2, topic1, topic2, topic3]

const videoComp = makeComponent({ id: 'v1', nodeId: 'topic1', componentType: 'video' })
const studyComp = makeComponent({ id: 'sm1', nodeId: 'mod1', componentType: 'study_material' })
const quizComp = makeComponent({ id: 'q1', nodeId: 'mod1', componentType: 'quiz' })

const validComponents: AttachedComponentType[] = [videoComp, studyComp, quizComp]

// ─── validateTree ─────────────────────────────────────────────────────────

describe('validateTree', () => {
  it('passes for a valid tree', () => {
    const result = validateTree('professional_training', validNodes, validComponents)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('passes for empty tree with no components', () => {
    const result = validateTree('professional_training', [], [])
    expect(result.valid).toBe(true)
  })

  // ─── Check 1: Orphan nodes ──────────────────────────────────────────

  describe('orphan nodes', () => {
    it('detects orphan node with non-existent parentId', () => {
      const orphan = makeNode({ id: 'orphan', parentId: 'nonexistent', title: 'Orphan', slug: 'orphan', path: '/orphan' })
      const result = validateTree('professional_training', [...validNodes, orphan], [])
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'ORPHAN_NODE')).toBe(true)
    })

    it('does not flag root nodes (parentId null)', () => {
      const result = validateTree('professional_training', [course], [])
      expect(result.errors.filter(e => e.code === 'ORPHAN_NODE')).toHaveLength(0)
    })
  })

  // ─── Check 2: Circular references ──────────────────────────────────

  describe('circular references', () => {
    it('detects circular parent chain', () => {
      const a = makeNode({ id: 'a', parentId: 'b', title: 'A', slug: 'a', depth: 1, path: '/a' })
      const b = makeNode({ id: 'b', parentId: 'a', title: 'B', slug: 'b', depth: 1, path: '/b' })
      const result = validateTree('professional_training', [a, b], [])
      expect(result.errors.some(e => e.code === 'CIRCULAR_REFERENCE')).toBe(true)
    })

    it('detects self-referencing node', () => {
      const self = makeNode({ id: 'self', parentId: 'self', title: 'Self', slug: 'self', depth: 0, path: '/self' })
      const result = validateTree('professional_training', [self], [])
      expect(result.errors.some(e => e.code === 'CIRCULAR_REFERENCE')).toBe(true)
    })
  })

  // ─── Check 3: Max depth ────────────────────────────────────────────

  describe('max depth', () => {
    it('detects depth exceeding archetype maxDepth', () => {
      // professional_training maxDepth = 3
      const deep = makeNode({ id: 'deep', parentId: 'topic1', title: 'Deep', slug: 'deep', depth: 4, path: '/course/module-1/topic-1/deep' })
      const result = validateTree('professional_training', [...validNodes, deep], [])
      expect(result.errors.some(e => e.code === 'DEPTH_EXCEEDED')).toBe(true)
    })

    it('allows nodes at maxDepth', () => {
      // professional_training maxDepth = 3
      const subtopic = makeNode({ id: 'sub', parentId: 'topic1', title: 'Subtopic', slug: 'subtopic', depth: 3, path: '/course/module-1/topic-1/subtopic' })
      const result = validateTree('professional_training', [...validNodes, subtopic], [])
      expect(result.errors.filter(e => e.code === 'DEPTH_EXCEEDED')).toHaveLength(0)
    })

    it('respects k12_curriculum maxDepth of 4', () => {
      const deep4 = makeNode({ id: 'd4', parentId: 'topic1', title: 'D4', slug: 'd4', depth: 4, path: '/course/module-1/topic-1/d4' })
      const result = validateTree('k12_curriculum', [...validNodes, deep4], [])
      expect(result.errors.filter(e => e.code === 'DEPTH_EXCEEDED')).toHaveLength(0)
    })
  })

  // ─── Check 4: Component levels ─────────────────────────────────────

  describe('component levels', () => {
    it('detects component attached at wrong depth', () => {
      // video attachableAt [2, 3] — attaching at depth 0 should fail
      const badComp = makeComponent({ id: 'bad-v', nodeId: 'course', componentType: 'video' })
      const result = validateTree('professional_training', validNodes, [badComp])
      expect(result.errors.some(e => e.code === 'INVALID_COMPONENT_LEVEL')).toBe(true)
    })

    it('allows component at valid depth', () => {
      // video attachableAt [2, 3], topic1 is depth 2
      const result = validateTree('professional_training', validNodes, [videoComp])
      expect(result.errors.filter(e => e.code === 'INVALID_COMPONENT_LEVEL')).toHaveLength(0)
    })

    it('detects unknown component type', () => {
      const unknownComp = makeComponent({ id: 'bad', nodeId: 'mod1', componentType: 'nonexistent_type' })
      const result = validateTree('professional_training', validNodes, [unknownComp])
      expect(result.errors.some(e => e.code === 'INVALID_COMPONENT_LEVEL' && e.message.includes('Unknown'))).toBe(true)
    })
  })

  // ─── Check 5: Component dependencies ───────────────────────────────

  describe('component dependencies', () => {
    it('detects missing dependency (post_assessment needs study_material)', () => {
      // post_assessment dependsOn ['study_material']
      const postAssess = makeComponent({ id: 'pa', nodeId: 'mod1', componentType: 'post_assessment' })
      const result = validateTree('professional_training', validNodes, [postAssess])
      expect(result.errors.some(e => e.code === 'MISSING_DEPENDENCY')).toBe(true)
    })

    it('passes when dependency is satisfied on same node', () => {
      // quiz dependsOn ['study_material'] — both on mod1
      const result = validateTree('professional_training', validNodes, [studyComp, quizComp])
      expect(result.errors.filter(e => e.code === 'MISSING_DEPENDENCY')).toHaveLength(0)
    })

    it('detects capstone missing both dependencies', () => {
      // capstone_project dependsOn ['study_material', 'quiz']
      const capstone = makeComponent({ id: 'cap', nodeId: 'course', componentType: 'capstone_project' })
      const result = validateTree('professional_training', validNodes, [capstone])
      const depErrors = result.errors.filter(e => e.code === 'MISSING_DEPENDENCY')
      expect(depErrors.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ─── Check 6: Duplicate paths ──────────────────────────────────────

  describe('duplicate paths', () => {
    it('detects duplicate paths within same blueprint', () => {
      const dupe = makeNode({ id: 'dupe', parentId: 'mod1', title: 'Duplicate', slug: 'topic-1', depth: 2, path: '/course/module-1/topic-1' })
      const result = validateTree('professional_training', [...validNodes, dupe], [])
      expect(result.errors.some(e => e.code === 'DUPLICATE_PATH')).toBe(true)
    })

    it('passes when all paths are unique', () => {
      const result = validateTree('professional_training', validNodes, [])
      expect(result.errors.filter(e => e.code === 'DUPLICATE_PATH')).toHaveLength(0)
    })
  })

  // ─── Check 7: Path consistency ─────────────────────────────────────

  describe('path consistency', () => {
    it('detects mismatched materialized path', () => {
      const badPath = makeNode({
        id: 'bp', parentId: 'mod1', title: 'Bad Path', slug: 'bad-path',
        depth: 2, path: '/wrong/bad-path',
      })
      const result = validateTree('professional_training', [...validNodes, badPath], [])
      expect(result.errors.some(e => e.code === 'PATH_MISMATCH')).toBe(true)
    })

    it('passes when all paths match parent chain', () => {
      const result = validateTree('professional_training', validNodes, [])
      expect(result.errors.filter(e => e.code === 'PATH_MISMATCH')).toHaveLength(0)
    })
  })

  // ─── Multiple errors ──────────────────────────────────────────────

  it('returns all errors from all checks at once', () => {
    const orphan = makeNode({ id: 'orph', parentId: 'ghost', title: 'Orphan', slug: 'orphan', depth: 5, path: '/wrong' })
    const badComp = makeComponent({ id: 'bc', nodeId: 'course', componentType: 'video' })
    const result = validateTree('professional_training', [...validNodes, orphan], [badComp])
    expect(result.valid).toBe(false)
    const codes = new Set(result.errors.map(e => e.code))
    expect(codes.has('ORPHAN_NODE')).toBe(true)
    expect(codes.has('DEPTH_EXCEEDED')).toBe(true)
  })
})

// ─── serializeBlueprint / deserializeBlueprint ────────────────────────────

describe('serializeBlueprint', () => {
  it('produces a valid snapshot with all fields', () => {
    const bp = makeBlueprint({ nodes: validNodes })
    const snapshot = serializeBlueprint(bp, validNodes, validComponents)

    expect(snapshot.version).toBe(0) // caller sets
    expect(snapshot.blueprint.id).toBe('bp-1')
    expect(snapshot.blueprint.archetype).toBe('professional_training')
    expect(snapshot.nodes).toHaveLength(6)
    expect(snapshot.components).toHaveLength(3)
  })

  it('strips Date objects from snapshot', () => {
    const bp = makeBlueprint()
    const snapshot = serializeBlueprint(bp, validNodes, validComponents)
    const json = JSON.stringify(snapshot)
    const parsed = JSON.parse(json)

    // Should be JSON-serializable without Date issues
    expect(typeof parsed.createdAt).toBe('string')
    expect(parsed.nodes[0].createdAt).toBeUndefined() // Dates stripped from nodes
  })

  it('strips children arrays from nodes', () => {
    const bp = makeBlueprint()
    const nodesWithChildren = validNodes.map(n => ({
      ...n,
      children: [makeNode({ id: 'child-' + n.id })],
    }))
    const snapshot = serializeBlueprint(bp, nodesWithChildren, [])

    for (const node of snapshot.nodes) {
      expect((node as unknown as Record<string, unknown>).children).toBeUndefined()
    }
  })
})

describe('deserializeBlueprint', () => {
  it('round-trips through serialize → deserialize', () => {
    const bp = makeBlueprint({ nodes: validNodes })
    const snapshot = serializeBlueprint(bp, validNodes, validComponents)
    snapshot.version = 1

    const { blueprint, nodes, components } = deserializeBlueprint(snapshot)

    expect(blueprint.id).toBe('bp-1')
    expect(blueprint.archetype).toBe('professional_training')
    expect(nodes).toHaveLength(6)
    expect(components).toHaveLength(3)
  })

  it('restores node fields correctly', () => {
    const bp = makeBlueprint()
    const snapshot = serializeBlueprint(bp, validNodes, validComponents)
    const { nodes } = deserializeBlueprint(snapshot)

    const mod = nodes.find(n => n.id === 'mod1')!
    expect(mod.title).toBe('Module 1')
    expect(mod.slug).toBe('module-1')
    expect(mod.depth).toBe(1)
    expect(mod.parentId).toBe('course')
    expect(mod.path).toBe('/course/module-1')
  })

  it('restores component fields correctly', () => {
    const bp = makeBlueprint()
    const snapshot = serializeBlueprint(bp, validNodes, validComponents)
    const { components } = deserializeBlueprint(snapshot)

    const vid = components.find(c => c.id === 'v1')!
    expect(vid.componentType).toBe('video')
    expect(vid.nodeId).toBe('topic1')
    expect(vid.priority).toBe('core')
  })

  it('attaches components to their nodes', () => {
    const bp = makeBlueprint()
    const snapshot = serializeBlueprint(bp, validNodes, validComponents)
    const { nodes } = deserializeBlueprint(snapshot)

    const mod = nodes.find(n => n.id === 'mod1')!
    expect(mod.components).toHaveLength(2) // study_material + quiz
    expect(mod.components.map(c => c.componentType).sort()).toEqual(['quiz', 'study_material'])
  })

  it('restores Date objects', () => {
    const bp = makeBlueprint()
    const snapshot = serializeBlueprint(bp, validNodes, [])
    const { blueprint, nodes } = deserializeBlueprint(snapshot)

    expect(blueprint.createdAt).toBeInstanceOf(Date)
    expect(blueprint.updatedAt).toBeInstanceOf(Date)
    expect(nodes[0].createdAt).toBeInstanceOf(Date)
  })

  it('sets empty children arrays on all nodes', () => {
    const bp = makeBlueprint()
    const snapshot = serializeBlueprint(bp, validNodes, [])
    const { nodes } = deserializeBlueprint(snapshot)

    for (const node of nodes) {
      expect(node.children).toEqual([])
    }
  })
})

// ─── Version Snapshot / Restore Flow ──────────────────────────────────────

describe('version snapshot and restore flow', () => {
  it('snapshot v1 → add node → snapshot v2 → restore v1 → node count matches v1', () => {
    const bp = makeBlueprint({ nodes: validNodes })

    // 1. Snapshot version 1
    const v1Snapshot = serializeBlueprint(bp, validNodes, validComponents)
    v1Snapshot.version = 1

    // 2. Add a new node
    const newTopic = makeNode({
      id: 'topic4', parentId: 'mod2', title: 'Topic 4', slug: 'topic-4',
      depth: 2, sortOrder: 1, path: '/course/module-2/topic-4',
    })
    const newComp = makeComponent({ id: 'v2', nodeId: 'topic4', componentType: 'video' })
    const nodesV2 = [...validNodes, newTopic]
    const compsV2 = [...validComponents, newComp]

    // 3. Snapshot version 2
    const v2Snapshot = serializeBlueprint(bp, nodesV2, compsV2)
    v2Snapshot.version = 2

    expect(v2Snapshot.nodes).toHaveLength(7)
    expect(v2Snapshot.components).toHaveLength(4)

    // 4. Restore version 1
    const restored = deserializeBlueprint(v1Snapshot)

    // 5. Verify node count matches version 1
    expect(restored.nodes).toHaveLength(6)
    expect(restored.components).toHaveLength(3)

    // Verify the added node from v2 is NOT present
    expect(restored.nodes.find(n => n.id === 'topic4')).toBeUndefined()
    expect(restored.components.find(c => c.id === 'v2')).toBeUndefined()

    // Verify original nodes are intact
    expect(restored.nodes.find(n => n.id === 'course')).toBeDefined()
    expect(restored.nodes.find(n => n.id === 'mod1')).toBeDefined()
    expect(restored.nodes.find(n => n.id === 'topic1')).toBeDefined()
  })

  it('restored tree passes validation', () => {
    const bp = makeBlueprint()
    const snapshot = serializeBlueprint(bp, validNodes, validComponents)
    snapshot.version = 1

    const { nodes, components } = deserializeBlueprint(snapshot)
    const result = validateTree('professional_training', nodes, components)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('preserves blueprint metadata across snapshot/restore', () => {
    const bp = makeBlueprint({
      ideationScore: 85.5,
      ideationPhase: 'review',
      enabledComponents: ['video', 'quiz', 'activity'],
    })

    const snapshot = serializeBlueprint(bp, [], [])
    const { blueprint } = deserializeBlueprint(snapshot)

    expect(blueprint.ideationScore).toBe(85.5)
    expect(blueprint.ideationPhase).toBe('review')
    expect(blueprint.enabledComponents).toEqual(['video', 'quiz', 'activity'])
  })
})
