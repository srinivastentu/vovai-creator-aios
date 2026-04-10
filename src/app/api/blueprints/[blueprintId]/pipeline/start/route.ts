import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createElearnIdeationPipeline } from '@/lib/domain/workflows/ideation/pipeline-config'
import { savePipelineState, loadPipelineState } from '@/lib/domain/workflows/pipeline-persistence'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    // 1. Validate blueprint exists
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // 2. Check if pipeline already exists (409 Conflict)
    const existing = await loadPipelineState(blueprintId)
    if (existing) {
      return NextResponse.json(
        { error: 'Pipeline already exists for this blueprint' },
        { status: 409 }
      )
    }

    // 3. Create pipeline
    const pipeline = createElearnIdeationPipeline(blueprintId)

    // 4. Persist
    await savePipelineState(blueprintId, pipeline)

    // 5. Return summary
    const currentStage = pipeline.stages[pipeline.currentStageIndex]
    return NextResponse.json({
      pipelineId: pipeline.id,
      currentStage: { id: currentStage.id, name: currentStage.id },
      totalStages: pipeline.stages.length,
      status: pipeline.status,
    }, { status: 200 })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/pipeline/start error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
