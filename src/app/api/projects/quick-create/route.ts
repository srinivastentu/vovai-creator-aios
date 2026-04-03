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
    // Strategy: find content after topic/subject markers first, then fall back
    // to stripping conversational prefixes.
    const firstSentence = (intent.match(/^[^.!?\n]+/)?.[0] ?? intent).trim()

    // Try to extract the subject after markers like "on the topic:", "about:", "on:", "titled:", "called:"
    const topicMatch = firstSentence.match(
      /(?:on the topic(?:\s+of)?|about|on|titled|called|regarding|covering)\s*[:]\s*(.+)/i
    ) ?? firstSentence.match(
      /(?:course|program|training|video|series|channel|curriculum|module)\s+(?:on|about|for|covering)\s+(.+)/i
    )

    let raw: string
    if (topicMatch) {
      raw = topicMatch[1].trim()
    } else {
      // Fall back: strip conversational prefixes
      const stripped = firstSentence
        .replace(/^(I('d| would| want(?: you)? to| need(?: you)? to| am looking to)|please|can you|help me|let'?s|we need to|create|build|make|design|develop|produce|generate)\s+/i, '')
        .replace(/^(an?\s+)?(?:elearning |e-learning |online |interactive )?(?:course|program|training|video|series|channel|curriculum|module)\s+(?:on|about|for|covering)\s+/i, '')
        .replace(/^(a |an |the |me |some |my )/i, '')
      raw = stripped
    }

    raw = raw.replace(/^(a |an |the )/i, '')
    raw = raw.charAt(0).toUpperCase() + raw.slice(1)
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
