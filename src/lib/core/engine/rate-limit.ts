// Lightweight in-memory per-IP token bucket. Volatile: resets on restart and
// does not survive across multiple server instances. Matches the proving-UI
// ethos — a placeholder until we have real auth + a shared store.

interface Bucket {
  tokens: number
  updatedAt: number
}

const buckets = new Map<string, Bucket>()

const DEFAULT_CAPACITY = 5
const DEFAULT_REFILL_MS = 60_000 // full refill in 60s

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

export function consumeToken(
  key: string,
  capacity: number = DEFAULT_CAPACITY,
  refillMs: number = DEFAULT_REFILL_MS,
  now: number = Date.now()
): RateLimitResult {
  const refillPerMs = capacity / refillMs
  const existing = buckets.get(key)
  const tokens = existing
    ? Math.min(capacity, existing.tokens + (now - existing.updatedAt) * refillPerMs)
    : capacity
  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now })
    return { allowed: false, retryAfterMs: Math.ceil((1 - tokens) / refillPerMs) }
  }
  buckets.set(key, { tokens: tokens - 1, updatedAt: now })
  return { allowed: true, retryAfterMs: 0 }
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export function __resetRateLimitForTest(): void {
  buckets.clear()
}
