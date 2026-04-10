import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Prisma ────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  ideationConversation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  ideationMessage: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('../../src/lib/db', () => ({ db: mockDb }))

import {
  createConversation,
  addMessage,
  getMessages,
  getLatestConversation,
  getConversation,
  updateConversationPhase,
} from '../../src/lib/domain/workflows/ideation/conversation-manager'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('conversation-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createConversation', () => {
    it('creates a conversation with blueprintId and phase', async () => {
      const mockConvo = {
        id: 'conv-1',
        blueprintId: 'bp-1',
        phase: 'brainstorm',
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
  })

  describe('addMessage', () => {
    it('creates a message with all fields', async () => {
      const mockMsg = {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'human',
        content: 'Hello',
        messageType: 'text',
        structuredData: null,
        createdAt: new Date(),
      }
      mockDb.ideationMessage.create.mockResolvedValue(mockMsg)

      const result = await addMessage({
        conversationId: 'conv-1',
        role: 'human',
        content: 'Hello',
        messageType: 'text',
      })

      expect(result).toEqual(mockMsg)
      expect(mockDb.ideationMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          role: 'human',
          content: 'Hello',
          messageType: 'text',
          structuredData: undefined,
        },
      })
    })

    it('passes structured data when provided', async () => {
      mockDb.ideationMessage.create.mockResolvedValue({
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'facilitator',
        content: 'Response',
        messageType: 'question',
        structuredData: { archetype: 'k12_curriculum' },
        createdAt: new Date(),
      })

      await addMessage({
        conversationId: 'conv-1',
        role: 'facilitator',
        content: 'Response',
        messageType: 'question',
        structuredData: { archetype: 'k12_curriculum' },
      })

      expect(mockDb.ideationMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          role: 'facilitator',
          content: 'Response',
          messageType: 'question',
          structuredData: { archetype: 'k12_curriculum' },
        },
      })
    })
  })

  describe('getMessages', () => {
    it('returns messages mapped to IdeationMessageType', async () => {
      const now = new Date()
      mockDb.ideationMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'human',
          messageType: 'text',
          content: 'Hello',
          structuredData: null,
          createdAt: now,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'facilitator',
          messageType: 'question',
          content: 'What subject?',
          structuredData: { phase: 'brainstorm' },
          createdAt: now,
        },
      ])

      const messages = await getMessages('conv-1')

      expect(messages).toHaveLength(2)
      expect(messages[0]).toEqual({
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'human',
        messageType: 'text',
        content: 'Hello',
        structuredData: undefined,
        createdAt: now,
      })
      expect(messages[1].structuredData).toEqual({ phase: 'brainstorm' })
    })

    it('orders by createdAt ascending', async () => {
      mockDb.ideationMessage.findMany.mockResolvedValue([])
      await getMessages('conv-1')

      expect(mockDb.ideationMessage.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('getLatestConversation', () => {
    it('returns the most recent conversation with messages', async () => {
      const mockConvo = {
        id: 'conv-2',
        blueprintId: 'bp-1',
        phase: 'structure',
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

    it('returns null if no conversation exists', async () => {
      mockDb.ideationConversation.findFirst.mockResolvedValue(null)
      const result = await getLatestConversation('bp-nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getConversation', () => {
    it('returns conversation by ID', async () => {
      const mockConvo = { id: 'conv-1', messages: [] }
      mockDb.ideationConversation.findUnique.mockResolvedValue(mockConvo)

      const result = await getConversation('conv-1')
      expect(result).toEqual(mockConvo)
    })
  })

  describe('updateConversationPhase', () => {
    it('updates the phase field', async () => {
      mockDb.ideationConversation.update.mockResolvedValue({ id: 'conv-1', phase: 'refinement' })

      await updateConversationPhase('conv-1', 'refinement')

      expect(mockDb.ideationConversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { phase: 'refinement' },
      })
    })
  })
})
