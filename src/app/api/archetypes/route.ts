import { NextResponse } from 'next/server'
import { listArchetypes } from '@/lib/domain/workflows/archetypes'

export async function GET() {
  return NextResponse.json(listArchetypes())
}
