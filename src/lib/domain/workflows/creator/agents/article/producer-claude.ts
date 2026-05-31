// Long-Form Article Producer (Stage 5b) — Claude Sonnet.
// Domain configuration: knows WHAT to produce (a publishable blog/Substack-style
// article in the persona's voice, expanded from the Long-Form Master) and HOW to
// shape it for long-form reading. The HOW-to-call-Claude machinery is the
// Anthropic SDK; cost tracking goes through Core pricing.
//
// CR-4 status: this is the SINGLE producer in a Standard loop — no cross-
// critique, no LLM judge yet (the deterministic validator is the only gate).
// CR-7 adapts this file into Producer A of the Cross-Critique pattern.
//
// Per rubrics.md Rule 5 the producer NEVER sees the rubric.

import Anthropic from '@anthropic-ai/sdk'
import { calculateCost } from '../../../../../core/agentic/pricing'
import type { ArticleArtifact, RepurposeContext, RepurposeCostEvent } from '../../types'

export interface ArticleProducerDeps {
  client?: Anthropic
  model?: string
  onCost?: (event: RepurposeCostEvent) => void
  maxTokens?: number
}

export interface ArticleProduceArgs {
  context: RepurposeContext
}

export interface ArticleProducer {
  produce(args: ArticleProduceArgs): Promise<ArticleArtifact>
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 8192

const SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are the long-form article producer for the CreatorOS content pipeline.',
  'You turn a finished Long-Form Master into ONE publishable article (1,200–3,000',
  "words) for a blog / LinkedIn Article / Substack, in the creator's voice. You",
  'run as the single producer in a Standard quality loop: produce → validate →',
  'present. You do NOT see a rubric.',
  '',
  '# Mission',
  '',
  'Given a Long-Form Master and a creator persona, produce one article that:',
  '1. Opens with an intro (100–200 words) that earns the read — a concrete claim,',
  '   a named tension, or a real moment. No throat-clearing.',
  '2. Develops the idea across at least 2 H2 (`##`) body sections, each making one',
  '   point with substance — mechanisms, evidence, tradeoffs.',
  '3. Closes with an explicit conclusion section (an H2 that reads as a wrap-up:',
  '   "Conclusion", "The takeaway", "Where this leaves us", etc.).',
  '4. Sounds like the persona throughout — voice, register, and point of view.',
  '5. Is scannable: a clear H1 title, descriptive H2s, paragraphs of digestible',
  '   length.',
  '',
  '# Core behaviors',
  '',
  '- READ THE PERSONA FIRST. Match its formality, vocabulary, and point of view.',
  '  Reach for its signature phrases where they fit naturally; never force them.',
  '- USE THE MASTER AS RAW MATERIAL. Expand and structure its insight into a',
  '  coherent argument — do not just stitch the sections together.',
  '- BE CONCRETE. Name the pattern, show the tradeoff. Specifics over adjectives.',
  '- STRUCTURE DELIBERATELY: H1 title, intro prose before the first H2, ≥2 H2 body',
  '  sections, then a conclusion H2.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] Word count is in [1200, 3000]',
  '- [ ] One H1 title; at least 2 H2 body sections; a conclusion H2',
  '- [ ] Intro prose appears before the first H2 (≥ ~25 words)',
  '- [ ] Persona voice present throughout (formality, vocabulary, POV)',
  '- [ ] No phrase from the persona do-not-say list',
  '- [ ] Nothing truncated mid-thought',
  '',
  '# Constraints',
  '',
  '- DO NOT include rubric text (you have none) or address "the judge".',
  '- DO NOT cite sources inline ("[1]", footnotes) — the Master holds the',
  '  citations; the article is the publishable surface.',
  '- DO NOT use any phrase on the persona do-not-say list.',
  '- DO NOT exceed 3,000 words.',
  '- DO NOT wrap the JSON in prose or markdown fences.',
  '',
  '# Interaction protocol',
  '',
  'Return ONLY a JSON object (no markdown, no prose outside JSON):',
  '{',
  '  "title": "<the article title>",',
  '  "markdown": "<the full article in markdown: # H1, intro prose, ## H2 sections, ## Conclusion>"',
  '}',
].join('\n')

