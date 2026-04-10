import { NextResponse } from 'next/server'
import { runStageSchema } from '@/lib/validations/pipeline'
import { formatZodError } from '@/lib/validations/blueprint'
import { loadPipelineState, savePipelineState } from '@/lib/domain/workflows/pipeline-persistence'
import { getCurrentStage, runCurrentStage } from '@/lib/domain/workflows/pipeline-orchestrator'
import { createMockAgentExecutor, createMockJudge } from '@/lib/domain/workflows/pipeline-mocks'
import { getOrCreateStageConversation, addMessage } from '@/lib/domain/workflows/ideation/conversation-manager'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string; stageId: string }> }
) {
  try {
    const { blueprintId, stageId } = await params

    // 1. Parse and validate body
    let body: unknown = {}
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      body = await request.json()
    }
    const parsed = runStageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    // 2. Load pipeline
    const pipeline = await loadPipelineState(blueprintId)
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // 3. Verify stageId matches current stage
    const currentStage = getCurrentStage(pipeline)
    if (!currentStage) {
      return NextResponse.json({ error: 'Pipeline is complete' }, { status: 400 })
    }
    if (currentStage.id !== stageId) {
      return NextResponse.json(
        { error: `Stage '${stageId}' is not the current stage. Current: '${currentStage.id}'` },
        { status: 400 }
      )
    }

    // 4. Check if already approved
    const stageState = pipeline.stageStates[stageId]
    if (stageState?.status === 'approved') {
      return NextResponse.json(
        { error: `Stage '${stageId}' is already approved` },
        { status: 409 }
      )
    }

    // 5. Run one iteration with mocks
    const agentExecutor = createMockAgentExecutor()
    const judge = createMockJudge()
    const context = parsed.data.context ?? {}

    const { pipeline: updated, stageState: newState, gate } =
      await runCurrentStage(pipeline, context, agentExecutor, judge)

    // 6. Translate presenting → awaiting_review (Option A)
    //    The client should never see 'presenting' — it's an engine-internal state.
    let finalState = newState
    if (newState.status === 'presenting') {
      finalState = { ...newState, status: 'awaiting_review' as const }
      updated.stageStates[stageId] = finalState
    }

    // 7. Store agent output in stage-specific conversation
    const conversation = await getOrCreateStageConversation(blueprintId, stageId)
    await addMessage({
      conversationId: conversation.id,
      role: 'facilitator',
      content: JSON.stringify(finalState.currentArtifact),
      messageType: 'text',
    })

    // 8. Persist
    await savePipelineState(blueprintId, updated)

    // 9. Return stage state
    return NextResponse.json({
      stageId,
      status: finalState.status,
      loopCount: finalState.loopCount,
      grade: finalState.bestGrade,
      bestScore: finalState.bestGrade?.overallScore ?? null,
      gate: gate ?? null,
    }, { status: 200 })
  } catch (error) {
    console.error('POST /pipeline/stages/[stageId]/run error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
