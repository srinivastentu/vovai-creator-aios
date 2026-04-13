import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from './route'
import { __resetRateLimitForTest } from '@/lib/core/engine/rate-limit'
import { __resetSessionsForTest } from '@/lib/core/engine/session-store'

function jsonReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://local.test/api/generate/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/generate/text — validation + rate limit', () => {
  beforeEach(() => {
    __resetRateLimitForTest()
    __resetSessionsForTest()
  })

  it('rejects oversized systemPrompt', async () => {
    const big = 'x'.repeat(4001)
    const res = await POST(jsonReq({ goal: 'write intro', systemPrompt: big }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Validation/)
  })

  it('rejects too-short goal', async () => {
    const res = await POST(jsonReq({ goal: 'x' }))
    expect(res.status).toBe(400)
  })

  it('rate-limits after 5 requests from same ip', async () => {
    const ip = '1.2.3.4'
    for (let i = 0; i < 5; i++) {
      const res = await POST(jsonReq({ goal: 'x' }, { 'x-forwarded-for': ip }))
      // 400 or 200 (streaming) — doesn't matter; confirms not rate-limited.
      expect(res.status).not.toBe(429)
      // Ensure any open stream is drained so the test doesn't leak.
      if (res.body) await res.body.cancel().catch(() => {})
    }
    const sixth = await POST(jsonReq({ goal: 'x' }, { 'x-forwarded-for': ip }))
    expect(sixth.status).toBe(429)
    expect(sixth.headers.get('Retry-After')).toBeTruthy()
  })
})
