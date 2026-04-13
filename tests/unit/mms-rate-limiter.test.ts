import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRateLimiter } from '../../src/lib/core/models/rate-limiter'

const limits = { requestsPerMinute: 3, requestsPerDay: 10 }

describe('RateLimiter', () => {
  let now = 1_000_000_000_000
  beforeEach(() => {
    now = 1_000_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('canRequest returns true when under limits', () => {
    const rl = createRateLimiter()
    expect(rl.canRequest('p', limits)).toBe(true)
  })

  it('canRequest returns false when per-minute limit reached', () => {
    const rl = createRateLimiter()
    for (let i = 0; i < 3; i += 1) rl.recordRequest('p')
    expect(rl.canRequest('p', limits)).toBe(false)
  })

  it('canRequest returns false when per-day limit reached', () => {
    const rl = createRateLimiter()
    const dayLimits = { requestsPerMinute: 1000, requestsPerDay: 2 }
    rl.recordRequest('p')
    rl.recordRequest('p')
    expect(rl.canRequest('p', dayLimits)).toBe(false)
  })

  it('recordRequest increments and appears in remaining quota', () => {
    const rl = createRateLimiter()
    rl.recordRequest('p')
    rl.recordRequest('p')
    const q = rl.getRemainingQuota('p', limits)
    expect(q.perMinute).toBe(1)
    expect(q.perDay).toBe(8)
  })

  it('requests outside 60s window do not count for per-minute', () => {
    const rl = createRateLimiter()
    for (let i = 0; i < 3; i += 1) rl.recordRequest('p')
    expect(rl.canRequest('p', limits)).toBe(false)
    now += 61_000
    expect(rl.canRequest('p', limits)).toBe(true)
  })

  it('getRemainingQuota returns correct counts for unknown provider', () => {
    const rl = createRateLimiter()
    const q = rl.getRemainingQuota('unknown', limits)
    expect(q.perMinute).toBe(3)
    expect(q.perDay).toBe(10)
  })

  it('reset clears a specific provider', () => {
    const rl = createRateLimiter()
    rl.recordRequest('p')
    rl.recordRequest('q')
    rl.reset('p')
    expect(rl.getRemainingQuota('p', limits).perDay).toBe(10)
    expect(rl.getRemainingQuota('q', limits).perDay).toBe(9)
  })

  it('resetAll clears everything', () => {
    const rl = createRateLimiter()
    rl.recordRequest('p')
    rl.recordRequest('q')
    rl.resetAll()
    expect(rl.getRemainingQuota('p', limits).perDay).toBe(10)
    expect(rl.getRemainingQuota('q', limits).perDay).toBe(10)
  })
})
