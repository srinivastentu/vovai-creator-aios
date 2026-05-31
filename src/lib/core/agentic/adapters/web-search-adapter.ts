// Claude web-search adapter — domain-agnostic Core machinery.
// Calls @anthropic-ai/sdk with the server-side `web_search_20250305` tool,
// parses the returned web_search_tool_result blocks + citations into a
// normalized, vendor-neutral shape, and tracks cost (tokens + per-search fee).
//
// Zero domain words. Any AIOS that needs grounded web research reuses this —
// the domain decides WHAT to search for and HOW to shape the result; this file
// only knows HOW to run a single grounded Claude turn and read it back.
//
// Per docs/03-decisions/creator-decisions-log.md (2026-05): web search is
// Anthropic web_search via the Claude SDK — no extra vendor, no MMS provider.

import Anthropic from '@anthropic-ai/sdk'
import { calculateCost } from '../pricing'

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

/** A single source surfaced by the web_search tool. */
export interface WebSearchSource {
  url: string
  title: string
  /** ISO-ish age string Anthropic attaches when known, else null. */
  pageAge: string | null
  /** Grounding excerpt drawn from the model's citation of this URL, if any. */
  snippet: string
}

/** Result of one grounded Claude turn. */
export interface WebSearchRun {
  /** The model's prose answer (citations stripped to plain text). */
  text: string
  /** De-duplicated sources (by URL) in first-seen order. */
  sources: WebSearchSource[]
  /** Number of server-side web_search requests Anthropic billed. */
  searchCount: number
  tokensIn: number
  tokensOut: number
  costUSD: number
  modelUsed: string
}

export interface WebSearchArgs {
  systemPrompt: string
  query: string
  maxTokens?: number
  /** Cap on server-side searches per turn (Anthropic `max_uses`). */
  maxSearches?: number
}

/** Injectable runner — domains depend on this type, not the concrete client. */
export type WebSearchRunner = (args: WebSearchArgs) => Promise<WebSearchRun>

export interface WebSearchClientOptions {
  model?: string
  fallbackModel?: string
  maxTokens?: number
  maxSearches?: number
  client?: Anthropic
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_FALLBACK = 'claude-haiku-4-5-20251001'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_MAX_SEARCHES = 6

/**
 * Anthropic bills server-side web search at $10 per 1,000 searches.
 * Token cost is tracked separately via pricing.ts.
 */
export const WEB_SEARCH_COST_PER_CALL = 0.01

// ---------------------------------------------------------------------------
// Response parsing (pure — exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Reduce a Claude message's content blocks to normalized text + sources.
 * Defensive: tolerates partial/unknown block shapes without throwing.
 */
export function parseWebSearchContent(
  content: readonly Anthropic.ContentBlock[]
): { text: string; sources: WebSearchSource[] } {
  const textParts: string[] = []
  // url -> source (first-seen order preserved via insertion order).
  const byUrl = new Map<string, WebSearchSource>()
  // url -> first grounding excerpt from citations.
  const snippetByUrl = new Map<string, string>()

  for (const block of content) {
    if (block.type === 'text') {
      textParts.push(block.text)
      for (const cite of block.citations ?? []) {
        if (cite.type === 'web_search_result_location') {
          const excerpt = cite.cited_text?.trim()
          if (cite.url && excerpt && !snippetByUrl.has(cite.url)) {
            snippetByUrl.set(cite.url, excerpt)
          }
        }
      }
    } else if (block.type === 'web_search_tool_result') {
      const results = block.content
      if (Array.isArray(results)) {
        for (const r of results) {
          if (r.type === 'web_search_result' && r.url && !byUrl.has(r.url)) {
            byUrl.set(r.url, {
              url: r.url,
              title: r.title ?? r.url,
              pageAge: r.page_age ?? null,
              snippet: '',
            })
          }
        }
      }
    }
  }

  // Backfill snippets from citations now that both passes are complete.
  for (const [url, source] of byUrl) {
    const excerpt = snippetByUrl.get(url)
    if (excerpt) source.snippet = excerpt
  }

  return {
    text: textParts.join('\n').trim(),
    sources: [...byUrl.values()],
  }
}

/** Read the billed web-search count from a message's usage block. */
export function readSearchCount(usage: Anthropic.Usage): number {
  return usage.server_tool_use?.web_search_requests ?? 0
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWebSearchClient(
  opts: WebSearchClientOptions = {}
): WebSearchRunner {
  const model = opts.model ?? DEFAULT_MODEL
  const fallbackModel = opts.fallbackModel ?? DEFAULT_FALLBACK
  const defaultMaxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS
  const defaultMaxSearches = opts.maxSearches ?? DEFAULT_MAX_SEARCHES

  const client =
    opts.client ??
    (() => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is not set — cannot create web-search client'
        )
      }
      return new Anthropic({ apiKey })
    })()

  async function callOnce(
    modelId: string,
    args: WebSearchArgs
  ): Promise<WebSearchRun> {
    const maxSearches = args.maxSearches ?? defaultMaxSearches
    const response = await client.messages.create({
      model: modelId,
      max_tokens: args.maxTokens ?? defaultMaxTokens,
      system: args.systemPrompt,
      messages: [{ role: 'user', content: args.query }],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: maxSearches,
        },
      ],
    })

    const { text, sources } = parseWebSearchContent(response.content)
    const tokensIn = response.usage.input_tokens
    const tokensOut = response.usage.output_tokens
    const searchCount = readSearchCount(response.usage)
    const costUSD =
      calculateCost(modelId, tokensIn, tokensOut) +
      searchCount * WEB_SEARCH_COST_PER_CALL

    return {
      text,
      sources,
      searchCount,
      tokensIn,
      tokensOut,
      costUSD: Math.round(costUSD * 1_000_000) / 1_000_000,
      modelUsed: modelId,
    }
  }

  return async function runWebSearch(args: WebSearchArgs): Promise<WebSearchRun> {
    try {
      return await callOnce(model, args)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(
        `[web-search] primary model ${model} failed: ${msg}. Trying fallback ${fallbackModel}.`
      )
      return await callOnce(fallbackModel, args)
    }
  }
}
