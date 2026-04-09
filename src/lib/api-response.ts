import { NextResponse } from 'next/server'

/**
 * Standardized API response helpers.
 *
 * All API routes should use these to ensure a consistent envelope:
 *   { success: true, data: T }
 *   { success: false, error: string }
 */

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status })
}

export function apiError(error: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error }, { status })
}
