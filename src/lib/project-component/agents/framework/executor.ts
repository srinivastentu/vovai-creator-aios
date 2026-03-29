/**
 * Agent Executor — Calls Anthropic API with cost tracking
 *
 * Stateless execution: receives config + prompt, returns typed result.
 * Every call tracks model, tokens, cost. Supports fallback model,
 * retries, and timeout. Gracefully handles missing API key.
 *
 * Level 1 (Engine) — domain-agnostic agent execution.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { IdeationAgentConfig, AgentResult } from './types'
import { calculateCost } from './types'

// ─── Singleton Client ──────────────────────────────────────────────────────

let clientInstance: Anthropic | null = null

function getClient(): Anthropic | null {
  if (clientInstance) return clientInstance
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  clientInstance = new Anthropic({ apiKey })
  return clientInstance
}

/** Reset client — used in tests to pick up env changes */
export function resetClient(): void {
  clientInstance = null
}

// ─── Executor ──────────────────────────────────────────────────────────────

/**
 * Execute an ideation agent call against the Anthropic API.
 *
 * @param config - Agent configuration (model, retries, timeout)
 * @param systemPrompt - System prompt setting agent persona
 * @param userMessage - User message / task for the agent
 * @param outputSchema - If provided, instructs model to return JSON matching this shape
 * @returns AgentResult<T> with cost tracking, always (never throws)
 */
export async function executeIdeationAgent<T>(
  config: IdeationAgentConfig,
  systemPrompt: string,
  userMessage: string,
  outputSchema?: Record<string, unknown>
): Promise<AgentResult<T>> {
  const start = performance.now()

  // Check for API key before doing anything
  const client = getClient()
  if (!client) {
    return makeErrorResult(config, start, 'ANTHROPIC_API_KEY is not set')
  }

  // Try primary model, then fallback
  const models = [config.model.primary, config.model.fallback]

  for (const model of models) {
    const result = await tryModel<T>(client, config, model, systemPrompt, userMessage, outputSchema, start)
    if (result.success) return result
    // If primary failed, log and try fallback
    if (model === config.model.primary) {
      console.warn(`[agent:${config.id}] Primary model ${model} failed: ${result.error}. Trying fallback...`)
    }
  }

  // Both models failed — return last error
  return makeErrorResult(
    config,
    start,
    `All models failed for agent ${config.id}`
  )
}

// ─── Internal ──────────────────────────────────────────────────────────────

async function tryModel<T>(
  client: Anthropic,
  config: IdeationAgentConfig,
  model: string,
  systemPrompt: string,
  userMessage: string,
  outputSchema: Record<string, unknown> | undefined,
  start: number
): Promise<AgentResult<T>> {
  let lastError = ''

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const finalUserMessage = outputSchema
        ? `${userMessage}\n\nRespond with valid JSON matching this schema:\n${JSON.stringify(outputSchema, null, 2)}`
        : userMessage

      const response = await client.messages.create(
        {
          model,
          max_tokens: config.maxTokens ?? 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: finalUserMessage }],
        },
        { timeout: config.timeoutMs }
      )

      const tokensIn = response.usage.input_tokens
      const tokensOut = response.usage.output_tokens
      const costUSD = calculateCost(model, tokensIn, tokensOut)
      const durationMs = Math.round(performance.now() - start)

      // Check if response was truncated (hit max_tokens before completing)
      if (response.stop_reason === 'max_tokens') {
        lastError = `Response truncated (hit ${config.maxTokens ?? 4096} token limit)`
        continue
      }

      // Extract text from response
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      )
      if (!textBlock) {
        lastError = 'No text content in response'
        continue
      }

      // Parse output
      const output = parseOutput<T>(textBlock.text, outputSchema)

      // Emit cost data (will be events later)
      console.log(`[agent:${config.id}] model=${model} tokens_in=${tokensIn} tokens_out=${tokensOut} cost=$${costUSD.toFixed(6)} duration=${durationMs}ms`)

      return {
        agentId: config.id,
        success: true,
        output,
        durationMs,
        modelUsed: model,
        tokensIn,
        tokensOut,
        costUSD,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < config.maxRetries) {
        console.warn(`[agent:${config.id}] Attempt ${attempt + 1} failed: ${lastError}. Retrying...`)
      }
    }
  }

  return makeErrorResult(config, start, lastError, model)
}

function parseOutput<T>(text: string, outputSchema?: Record<string, unknown>): T {
  if (!outputSchema) {
    return text as unknown as T
  }

  // Strip markdown code fences if present
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  return JSON.parse(cleaned) as T
}

function makeErrorResult<T>(
  config: IdeationAgentConfig,
  start: number,
  error: string,
  modelUsed?: string
): AgentResult<T> {
  return {
    agentId: config.id,
    success: false,
    output: null,
    durationMs: Math.round(performance.now() - start),
    modelUsed: modelUsed ?? config.model.primary,
    tokensIn: 0,
    tokensOut: 0,
    costUSD: 0,
    error,
  }
}
