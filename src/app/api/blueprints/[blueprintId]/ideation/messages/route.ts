import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { IdeationPhase as IdeationPhaseEnum } from '@/generated/prisma/client'
import {
  getLatestConversation,
  getMessages,
} from '@/lib/project-component/ideation/conversation-manager'

/**
 * GET /api/blueprints/[blueprintId]/ideation/messages
 *
 * Load conversation history for a blueprint. Returns messages from
 * the latest conversation, or optionally filtered by phase.
 *
 * Query params:
 *   ?phase=brainstorm|structure|refinement|review  (optional — filters by phase)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    // Verify blueprint exists
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
      select: { id: true, ideationPhase: true },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // Check for optional phase filter
    const url = new URL(request.url)
    const phaseFilter = url.searchParams.get('phase')

    if (phaseFilter) {
      // Get conversation for a specific phase
      const conversation = await db.ideationConversation.findFirst({
        where: { blueprintId, phase: phaseFilter as IdeationPhaseEnum },
        orderBy: { createdAt: 'desc' },
      })

      if (!conversation) {
        return NextResponse.json({
          conversationId: null,
          phase: phaseFilter,
          messages: [],
        })
      }

      const phaseMessages = await getMessages(conversation.id)

      return NextResponse.json({
        conversationId: conversation.id,
        phase: conversation.phase,
        messages: phaseMessages,
      })
    }

    // Default: get the latest conversation with all messages
    const conversation = await getLatestConversation(blueprintId)

    if (!conversation) {
      return NextResponse.json({
        conversationId: null,
        phase: blueprint.ideationPhase,
        messages: [],
      })
    }

    const messages = await getMessages(conversation.id)

    // Also fetch all conversations for this blueprint (for phase navigation)
    const conversations = await db.ideationConversation.findMany({
      where: { blueprintId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        phase: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      phase: conversation.phase,
      messages,
      conversations: conversations.map(c => ({
        id: c.id,
        phase: c.phase,
        messageCount: c._count.messages,
        createdAt: c.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/blueprints/[blueprintId]/ideation/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
