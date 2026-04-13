import type { RateLimits } from './types'

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000

export interface RateLimiter {
  canRequest(providerId: string, limits: RateLimits): boolean
  recordRequest(providerId: string): void
  getRemainingQuota(
    providerId: string,
    limits: RateLimits,
  ): { perMinute: number; perDay: number }
  reset(providerId: string): void
  resetAll(): void
}

export const createRateLimiter = (): RateLimiter => {
  const hits = new Map<string, number[]>()

  const countSince = (timestamps: number[], since: number): number => {
    let count = 0
    for (let i = timestamps.length - 1; i >= 0; i -= 1) {
      if (timestamps[i] >= since) count += 1
      else break
    }
    return count
  }

  const canRequest = (providerId: string, limits: RateLimits): boolean => {
    const ts = hits.get(providerId)
    if (!ts || ts.length === 0) return true
    const now = Date.now()
    if (countSince(ts, now - MINUTE_MS) >= limits.requestsPerMinute) return false
    if (countSince(ts, now - DAY_MS) >= limits.requestsPerDay) return false
    return true
  }

  const recordRequest = (providerId: string): void => {
    const now = Date.now()
    const ts = hits.get(providerId) ?? []
    ts.push(now)
    const cutoff = now - DAY_MS
    let firstValid = 0
    while (firstValid < ts.length && ts[firstValid] < cutoff) firstValid += 1
    hits.set(providerId, firstValid === 0 ? ts : ts.slice(firstValid))
  }

  const getRemainingQuota = (
    providerId: string,
    limits: RateLimits,
  ): { perMinute: number; perDay: number } => {
    const ts = hits.get(providerId) ?? []
    const now = Date.now()
    const perMinute = Math.max(0, limits.requestsPerMinute - countSince(ts, now - MINUTE_MS))
    const perDay = Math.max(0, limits.requestsPerDay - countSince(ts, now - DAY_MS))
    return { perMinute, perDay }
  }

  const reset = (providerId: string): void => {
    hits.delete(providerId)
  }

  const resetAll = (): void => {
    hits.clear()
  }

  return { canRequest, recordRequest, getRemainingQuota, reset, resetAll }
}
