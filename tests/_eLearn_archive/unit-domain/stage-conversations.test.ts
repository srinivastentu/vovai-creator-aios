import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Prisma ────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  ideationConversation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  ideationMessage: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('../../../src/lib/db', () => ({ db: mockDb }))

import {
  createConversation,
  getLatestConversation,
  getOrCreateStageConversation,
  getStageConversations,
} from '../../../src/lib/domain/workflows/ideation/conversation-manager'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('stage-conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrCreateStageConversation', () => {
    const now = new Date()

    it('creates a new conversation when none exists for the stage', async () => {
      mockDb.ideationConversation.findFirst.mockResolvedValue(null)
      const created = {
        id: 'conv-stage-1',
        blueprintId: 'bp-1',
        phase: 'brainstorm',
        stageId: 'brief',
        createdAt: now,
        updatedAt: now,
        messages: [],
      }
      mockDb.ideationConversation.create.mockResolvedValue(created)

      const result = await getOrCreateStageConversation('bp-1', 'brief')

      expect(result).toEqual(created)
      expect(mockDb.ideationConversation.findFirst).toHaveBeenCalledWith({
        where: { blueprintId: 'bp-1', stageId: 'brief' },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
      expect(mockDb.ideationConversation.create).toHaveBeenCalledWith({
        data: { blueprintId: 'bp-1', stageId: 'brief', phase: 'brainstorm' },
        include: { messages: true },
      })
    })

    it('returns existing conversation on second call', async () => {
      const existing = {
        id: 'conv-stage-1',
        blueprintId: 'bp-1',
        phase: 'brainstorm',
        stageId: 'brief',
        createdAt: now,
        updatedAt: now,
        messages: [{ id: 'msg-1', content: 'hello' }],
      }
      mockDb.ideationConversation.findFirst.mockResolvedValue(existing)

      const result = await getOrCreateStageConversation('bp-1', 'brief')

      expect(result).toEqual(existing)
      expect(mockDb.ideationConversation.create).not.toHaveBeenCalled()
    })

    it('creates separate conversations per stageId', async () => {
      mockDb.ideationConversation.findFirst.mockResolvedValue(null)
      mockDb.ideationConversation.create
        .mockResolvedValueOnce({
          id: 'conv-brief', blueprintId: 'bp-1', stageId: 'brief',
          phase: 'brainstorm', messages: [], createdAt: now, updatedAt: now,
        })
        .mockResolvedValueOnce({
          id: 'conv-audience', blueprintId: 'bp-1', stageId: 'audience',
          phase: 'brainstorm', messages: [], createdAt: now, updatedAt: now,
        })

      const brief = await getOrCreateStageConversation('bp-1', 'brief')
      const audience = await getOrCreateStageConversation('bp-1', 'audience')

      expect(brief.id).toBe('conv-brief')
      expect(audience.id).toBe('conv-audience')
      expect(mockDb.ideationConversation.findFirst).toHaveBeenCalledTimes(2)
      expect(mockDb.ideationConversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { blueprintId: 'bp-1', stageId: 'brief' } })
      )
      expect(mockDb.ideationConversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { blueprintId: 'bp-1', stageId: 'audience' } })
      )
    })
  })

  describe('getStageConversations', () => {
    it('returns all stage conversations keyed by stageId', async () => {
      const now = new Date()
      mockDb.ideationConversation.findMany.mockResolvedValue([
        { id: 'c1', blueprintId: 'bp-1', stageId: 'brief', phase: 'brainstorm', messages: [], createdAt: now, updatedAt: now },
        { id: 'c2', blueprintId: 'bp-1', stageId: 'audience', phase: 'brainstorm', messages: [], createdAt: now, updatedAt: now },
        { id: 'c3', blueprintId: 'bp-1', stageId: 'structure', phase: 'brainstorm', messages: [], createdAt: now, updatedAt: now },
      ])

      const result = await getStageConversations('bp-1')

      expect(Object.keys(result)).toEqual(['brief', 'audience', 'structure'])
      expect(result['brief'].id).toBe('c1')
      expect(result['audience'].id).toBe('c2')
      expect(result['structure'].id).toBe('c3')
      expect(mockDb.ideationConversation.findMany).toHaveBeenCalledWith({
        where: { blueprintId: 'bp-1', stageId: { not: null } },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
    })

    it('returns empty object for blueprint with no stage conversations', async () => {
      mockDb.ideationConversation.findMany.mockResolvedValue([])

      const result = await getStageConversations('bp-empty')

      expect(result).toEqual({})
    })
  })

  describe('backward compatibility', () => {
    it('createConversation still works without stageId', async () => {
      const mockConvo = {
        id: 'conv-legacy',
        blueprintId: 'bp-1',
        phase: 'brainstorm',
        stageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
      }
      mockDb.ideationConversation.create.mockResolvedValue(mockConvo)

      const result = await createConversation({
        blueprintId: 'bp-1',
        phase: 'brainstorm',
      })

      expect(result).toEqual(mockConvo)
      expect(mockDb.ideationConversation.create).toHaveBeenCalledWith({
        data: { blueprintId: 'bp-1', phase: 'brainstorm' },
        include: { messages: true },
      })
    })

    it('getLatestConversation still works for legacy conversations', async () => {
      const mockConvo = {
        id: 'conv-legacy',
        blueprintId: 'bp-1',
        phase: 'structure',
        stageId: null,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockDb.ideationConversation.findFirst.mockResolvedValue(mockConvo)

      const result = await getLatestConversation('bp-1')

      expect(result).toEqual(mockConvo)
      expect(mockDb.ideationConversation.findFirst).toHaveBeenCalledWith({
        where: { blueprintId: 'bp-1' },
        orderBy: { createdAt: 'desc' },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
    })
  })
})
