import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { startIdeationSchema } from '@/lib/validations/ideation'
import { formatZodError } from '@/lib/validations/blueprint'
import { createConversation, addMessage, getLatestConversation } from '@/lib/project-component/ideation/conversation-manager'
import { createInitialState } from '@/lib/project-component/ideation/phase-manager'
import { runIdeationStep } from '@/lib/project-component/ideation/loop-engine'
import { checkCostLimit } from '@/lib/project-component/ideation/cost-guard'

// TODO(Ring-5): Add authentication + authorization middleware
// TODO(Ring-5): Add rate limiting (expensive — triggers LLM call)

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

    // Idempotency: if an active conversation already exists, return it
    // instead of creating a duplicate (prevents double-submit issues)
    const existing = await getLatestConversation(blueprintId)
    if (existing && existing.messages.length > 0) {
      const lastMsg = existing.messages[existing.messages.length - 1]
      const structuredData = lastMsg.structuredData as Record<string, unknown> | null
      return NextResponse.json({
        conversationId: existing.id,
        phase: structuredData?.phase ?? blueprint.ideationPhase,
        archetype: structuredData?.archetype ?? null,
        awaitingHuman: true,
        message: lastMsg.content,
        costUSD: 0,
        duplicate: true,
      }, { status: 200 })
    }

    // Check cost limit before running agents
    const costCheck = await checkCostLimit(blueprintId)
    if (!costCheck.ok) {
      return NextResponse.json(
        { error: 'Ideation cost limit reached. Please start a new session or contact support.' },
        { status: 400 }
      )
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

    // Persist the orchestrator's response (include accumulated state for rebuild)
    await addMessage({
      conversationId: conversation.id,
      role: 'facilitator',
      content: result.humanMessage,
      messageType: result.updatedState.currentPhase === 'brainstorm' ? 'question' : 'decision',
      structuredData: {
        phase: result.updatedState.currentPhase,
        archetype: result.updatedState.archetype,
        costUSD: result.stepCostUSD,
        audienceProfile: result.updatedState.audienceProfile ?? undefined,
        proposedStructure: result.updatedState.proposedStructure ?? undefined,
        outcomesMap: result.updatedState.outcomesMap ?? undefined,
        componentPlan: result.updatedState.componentPlan ?? undefined,
        gradeReport: result.updatedState.gradeReport ?? undefined,
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
