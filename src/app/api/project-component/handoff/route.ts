import { NextResponse } from 'next/server'
import { executeHandoff, HandoffError } from '@/lib/domain/workflows/production/handoff'
import { handoffSchema } from '@/lib/validations/ideation'
import { formatZodError } from '@/lib/validations/blueprint'

// TODO(Ring-5): Add authentication + authorization middleware
// TODO(Ring-5): Add rate limiting (triggers production pipeline)

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = handoffSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const result = await executeHandoff(parsed.data.blueprintId)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof HandoffError) {
      console.error('POST /api/project-component/handoff HandoffError:', error.code, error.message)
      const statusMap: Record<string, number> = {
        BLUEPRINT_NOT_FOUND: 404,
        NOT_APPROVED: 422,
        NO_COMPONENTS: 422,
        TRANSACTION_FAILED: 500,
      }
      // Return safe error messages — don't expose internal error codes/details
      const safeMessages: Record<string, string> = {
        BLUEPRINT_NOT_FOUND: 'Blueprint not found',
        NOT_APPROVED: 'Blueprint must be approved before handoff',
        NO_COMPONENTS: 'Blueprint has no components to hand off',
        TRANSACTION_FAILED: 'Internal server error',
      }
      return NextResponse.json(
        { error: safeMessages[error.code] ?? 'Internal server error' },
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
