import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'
import { createBlueprintSchema, formatZodError } from '@/lib/validations/blueprint'
import { getArchetype } from '@/lib/project-component/archetypes'

// TODO(Ring-5): Add authentication + authorization middleware

/**
 * GET /api/blueprints?projectId=xxx
 *
 * Returns the blueprint for a given project, including nodes and components.
 * Requires projectId query parameter.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 })
    }

    const blueprint = await db.projectBlueprint.findUnique({
      where: { projectId },
      include: {
        project: {
          select: { id: true, name: true, topic: true, targetAudience: true },
        },
        nodes: {
          include: { components: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!blueprint) {
      return NextResponse.json({ error: 'No blueprint found for this project' }, { status: 404 })
    }

    return NextResponse.json(blueprint)
  } catch (error) {
    console.error('GET /api/blueprints error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = createBlueprintSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: result.data.projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const existing = await db.projectBlueprint.findUnique({
      where: { projectId: result.data.projectId },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Blueprint already exists for this project' },
        { status: 409 }
      )
    }

    // Auto-fill defaults from archetype registry
    const archetype = result.data.archetype ?? 'professional_training'
    const archetypeDef = getArchetype(archetype)

    const hierarchyLabels =
      result.data.hierarchyLabels ??
      Object.fromEntries(
        Object.entries(archetypeDef.hierarchy).map(([k, v]) => [`level${k}`, v])
      )
    const enabledComponents = result.data.enabledComponents ?? archetypeDef.defaultComponents
    const targetAudience = result.data.targetAudience ?? {}

    const blueprint = await db.projectBlueprint.create({
      data: {
        projectId: result.data.projectId,
        archetype,
        hierarchyLabels: hierarchyLabels as Prisma.InputJsonValue,
        targetAudience: targetAudience as Prisma.InputJsonValue,
        learningOutcomes: [] as Prisma.InputJsonValue,
        enabledComponents: enabledComponents as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json(blueprint, { status: 201 })
  } catch (error) {
    console.error('POST /api/blueprints error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
