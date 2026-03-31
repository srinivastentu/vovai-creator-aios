/**
 * Production Handoff — bridges Project Component layer to the production pipeline.
 *
 * executeHandoff() loads the approved blueprint, groups components by pipeline
 * phase, creates one StageSession per component (the production job), links
 * each NodeComponent.pipelineJobId to it, and batches videos in groups of 10.
 *
 * The entire operation runs in a single Prisma transaction: all-or-nothing.
 */

import { db } from '@/lib/db'
import { COMPONENT_REGISTRY } from '../component-registry'
import { PIPELINE_PHASE_ORDER } from '../workflow-defaults'
import { estimateProjectCost } from './cost-estimator'
import type { CostEstimate } from './cost-estimator'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HandoffResult {
  totalJobs: number
  jobsByPhase: {
    documents: number
    assessments: number
    videos: number
    activities: number
    capstone: number
    meta: number
  }
  videoBatchCount: number
  videoBatches: VideoBatch[]
  estimatedCost: CostEstimate
  createdSessionIds: string[]
}

export interface VideoBatch {
  batchIndex: number
  componentIds: string[]
  sessionIds: string[]
}

// ─── Pipeline phase → first stage ID mapping ────────────────────────────────
// Each pipeline type starts at its first stage.
// These are logical stage IDs for the production pipeline.

const FIRST_STAGE_BY_PIPELINE: Record<string, number> = {
  document: 100,   // D1: Content Research & Outline
  assessment: 200, // A1: Outcome-to-Question Mapping
  video: 1,        // V1: Discovery & Research (matches existing STAGES[0].id)
  activity: 400,   // T1: Activity Design
  capstone: 500,   // C1: Capstone Design
  meta: 600,       // M1: Meta generation
}

// ─── Pipeline phase grouping ────────────────────────────────────────────────

type PhaseKey = 'documents' | 'assessments' | 'videos' | 'activities' | 'capstone' | 'meta'

const PIPELINE_TYPE_TO_PHASE: Record<string, PhaseKey> = {
  document: 'documents',
  assessment: 'assessments',
  video: 'videos',
  activity: 'activities',
  capstone: 'capstone',
  meta: 'meta',
}

const VIDEO_BATCH_SIZE = 10

// ─── Handoff ────────────────────────────────────────────────────────────────

export async function executeHandoff(blueprintId: string): Promise<HandoffResult> {
  // 1. Load approved blueprint with all nodes and components
  const blueprint = await db.projectBlueprint.findUnique({
    where: { id: blueprintId },
    include: {
      nodes: {
        include: { components: true },
        orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  })

  if (!blueprint) {
    throw new HandoffError('BLUEPRINT_NOT_FOUND', `Blueprint ${blueprintId} not found`)
  }

  // 2. Validate: must be approved
  if (blueprint.ideationPhase !== 'approved') {
    throw new HandoffError(
      'NOT_APPROVED',
      `Blueprint must be in "approved" phase, currently "${blueprint.ideationPhase}"`
    )
  }

  // 3. Collect all components with their pipeline type
  const allComponents: ComponentForHandoff[] = []
  for (const node of blueprint.nodes) {
    for (const comp of node.components) {
      // Skip already queued / in-production / completed / skipped
      if (comp.status !== 'planned' && comp.status !== 'configured') continue

      const def = COMPONENT_REGISTRY[comp.componentType]
      if (!def) continue

      allComponents.push({
        id: comp.id,
        nodeId: comp.nodeId,
        componentType: comp.componentType,
        pipelineType: def.pipelineType,
        phaseKey: PIPELINE_TYPE_TO_PHASE[def.pipelineType] ?? 'meta',
        phaseOrder: PIPELINE_PHASE_ORDER[def.pipelineType] ?? 99,
      })
    }
  }

  if (allComponents.length === 0) {
    throw new HandoffError('NO_COMPONENTS', 'No eligible components found for production')
  }

  // 4. Sort by production order
  allComponents.sort((a, b) => a.phaseOrder - b.phaseOrder)

  // 5. Compute cost estimate
  const componentTypes = allComponents.map(c => c.componentType)
  const estimatedCost = estimateProjectCost(componentTypes)

  // 6. Execute all-or-nothing in a transaction
  const result = await db.$transaction(async (tx) => {
    const jobsByPhase: HandoffResult['jobsByPhase'] = {
      documents: 0,
      assessments: 0,
      videos: 0,
      activities: 0,
      capstone: 0,
      meta: 0,
    }
    const createdSessionIds: string[] = []
    const videoBatches: VideoBatch[] = []

    // Group video components for batching
    const videoComponents = allComponents.filter(c => c.pipelineType === 'video')
    const nonVideoComponents = allComponents.filter(c => c.pipelineType !== 'video')

    // 6a. Create sessions for non-video components (one per component)
    for (const comp of nonVideoComponents) {
      const stageId = FIRST_STAGE_BY_PIPELINE[comp.pipelineType] ?? 600
      const session = await tx.stageSession.create({
        data: {
          projectId: blueprint.projectId,
          stageId,
          status: 'idle',
        },
      })

      await tx.nodeComponent.update({
        where: { id: comp.id },
        data: {
          pipelineJobId: session.id,
          status: 'queued',
        },
      })

      createdSessionIds.push(session.id)
      jobsByPhase[comp.phaseKey]++
    }

    // 6b. Batch videos in groups of VIDEO_BATCH_SIZE
    for (let i = 0; i < videoComponents.length; i += VIDEO_BATCH_SIZE) {
      const batch = videoComponents.slice(i, i + VIDEO_BATCH_SIZE)
      const batchIndex = Math.floor(i / VIDEO_BATCH_SIZE)
      const batchSessionIds: string[] = []

      for (const comp of batch) {
        const stageId = FIRST_STAGE_BY_PIPELINE.video
        const session = await tx.stageSession.create({
          data: {
            projectId: blueprint.projectId,
            stageId,
            status: 'idle',
            bestGrade: {
              batchIndex,
              batchSize: batch.length,
              componentType: comp.componentType,
            },
          },
        })

        await tx.nodeComponent.update({
          where: { id: comp.id },
          data: {
            pipelineJobId: session.id,
            status: 'queued',
          },
        })

        createdSessionIds.push(session.id)
        batchSessionIds.push(session.id)
        jobsByPhase.videos++
      }

      videoBatches.push({
        batchIndex,
        componentIds: batch.map(c => c.id),
        sessionIds: batchSessionIds,
      })
    }

    // 6c. Update project status to in_progress
    await tx.project.update({
      where: { id: blueprint.projectId },
      data: { status: 'in_progress' },
    })

    return {
      totalJobs: createdSessionIds.length,
      jobsByPhase,
      videoBatchCount: videoBatches.length,
      videoBatches,
      estimatedCost,
      createdSessionIds,
    }
  })

  return result
}

// ─── Internal helpers ───────────────────────────────────────────────────────

interface ComponentForHandoff {
  id: string
  nodeId: string
  componentType: string
  pipelineType: string
  phaseKey: PhaseKey
  phaseOrder: number
}

// ─── Error class ────────────────────────────────────────────────────────────

export type HandoffErrorCode =
  | 'BLUEPRINT_NOT_FOUND'
  | 'NOT_APPROVED'
  | 'NO_COMPONENTS'
  | 'TRANSACTION_FAILED'

export class HandoffError extends Error {
  code: HandoffErrorCode

  constructor(code: HandoffErrorCode, message: string) {
    super(message)
    this.name = 'HandoffError'
    this.code = code
  }
}
