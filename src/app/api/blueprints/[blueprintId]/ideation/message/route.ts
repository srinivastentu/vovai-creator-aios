import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendMessageSchema } from '@/lib/validations/ideation'
import { formatZodError } from '@/lib/validations/blueprint'
import {
  getLatestConversation,
  addMessage,
  getMessages,
  updateConversationPhase,
} from '@/lib/project-component/ideation/conversation-manager'
import type { IdeationLoopState } from '@/lib/project-component/ideation/phase-manager'
import { runIdeationStep } from '@/lib/project-component/ideation/loop-engine'
import { checkCostLimit, recordIdeationCost } from '@/lib/project-component/ideation/cost-guard'
import { rebuildState } from '@/lib/project-component/ideation/state-rebuilder'

// TODO(Ring-5): Add authentication + authorization middleware
// TODO(Ring-5): Add rate limiting (expensive — triggers LLM call)

/**
 * POST /api/blueprints/[blueprintId]/ideation/message
 *
 * Send a human message during brainstorming. Persists the message,
 * rebuilds loop state from the conversation, and runs the next step.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()

    const parsed = sendMessageSchema.safeParse(body)
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

    // Get active conversation
    const conversation = await getLatestConversation(blueprintId)
    if (!conversation) {
      return NextResponse.json(
        { error: 'No active conversation. Call /ideation/start first.' },
        { status: 400 }
      )
    }

    // Check cost limit before running agents
    const costCheck = await checkCostLimit(blueprintId)
    if (!costCheck.ok) {
      return NextResponse.json(
        { error: 'Ideation cost limit reached. Please start a new session or contact support.' },
        { status: 400 }
      )
    }

    // Persist the human message
    await addMessage({
      conversationId: conversation.id,
      role: 'human',
      content: parsed.data.message,
      messageType: 'text',
    })

    // Rebuild loop state from conversation + blueprint
    const state = await rebuildState(blueprintId, blueprint, conversation)

    // Run the next step
    const result = await runIdeationStep(state, parsed.data.message)

    // Persist the agent response (include accumulated state for rebuild)
    await addMessage({
      conversationId: conversation.id,
      role: 'facilitator',
      content: result.humanMessage,
      messageType: inferMessageType(result),
      structuredData: {
        phase: result.updatedState.currentPhase,
        archetype: result.updatedState.archetype,
        costUSD: result.stepCostUSD,
        awaitingHuman: result.awaitingHuman,
        awaitingAudienceConfirmation: result.updatedState.awaitingAudienceConfirmation,
        audienceProfile: result.updatedState.audienceProfile ?? undefined,
        proposedStructure: result.updatedState.proposedStructure ?? undefined,
        outcomesMap: result.updatedState.outcomesMap ?? undefined,
        componentPlan: result.updatedState.componentPlan ?? undefined,
        gradeReport: result.updatedState.gradeReport ?? undefined,
      },
    })

    // Persist cost to Project.totalCostUSD
    await recordIdeationCost(blueprintId, result.stepCostUSD)

    // Update conversation phase if it changed
    if (result.updatedState.currentPhase !== conversation.phase) {
      await updateConversationPhase(conversation.id, result.updatedState.currentPhase)
    }

    // Sync blueprint ideation phase
    await db.projectBlueprint.update({
      where: { id: blueprintId },
      data: { ideationPhase: result.updatedState.currentPhase },
    })

    // Fetch updated messages
    const messages = await getMessages(conversation.id)

    return NextResponse.json({
      conversationId: conversation.id,
      phase: result.updatedState.currentPhase,
      archetype: result.updatedState.archetype,
      awaitingHuman: result.awaitingHuman,
      message: result.humanMessage,
      costUSD: result.stepCostUSD,
      messages,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferMessageType(result: { updatedState: IdeationLoopState; awaitingHuman: boolean }): 'question' | 'decision' | 'structure_update' {
  if (result.updatedState.currentPhase === 'brainstorm' && result.awaitingHuman) {
    return 'question'
  }
  if (result.updatedState.currentPhase === 'structure' || result.updatedState.currentPhase === 'refinement') {
    return 'structure_update'
  }
  return 'decision'
}
