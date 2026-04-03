import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { materializeStructure } from '@/lib/project-component/ideation/materializer'
import type {
  ProposedStructure,
  ComponentPlan,
  ProjectArchetype,
} from '@/lib/project-component'

/**
 * POST /api/blueprints/[blueprintId]/materialize
 *
 * Converts the proposed structure from ideation into real DB nodes.
 * Idempotent — returns existing count if nodes already exist.
 * Does NOT change the ideation phase.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    // Fetch blueprint
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // Check if already materialized (nodes exist)
    const existingNodes = await db.projectNode.count({
      where: { blueprintId },
    })
    if (existingNodes > 0) {
      return NextResponse.json({
        alreadyMaterialized: true,
        nodesCreated: existingNodes,
        componentsCreated: 0,
      })
    }

    // Get conversation to extract proposed structure
    const conversation = await db.ideationConversation.findFirst({
      where: { blueprintId },
      orderBy: { createdAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conversation) {
      return NextResponse.json({ error: 'No conversation found' }, { status: 404 })
    }

    // Extract latest proposedStructure and componentPlan from messages
    let proposedStructure: ProposedStructure | null = null
    let componentPlan: ComponentPlan | null = null

    for (const msg of [...conversation.messages].reverse()) {
      const sd = msg.structuredData as Record<string, unknown> | null
      if (!proposedStructure && sd?.proposedStructure) {
        proposedStructure = sd.proposedStructure as ProposedStructure
      }
      if (!componentPlan && sd?.componentPlan) {
        componentPlan = sd.componentPlan as ComponentPlan
      }
      if (proposedStructure && componentPlan) break
    }

    if (!proposedStructure) {
      return NextResponse.json(
        { error: 'No proposed structure found in conversation' },
        { status: 400 }
      )
    }

    const archetype = (blueprint.archetype as ProjectArchetype) ?? null
    const result = await materializeStructure(
      blueprintId,
      proposedStructure,
      componentPlan,
      archetype
    )

    return NextResponse.json({
      alreadyMaterialized: false,
      nodesCreated: result.nodesCreated,
      componentsCreated: result.componentsCreated,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/materialize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
