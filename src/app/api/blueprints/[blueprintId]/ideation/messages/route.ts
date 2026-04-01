import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { IdeationPhase as IdeationPhaseEnum } from '@/generated/prisma/client'
import {
  getLatestConversation,
  getMessages,
} from '@/lib/project-component/ideation/conversation-manager'
import { IDEATION_PHASE_VALUES } from '@/lib/validations/blueprint'

// TODO(Ring-5): Add authentication + authorization middleware

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
      // Validate phase is a known enum value
      if (!(IDEATION_PHASE_VALUES as readonly string[]).includes(phaseFilter)) {
        return NextResponse.json(
          { error: `Invalid phase "${phaseFilter}". Must be one of: ${IDEATION_PHASE_VALUES.join(', ')}` },
          { status: 400 }
        )
      }

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

    // Default: get ALL conversations with their messages (for full chat history)
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

    if (conversations.length === 0) {
      return NextResponse.json({
        conversationId: null,
        phase: blueprint.ideationPhase,
        messages: [],
        conversations: [],
        groupedByPhase: [],
      })
    }

    // Fetch messages from ALL conversations, grouped by phase
    const groupedByPhase = []
    for (const convo of conversations) {
      const convoMessages = await getMessages(convo.id)
      if (convoMessages.length > 0) {
        groupedByPhase.push({
          conversationId: convo.id,
          phase: convo.phase,
          messages: convoMessages,
        })
      }
    }

    // Flatten all messages for backward compatibility
    const allMessages = groupedByPhase.flatMap(g => g.messages)
    const latestConvo = conversations[conversations.length - 1]

    return NextResponse.json({
      conversationId: latestConvo.id,
      phase: latestConvo.phase,
      messages: allMessages,
      conversations: conversations.map(c => ({
        id: c.id,
        phase: c.phase,
        messageCount: c._count.messages,
        createdAt: c.createdAt,
      })),
      groupedByPhase,
    })
  } catch (error) {
    console.error('GET /api/blueprints/[blueprintId]/ideation/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
