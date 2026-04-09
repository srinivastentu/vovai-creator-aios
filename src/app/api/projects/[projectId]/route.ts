import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { updateProjectSchema } from '@/lib/validations/project'
import { formatZodError } from '@/lib/validations/blueprint'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await request.json()

    const parsed = updateProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const project = await db.project.update({
      where: { id: projectId },
      data: { name: parsed.data.name.trim() },
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
