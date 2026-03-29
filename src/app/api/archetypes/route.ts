import { NextResponse } from 'next/server'
import { listArchetypes } from '@/lib/project-component/archetypes'

export async function GET() {
  return NextResponse.json(listArchetypes())
}
