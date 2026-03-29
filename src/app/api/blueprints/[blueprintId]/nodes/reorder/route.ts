import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reorderNodesSchema, formatZodError } from '@/lib/validations/blueprint'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()
    const result = reorderNodesSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 })
    }

    if (result.data.length === 0) {
      return NextResponse.json({ error: 'Empty reorder array' }, { status: 400 })
    }

    // Verify all nodes belong to this blueprint
    const nodeIds = result.data.map(e => e.nodeId)
    const existingCount = await db.projectNode.count({
      where: { id: { in: nodeIds }, blueprintId },
    })
    if (existingCount !== nodeIds.length) {
      return NextResponse.json(
        { error: 'Some nodes not found in this blueprint' },
        { status: 400 }
      )
    }

    await db.$transaction(async (tx) => {
      // Step 1: Apply parentId + sortOrder updates
      for (const entry of result.data) {
        await tx.projectNode.update({
          where: { id: entry.nodeId },
          data: { parentId: entry.parentId, sortOrder: entry.sortOrder },
        })
      }

      // Step 2: Recalculate depth + path for all nodes in the blueprint
      const allNodes = await tx.projectNode.findMany({
        where: { blueprintId },
        select: { id: true, parentId: true, slug: true, depth: true, path: true },
      })

      const nodeMap = new Map(allNodes.map(n => [n.id, n]))
      const cache = new Map<string, { depth: number; path: string }>()

      function calcDepthPath(
        nodeId: string,
        visited = new Set<string>()
      ): { depth: number; path: string } {
        if (cache.has(nodeId)) return cache.get(nodeId)!
        if (visited.has(nodeId)) throw new Error('Circular reference detected')
        visited.add(nodeId)

        const node = nodeMap.get(nodeId)!
        if (!node.parentId) {
          const r = { depth: 0, path: `/${node.slug}` }
          cache.set(nodeId, r)
          return r
        }
        const parent = calcDepthPath(node.parentId, visited)
        const r = { depth: parent.depth + 1, path: `${parent.path}/${node.slug}` }
        cache.set(nodeId, r)
        return r
      }

      // Only update nodes whose depth or path changed
      for (const node of allNodes) {
        const { depth, path } = calcDepthPath(node.id)
        if (depth !== node.depth || path !== node.path) {
          await tx.projectNode.update({
            where: { id: node.id },
            data: { depth, path },
          })
        }
      }
    })

    // Return updated node list
    const nodes = await db.projectNode.findMany({
      where: { blueprintId },
      include: { components: true },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(nodes)
  } catch (error) {
    if (error instanceof Error && error.message === 'Circular reference detected') {
      return NextResponse.json({ error: 'Reorder would create a circular reference' }, { status: 400 })
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Reorder would create duplicate paths' },
        { status: 409 }
      )
    }
    console.error('POST /api/blueprints/[blueprintId]/nodes/reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
