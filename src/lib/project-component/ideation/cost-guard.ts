/**
 * Cost Guard — Enforces per-session cost limits on ideation.
 *
 * Before each agent call, callers check accumulated cost against
 * a configurable limit ($5.00 default). Prevents runaway spending
 * from auto-refinement loops or unusually long brainstorming.
 *
 * Level 1 (Engine) — domain-agnostic cost enforcement.
 */

import { db } from '@/lib/db'

// ─── Configuration ───────────────────────────────────────────────────────────

/** Default max cost for a single ideation session in USD */
export const DEFAULT_IDEATION_COST_LIMIT_USD = 5.00

/** Read limit from env or use default */
export function getIdeationCostLimit(): number {
  const envLimit = process.env.IDEATION_COST_LIMIT_USD
  if (envLimit) {
    const parsed = parseFloat(envLimit)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_IDEATION_COST_LIMIT_USD
}

// ─── Cost Check ──────────────────────────────────────────────────────────────

export interface CostCheckResult {
  /** Whether the session is within budget */
  ok: boolean
  /** Total cost accumulated so far in USD */
  accumulatedUSD: number
  /** Configured limit in USD */
  limitUSD: number
}

/**
 * Calculate accumulated ideation cost for a blueprint by summing
 * costUSD from all conversation message structuredData.
 */
export async function getAccumulatedCost(blueprintId: string): Promise<number> {
  const messages = await db.ideationMessage.findMany({
    where: {
      conversation: { blueprintId },
    },
    select: { structuredData: true },
  })

  let total = 0
  for (const msg of messages) {
    const data = msg.structuredData as Record<string, unknown> | null
    if (data && typeof data.costUSD === 'number') {
      total += data.costUSD
    }
  }
  return Math.round(total * 1_000_000) / 1_000_000
}

/**
 * Check whether the ideation session for a blueprint is within its cost budget.
 *
 * Call this BEFORE running agent steps. Returns { ok: false } when the
 * accumulated cost has reached or exceeded the limit.
 */
export async function checkCostLimit(blueprintId: string): Promise<CostCheckResult> {
  const limitUSD = getIdeationCostLimit()
  const accumulatedUSD = await getAccumulatedCost(blueprintId)
  return {
    ok: accumulatedUSD < limitUSD,
    accumulatedUSD,
    limitUSD,
  }
}

// ─── Cost Persistence ───────────────────────────────────────────────────────

/**
 * Record ideation step cost on Project.totalCostUSD.
 * Call this after each successful ideation step that incurred cost.
 */
export async function recordIdeationCost(blueprintId: string, costUSD: number): Promise<void> {
  if (costUSD <= 0) return

  const blueprint = await db.projectBlueprint.findUnique({
    where: { id: blueprintId },
    select: { projectId: true },
  })
  if (!blueprint) return

  await db.project.update({
    where: { id: blueprint.projectId },
    data: { totalCostUSD: { increment: costUSD } },
  })
}
