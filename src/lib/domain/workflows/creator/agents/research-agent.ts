// Research Agent (Stage 2) — Claude Sonnet + web_search.
// Domain configuration: knows WHAT to research (the Idea, for this Persona's
// audience) and HOW to shape a ResearchDossier. The HOW-to-call-Claude-with-
// web_search machinery lives in Core (web-search-adapter).
//
// Produces a RAW dossier (uncurated). The Source Curator dedupes/ranks it.
// On revise, it searches the GAPS the judge flagged and MERGES new sources
// into the prior set — iterations accumulate coverage rather than restart.

import type { GradeReport } from '../../../../core/engine/types'
import type { WebSearchRunner } from '../../../../core/agentic/adapters/web-search-adapter'
import type {
  DossierSource,
  ResearchContext,
  ResearchCostEvent,
  ResearchDossier,
} from '../types'

export interface ResearchAgentDeps {
  webSearch: WebSearchRunner
  onCost?: (event: ResearchCostEvent) => void
  /** Cap on searches per turn. */
  maxSearches?: number
}

export interface ResearchProduceArgs {
  context: ResearchContext
}

export interface ResearchReviseArgs {
  context: ResearchContext
  previous: ResearchDossier
  grade: GradeReport
}

export interface ResearchAgent {
  produce(args: ResearchProduceArgs): Promise<ResearchDossier>
  revise(args: ResearchReviseArgs): Promise<ResearchDossier>
}

const SYSTEM_PROMPT = [
  'You are a research agent for a content-production pipeline. Your job is to',
  'gather authoritative, on-topic sources about a single idea and write a',
  'grounded synthesis a downstream writer can build an article from.',
  '',
  'METHOD:',
  '- Use the web_search tool to find sources. Run several distinct searches that',
  '  cover DIFFERENT facets of the idea (mechanisms, evidence, competing views,',
  '  real examples, implications) — not the same query reworded.',
  '- Prefer primary and authoritative sources: documentation, papers, reputable',
  '  outlets, named practitioners. Avoid SEO content farms and anonymous blogs.',
  '- Ground every claim. When you assert something in your synthesis, it must',
  '  trace to a source you actually found.',
  '',
  'OUTPUT: Write a focused synthesis (300–600 words) of what the sources',
  'establish about the idea. Cite as you go so each claim is anchored. Do not',
  'pad. Do not invent sources or facts.',
].join('\n')

function buildQuery(ctx: ResearchContext): string {
  return [
    `Research this idea thoroughly: "${ctx.ideaTitle}".`,
    '',
    ctx.ideaDescription ? `Context: ${ctx.ideaDescription}` : '',
    ctx.niches.length ? `Topic area: ${ctx.niches.join(', ')}.` : '',
    ctx.audienceSummary ? `Audience for the eventual content: ${ctx.audienceSummary}.` : '',
    '',
    'Find authoritative sources covering multiple facets, then synthesize.',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildReviseQuery(args: ResearchReviseArgs): string {
  const { context: ctx, previous, grade } = args
  const weak = grade.dimensionScores
    .filter((d) => d.score < 7)
    .map((d) => `- ${d.name} (${d.score}/10): ${d.feedback}`)
  const priorUrls = previous.sources.map((s) => `- ${s.url}`).slice(0, 20)

  return [
    `You already researched "${ctx.ideaTitle}". A reviewer found gaps. Close them.`,
    '',
    weak.length ? 'Weak dimensions to fix:' : 'Strengthen coverage and source quality.',
    ...weak,
    grade.improvementPriorities.length
      ? `\nPriorities: ${grade.improvementPriorities.join('; ')}`
      : '',
    '',
    'Sources you already have (do NOT re-fetch these — find NEW, complementary ones):',
    ...priorUrls,
    '',
    'Run new searches targeting the gaps above. Then write an updated synthesis',
    'that integrates the new findings with what you already had.',
  ]
    .filter(Boolean)
    .join('\n')
}

function toDossierSources(
  sources: { url: string; title: string; pageAge: string | null; snippet: string }[]
): DossierSource[] {
  return sources.map((s) => ({
    url: s.url,
    title: s.title,
    snippet: s.snippet,
    type: 'web' as const,
    pageAge: s.pageAge,
  }))
}

/** Merge by URL, first-seen wins, preferring a non-empty snippet. */
function mergeSources(
  prior: DossierSource[],
  next: DossierSource[]
): DossierSource[] {
  const byUrl = new Map<string, DossierSource>()
  for (const s of [...prior, ...next]) {
    const existing = byUrl.get(s.url)
    if (!existing) {
      byUrl.set(s.url, s)
    } else if (!existing.snippet && s.snippet) {
      byUrl.set(s.url, { ...existing, snippet: s.snippet })
    }
  }
  return [...byUrl.values()]
}

export function createResearchAgent(deps: ResearchAgentDeps): ResearchAgent {
  const { webSearch, onCost, maxSearches } = deps

  return {
    async produce({ context }: ResearchProduceArgs): Promise<ResearchDossier> {
      const run = await webSearch({
        systemPrompt: SYSTEM_PROMPT,
        query: buildQuery(context),
        maxSearches,
      })
      onCost?.({
        source: 'research',
        model: run.modelUsed,
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        costUSD: run.costUSD,
      })
      return {
        ideaId: context.ideaId,
        query: buildQuery(context),
        summary: run.text,
        sources: toDossierSources(run.sources),
        searchCount: run.searchCount,
      }
    },

    async revise(args: ResearchReviseArgs): Promise<ResearchDossier> {
      const { context, previous } = args
      const run = await webSearch({
        systemPrompt: SYSTEM_PROMPT,
        query: buildReviseQuery(args),
        maxSearches,
      })
      onCost?.({
        source: 'research',
        model: run.modelUsed,
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        costUSD: run.costUSD,
      })
      const merged = mergeSources(previous.sources, toDossierSources(run.sources))
      return {
        ideaId: context.ideaId,
        query: previous.query,
        // Prefer the fresh synthesis; fall back to prior if the revise turn
        // returned nothing usable.
        summary: run.text.length > 0 ? run.text : previous.summary,
        sources: merged,
        searchCount: previous.searchCount + run.searchCount,
      }
    },
  }
}
