import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from './route'
import {
  __resetSessionsForTest,
  createSessionId,
  loadSession,
  saveSession,
} from '@/lib/core/engine/session-store'
import { __resetRateLimitForTest } from '@/lib/core/engine/rate-limit'
import { createInitialState } from '@/lib/core/engine/loop-engine'
import type { LoopState } from '@/lib/core/engine/types'

function jsonReq(body: unknown): Request {
  return new Request('http://local.test/api/generate/text/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
    body: JSON.stringify(body),
  })
}

function seedPresentingSession() {
  const sessionId = createSessionId()
  const base = createInitialState<string>('text-generation')
  const state: LoopState<string> = {
    ...base,
    status: 'presenting',
    currentArtifact: 'hello',
    bestArtifact: 'hello',
    bestGrade: {
      overallScore: 9,
      passesThreshold: true,
      dimensionScores: [],
      recommendation: 'ok',
      improvementPriorities: [],
    },
  }
  saveSession({
    sessionId,
    goal: 'topic',
    systemPrompt: 'sys',
    state,
    totalCostUSD: 0.01,
    createdAt: Date.now(),
  })
  return sessionId
}

describe('POST /api/generate/text/review', () => {
  beforeEach(() => {
    __resetSessionsForTest()
    __resetRateLimitForTest()
  })

  it('rejects feedback action with missing/empty feedback string', async () => {
    const sessionId = seedPresentingSession()
    const res = await POST(jsonReq({ sessionId, action: 'feedback', feedback: '   ' }))
    expect(res.status).toBe(400)
  })

  it('rejects feedback longer than 2000 chars', async () => {
    const sessionId = seedPresentingSession()
    const big = 'a'.repeat(2001)
    const res = await POST(jsonReq({ sessionId, action: 'feedback', feedback: big }))
    expect(res.status).toBe(400)
  })

  it('approve deletes the session', async () => {
    const sessionId = seedPresentingSession()
    const res = await POST(jsonReq({ sessionId, action: 'approve' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('approved')
    expect(loadSession(sessionId)).toBeUndefined()
  })

  it('approve then another review returns 404', async () => {
    const sessionId = seedPresentingSession()
    await POST(jsonReq({ sessionId, action: 'approve' }))
    const res = await POST(jsonReq({ sessionId, action: 'approve' }))
    expect(res.status).toBe(404)
  })

  it('reject deletes the session', async () => {
    const sessionId = seedPresentingSession()
    const res = await POST(jsonReq({ sessionId, action: 'reject' }))
    expect(res.status).toBe(200)
    expect(loadSession(sessionId)).toBeUndefined()
  })
})
