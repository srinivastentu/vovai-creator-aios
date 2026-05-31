import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'

// TODO(Ring-5): Add authentication + authorization middleware

/**
 * POST /api/blueprints/[blueprintId]/versions
 * Create a version snapshot of the current blueprint state.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
      include: {
        nodes: {
          include: { components: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // Determine next version number
    const latestVersion = await db.blueprintVersion.findFirst({
      where: { blueprintId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (latestVersion?.version ?? 0) + 1

    // Flatten components from nested nodes
    const allComponents = blueprint.nodes.flatMap(n => n.components)

    // Build snapshot — strip Prisma internals, keep portable data
    const snapshot = {
      version: nextVersion,
      createdAt: new Date().toISOString(),
      blueprint: {
        id: blueprint.id,
        projectId: blueprint.projectId,
        archetype: blueprint.archetype,
        hierarchyLabels: blueprint.hierarchyLabels,
        targetAudience: blueprint.targetAudience,
        learningOutcomes: blueprint.learningOutcomes,
        enabledComponents: blueprint.enabledComponents,
        ideationPhase: blueprint.ideationPhase,
        ideationScore: blueprint.ideationScore,
        structureSummary: blueprint.structureSummary,
      },
      nodes: blueprint.nodes.map(n => ({
        id: n.id,
        blueprintId: n.blueprintId,
        parentId: n.parentId,
        title: n.title,
        slug: n.slug,
        description: n.description,
        notes: n.notes,
        depth: n.depth,
        sortOrder: n.sortOrder,
        learningOutcomes: n.learningOutcomes,
        status: n.status,
        agentConfidence: n.agentConfidence,
        path: n.path,
      })),
      components: allComponents.map(c => ({
        id: c.id,
        nodeId: c.nodeId,
        componentType: c.componentType,
        config: c.config,
        priority: c.priority,
        status: c.status,
        relevanceScore: c.relevanceScore,
        pipelineJobId: c.pipelineJobId,
      })),
    }

    const version = await db.blueprintVersion.create({
      data: {
        blueprintId,
        version: nextVersion,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/versions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/blueprints/[blueprintId]/versions
 * List all version snapshots for a blueprint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
      select: { id: true },
    })

    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    const versions = await db.blueprintVersion.findMany({
      where: { blueprintId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        rubricScore: true,
        createdAt: true,
      },
    })

    return NextResponse.json(versions)
  } catch (error) {
    console.error('GET /api/blueprints/[blueprintId]/versions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
