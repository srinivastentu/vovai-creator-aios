import { NextResponse } from 'next/server'
import { loadPipelineState } from '@/lib/domain/workflows/pipeline-persistence'
import {
  getCurrentStage,
  getPipelineProgress,
} from '@/lib/domain/workflows/pipeline-orchestrator'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    // 1. Load pipeline
    const pipeline = await loadPipelineState(blueprintId)
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // 2. Get progress
    const progress = getPipelineProgress(pipeline)
    const currentStage = getCurrentStage(pipeline)

    // 3. Build stage summaries
    const stages = pipeline.stages.map((stage) => {
      const state = pipeline.stageStates[stage.id]
      return {
        id: stage.id,
        status: state?.status ?? 'idle',
        loopCount: state?.loopCount ?? 0,
        bestScore: state?.bestGrade?.overallScore ?? null,
      }
    })

    // 4. Build current stage summary
    const currentStageSummary = currentStage
      ? {
          id: currentStage.id,
          status: pipeline.stageStates[currentStage.id]?.status ?? 'idle',
          loopCount: pipeline.stageStates[currentStage.id]?.loopCount ?? 0,
          bestScore: pipeline.stageStates[currentStage.id]?.bestGrade?.overallScore ?? null,
        }
      : null

    return NextResponse.json({
      pipelineId: pipeline.id,
      status: pipeline.status,
      progress,
      currentStage: currentStageSummary,
      stages,
    }, { status: 200 })
  } catch (error) {
    console.error('GET /pipeline/state error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
