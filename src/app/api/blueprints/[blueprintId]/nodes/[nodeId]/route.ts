import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { updateNodeSchema, formatZodError, slugify } from '@/lib/validations/blueprint'

type RouteParams = { params: Promise<{ blueprintId: string; nodeId: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { blueprintId, nodeId } = await params

    const node = await db.projectNode.findFirst({
      where: { id: nodeId, blueprintId },
      include: { components: true },
    })

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    return NextResponse.json(node)
  } catch (error) {
    console.error('GET /api/blueprints/[blueprintId]/nodes/[nodeId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { blueprintId, nodeId } = await params
    const body = await request.json()
    const result = updateNodeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 })
    }

    const node = await db.projectNode.findFirst({
      where: { id: nodeId, blueprintId },
      select: { id: true, parentId: true, path: true, slug: true },
    })
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    // Build update data
    const data: Record<string, unknown> = {}
    const fields = result.data
    if (fields.title !== undefined) data.title = fields.title
    if (fields.description !== undefined) data.description = fields.description
    if (fields.notes !== undefined) data.notes = fields.notes
    if (fields.learningOutcomes !== undefined) data.learningOutcomes = fields.learningOutcomes
    if (fields.status !== undefined) data.status = fields.status

    // If title changed, recalculate slug and path for this node + descendants
    if (fields.title !== undefined) {
      const newSlug = slugify(fields.title)
      const parentPath = node.parentId
        ? node.path.slice(0, node.path.lastIndexOf('/'))
        : ''
      const newPath = `${parentPath}/${newSlug}`

      data.slug = newSlug
      data.path = newPath

      // Update descendant paths in a transaction
      const updated = await db.$transaction(async (tx) => {
        const updatedNode = await tx.projectNode.update({
          where: { id: nodeId },
          data,
          include: { components: true },
        })

        // Recursively update descendant paths
        async function updateChildPaths(pId: string, pPath: string) {
          const children = await tx.projectNode.findMany({
            where: { parentId: pId },
            select: { id: true, slug: true },
          })
          for (const child of children) {
            const childPath = `${pPath}/${child.slug}`
            await tx.projectNode.update({
              where: { id: child.id },
              data: { path: childPath },
            })
            await updateChildPaths(child.id, childPath)
          }
        }
        await updateChildPaths(nodeId, newPath)

        return updatedNode
      })

      return NextResponse.json(updated)
    }

    // Simple update — no path recalculation needed
    const updated = await db.projectNode.update({
      where: { id: nodeId },
      data,
      include: { components: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A node with this path already exists in this blueprint' },
        { status: 409 }
      )
    }
    console.error('PATCH /api/blueprints/[blueprintId]/nodes/[nodeId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { blueprintId, nodeId } = await params

    const node = await db.projectNode.findFirst({
      where: { id: nodeId, blueprintId },
      select: { id: true, path: true },
    })
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    // Find all descendants using materialized path prefix
    const descendants = await db.projectNode.findMany({
      where: { blueprintId, path: { startsWith: `${node.path}/` } },
      select: { id: true },
    })
    const allIds = [nodeId, ...descendants.map(n => n.id)]

    // Delete components first, then nodes
    await db.$transaction([
      db.nodeComponent.deleteMany({ where: { nodeId: { in: allIds } } }),
      db.projectNode.deleteMany({ where: { id: { in: allIds } } }),
    ])

    return NextResponse.json({ deleted: allIds.length })
  } catch (error) {
    console.error('DELETE /api/blueprints/[blueprintId]/nodes/[nodeId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
