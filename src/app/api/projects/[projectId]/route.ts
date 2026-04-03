import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await request.json()
    const { name } = body as { name?: string }

    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (name.trim().length > 255) {
      return NextResponse.json(
        { error: 'Name must be 255 characters or less' },
        { status: 400 }
      )
    }

    const project = await db.project.update({
      where: { id: projectId },
      data: { name: name.trim() },
    })

    return NextResponse.json({ id: project.id, name: project.name })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Record to update not found')
    ) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    console.error('PATCH /api/projects/[projectId] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
