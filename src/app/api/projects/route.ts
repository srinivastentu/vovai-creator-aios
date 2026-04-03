import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectSchema } from '@/lib/validations/project'
import { formatZodError } from '@/lib/validations/blueprint'

// TODO(Ring-5): Add authentication + authorization middleware

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        blueprint: {
          select: {
            id: true,
            ideationPhase: true,
            archetype: true,
            nodes: {
              where: { depth: 1 },
              select: { id: true },
            },
          },
        },
      },
    })

    // Flatten node count into response
    const mapped = projects.map(({ blueprint, ...rest }) => ({
      ...rest,
      blueprint: blueprint ? {
        id: blueprint.id,
        ideationPhase: blueprint.ideationPhase,
        archetype: blueprint.archetype,
        moduleCount: blueprint.nodes.length,
      } : null,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = createProjectSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      )
    }

    const project = await db.project.create({
      data: {
        name: result.data.name,
        topic: result.data.topic,
        targetAudience: result.data.targetAudience,
        durationMinutes: result.data.durationMinutes,
      },
    })

    return NextResponse.json({ id: project.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
