import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  Prisma,
  type ProjectArchetype,
  type IdeationPhase,
  type NodeStatus,
  type ComponentPriority,
  type ComponentStatus,
} from '@/generated/prisma/client'

// TODO(Ring-5): Add authentication + authorization middleware

interface SnapshotNode {
  id: string
  blueprintId: string
  parentId: string | null
  title: string
  slug: string
  description: string | null
  notes: string | null
  depth: number
  sortOrder: number
  learningOutcomes: unknown
  status: string
  agentConfidence: number | null
  path: string
}

interface SnapshotComponent {
  id: string
  nodeId: string
  componentType: string
  config: Record<string, unknown>
  priority: string
  status: string
  relevanceScore: number | null
  pipelineJobId: string | null
}

interface Snapshot {
  blueprint: {
    archetype: string
    hierarchyLabels: Record<string, string>
    targetAudience: Record<string, unknown>
    learningOutcomes: unknown[]
    enabledComponents: string[]
    ideationPhase: string
    ideationScore: number | null
    structureSummary: Record<string, unknown> | null
  }
  nodes: SnapshotNode[]
  components: SnapshotComponent[]
}

/**
 * POST /api/blueprints/[blueprintId]/versions/[version]/restore
 * Restore a blueprint to a specific version snapshot.
 *
 * Deletes all current nodes+components and recreates from snapshot.
 * Runs in a transaction for atomicity.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string; version: string }> }
) {
  try {
    const { blueprintId, version: versionStr } = await params
    const versionNum = parseInt(versionStr, 10)

    if (isNaN(versionNum) || versionNum < 1) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 })
    }

    const versionRecord = await db.blueprintVersion.findUnique({
      where: { blueprintId_version: { blueprintId, version: versionNum } },
    })

    if (!versionRecord) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const snapshot = versionRecord.snapshot as unknown as Snapshot

    // Restore in a transaction: delete current state, recreate from snapshot
    const result = await db.$transaction(async (tx) => {
      // 1. Delete all current components (depends on nodes)
      await tx.nodeComponent.deleteMany({ where: { node: { blueprintId } } })

      // 2. Delete all current nodes
      await tx.projectNode.deleteMany({ where: { blueprintId } })

      // 3. Update blueprint fields from snapshot
      await tx.projectBlueprint.update({
        where: { id: blueprintId },
        data: {
          archetype: snapshot.blueprint.archetype as ProjectArchetype,
          hierarchyLabels: snapshot.blueprint.hierarchyLabels as Prisma.InputJsonValue,
          targetAudience: snapshot.blueprint.targetAudience as Prisma.InputJsonValue,
          learningOutcomes: snapshot.blueprint.learningOutcomes as Prisma.InputJsonValue,
          enabledComponents: snapshot.blueprint.enabledComponents as Prisma.InputJsonValue,
          ideationPhase: snapshot.blueprint.ideationPhase as IdeationPhase,
          ideationScore: snapshot.blueprint.ideationScore,
          structureSummary: snapshot.blueprint.structureSummary as Prisma.InputJsonValue,
        },
      })

      // 4. Recreate nodes — insert roots first, then children (respecting parentId FK)
      const sortedNodes = [...snapshot.nodes].sort((a, b) => a.depth - b.depth)
      for (const node of sortedNodes) {
        await tx.projectNode.create({
          data: {
            id: node.id,
            blueprintId: node.blueprintId,
            parentId: node.parentId,
            title: node.title,
            slug: node.slug,
            description: node.description,
            notes: node.notes,
            depth: node.depth,
            sortOrder: node.sortOrder,
            learningOutcomes: node.learningOutcomes as Prisma.InputJsonValue,
            status: node.status as NodeStatus,
            agentConfidence: node.agentConfidence,
            path: node.path,
          },
        })
      }

      // 5. Recreate components
      for (const comp of snapshot.components) {
        await tx.nodeComponent.create({
          data: {
            id: comp.id,
            nodeId: comp.nodeId,
            componentType: comp.componentType,
            config: comp.config as Prisma.InputJsonValue,
            priority: comp.priority as ComponentPriority,
            status: comp.status as ComponentStatus,
            relevanceScore: comp.relevanceScore,
            pipelineJobId: comp.pipelineJobId,
          },
        })
      }

      // 6. Return restored blueprint with all relations
      return tx.projectBlueprint.findUnique({
        where: { id: blueprintId },
        include: {
          nodes: {
            include: { components: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })
    })

    return NextResponse.json({
      message: `Restored to version ${versionNum}`,
      blueprint: result,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/versions/[version]/restore error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
