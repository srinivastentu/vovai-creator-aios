import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatZodError } from '@/lib/validations/blueprint'
import {
  getLatestConversation,
  addMessage,
  getMessages,
  updateConversationPhase,
} from '@/lib/project-component/ideation/conversation-manager'
import type { IdeationLoopState } from '@/lib/project-component/ideation/phase-manager'
import { runIdeationStep } from '@/lib/project-component/ideation/loop-engine'
import { checkCostLimit } from '@/lib/project-component/ideation/cost-guard'
import { rebuildState } from '@/lib/project-component/ideation/state-rebuilder'
import { z } from 'zod'

// TODO(Ring-5): Add authentication + authorization middleware
// TODO(Ring-5): Add rate limiting (expensive — triggers LLM call)

const confirmAudienceSchema = z.object({
  action: z.enum(['confirm', 'revise']),
  message: z.string().optional(),
})

/**
 * POST /api/blueprints/[blueprintId]/ideation/confirm-audience
 *
 * Human confirms or requests revision of the audience profile during
 * structure phase. On confirm, triggers curriculum strategist. On revise,
 * re-runs audience analyst with fresh context.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()

    const parsed = confirmAudienceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    const { action, message: humanMessage } = parsed.data

    // Verify blueprint exists and is in structure phase
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }
    if (blueprint.ideationPhase !== 'structure') {
      return NextResponse.json(
        { error: `Cannot confirm audience — blueprint is in '${blueprint.ideationPhase}' phase, expected 'structure'.` },
        { status: 400 }
      )
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

    // Persist the human action as a message
    const humanContent = action === 'confirm'
      ? (humanMessage ?? 'Audience profile looks good — please proceed with the course structure.')
      : (humanMessage ?? 'Please revise the audience profile.')

    await addMessage({
      conversationId: conversation.id,
      role: 'human',
      content: humanContent,
      messageType: 'text',
    })

    // Rebuild state from conversation
    const state = await rebuildState(blueprintId, blueprint, conversation)

    // Apply action to state flags before running the next step
    let nextState: IdeationLoopState
    if (action === 'confirm') {
      // Clear the confirmation flag so the switch case proceeds to curriculum design
      nextState = { ...state, awaitingAudienceConfirmation: false }
    } else {
      // Revise: clear audience profile so audience analyst runs again
      nextState = { ...state, audienceProfile: null, awaitingAudienceConfirmation: false }
    }

    // Run the next step
    const result = await runIdeationStep(nextState)

    // Persist the agent response
    await addMessage({
      conversationId: conversation.id,
      role: 'facilitator',
      content: result.humanMessage,
      messageType: inferMessageType(result),
      structuredData: {
        phase: result.updatedState.currentPhase,
        awaitingAudienceConfirmation: result.updatedState.awaitingAudienceConfirmation,
        audienceProfile: result.updatedState.audienceProfile ?? undefined,
        proposedStructure: result.updatedState.proposedStructure ?? undefined,
        costUSD: result.stepCostUSD,
        awaitingHuman: result.awaitingHuman,
      },
    })

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
      awaitingAudienceConfirmation: result.updatedState.awaitingAudienceConfirmation,
      awaitingHuman: result.awaitingHuman,
      message: result.humanMessage,
      costUSD: result.stepCostUSD,
      messages,
      state: result.updatedState,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/confirm-audience error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferMessageType(result: { updatedState: IdeationLoopState; awaitingHuman: boolean }): 'question' | 'decision' | 'structure_update' {
  if (result.updatedState.awaitingAudienceConfirmation) {
    return 'question'
  }
  if (result.updatedState.currentPhase === 'structure' || result.updatedState.currentPhase === 'refinement') {
    return 'structure_update'
  }
  return 'decision'
}
