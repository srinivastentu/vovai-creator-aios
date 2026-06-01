import type { HealthState, HealthStatus } from './types'

interface Outcome {
  success: boolean
  durationMs: number
  timestamp: number
  error?: string
}

export interface HealthMonitorOptions {
  windowSize?: number
  /**
   * Time-based recovery (circuit-breaker half-open). Outcomes older than this are
   * ignored when computing health, so a provider that tripped "down" auto-recovers
   * after a quiet period. Without this the window is count-based with no recovery:
   * once a provider is "down" the router refuses it, which records no new outcome,
   * so the failing window is frozen and the provider stays "down" for the rest of
   * the process — fatal for a batch run (one transient overload patch cascades the
   * whole pipeline). Default 30s.
   */
  recoveryMs?: number
}

export interface HealthMonitor {
  recordOutcome(
    providerId: string,
    success: boolean,
    durationMs: number,
    error?: string,
  ): void
  getHealth(providerId: string): HealthStatus
  getAll(): Map<string, HealthStatus>
  reset(providerId: string): void
  resetAll(): void
}

const classify = (successRate: number): HealthState => {
  if (successRate >= 0.8) return 'healthy'
  if (successRate >= 0.5) return 'degraded'
  return 'down'
}

export const createHealthMonitor = (options: HealthMonitorOptions = {}): HealthMonitor => {
  const windowSize = options.windowSize ?? 20
  const recoveryMs = options.recoveryMs ?? 30_000
  const outcomes = new Map<string, Outcome[]>()

  const recordOutcome = (
    providerId: string,
    success: boolean,
    durationMs: number,
    error?: string,
  ): void => {
    const arr = outcomes.get(providerId) ?? []
    arr.push({ success, durationMs, timestamp: Date.now(), error })
    while (arr.length > windowSize) arr.shift()
    outcomes.set(providerId, arr)
  }

  const getHealth = (providerId: string): HealthStatus => {
    const all = outcomes.get(providerId) ?? []
    // Only consider outcomes within the recovery window — stale failures age out,
    // so a "down" provider becomes retryable again after recoveryMs of quiet.
    const cutoff = Date.now() - recoveryMs
    const arr = all.filter((o) => o.timestamp >= cutoff)
    if (arr.length === 0) {
      return {
        providerId,
        status: 'healthy',
        successRate: 1,
        avgLatencyMs: 0,
        sampleSize: 0,
        lastChecked: new Date().toISOString(),
      }
    }
    const successes = arr.filter((o) => o.success).length
    const successRate = successes / arr.length
    const avgLatencyMs = arr.reduce((s, o) => s + o.durationMs, 0) / arr.length
    const lastError = [...arr].reverse().find((o) => o.error)?.error
    return {
      providerId,
      status: classify(successRate),
      successRate,
      avgLatencyMs,
      sampleSize: arr.length,
      lastError,
      lastChecked: new Date(arr[arr.length - 1].timestamp).toISOString(),
    }
  }

  const getAll = (): Map<string, HealthStatus> => {
    const map = new Map<string, HealthStatus>()
    for (const id of outcomes.keys()) map.set(id, getHealth(id))
    return map
  }

  const reset = (providerId: string): void => {
    outcomes.delete(providerId)
  }

  const resetAll = (): void => {
    outcomes.clear()
  }

  return { recordOutcome, getHealth, getAll, reset, resetAll }
}
