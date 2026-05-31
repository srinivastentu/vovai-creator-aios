import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  savePipelineState,
  loadPipelineState,
  deletePipelineState,
  PIPELINE_SENTINEL_STAGE_ID,
} from '../../../src/lib/domain/workflows/pipeline-persistence'
import type { IdeationPipeline } from '../../../src/lib/domain/workflows/pipeline-orchestrator'

vi.mock('@/lib/db', () => {
  const mockDb = {
    projectBlueprint: {
      findUnique: vi.fn(),
    },
    stageSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
  return { db: mockDb }
})

import { db } from '@/lib/db'

const mockDb = db as unknown as {
  projectBlueprint: {
    findUnique: ReturnType<typeof vi.fn>
  }
  stageSession: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
  }
}

function makePipeline(): IdeationPipeline {
  return {
    id: 'elearn-ideation-bp1',
    blueprintId: 'bp1',
    stages: [],
    currentStageIndex: 0,
    stageStates: {},
    status: 'active',
    createdAt: new Date('2026-04-10T12:00:00Z'),
    updatedAt: new Date('2026-04-10T12:00:00Z'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PIPELINE_SENTINEL_STAGE_ID', () => {
  it('is 0', () => {
    expect(PIPELINE_SENTINEL_STAGE_ID).toBe(0)
  })
})

describe('savePipelineState', () => {
  it('creates a new StageSession when none exists', async () => {
    const pipeline = makePipeline()
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue(null)
    mockDb.stageSession.create.mockResolvedValue({ id: 'ss1' })

    await savePipelineState('bp1', pipeline)

    expect(mockDb.stageSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj1',
          stageId: 0,
          metadata: expect.any(String),
          status: 'idle',
        }),
      })
    )
  })

  it('updates existing StageSession when one exists', async () => {
    const pipeline = makePipeline()
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({ id: 'ss-existing' })
    mockDb.stageSession.update.mockResolvedValue({ id: 'ss-existing' })

    await savePipelineState('bp1', pipeline)

    expect(mockDb.stageSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ss-existing' },
        data: expect.objectContaining({
          metadata: expect.any(String),
        }),
      })
    )
  })

  it('throws if blueprint not found', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue(null)
    await expect(savePipelineState('nonexistent', makePipeline())).rejects.toThrow('Blueprint not found')
  })
})

describe('loadPipelineState', () => {
  it('returns null when no sentinel session exists', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue(null)
    const result = await loadPipelineState('bp1')
    expect(result).toBeNull()
  })

  it('returns deserialized pipeline when sentinel session exists', async () => {
    const pipeline = makePipeline()
    const serialized = JSON.stringify(pipeline)

    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: serialized,
    })

    const result = await loadPipelineState('bp1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('elearn-ideation-bp1')
    expect(result!.blueprintId).toBe('bp1')
    expect(result!.status).toBe('active')
  })

  it('reconstructs Date objects from JSON strings', async () => {
    const pipeline = makePipeline()
    const serialized = JSON.stringify(pipeline)

    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: serialized,
    })

    const result = await loadPipelineState('bp1')
    expect(result!.createdAt).toBeInstanceOf(Date)
    expect(result!.updatedAt).toBeInstanceOf(Date)
    expect(result!.createdAt.toISOString()).toBe('2026-04-10T12:00:00.000Z')
  })

  it('handles metadata that is already parsed as object (Prisma Json field)', async () => {
    const pipeline = makePipeline()

    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.findFirst.mockResolvedValue({
      id: 'ss1',
      metadata: JSON.parse(JSON.stringify(pipeline)),
    })

    const result = await loadPipelineState('bp1')
    expect(result).not.toBeNull()
    expect(result!.createdAt).toBeInstanceOf(Date)
  })
})

describe('deletePipelineState', () => {
  it('deletes sentinel session for the project', async () => {
    mockDb.projectBlueprint.findUnique.mockResolvedValue({ id: 'bp1', projectId: 'proj1' })
    mockDb.stageSession.deleteMany.mockResolvedValue({ count: 1 })

    await deletePipelineState('bp1')

    expect(mockDb.stageSession.deleteMany).toHaveBeenCalledWith({
      where: { projectId: 'proj1', stageId: 0 },
    })
  })
})