function personaBlock(ctx: RepurposeContext): string {
  const p = ctx.persona
  return [
    'PERSONA — write in this voice:',
    `- Name: ${p.name}`,
    p.voiceSummary ? `- Voice: ${p.voiceSummary}` : '',
    p.pointOfView ? `- Point of view: ${p.pointOfView}` : '',
    p.audienceSummary ? `- Audience: ${p.audienceSummary}` : '',
    p.signatureHooks.length ? `- Opening moves: ${p.signatureHooks.join('; ')}` : '',
    p.signaturePhrases.length ? `- Signature phrases (use where natural): ${p.signaturePhrases.join('; ')}` : '',
    p.doNotSay.length ? `- Never say: ${p.doNotSay.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function masterBlock(ctx: RepurposeContext): string {
  const body = ctx.sections
    .map((s) => `## ${s.heading}\n${s.contentMarkdown}`)
    .join('\n\n')
  return [
    `LONG-FORM MASTER — "${ctx.masterTitle}" (raw material to expand and structure):`,
    body,
  ].join('\n')
}

function buildUser(ctx: RepurposeContext): string {
  return [
    personaBlock(ctx),
    '',
    masterBlock(ctx),
    '',
    `Write ONE long-form article (1,200–3,000 words) on "${ctx.ideaTitle}".`,
    'H1 title, an intro before the first H2, at least 2 H2 body sections, and an',
    'explicit conclusion H2.',
  ].join('\n')
}

interface RawResponse {
  title?: string
  markdown?: string
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()
}

function parseResponse(raw: string): RawResponse | null {
  try {
    const parsed = JSON.parse(stripFences(raw))
    if (parsed && typeof parsed.markdown === 'string') return parsed as RawResponse
    return null
  } catch {
    return null
  }
}

/** Count whitespace-delimited words; recomputed in code (never trust the LLM count). */
function wordCount(markdown: string): number {
  return markdown.trim().split(/\s+/).filter(Boolean).length
}

/** Derive a fallback title from the first H1 line, if the model omitted one. */
function titleFromMarkdown(markdown: string, fallback: string): string {
  const h1 = /^#[ \t]+(.+)$/m.exec(markdown)
  return h1 ? h1[1].trim() : fallback
}

function toArtifact(parsed: RawResponse, ctx: RepurposeContext): ArticleArtifact {
  const markdown = (parsed.markdown ?? '').trim()
  const title = parsed.title?.trim() || titleFromMarkdown(markdown, ctx.ideaTitle)
  return { title, markdown, wordCount: wordCount(markdown) }
}

export function createArticleProducer(deps: ArticleProducerDeps = {}): ArticleProducer {
  const model = deps.model ?? DEFAULT_MODEL
  const maxTokens = deps.maxTokens ?? DEFAULT_MAX_TOKENS
  const onCost = deps.onCost

  const client =
    deps.client ??
    (() => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set — cannot create article producer')
      }
      return new Anthropic({ apiKey })
    })()

  return {
    async produce({ context }: ArticleProduceArgs): Promise<ArticleArtifact> {
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUser(context) }],
      })
      const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      onCost?.({
        source: 'producer',
        model,
        tokensIn: res.usage.input_tokens,
        tokensOut: res.usage.output_tokens,
        costUSD: calculateCost(model, res.usage.input_tokens, res.usage.output_tokens),
      })
      const parsed = parseResponse(textBlock?.text ?? '')
      // On unparseable output, return an empty article — the validator fails it
      // and the loop revises (produces again) rather than crashing.
      if (!parsed) return { title: context.ideaTitle, markdown: '', wordCount: 0 }
      return toArtifact(parsed, context)
    },
  }
}
