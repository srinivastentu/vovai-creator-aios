import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Prisma ────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => {
  const txProxy = {
    stageSession: { create: vi.fn() },
    nodeComponent: { update: vi.fn() },
    project: { update: vi.fn() },
  }
  return {
    projectBlueprint: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof txProxy) => Promise<unknown>) => fn(txProxy)),
    _tx: txProxy,
  }
})

vi.mock('../../src/lib/db', () => ({ db: mockDb }))

import { executeHandoff, HandoffError } from '../../src/lib/project-component/production/handoff'
import { estimateProjectCost } from '../../src/lib/project-component/production/cost-estimator'
import { COMPONENT_REGISTRY } from '../../src/lib/project-component/component-registry'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeComponent(id: string, type: string, status = 'configured') {
  return {
    id,
    nodeId: 'node-1',
    componentType: type,
    config: {},
    priority: 'core',
    status,
    relevanceScore: null,
    pipelineJobId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeNode(id: string, components: ReturnType<typeof makeComponent>[] = []) {
  return {
    id,
    blueprintId: 'bp-1',
    parentId: null,
    title: `Node ${id}`,
    slug: id,
    description: null,
    notes: null,
    depth: 1,
    sortOrder: 0,
    learningOutcomes: [],
    status: 'approved',
    agentConfidence: null,
    path: `/${id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    components,
  }
}

function makeBlueprint(
  ideationPhase: string,
  components: ReturnType<typeof makeComponent>[] = [],
) {
  return {
    id: 'bp-1',
    projectId: 'proj-1',
    archetype: 'professional_training',
    hierarchyLabels: {},
    targetAudience: {},
    learningOutcomes: [],
    enabledComponents: [],
    workflowTemplate: null as Record<string, unknown> | null,
    ideationPhase,
    ideationScore: 85,
    structureSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    nodes: [makeNode('node-1', components)],
  }
}

let sessionCounter = 0

function setupSessionCreation() {
  sessionCounter = 0
  mockDb._tx.stageSession.create.mockImplementation(async () => {
    sessionCounter++
    return { id: `session-${sessionCounter}`, projectId: 'proj-1', stageId: 1, status: 'idle' }
  })
  mockDb._tx.nodeComponent.update.mockResolvedValue({})
  mockDb._tx.project.update.mockResolvedValue({})
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('estimateProjectCost', () => {
  it('calculates correct totals for a mix of component types', () => {
    const types = ['study_material', 'study_material', 'quiz', 'video']
    const result = estimateProjectCost(types)

    expect(result.totalComponents).toBe(4)
    expect(result.total.currency).toBe('USD')
    // study_material: 2 * ($0.50–$2.00) = $1.00–$4.00
    // quiz: 1 * ($0.40–$1.50) = $0.40–$1.50
    // video: 1 * ($3.00–$12.00) = $3.00–$12.00
    // total: $4.40–$17.50
    expect(result.total.min).toBeCloseTo(4.40)
    expect(result.total.max).toBeCloseTo(17.50)
  })

  it('groups by phase correctly', () => {
    const types = ['study_material', 'practice_worksheet', 'quiz', 'video']
    const result = estimateProjectCost(types)

    expect(result.byPhase).toHaveLength(3) // document, assessment, video
    const docPhase = result.byPhase.find(p => p.phase === 'Documents')
    expect(docPhase?.componentCount).toBe(2) // study_material + practice_worksheet
  })

  it('groups by type correctly', () => {
    const types = ['video', 'video', 'video']
    const result = estimateProjectCost(types)

    expect(result.byType).toHaveLength(1)
    expect(result.byType[0].count).toBe(3)
    expect(result.byType[0].totalCost.min).toBeCloseTo(9.00)
    expect(result.byType[0].totalCost.max).toBeCloseTo(36.00)
  })

  it('returns empty estimates for empty input', () => {
    const result = estimateProjectCost([])
    expect(result.totalComponents).toBe(0)
    expect(result.total.min).toBe(0)
    expect(result.total.max).toBe(0)
    expect(result.byPhase).toHaveLength(0)
    expect(result.byType).toHaveLength(0)
  })

  it('ignores unknown component types', () => {
    const result = estimateProjectCost(['unknown_thing', 'video'])
    expect(result.totalComponents).toBe(2) // counts input, but only 1 has a def
    // Only video contributes to cost
    expect(result.byType).toHaveLength(1)
    expect(result.byType[0].componentType).toBe('video')
  })

  it('sorts phases by production order', () => {
    const types = ['video', 'study_material', 'capstone_project', 'quiz']
    const result = estimateProjectCost(types)

    const phaseNames = result.byPhase.map(p => p.phase)
    expect(phaseNames).toEqual(['Documents', 'Assessments', 'Videos', 'Capstone'])
  })
})

describe('executeHandoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSessionCreation()
  })

  it('throws BLUEPRINT_NOT_FOUND when blueprint does not exist', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(null)

    await expect(executeHandoff('nonexistent')).rejects.toThrow(HandoffError)
    await expect(executeHandoff('nonexistent')).rejects.toMatchObject({
      code: 'BLUEPRINT_NOT_FOUND',
    })
  })

  it('throws NOT_APPROVED when blueprint is not approved', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('review', [
      makeComponent('c1', 'video'),
    ]))

    await expect(executeHandoff('bp-1')).rejects.toThrow(HandoffError)
    await expect(executeHandoff('bp-1')).rejects.toMatchObject({
      code: 'NOT_APPROVED',
    })
  })

  it('throws NO_COMPONENTS when no eligible components exist', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', []))

    await expect(executeHandoff('bp-1')).rejects.toMatchObject({
      code: 'NO_COMPONENTS',
    })
  })

  it('skips components that are already queued or completed', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'video', 'queued'),
      makeComponent('c2', 'video', 'completed'),
      makeComponent('c3', 'video', 'skipped'),
    ]))

    await expect(executeHandoff('bp-1')).rejects.toMatchObject({
      code: 'NO_COMPONENTS',
    })
  })

  it('creates correct number of StageSession records', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'study_material'),
      makeComponent('c2', 'quiz'),
      makeComponent('c3', 'video'),
    ]))

    const result = await executeHandoff('bp-1')

    expect(result.totalJobs).toBe(3)
    expect(mockDb._tx.stageSession.create).toHaveBeenCalledTimes(3)
  })

  it('links NodeComponent.pipelineJobId correctly', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'study_material'),
    ]))

    await executeHandoff('bp-1')

    expect(mockDb._tx.nodeComponent.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        pipelineJobId: 'session-1',
        status: 'queued',
      },
    })
  })

  it('respects production ordering (documents before videos)', async () => {
    // Insert in reverse order — video first, then document
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c-video', 'video'),
      makeComponent('c-doc', 'study_material'),
    ]))

    const result = await executeHandoff('bp-1')

    // Documents phase should have jobs, videos should have jobs
    expect(result.jobsByPhase.documents).toBe(1)
    expect(result.jobsByPhase.videos).toBe(1)

    // The session creation calls: first call should be for the document (non-video),
    // second for the video
    const calls = mockDb._tx.stageSession.create.mock.calls
    expect(calls).toHaveLength(2)
    // Non-video components use FIRST_STAGE_BY_PIPELINE[document] = 100
    expect(calls[0][0].data.stageId).toBe(100) // document stage
    // Video components use FIRST_STAGE_BY_PIPELINE[video] = 1
    expect(calls[1][0].data.stageId).toBe(1)   // video stage
  })

  it('assigns correct first stage IDs per pipeline type', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'study_material'),   // document → 100
      makeComponent('c2', 'quiz'),              // assessment → 200
      makeComponent('c3', 'activity'),          // activity → 400
      makeComponent('c4', 'capstone_project'),  // capstone → 500
    ]))

    await executeHandoff('bp-1')

    const calls = mockDb._tx.stageSession.create.mock.calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stageIds = calls.map((c: any) => c[0].data.stageId)
    expect(stageIds).toEqual([100, 200, 400, 500])
  })

  it('batches videos into groups of 10', async () => {
    const videoComponents = Array.from({ length: 23 }, (_, i) =>
      makeComponent(`v${i}`, 'video')
    )
    mockDb.projectBlueprint.findUnique.mockResolvedValue(
      makeBlueprint('approved', videoComponents)
    )

    const result = await executeHandoff('bp-1')

    expect(result.totalJobs).toBe(23)
    expect(result.jobsByPhase.videos).toBe(23)
    expect(result.videoBatchCount).toBe(3) // 10 + 10 + 3
    expect(result.videoBatches).toHaveLength(3)
    expect(result.videoBatches[0].componentIds).toHaveLength(10)
    expect(result.videoBatches[1].componentIds).toHaveLength(10)
    expect(result.videoBatches[2].componentIds).toHaveLength(3)
  })

  it('stores batch metadata on video session metadata field', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('v1', 'video'),
      makeComponent('v2', 'video'),
    ]))

    await executeHandoff('bp-1')

    const calls = mockDb._tx.stageSession.create.mock.calls
    // Both are videos — check batch metadata
    for (const call of calls) {
      expect(call[0].data.metadata).toMatchObject({
        batchIndex: 0,
        batchSize: 2,
        componentType: 'video',
      })
    }
  })

  it('returns correct jobsByPhase breakdown', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'study_material'),
      makeComponent('c2', 'practice_worksheet'),
      makeComponent('c3', 'quiz'),
      makeComponent('c4', 'video'),
      makeComponent('c5', 'video'),
      makeComponent('c6', 'activity'),
      makeComponent('c7', 'capstone_project'),
      makeComponent('c8', 'glossary'),
    ]))

    const result = await executeHandoff('bp-1')

    expect(result.jobsByPhase).toEqual({
      documents: 2,
      assessments: 1,
      videos: 2,
      activities: 1,
      capstone: 1,
      meta: 1,
    })
    expect(result.totalJobs).toBe(8)
  })

  it('includes cost estimate in result', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'study_material'),
      makeComponent('c2', 'video'),
    ]))

    const result = await executeHandoff('bp-1')

    expect(result.estimatedCost).toBeDefined()
    expect(result.estimatedCost.totalComponents).toBe(2)
    expect(result.estimatedCost.total.min).toBeGreaterThan(0)
    expect(result.estimatedCost.total.currency).toBe('USD')
  })

  it('updates project status to in_progress', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'video'),
    ]))

    await executeHandoff('bp-1')

    expect(mockDb._tx.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { status: 'in_progress' },
    })
  })

  it('transaction rolls back on failure', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'video'),
    ]))

    // Make the transaction callback throw
    mockDb.$transaction.mockRejectedValueOnce(new Error('DB connection lost'))

    await expect(executeHandoff('bp-1')).rejects.toThrow('DB connection lost')
  })

  it('returns createdSessionIds', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'study_material'),
      makeComponent('c2', 'quiz'),
    ]))

    const result = await executeHandoff('bp-1')

    expect(result.createdSessionIds).toHaveLength(2)
    expect(result.createdSessionIds).toEqual(['session-1', 'session-2'])
  })

  it('processes both planned and configured components', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c1', 'study_material', 'planned'),
      makeComponent('c2', 'quiz', 'configured'),
    ]))

    const result = await executeHandoff('bp-1')
    expect(result.totalJobs).toBe(2)
  })

  it('respects workflowTemplate.productionOrder when present', async () => {
    // User configured: quiz before study_material (reverse of default pipeline order)
    const bp = makeBlueprint('approved', [
      makeComponent('c-doc', 'study_material'),
      makeComponent('c-quiz', 'quiz'),
    ])
    bp.workflowTemplate = {
      enabledComponents: ['quiz', 'study_material'],
      productionOrder: ['quiz', 'study_material'],
      levelDefaults: [],
    }
    mockDb.projectBlueprint.findUnique.mockResolvedValue(bp)

    await executeHandoff('bp-1')

    const calls = mockDb._tx.stageSession.create.mock.calls
    // quiz (assessment → 200) should be created FIRST per user's order
    expect(calls[0][0].data.stageId).toBe(200) // assessment stage
    expect(calls[1][0].data.stageId).toBe(100) // document stage
  })

  it('falls back to pipeline phase order when workflowTemplate is null', async () => {
    // No workflowTemplate — default ordering: documents (0) before assessments (1)
    mockDb.projectBlueprint.findUnique.mockResolvedValue(makeBlueprint('approved', [
      makeComponent('c-quiz', 'quiz'),
      makeComponent('c-doc', 'study_material'),
    ]))

    await executeHandoff('bp-1')

    const calls = mockDb._tx.stageSession.create.mock.calls
    // document (100) should come first by default pipeline order
    expect(calls[0][0].data.stageId).toBe(100) // document stage
    expect(calls[1][0].data.stageId).toBe(200) // assessment stage
  })
})
