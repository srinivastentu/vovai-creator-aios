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
import { processHumanFeedback, runIdeationStep } from '@/lib/project-component/ideation/loop-engine'
import { materializeStructure } from '@/lib/project-component/ideation/materializer'
import { checkCostLimit, recordIdeationCost } from '@/lib/project-component/ideation/cost-guard'
import { rebuildState } from '@/lib/project-component/ideation/state-rebuilder'

// TODO(Ring-5): Add authentication + authorization middleware
// TODO(Ring-5): Add rate limiting (expensive — triggers LLM call)

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

    // Rebuild state and process the feedback (shared state-rebuilder)
    const state = await rebuildState(blueprintId, blueprint, conversation)
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

    // Persist the system response (include accumulated state for rebuild)
    await addMessage({
      conversationId: conversation.id,
      role: 'facilitator',
      content: responseMessage,
      messageType: 'decision',
      structuredData: {
        action: parsed.data.action,
        phase: updatedState.currentPhase,
        archetype: updatedState.archetype ?? undefined,
        audienceProfile: updatedState.audienceProfile ?? undefined,
        proposedStructure: updatedState.proposedStructure ?? undefined,
        outcomesMap: updatedState.outcomesMap ?? undefined,
        componentPlan: updatedState.componentPlan ?? undefined,
        gradeReport: updatedState.gradeReport ?? undefined,
      },
    })

    // Update conversation and blueprint phase
    await updateConversationPhase(conversation.id, updatedState.currentPhase)
    await db.projectBlueprint.update({
      where: { id: blueprintId },
      data: { ideationPhase: updatedState.currentPhase },
    })

    // On approval, materialize the proposed structure into ProjectNode + NodeComponent records
    let materializeResult = null
    if (parsed.data.action === 'approve' && updatedState.proposedStructure) {
      materializeResult = await materializeStructure(
        blueprintId,
        updatedState.proposedStructure,
        updatedState.componentPlan ?? null,
        updatedState.archetype ?? null,
      )
    }

    // If feedback or restructure, auto-run the next step (with cost check)
    let nextStepResult = null
    if (parsed.data.action !== 'approve') {
      const costCheck = await checkCostLimit(blueprintId)
      if (!costCheck.ok) {
        return NextResponse.json(
          { error: 'Ideation cost limit reached. Please start a new session or contact support.' },
          { status: 400 }
        )
      }

      const stepResult = await runIdeationStep(updatedState, parsed.data.message)

      await addMessage({
        conversationId: conversation.id,
        role: 'facilitator',
        content: stepResult.humanMessage,
        messageType: 'structure_update',
        structuredData: {
          phase: stepResult.updatedState.currentPhase,
          costUSD: stepResult.stepCostUSD,
          archetype: stepResult.updatedState.archetype ?? undefined,
          audienceProfile: stepResult.updatedState.audienceProfile ?? undefined,
          proposedStructure: stepResult.updatedState.proposedStructure ?? undefined,
          outcomesMap: stepResult.updatedState.outcomesMap ?? undefined,
          componentPlan: stepResult.updatedState.componentPlan ?? undefined,
          gradeReport: stepResult.updatedState.gradeReport ?? undefined,
        },
      })

      // Persist cost to Project.totalCostUSD
      await recordIdeationCost(blueprintId, stepResult.stepCostUSD)

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
      materializeResult,
      messages,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/approve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

