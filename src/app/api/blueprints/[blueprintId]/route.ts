import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { updateBlueprintSchema, formatZodError } from '@/lib/validations/blueprint'

// TODO(Ring-5): Add authentication + authorization middleware
// TODO(Ring-5): Add rate limiting
export async function GET(
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

    return NextResponse.json(blueprint)
  } catch (error) {
    console.error('GET /api/blueprints/[blueprintId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/blueprints/[blueprintId]
 * Delete a blueprint and ALL related data (nodes, components, conversations,
 * messages, versions, grades) via Prisma cascade.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    const existing = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // Prisma onDelete: Cascade handles all related records:
    // nodes → components, conversations → messages, versions, grades
    await db.projectBlueprint.delete({ where: { id: blueprintId } })

    return NextResponse.json({ deleted: true, blueprintId })
  } catch (error) {
    console.error('DELETE /api/blueprints/[blueprintId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// TODO(Ring-5): Add authentication + authorization middleware
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()
    const result = updateBlueprintSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 })
    }

    const existing = await db.projectBlueprint.findUnique({ where: { id: blueprintId } })
    if (!existing) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // Build update payload — only include fields that were provided
    const data: Record<string, unknown> = {}
    const fields = result.data
    if (fields.archetype !== undefined) data.archetype = fields.archetype
    if (fields.hierarchyLabels !== undefined) data.hierarchyLabels = fields.hierarchyLabels
    if (fields.targetAudience !== undefined) data.targetAudience = fields.targetAudience
    if (fields.enabledComponents !== undefined) data.enabledComponents = fields.enabledComponents
    if (fields.learningOutcomes !== undefined) data.learningOutcomes = fields.learningOutcomes
    if (fields.ideationPhase !== undefined) data.ideationPhase = fields.ideationPhase
    if (fields.structureSummary !== undefined) data.structureSummary = fields.structureSummary
    if (fields.workflowTemplate !== undefined) data.workflowTemplate = fields.workflowTemplate

    // Sync: when workflowTemplate is set, its enabledComponents is the source of truth
    if (data.workflowTemplate && typeof data.workflowTemplate === 'object') {
      const wt = data.workflowTemplate as { enabledComponents?: string[] }
      if (Array.isArray(wt.enabledComponents)) {
        data.enabledComponents = wt.enabledComponents
      }
    }

    const updated = await db.projectBlueprint.update({
      where: { id: blueprintId },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/blueprints/[blueprintId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
