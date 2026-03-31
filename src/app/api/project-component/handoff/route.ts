import { NextResponse } from 'next/server'
import { executeHandoff, HandoffError } from '@/lib/project-component/production/handoff'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { blueprintId } = body

    if (!blueprintId || typeof blueprintId !== 'string') {
      return NextResponse.json(
        { error: 'blueprintId is required' },
        { status: 400 }
      )
    }

    const result = await executeHandoff(blueprintId)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof HandoffError) {
      const statusMap: Record<string, number> = {
        BLUEPRINT_NOT_FOUND: 404,
        NOT_APPROVED: 422,
        NO_COMPONENTS: 422,
        TRANSACTION_FAILED: 500,
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] ?? 500 }
      )
    }

    console.error('POST /api/project-component/handoff error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
