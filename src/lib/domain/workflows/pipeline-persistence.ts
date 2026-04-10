import { db } from '@/lib/db'
import type { IdeationPipeline } from './pipeline-orchestrator'

export const PIPELINE_SENTINEL_STAGE_ID = 0

async function getProjectId(blueprintId: string): Promise<string> {
  const blueprint = await db.projectBlueprint.findUnique({
    where: { id: blueprintId },
    select: { projectId: true },
  })
  if (!blueprint) {
    throw new Error(`Blueprint not found: ${blueprintId}`)
  }
  return blueprint.projectId
}

function serializePipeline(pipeline: IdeationPipeline): string {
  return JSON.stringify(pipeline)
}

function deserializePipeline(data: unknown): IdeationPipeline {
  const raw = typeof data === 'string' ? JSON.parse(data) : data
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  } as IdeationPipeline
}

export async function savePipelineState(
  blueprintId: string,
  pipeline: IdeationPipeline
): Promise<void> {
  const projectId = await getProjectId(blueprintId)
  const serialized = serializePipeline(pipeline)

  const existing = await db.stageSession.findFirst({
    where: { projectId, stageId: PIPELINE_SENTINEL_STAGE_ID },
    select: { id: true },
  })

  if (existing) {
    await db.stageSession.update({
      where: { id: existing.id },
      data: { metadata: serialized, updatedAt: new Date() },
    })
  } else {
    await db.stageSession.create({
      data: {
        projectId,
        stageId: PIPELINE_SENTINEL_STAGE_ID,
        metadata: serialized,
        status: 'idle',
      },
    })
  }
}

export async function loadPipelineState(
  blueprintId: string
): Promise<IdeationPipeline | null> {
  const projectId = await getProjectId(blueprintId)

  const session = await db.stageSession.findFirst({
    where: { projectId, stageId: PIPELINE_SENTINEL_STAGE_ID },
    select: { metadata: true },
  })

  if (!session?.metadata) return null
  return deserializePipeline(session.metadata)
}

export async function deletePipelineState(
  blueprintId: string
): Promise<void> {
  const projectId = await getProjectId(blueprintId)
  await db.stageSession.deleteMany({
    where: { projectId, stageId: PIPELINE_SENTINEL_STAGE_ID },
  })
}
