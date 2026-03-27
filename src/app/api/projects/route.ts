import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectSchema } from '@/lib/validations/project'

export async function POST(request: Request) {
  const body = await request.json()
  const result = createProjectSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { errors: result.error.flatten().fieldErrors },
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
}
