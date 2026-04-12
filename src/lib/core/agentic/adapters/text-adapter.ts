// Claude text producer adapter.
// Implements ProducerAdapter<string>: produce() and revise() using @anthropic-ai/sdk.
// Cost tracking via local pricing helper. Primary -> fallback model on error.

import Anthropic from '@anthropic-ai/sdk'
import type { GradeReport, DimensionScore } from '../../engine/types'
import { calculateCost } from '../pricing'
import type { Artifact, ProduceArgs, ProducerAdapter, ReviseArgs } from './types'

export interface ClaudeTextAdapterOptions {
  model?: string
  fallbackModel?: string
  maxTokens?: number
  client?: Anthropic
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_FALLBACK = 'claude-haiku-4-5-20251001'
const DEFAULT_MAX_TOKENS = 2048

export function buildRevisePrompt(args: {
  goal: string
  previous: Artifact<string>
  grade: GradeReport
  humanFeedback?: string
}): string {
  const { goal, previous, grade, humanFeedback } = args
  const preserve = grade.dimensionScores.filter((d) => d.score >= 8)
  const improve = grade.dimensionScores.filter((d) => d.score < 8)

  const fmt = (d: DimensionScore) =>
    `- ${d.name} (${d.score}/10): ${d.feedback}`

  const preserveBlock = preserve.length
    ? `PRESERVE these strengths (do NOT change what works):\n${preserve.map(fmt).join('\n')}`
    : 'PRESERVE: (no strengths scored >= 8 yet)'

  const improveBlock = improve.length
    ? `IMPROVE these weaknesses:\n${improve.map(fmt).join('\n')}`
    : 'IMPROVE: (no weaknesses scored < 8)'

  const human = humanFeedback
    ? `\n\nHuman reviewer also said: ${humanFeedback}`
    : ''

  return [
    `You previously produced this text for the goal: "${goal}"`,
    '',
    `--- PREVIOUS VERSION (v${previous.version}) ---`,
    previous.content,
    '--- END PREVIOUS ---',
    '',
    `A judge scored it ${grade.overallScore}/10. Revise it.`,
    '',
    preserveBlock,
    improveBlock + human,
    '',
    'Return only the revised text, no preamble.',
  ].join('\n')
}

export function createClaudeTextAdapter(
  opts: ClaudeTextAdapterOptions = {}
): ProducerAdapter<string> {
  const model = opts.model ?? DEFAULT_MODEL
  const fallbackModel = opts.fallbackModel ?? DEFAULT_FALLBACK
  const defaultMaxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS

  const client =
    opts.client ??
    (() => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is not set — cannot create Claude text adapter'
        )
      }
      return new Anthropic({ apiKey })
    })()

  async function callOnce(params: {
    model: string
    systemPrompt: string
    userMessage: string
    maxTokens: number
  }): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userMessage }],
    })
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    )
    if (!textBlock) throw new Error('No text content in Claude response')
    return {
      text: textBlock.text.trim(),
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    }
  }

  async function callWithFallback(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number
  ): Promise<{ text: string; tokensIn: number; tokensOut: number; modelUsed: string }> {
    try {
      const r = await callOnce({ model, systemPrompt, userMessage, maxTokens })
      return { ...r, modelUsed: model }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(
        `[text-adapter] primary model ${model} failed: ${msg}. Trying fallback ${fallbackModel}.`
      )
      const r = await callOnce({
        model: fallbackModel,
        systemPrompt,
        userMessage,
        maxTokens,
      })
      return { ...r, modelUsed: fallbackModel }
    }
  }

  function makeId(): string {
    return `art_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }

  return {
    async produce(args: ProduceArgs): Promise<Artifact<string>> {
      const maxTokens = args.maxTokens ?? defaultMaxTokens
      const { text, tokensIn, tokensOut, modelUsed } = await callWithFallback(
        args.systemPrompt,
        args.goal,
        maxTokens
      )
      return {
        id: makeId(),
        version: 1,
        kind: 'text',
        content: text,
        createdAt: new Date(),
        modelUsed,
        tokensIn,
        tokensOut,
        costUSD: calculateCost(modelUsed, tokensIn, tokensOut),
      }
    },

    async revise(args: ReviseArgs<string>): Promise<Artifact<string>> {
      const maxTokens = args.maxTokens ?? defaultMaxTokens
      const userMessage = buildRevisePrompt({
        goal: args.goal,
        previous: args.previous,
        grade: args.grade,
        humanFeedback: args.humanFeedback,
      })
      const { text, tokensIn, tokensOut, modelUsed } = await callWithFallback(
        args.systemPrompt,
        userMessage,
        maxTokens
      )
      return {
        id: makeId(),
        version: args.previous.version + 1,
        kind: 'text',
        content: text,
        createdAt: new Date(),
        modelUsed,
        tokensIn,
        tokensOut,
        costUSD: calculateCost(modelUsed, tokensIn, tokensOut),
      }
    },
  }
}
