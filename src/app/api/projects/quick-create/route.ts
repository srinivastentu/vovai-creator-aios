import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { quickCreateSchema } from '@/lib/validations/project'
import { formatZodError } from '@/lib/validations/blueprint'
import { getArchetype } from '@/lib/project-component/archetypes'
import { Prisma } from '@/generated/prisma/client'

/**
 * POST /api/projects/quick-create
 *
 * Creates a Project + Blueprint in one call from a raw intent string.
 * Returns { projectId, blueprintId } for immediate redirect.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = quickCreateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      )
    }

    const { intent } = result.data

    // Extract a meaningful project name from the intent.
    // Strategy: use first sentence, strip common conversational prefixes
    // ("I want to", "Create a", "Build me a", etc.) to get to the subject.
    const firstSentence = (intent.match(/^[^.!?\n]+/)?.[0] ?? intent).trim()
    const stripped = firstSentence
      .replace(/^(I('d| would| want to| need to| am looking to)|please|can you|help me|let'?s|we need to|create|build|make|design|develop|produce|generate)\s+/i, '')
      .replace(/^(a |an |the |me |some |my )/i, '')
    const raw = stripped.charAt(0).toUpperCase() + stripped.slice(1)
    const name = raw.length > 80 ? raw.slice(0, 77) + '...' : raw

    const archetype = 'professional_training' as const
    const archetypeDef = getArchetype(archetype)
    const hierarchyLabels = Object.fromEntries(
      Object.entries(archetypeDef.hierarchy).map(([k, v]) => [`level${k}`, v])
    )

    const project = await db.project.create({
      data: {
        name: name.trim(),
        topic: intent,
        targetAudience: '',
        durationMinutes: 0,
        blueprint: {
          create: {
            archetype,
            hierarchyLabels: hierarchyLabels as Prisma.InputJsonValue,
            targetAudience: {} as Prisma.InputJsonValue,
            learningOutcomes: [] as Prisma.InputJsonValue,
            enabledComponents: archetypeDef.defaultComponents as Prisma.InputJsonValue,
          },
        },
      },
      include: { blueprint: { select: { id: true } } },
    })

    return NextResponse.json(
      { projectId: project.id, blueprintId: project.blueprint!.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/projects/quick-create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
