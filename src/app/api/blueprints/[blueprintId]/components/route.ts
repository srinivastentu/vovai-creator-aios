import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'
import { addComponentSchema, formatZodError } from '@/lib/validations/blueprint'
import { COMPONENT_REGISTRY } from '@/lib/project-component/component-registry'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()
    const result = addComponentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 })
    }

    // Validate componentType exists in registry
    if (!COMPONENT_REGISTRY[result.data.componentType]) {
      return NextResponse.json(
        { error: `Unknown component type: ${result.data.componentType}` },
        { status: 400 }
      )
    }

    // Verify node belongs to this blueprint
    const node = await db.projectNode.findFirst({
      where: { id: result.data.nodeId, blueprintId },
      select: { id: true },
    })
    if (!node) {
      return NextResponse.json(
        { error: 'Node not found in this blueprint' },
        { status: 404 }
      )
    }

    const component = await db.nodeComponent.create({
      data: {
        nodeId: result.data.nodeId,
        componentType: result.data.componentType,
        config: (result.data.config ?? {}) as Prisma.InputJsonValue,
        priority: result.data.priority ?? 'core',
      },
    })

    return NextResponse.json(component, { status: 201 })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/components error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const { searchParams } = new URL(request.url)
    const componentId = searchParams.get('componentId')

    if (!componentId) {
      return NextResponse.json(
        { error: 'componentId query parameter is required' },
        { status: 400 }
      )
    }

    // Verify component exists and its node belongs to this blueprint
    const component = await db.nodeComponent.findUnique({
      where: { id: componentId },
      include: { node: { select: { blueprintId: true } } },
    })
    if (!component || component.node.blueprintId !== blueprintId) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 })
    }

    await db.nodeComponent.delete({ where: { id: componentId } })

    return NextResponse.json({ deleted: componentId })
  } catch (error) {
    console.error('DELETE /api/blueprints/[blueprintId]/components error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
