// Source Curator (Stage 2) — Claude Sonnet, dedupe + rank + filter.
// Domain configuration. Takes the Research Agent's raw dossier and returns a
// curated one: de-duplicated, ranked best-first, off-topic sources dropped,
// each kept source given a one-line relevance note.
//
// Degrades gracefully (loop rule 9): if the LLM ranking fails or is
// unparseable, fall back to the deterministically de-duplicated set.

import Anthropic from '@anthropic-ai/sdk'
import { calculateCost } from '../../../../core/agentic/pricing'
import type {
  DossierSource,
  ResearchContext,
  ResearchCostEvent,
  ResearchDossier,
} from '../types'

export interface SourceCuratorDeps {
  client?: Anthropic
  model?: string
  onCost?: (event: ResearchCostEvent) => void
  /** Max sources to keep after curation. */
  maxSources?: number
}

export interface SourceCurator {
  curate(dossier: ResearchDossier, context: ResearchContext): Promise<ResearchDossier>
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_SOURCES = 12

/** Normalize a URL for dedupe: lowercase host, drop trailing slash + fragment. */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/+$/, '')
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return url.trim()
  }
}

/** Pure: de-duplicate sources by normalized URL, first-seen wins. */
export function dedupeSources(sources: DossierSource[]): DossierSource[] {
  const seen = new Set<string>()
  const out: DossierSource[] = []
  for (const s of sources) {
    const key = normalizeUrl(s.url)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

/** Guarantee a non-empty snippet so persistence never writes a blank. */
function ensureSnippet(s: DossierSource): DossierSource {
  if (s.snippet && s.snippet.trim()) return s
  return { ...s, snippet: `Source: ${s.title}` }
}

function buildCuratePrompt(
  dossier: ResearchDossier,
  context: ResearchContext,
  deduped: DossierSource[]
): { system: string; user: string } {
  const system = [
    'You are a source curator. Given an idea and a list of web sources, keep only',
    'those that are on-topic and credible, rank them best-first, and write a',
    'one-sentence relevance note for each kept source explaining why it matters',
    'for the idea. Drop off-topic, low-quality, or redundant sources.',
    '',
    'Return ONLY a JSON object (no markdown, no prose outside JSON):',
    '{ "kept": [ { "url": "<exact url from the list>", "relevanceNote": "<one sentence>" } ] }',
    'Order "kept" from most to least valuable. Do not invent URLs.',
  ].join('\n')

  const list = deduped
    .map((s, i) => `${i + 1}. ${s.title}\n   ${s.url}\n   ${s.snippet || '(no excerpt)'}`)
    .join('\n')

  const user = [
    `IDEA: ${context.ideaTitle}`,
    context.ideaDescription ? `CONTEXT: ${context.ideaDescription}` : '',
    context.niches.length ? `TOPIC AREA: ${context.niches.join(', ')}` : '',
    '',
    'SOURCES:',
    list,
  ]
    .filter(Boolean)
    .join('\n')

  return { system, user }
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()
}

interface CurateResponse {
  kept: { url: string; relevanceNote?: string }[]
}

function parseCurateResponse(raw: string): CurateResponse | null {
  try {
    const parsed = JSON.parse(stripFences(raw))
    if (parsed && Array.isArray(parsed.kept)) return parsed as CurateResponse
    return null
  } catch {
    return null
  }
}

export function createSourceCurator(deps: SourceCuratorDeps = {}): SourceCurator {
  const model = deps.model ?? DEFAULT_MODEL
  const maxSources = deps.maxSources ?? DEFAULT_MAX_SOURCES
  const onCost = deps.onCost

  const client =
    deps.client ??
    (() => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set — cannot create source curator')
      }
      return new Anthropic({ apiKey })
    })()

  return {
    async curate(
      dossier: ResearchDossier,
      context: ResearchContext
    ): Promise<ResearchDossier> {
      const deduped = dedupeSources(dossier.sources)
      // Nothing to rank — return the deduped set with snippets guaranteed.
      if (deduped.length === 0) {
        return { ...dossier, sources: [] }
      }

      const byUrl = new Map(deduped.map((s) => [s.url, s]))
      const { system, user } = buildCuratePrompt(dossier, context, deduped)

      let curated: DossierSource[]
      try {
        const res = await client.messages.create({
          model,
          max_tokens: 1500,
          system,
          messages: [{ role: 'user', content: user }],
        })
        const textBlock = res.content.find(
          (b): b is Anthropic.TextBlock => b.type === 'text'
        )
        onCost?.({
          source: 'curator',
          model,
          tokensIn: res.usage.input_tokens,
          tokensOut: res.usage.output_tokens,
          costUSD: calculateCost(
            model,
            res.usage.input_tokens,
            res.usage.output_tokens
          ),
        })

        const parsed = textBlock ? parseCurateResponse(textBlock.text) : null
        if (parsed) {
          curated = parsed.kept
            .map((k) => {
              const src = byUrl.get(k.url)
              if (!src) return null
              const note = k.relevanceNote?.trim()
              return note ? { ...src, snippet: note } : src
            })
            .filter((s): s is DossierSource => s !== null)
          // If the model dropped everything (over-eager), fall back to deduped.
          if (curated.length === 0) curated = deduped
        } else {
          curated = deduped
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[source-curator] ranking failed: ${msg}. Using deduped set.`)
        curated = deduped
      }

      return {
        ...dossier,
        sources: curated.slice(0, maxSources).map(ensureSnippet),
      }
    },
  }
}
