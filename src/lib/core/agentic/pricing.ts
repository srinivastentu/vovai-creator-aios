// Cost pricing helpers — domain-agnostic.
// Kept inside core/agentic to preserve the one-way import rule
// (core/ must not import from domain/).

export interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
  'claude-opus-4-20250514': { inputPerMTok: 15, outputPerMTok: 75 },
  'gpt-4o': { inputPerMTok: 2.5, outputPerMTok: 10 },
  'gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
}

export const DEFAULT_PRICING: ModelPricing = { inputPerMTok: 3, outputPerMTok: 15 }

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
