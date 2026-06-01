// Anthropic provider client (MMS) — text-generation via the Claude Messages API.
// Zero domain words: it knows HOW to call Claude for text, not WHAT to produce.
// Added in CR-7 so the Cross-Critique runner can route Claude producers, critics,
// and the integrator through the single MMS gateway (and into the cost ledger),
// instead of the direct-SDK path the CR-4/CR-5 single-producer stages used.
//
// Conventional params (set by the gateway / the cross-critique adapter):
//   prompt: string            — the user message (required)
//   systemPrompt?: string     — the system / instruction prompt
//   temperature?: number      — sampling temperature (model default when omitted)
//   maxOutputTokens?: number  — max output tokens (defaults to 4096)
//   timeoutMs?: number        — gateway-supplied per-request timeout
//   abortSignal?: AbortSignal — gateway cancellation signal

import Anthropic, { APIError } from '@anthropic-ai/sdk'
import type { Capability } from '../types'
import { failure as sharedFailure } from './shared'
import type { HealthCheckResult, ProviderClient, ProviderResult } from './types'

const PROVIDER_ID = 'anthropic'
const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_MAX_TOKENS = 4096

const failure = (error: string, startedAt: number): ProviderResult =>
  sharedFailure(PROVIDER_ID, Date.now() - startedAt, error)

const mapApiError = (err: unknown, timeoutMs: number): string => {
  if (err instanceof APIError) {
    const status = typeof err.status === 'number' ? err.status : 0
    const msg = err.message || 'API error'
    if (status === 429) return `Rate limited: ${msg}`
    if (status >= 500) return `Server error ${status}: ${msg}`
    if (status > 0) return `HTTP ${status}: ${msg}`
    return `API error: ${msg}`
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'APIUserAbortError') {
      return `Timeout after ${timeoutMs}ms`
    }
    return `Network error: ${err.message}`
  }
  return `Network error: ${String(err)}`
}

export const createAnthropicClient = (): ProviderClient => {
  let cachedClient: Anthropic | undefined

  const getClient = (apiKey: string): Anthropic => {
    if (!cachedClient) cachedClient = new Anthropic({ apiKey })
    return cachedClient
  }

  // text-generation + text-scoring share one path: produce text from a prompt.
  const handleText = async (
    modelApiId: string,
    params: Record<string, unknown>,
    startedAt: number,
  ): Promise<ProviderResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return failure('ANTHROPIC_API_KEY not set', startedAt)

    const prompt = typeof params.prompt === 'string' ? params.prompt : ''
    if (!prompt) return failure('prompt is required', startedAt)

    const systemPrompt =
      typeof params.systemPrompt === 'string' ? params.systemPrompt : undefined
    const temperature =
      typeof params.temperature === 'number' ? params.temperature : undefined
    const maxTokens =
      typeof params.maxOutputTokens === 'number' ? params.maxOutputTokens : DEFAULT_MAX_TOKENS
    const timeoutMs =
      typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS
    const abortSignal =
      params.abortSignal instanceof AbortSignal ? params.abortSignal : undefined

    let res: Anthropic.Message
    try {
      const client = getClient(apiKey)
      res = await client.messages.create(
        {
          model: modelApiId,
          max_tokens: maxTokens,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
          messages: [{ role: 'user', content: prompt }],
        },
        { signal: abortSignal },
      )
    } catch (err) {
      return failure(mapApiError(err, timeoutMs), startedAt)
    }

    const textBlock = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    )
    const content = textBlock?.text ?? ''
    if (!content) return failure('Empty response from Anthropic', startedAt)

    return {
      success: true,
      rawResponse: res as unknown as Record<string, unknown>,
      content,
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
      durationMs: Date.now() - startedAt,
    }
  }

  const execute = async (
    modelApiId: string,
    capability: Capability,
    params: Record<string, unknown>,
  ): Promise<ProviderResult> => {
    const startedAt = Date.now()
    if (capability === 'text-generation' || capability === 'text-scoring') {
      return handleText(modelApiId, params, startedAt)
    }
    return failure(`Unsupported capability: ${capability}`, startedAt)
  }

  const checkHealth = async (): Promise<HealthCheckResult> => {
    const checkedAt = new Date().toISOString()
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        providerId: PROVIDER_ID,
        state: 'down',
        latencyMs: 0,
        checkedAt,
        error: 'ANTHROPIC_API_KEY not set',
      }
    }
    return { providerId: PROVIDER_ID, state: 'healthy', latencyMs: 0, checkedAt }
  }

  return { providerId: PROVIDER_ID, execute, checkHealth }
}
