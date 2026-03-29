/**
 * Agent Execution Framework — Type Definitions
 *
 * Types for the ideation agent executor. Agents are stateless:
 * receive context, produce artifact, return. Every LLM call
 * includes cost tracking (model, tokens, cost in USD).
 *
 * Level 1 (Engine) — these types are domain-agnostic.
 */

// ─── Cost Constants ────────────────────────────────────────────────────────

/** Per-model pricing in USD per million tokens */
export interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
  'claude-opus-4-20250514': { inputPerMTok: 15, outputPerMTok: 75 },
}

/** Default pricing when model not found in MODEL_PRICING */
export const DEFAULT_PRICING: ModelPricing = { inputPerMTok: 3, outputPerMTok: 15 }

// ─── Agent Configuration ───────────────────────────────────────────────────

/** Tier determines execution priority and cost limits */
export type AgentTier = 'production' | 'governance' | 'orchestrator'

/** Configuration for an ideation agent */
export interface IdeationAgentConfig {
  /** Unique agent identifier, e.g. 'audience-analyst' */
  id: string
  /** Human-readable name, e.g. 'Audience Analyst' */
  name: string
  /** Agent tier — production, governance, or orchestrator */
  tier: AgentTier
  /** Model selection with automatic fallback */
  model: {
    primary: string
    fallback: string
  }
  /** Max retry attempts on transient failures (default: 2) */
  maxRetries: number
  /** Timeout per LLM call in milliseconds (default: 30000) */
  timeoutMs: number
}

// ─── Agent Result ──────────────────────────────────────────────────────────

/** Result of an agent execution — always includes cost tracking */
export interface AgentResult<T> {
  /** Which agent produced this result */
  agentId: string
  /** Whether the execution succeeded */
  success: boolean
  /** Typed output from the agent (null on failure) */
  output: T | null
  /** Wall-clock duration in milliseconds */
  durationMs: number
  /** Which model was actually used (primary or fallback) */
  modelUsed: string
  /** Input tokens consumed */
  tokensIn: number
  /** Output tokens consumed */
  tokensOut: number
  /** Computed cost in USD */
  costUSD: number
  /** Error message if success is false */
  error?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Calculate cost in USD from token counts and model */
export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING
  const inputCost = (tokensIn / 1_000_000) * pricing.inputPerMTok
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPerMTok
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}
