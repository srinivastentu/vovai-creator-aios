import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createNodeSchema, formatZodError, slugify } from '@/lib/validations/blueprint'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params

    const blueprint = await db.projectBlueprint.findUnique({ where: { id: blueprintId } })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    const nodes = await db.projectNode.findMany({
      where: { blueprintId },
      include: { components: true },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(nodes)
  } catch (error) {
    console.error('GET /api/blueprints/[blueprintId]/nodes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()
    const result = createNodeSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: formatZodError(result.error) }, { status: 400 })
    }

    const blueprint = await db.projectBlueprint.findUnique({ where: { id: blueprintId } })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    const parentId = result.data.parentId ?? null

    // Validate parent exists in this blueprint
    let parentPath = ''
    let parentDepth = -1
    if (parentId) {
      const parent = await db.projectNode.findFirst({
        where: { id: parentId, blueprintId },
        select: { path: true, depth: true },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent node not found in this blueprint' }, { status: 404 })
      }
      parentPath = parent.path
      parentDepth = parent.depth
    }

    // Auto-calculate slug, depth, path
    const slug = slugify(result.data.title)
    const depth = parentDepth + 1
    const path = parentId ? `${parentPath}/${slug}` : `/${slug}`

    // Auto-calculate sortOrder if not provided
    let sortOrder = result.data.sortOrder
    if (sortOrder === undefined) {
      const lastSibling = await db.projectNode.findFirst({
        where: { blueprintId, parentId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      sortOrder = lastSibling ? lastSibling.sortOrder + 1 : 0
    }

    const node = await db.projectNode.create({
      data: {
        blueprintId,
        parentId,
        title: result.data.title,
        slug,
        description: result.data.description ?? null,
        depth,
        sortOrder,
        path,
      },
      include: { components: true },
    })

    return NextResponse.json(node, { status: 201 })
  } catch (error) {
    // Handle unique constraint violation on [blueprintId, path]
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A node with this path already exists in this blueprint' },
        { status: 409 }
      )
    }
    console.error('POST /api/blueprints/[blueprintId]/nodes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
