import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/blueprints/[blueprintId]/grades
 *
 * Returns the latest StructureGrade for a blueprint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    const blueprint = await db.projectBlueprint.findUnique({ where: { id: blueprintId } })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    const grade = await db.structureGrade.findFirst({
      where: { blueprintId },
      orderBy: { createdAt: 'desc' },
    })

    if (!grade) {
      return NextResponse.json(null)
    }

    return NextResponse.json(grade)
  } catch (error) {
    console.error('GET /api/blueprints/[blueprintId]/grades error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
