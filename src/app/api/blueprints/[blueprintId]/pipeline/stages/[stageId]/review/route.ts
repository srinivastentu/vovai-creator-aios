import { NextResponse } from 'next/server'
import { reviewStageSchema } from '@/lib/validations/pipeline'
import { formatZodError } from '@/lib/validations/blueprint'
import { loadPipelineState, savePipelineState } from '@/lib/domain/workflows/pipeline-persistence'
import {
  getCurrentStage,
  canAdvance,
  advancePipeline,
} from '@/lib/domain/workflows/pipeline-orchestrator'
import { processReview } from '@/lib/core/engine'
import { validateReviewAction, createGate } from '@/lib/core/review'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string; stageId: string }> }
) {
  try {
    const { blueprintId, stageId } = await params

    // 1. Parse and validate body
    const body = await request.json()
    const parsed = reviewStageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    // 2. Load pipeline
    let pipeline = await loadPipelineState(blueprintId)
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // 3. Verify stage exists in pipeline
    const stageConfig = pipeline.stages.find((s) => s.id === stageId)
    if (!stageConfig) {
      return NextResponse.json({ error: `Stage '${stageId}' not found` }, { status: 404 })
    }

    // 4. Get stage state and verify it's awaiting review
    const stageState = pipeline.stageStates[stageId]
    if (!stageState) {
      return NextResponse.json({ error: `No state for stage '${stageId}'` }, { status: 404 })
    }
    if (stageState.status !== 'awaiting_review') {
      return NextResponse.json(
        { error: `Stage '${stageId}' is in '${stageState.status}' state, not 'awaiting_review'` },
        { status: 400 }
      )
    }

    // 5. Build gate and validate action
    const gate = createGate({
      stageId,
      artifactType: stageId,
      allowedActions: stageConfig.reviewGateConfig?.allowedActions,
      requiresRole: stageConfig.reviewerRoles,
    })

    const reviewAction = {
      type: parsed.data.action,
      message: parsed.data.message,
      editedArtifact: parsed.data.editedArtifact,
    }

    const validation = validateReviewAction(reviewAction, stageState, gate)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid review action',
          details: validation.errors.map((e) => e.message),
        },
        { status: 400 }
      )
    }

    // 6. Process review through core engine
    const newState = processReview(stageState, reviewAction)

    // 7. Update pipeline state
    pipeline = {
      ...pipeline,
      stageStates: {
        ...pipeline.stageStates,
        [stageId]: newState,
      },
      updatedAt: new Date(),
    }

    // 8. If approved and can advance, advance pipeline
    let pipelineAdvanced = false
    let nextStage: { id: string } | null = null

    if (newState.status === 'approved' && canAdvance(pipeline)) {
      pipeline = advancePipeline(pipeline)
      pipelineAdvanced = true
      const next = getCurrentStage(pipeline)
      nextStage = next ? { id: next.id } : null
    }

    // 9. Persist
    await savePipelineState(blueprintId, pipeline)

    // 10. Return result
    return NextResponse.json({
      stageId,
      status: newState.status,
      pipelineAdvanced,
      nextStage,
      pipelineStatus: pipeline.status,
    }, { status: 200 })
  } catch (error) {
    console.error('POST /pipeline/stages/[stageId]/review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
