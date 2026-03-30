import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { updateBlueprintSchema, formatZodError } from '@/lib/validations/blueprint'

// TODO(PC-9.2): Add authentication + authorization check
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

// TODO(PC-9.2): Add authentication + authorization check
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
