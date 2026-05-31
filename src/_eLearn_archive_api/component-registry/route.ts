import { NextResponse } from 'next/server'
import { listComponents } from '@/lib/domain/workflows/component-registry'
import { COMPONENT_COMPATIBILITY } from '@/lib/domain/workflows/compatibility'
import type { ProjectArchetype } from '@/lib/domain/workflows/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const archetype = searchParams.get('archetype')

  if (archetype) {
    const compat = COMPONENT_COMPATIBILITY[archetype as ProjectArchetype]
    if (!compat) {
      return NextResponse.json({ error: `Unknown archetype: ${archetype}` }, { status: 400 })
    }

    const allowedIds = new Set([...compat.recommended, ...compat.optional])
    const all = listComponents()
    const filtered = all.filter(c => allowedIds.has(c.id))

    return NextResponse.json(filtered)
  }

  return NextResponse.json(listComponents())
}
