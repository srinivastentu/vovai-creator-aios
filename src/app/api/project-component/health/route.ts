import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [blueprints, nodes, components] = await Promise.all([
    db.projectBlueprint.count(),
    db.projectNode.count(),
    db.nodeComponent.count(),
  ])

  return NextResponse.json({
    status: 'ok',
    counts: { blueprints, nodes, components },
  })
}
