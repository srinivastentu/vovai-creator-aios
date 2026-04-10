/**
 * Conversation Manager — Persists ideation conversations and messages to the database.
 *
 * Bridges the in-memory IdeationLoopState with the Prisma IdeationConversation
 * and IdeationMessage models. Each blueprint has one active conversation per phase.
 */

import { db } from '@/lib/db'
import type { IdeationPhase, BrainstormRole, IdeationMessageKind, IdeationMessageType } from '../types'
import type { Prisma } from '@/generated/prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateConversationInput {
  blueprintId: string
  phase: IdeationPhase
}

export interface AddMessageInput {
  conversationId: string
  role: BrainstormRole
  content: string
  messageType: IdeationMessageKind
  structuredData?: Record<string, unknown>
}

// ─── Conversation CRUD ───────────────────────────────────────────────────────

/**
 * Create a new conversation for a blueprint and phase.
 * Returns the created conversation with an empty messages array.
 */
export async function createConversation(input: CreateConversationInput) {
  const conversation = await db.ideationConversation.create({
    data: {
      blueprintId: input.blueprintId,
      phase: input.phase,
    },
    include: { messages: true },
  })
  return conversation
}

/**
 * Add a message to an existing conversation.
 * Returns the created message.
 */
export async function addMessage(input: AddMessageInput) {
  const message = await db.ideationMessage.create({
    data: {
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      messageType: input.messageType,
      structuredData: (input.structuredData ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
  return message
}

/**
 * Get all messages for a conversation, ordered by creation time.
 */
export async function getMessages(conversationId: string): Promise<IdeationMessageType[]> {
  const messages = await db.ideationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  })

  return messages.map(mapMessageToType)
}

/**
 * Get the latest conversation for a blueprint (most recently created).
 * Returns null if no conversation exists.
 */
export async function getLatestConversation(blueprintId: string) {
  const conversation = await db.ideationConversation.findFirst({
    where: { blueprintId },
    orderBy: { createdAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  return conversation
}

/**
 * Get a conversation by ID with all messages.
 */
export async function getConversation(conversationId: string) {
  const conversation = await db.ideationConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  return conversation
}

/**
 * Update the phase on an existing conversation.
 */
export async function updateConversationPhase(conversationId: string, phase: IdeationPhase) {
  return db.ideationConversation.update({
    where: { id: conversationId },
    data: { phase },
  })
}

// ─── Stage-specific conversations ───────────────────────────────────────────

/**
 * Get or create a conversation for a specific pipeline stage.
 * Uses blueprintId + stageId to find existing, or creates new.
 */
export async function getOrCreateStageConversation(blueprintId: string, stageId: string) {
  const existing = await db.ideationConversation.findFirst({
    where: { blueprintId, stageId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  if (existing) return existing

  return db.ideationConversation.create({
    data: {
      blueprintId,
      stageId,
      phase: 'brainstorm',
    },
    include: { messages: true },
  })
}

/**
 * Get all stage-specific conversations for a blueprint, keyed by stageId.
 * Excludes conversations with no stageId (legacy ideation conversations).
 */
export async function getStageConversations(blueprintId: string) {
  const conversations = await db.ideationConversation.findMany({
    where: { blueprintId, stageId: { not: null } },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  const result: Record<string, typeof conversations[number]> = {}
  for (const conv of conversations) {
    if (conv.stageId) {
      result[conv.stageId] = conv
    }
  }
  return result
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a Prisma IdeationMessage row to the application-level type. */
function mapMessageToType(row: {
  id: string
  conversationId: string
  role: string
  messageType: string
  content: string
  structuredData: Prisma.JsonValue | null
  createdAt: Date
}): IdeationMessageType {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as BrainstormRole,
    messageType: row.messageType as IdeationMessageKind,
    content: row.content,
    structuredData: (row.structuredData as Record<string, unknown>) ?? undefined,
    createdAt: row.createdAt,
  }
}
