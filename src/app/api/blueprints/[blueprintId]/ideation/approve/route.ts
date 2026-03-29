import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { approveSchema } from '@/lib/validations/ideation'
import { formatZodError } from '@/lib/validations/blueprint'
import {
  getLatestConversation,
  addMessage,
  getMessages,
  updateConversationPhase,
} from '@/lib/project-component/ideation/conversation-manager'
import { createInitialState } from '@/lib/project-component/ideation/phase-manager'
import type { IdeationLoopState } from '@/lib/project-component/ideation/phase-manager'
import { processHumanFeedback, runIdeationStep } from '@/lib/project-component/ideation/loop-engine'
import type { IdeationPhase, ProjectArchetype } from '@/lib/project-component/types'

/**
 * POST /api/blueprints/[blueprintId]/ideation/approve
 *
 * Submit a human review action during the review phase.
 *
 * Actions:
 * - approve: Lock blueprint, advance to approved (ready for configuration wizard)
 * - feedback: Return to refinement with specific feedback
 * - restructure: Fresh start from brainstorm (keeps brief + audience)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()

    const parsed = approveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    // Verify blueprint exists and is in review phase
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    if (blueprint.ideationPhase !== 'review') {
      return NextResponse.json(
        { error: `Cannot approve/feedback in ${blueprint.ideationPhase} phase. Must be in review.` },
        { status: 400 }
      )
    }

    const conversation = await getLatestConversation(blueprintId)
    if (!conversation) {
      return NextResponse.json(
        { error: 'No active conversation. Call /ideation/start first.' },
        { status: 400 }
      )
    }

    // Persist the human's review action
    await addMessage({
      conversationId: conversation.id,
      role: 'human',
      content: parsed.data.message || `Action: ${parsed.data.action}`,
      messageType: 'decision',
      structuredData: { action: parsed.data.action },
    })

    // Rebuild state and process the feedback
    const state = rebuildStateForReview(blueprintId, blueprint, conversation)
    const updatedState = await processHumanFeedback(state, {
      action: parsed.data.action,
      message: parsed.data.message,
    })

    // Determine the response message
    let responseMessage: string
    switch (parsed.data.action) {
      case 'approve':
        responseMessage = 'Blueprint approved. Ready for configuration wizard.'
        break
      case 'feedback':
        responseMessage = 'Feedback received. Returning to refinement with your guidance.'
        break
      case 'restructure':
        responseMessage = 'Restructuring. Starting fresh approach (brief and audience profile retained).'
        break
    }

    // Persist the system response
    await addMessage({
      conversationId: conversation.id,
      role: 'facilitator',
      content: responseMessage,
      messageType: 'decision',
      structuredData: {
        action: parsed.data.action,
        phase: updatedState.currentPhase,
      },
    })

    // Update conversation and blueprint phase
    await updateConversationPhase(conversation.id, updatedState.currentPhase)
    await db.projectBlueprint.update({
      where: { id: blueprintId },
      data: { ideationPhase: updatedState.currentPhase },
    })

    // If feedback or restructure, auto-run the next step
    let nextStepResult = null
    if (parsed.data.action !== 'approve') {
      const stepResult = await runIdeationStep(updatedState, parsed.data.message)

      await addMessage({
        conversationId: conversation.id,
        role: 'facilitator',
        content: stepResult.humanMessage,
        messageType: 'structure_update',
        structuredData: {
          phase: stepResult.updatedState.currentPhase,
          costUSD: stepResult.stepCostUSD,
        },
      })

      if (stepResult.updatedState.currentPhase !== updatedState.currentPhase) {
        await updateConversationPhase(conversation.id, stepResult.updatedState.currentPhase)
        await db.projectBlueprint.update({
          where: { id: blueprintId },
          data: { ideationPhase: stepResult.updatedState.currentPhase },
        })
      }

      nextStepResult = {
        phase: stepResult.updatedState.currentPhase,
        awaitingHuman: stepResult.awaitingHuman,
        message: stepResult.humanMessage,
        costUSD: stepResult.stepCostUSD,
      }
    }

    const messages = await getMessages(conversation.id)

    return NextResponse.json({
      conversationId: conversation.id,
      action: parsed.data.action,
      phase: nextStepResult?.phase ?? updatedState.currentPhase,
      awaitingHuman: nextStepResult?.awaitingHuman ?? (parsed.data.action === 'approve'),
      message: responseMessage,
      nextStep: nextStepResult,
      costUSD: nextStepResult?.costUSD ?? 0,
      messages,
      state: updatedState,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/approve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rebuildStateForReview(
  blueprintId: string,
  blueprint: {
    ideationPhase: string
    archetype: string | null
    targetAudience: unknown
    structureSummary: unknown
  },
  conversation: {
    messages: Array<{
      role: string
      content: string
      messageType: string
      structuredData: unknown
    }>
  }
): IdeationLoopState {
  const firstHumanMsg = conversation.messages.find(m => m.role === 'human')
  const brief = firstHumanMsg?.content ?? ''

  let archetype: ProjectArchetype | null = blueprint.archetype as ProjectArchetype | null
  for (const msg of conversation.messages) {
    const data = msg.structuredData as Record<string, unknown> | null
    if (data?.archetype) {
      archetype = data.archetype as ProjectArchetype
    }
  }

  const state = createInitialState(blueprintId, brief)
  state.currentPhase = 'review'
  state.archetype = archetype

  // Rebuild conversation history
  state.conversationHistory = conversation.messages.map((m, i) => ({
    id: `msg-${i}`,
    conversationId: '',
    role: m.role as IdeationLoopState['conversationHistory'][number]['role'],
    messageType: m.messageType as IdeationLoopState['conversationHistory'][number]['messageType'],
    content: m.content,
    structuredData: (m.structuredData as Record<string, unknown>) ?? undefined,
    createdAt: new Date(),
  }))

  return state
}
