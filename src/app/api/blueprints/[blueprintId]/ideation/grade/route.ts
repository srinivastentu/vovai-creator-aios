import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { triggerGradeSchema } from '@/lib/validations/ideation'
import { formatZodError } from '@/lib/validations/blueprint'
import {
  getLatestConversation,
  addMessage,
  updateConversationPhase,
} from '@/lib/project-component/ideation/conversation-manager'
import { createInitialState } from '@/lib/project-component/ideation/phase-manager'
import type { IdeationLoopState } from '@/lib/project-component/ideation/phase-manager'
import { runIdeationStep } from '@/lib/project-component/ideation/loop-engine'
import type { IdeationPhase, ProjectArchetype } from '@/lib/project-component/types'

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

    const conversation = await getLatestConversation(blueprintId)
    if (!conversation) {
      return NextResponse.json(
        { error: 'No active conversation. Call /ideation/start first.' },
        { status: 400 }
      )
    }

    // Rebuild state from conversation
    const state = rebuildStateForGrading(blueprintId, blueprint, conversation)

    // Run the step — if in structure phase, this will advance to refinement
    // and then run the refinement agents. If already in refinement, it runs
    // another refinement cycle.
    let result = await runIdeationStep(state)

    // If we just came from structure → refinement, the step advanced the phase
    // but refinement itself needs to run. Auto-continue if not awaiting human.
    if (!result.awaitingHuman && result.updatedState.currentPhase === 'refinement') {
      result = await runIdeationStep(result.updatedState)
    }

    // Persist the grading result as a message
    await addMessage({
      conversationId: conversation.id,
      role: 'critic',
      content: result.humanMessage,
      messageType: 'structure_update',
      structuredData: {
        phase: result.updatedState.currentPhase,
        loopCount: result.updatedState.loopCount,
        gradeReport: result.updatedState.gradeReport,
        costUSD: result.stepCostUSD,
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
      state: result.updatedState,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/grade error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rebuildStateForGrading(
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
  state.currentPhase = blueprint.ideationPhase as IdeationPhase
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
