import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { triggerGradeSchema } from '@/lib/validations/ideation'
import { formatZodError } from '@/lib/validations/blueprint'
import {
  getLatestConversation,
  addMessage,
  updateConversationPhase,
} from '@/lib/project-component/ideation/conversation-manager'
import { runIdeationStep } from '@/lib/project-component/ideation/loop-engine'
import { checkCostLimit, recordIdeationCost } from '@/lib/project-component/ideation/cost-guard'
import { rebuildState } from '@/lib/project-component/ideation/state-rebuilder'
import type { IdeationPhase } from '@/lib/project-component/types'

// TODO(Ring-5): Add authentication + authorization middleware
// TODO(Ring-5): Add rate limiting (expensive — triggers LLM call)

/**
 * POST /api/blueprints/[blueprintId]/ideation/grade
 *
 * Trigger grading of the current structure. This advances the loop engine
 * through the refinement phase — running outcome architect, component
 * recommender, structure optimizer, rubric grader, and devil's advocate.
 *
 * The engine auto-routes: score >= 75 → review, else → another refinement loop.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json().catch(() => ({}))

    const parsed = triggerGradeSchema.safeParse(body)
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

    // Must be in structure or refinement phase to grade
    const phase = blueprint.ideationPhase as IdeationPhase
    if (phase !== 'structure' && phase !== 'refinement') {
      return NextResponse.json(
        { error: `Cannot grade in ${phase} phase. Must be in structure or refinement.` },
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

    const conversation = await getLatestConversation(blueprintId)
    if (!conversation) {
      return NextResponse.json(
        { error: 'No active conversation. Call /ideation/start first.' },
        { status: 400 }
      )
    }

    // Rebuild state from conversation (shared state-rebuilder)
    const state = await rebuildState(blueprintId, blueprint, conversation)

    // Run the step — if in structure phase, this will advance to refinement
    // and then run the refinement agents. If already in refinement, it runs
    // another refinement cycle.
    let result = await runIdeationStep(state)

    // If we just came from structure → refinement, the step advanced the phase
    // but refinement itself needs to run. Auto-continue if not awaiting human.
    if (!result.awaitingHuman && result.updatedState.currentPhase === 'refinement') {
      const costCheck2 = await checkCostLimit(blueprintId)
      if (!costCheck2.ok) {
        return NextResponse.json(
          { error: 'Ideation cost limit reached during auto-continuation.' },
          { status: 400 }
        )
      }
      result = await runIdeationStep(result.updatedState)
    }

    // Persist cost to Project.totalCostUSD
    await recordIdeationCost(blueprintId, result.stepCostUSD)

    // Persist the grading result as a message (include accumulated state for rebuild)
    await addMessage({
      conversationId: conversation.id,
      role: 'critic',
      content: result.humanMessage,
      messageType: 'structure_update',
      structuredData: {
        phase: result.updatedState.currentPhase,
        loopCount: result.updatedState.loopCount,
        costUSD: result.stepCostUSD,
        archetype: result.updatedState.archetype ?? undefined,
        audienceProfile: result.updatedState.audienceProfile ?? undefined,
        proposedStructure: result.updatedState.proposedStructure ?? undefined,
        outcomesMap: result.updatedState.outcomesMap ?? undefined,
        componentPlan: result.updatedState.componentPlan ?? undefined,
        gradeReport: result.updatedState.gradeReport ?? undefined,
      },
    })

    // Update conversation phase
    if (result.updatedState.currentPhase !== conversation.phase) {
      await updateConversationPhase(conversation.id, result.updatedState.currentPhase)
    }

    // Sync blueprint
    await db.projectBlueprint.update({
      where: { id: blueprintId },
      data: { ideationPhase: result.updatedState.currentPhase },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      phase: result.updatedState.currentPhase,
      loopCount: result.updatedState.loopCount,
      gradeReport: result.updatedState.gradeReport,
      awaitingHuman: result.awaitingHuman,
      message: result.humanMessage,
      costUSD: result.stepCostUSD,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/grade error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

