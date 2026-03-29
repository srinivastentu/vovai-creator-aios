import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { startIdeationSchema } from '@/lib/validations/ideation'
import { formatZodError } from '@/lib/validations/blueprint'
import { createConversation, addMessage } from '@/lib/project-component/ideation/conversation-manager'
import { createInitialState } from '@/lib/project-component/ideation/phase-manager'
import { runIdeationStep } from '@/lib/project-component/ideation/loop-engine'

/**
 * POST /api/blueprints/[blueprintId]/ideation/start
 *
 * Begin brainstorming for a blueprint. Creates a conversation,
 * initializes the ideation loop state, and runs the first brainstorm step.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()

    const parsed = startIdeationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    // Verify blueprint exists
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // Create conversation
    const conversation = await createConversation({
      blueprintId,
      phase: 'brainstorm',
    })

    // Persist the human's initial brief as the first message
    await addMessage({
      conversationId: conversation.id,
      role: 'human',
      content: parsed.data.brief,
      messageType: 'text',
    })

    // Initialize loop state and run the first brainstorm step
    const state = createInitialState(blueprintId, parsed.data.brief)
    const result = await runIdeationStep(state, parsed.data.brief)

    // Persist the orchestrator's response
    await addMessage({
      conversationId: conversation.id,
      role: 'facilitator',
      content: result.humanMessage,
      messageType: result.updatedState.currentPhase === 'brainstorm' ? 'question' : 'decision',
      structuredData: {
        phase: result.updatedState.currentPhase,
        archetype: result.updatedState.archetype,
        costUSD: result.stepCostUSD,
      },
    })

    // Update blueprint ideation phase
    await db.projectBlueprint.update({
      where: { id: blueprintId },
      data: { ideationPhase: result.updatedState.currentPhase },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      phase: result.updatedState.currentPhase,
      archetype: result.updatedState.archetype,
      awaitingHuman: result.awaitingHuman,
      message: result.humanMessage,
      costUSD: result.stepCostUSD,
      state: result.updatedState,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/start error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
