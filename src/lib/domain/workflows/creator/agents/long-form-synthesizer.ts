// Long-Form Master Synthesizer (Stage 3) — Claude Sonnet, structured output.
// Domain configuration: knows WHAT to synthesize (the idea, in this persona's
// voice, grounded in the dossier) and HOW to shape a structured, source-
// traceable LongFormMaster. The HOW-to-call-Claude machinery is the Anthropic
// SDK; cost tracking goes through Core pricing.
//
// This is the single PRODUCER in a Standard loop (Pattern 1). Per rubrics.md
// Rule 5 it NEVER sees the rubric — on revise it gets PRESERVE/IMPROVE feedback
// derived from the judge's grade (loop rule 4), not rubric text.
//
// Citations: the synthesizer cites sources by short stable handles (S1, S2, …)
// because the real ResearchSource ids are opaque cuids an LLM cannot echo
// reliably. The handles are mapped back to researchSourceIds in code here, so
// the returned MasterArtifact carries real ids the validator + persistence use.

import Anthropic from '@anthropic-ai/sdk'
import { calculateCost } from '../../../../core/agentic/pricing'
import type { GradeReport } from '../../../../core/engine/types'
import type {
  MasterArtifact,
  MasterContext,
  MasterCostEvent,
  MasterSection,
  MasterSourceInput,
  MasterSourceRef,
} from '../types'
import { assembleCreatorContext, CREATOR_CONTEXT_PRIORITIES } from '../context/curation'

export interface LongFormSynthesizerDeps {
  client?: Anthropic
  model?: string
  onCost?: (event: MasterCostEvent) => void
  maxTokens?: number
}

export interface SynthesizeProduceArgs {
  context: MasterContext
}

export interface SynthesizeReviseArgs {
  context: MasterContext
  previous: MasterArtifact
  grade: GradeReport
}

export interface LongFormSynthesizer {
  produce(args: SynthesizeProduceArgs): Promise<MasterArtifact>
  revise(args: SynthesizeReviseArgs): Promise<MasterArtifact>
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 8192

/**
 * Context-block priorities for the Stage-3 synthesizer prompt. CR-8 lifted the
 * curation MACHINERY into the Core PassthroughCurator (assembleMasterContext
 * below routes through it via the domain curation seam); these numbers are the
 * Stage-3 view of the shared CREATOR_CONTEXT_PRIORITIES
 * (docs/01-architecture/context-system.md) and are still printed inline so the
 * model sees each block's relative importance.
 */
export const MASTER_CONTEXT_PRIORITIES = {
  persona: CREATOR_CONTEXT_PRIORITIES.persona,
  idea: CREATOR_CONTEXT_PRIORITIES.idea,
  researchSources: CREATOR_CONTEXT_PRIORITIES.researchSources,
  uploadedDocs: CREATOR_CONTEXT_PRIORITIES.uploadedDocs,
} as const

// ─── Citation handles ────────────────────────────────────────────────────────

/** `S1`, `S2`, … in dossier order. */
function handleFor(index: number): string {
  return `S${index + 1}`
}

function handleToIdMap(sources: MasterSourceInput[]): Map<string, string> {
  return new Map(sources.map((s, i) => [handleFor(i), s.researchSourceId]))
}

function idToHandleMap(sources: MasterSourceInput[]): Map<string, string> {
  return new Map(sources.map((s, i) => [s.researchSourceId, handleFor(i)]))
}

// ─── Prompt building ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are the Long-Form Master synthesizer for the CreatorOS content pipeline.',
  'You turn a research dossier into a structured, source-traceable knowledge',
  'asset — the "Long-Form Master" — that downstream producers later repurpose',
  'into LinkedIn posts and articles. You run as the single producer in a',
  'Standard quality loop: produce → validate → judge → revise. You do NOT see',
  'the rubric; between iterations you receive PRESERVE/IMPROVE feedback.',
  '',
  '# Mission',
  '',
  'Given an idea, a creator persona, and a dossier of researched sources,',
  'produce ONE Long-Form Master that:',
  '1. Has 4-6 ordered sections (at least 3), each with a clear heading and a',
  '   substantial markdown body of roughly 250-400 words.',
  '2. Totals well over 800 words. 800 is a HARD validation floor, so aim for',
  '   1,200-1,600 words to clear it with margin. A master under 800 words is',
  '   rejected outright and the whole iteration is wasted.',
  '3. Treats the idea thoroughly — mechanisms, evidence, competing views, and',
  '   implications — not one shallow pass.',
  '4. Grounds every claim: each section cites at least one source by its handle',
  '   (S1, S2, …), and every claim traces to a cited source. Never invent facts',
  '   or sources.',
  "5. Reads in the persona's voice and point of view.",
  '',
  '# Core behaviors',
  '',
  '- READ THE PERSONA FIRST. Match its formality, vocabulary, cadence, and POV.',
  '  Never use a phrase on its do-not-say list.',
  '- USE ONLY THE PROVIDED SOURCES. Cite by handle. If a claim is not supported',
  '  by a source you were given, cut the claim or anchor it to the right source.',
  '- ONE SECTION = ONE COHERENT SUBTOPIC. Order sections so the master builds an',
  '  argument, not a flat list.',
  '- WRITE A relevanceSnippet PER CITATION: the specific finding or phrase from',
  '  that source the section relies on.',
  '- ON REVISE: apply PRESERVE/IMPROVE surgically — keep what scored well, fix',
  '  the flagged weaknesses, deepen thin coverage. Do not regress what works.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] 4-6 sections (at least 3), each with heading + a ~250-400 word body',
  '- [ ] Comfortably over 800 words total (target 1,200-1,600) — do not undershoot',
  '- [ ] Every section cites at least one provided source handle',
  '- [ ] Every cited handle exists in the SOURCES list',
  '- [ ] No do-not-say phrases',
  '- [ ] Persona voice + point of view present',
  '- [ ] No claim left without a supporting cited source',
  '',
  '# Constraints',
  '',
  '- DO NOT invent sources, URLs, or facts. Cite only handles from SOURCES.',
  '- DO NOT cite a handle you were not given.',
  '- DO NOT leave any section uncited.',
  '- DO NOT include rubric text (you do not have it) or address "the judge".',
  '- DO NOT wrap the JSON in prose or markdown fences.',
  '',
  '# Interaction protocol',
  '',
  'Return ONLY a JSON object (no markdown, no prose outside JSON):',
  '{',
  '  "title": "<refined master title>",',
  '  "sections": [',
  '    {',
  '      "heading": "<section heading>",',
  '      "contentMarkdown": "<the section body, in markdown>",',
  '      "sourceRefs": [',
  '        { "sourceId": "S1", "relevanceSnippet": "<the finding from S1 this section uses>" }',
  '      ]',
  '    }',
  '  ]',
  '}',
  'Section order is implied by array position — list sections in reading order.',
].join('\n')

function personaBlock(ctx: MasterContext): string {
  const p = ctx.persona
  return [
    `PERSONA (priority ${MASTER_CONTEXT_PRIORITIES.persona}) — write in this voice:`,
    `- Name: ${p.name}`,
    p.voiceSummary ? `- Voice: ${p.voiceSummary}` : '',
    p.pointOfView ? `- Point of view: ${p.pointOfView}` : '',
    p.audienceSummary ? `- Audience: ${p.audienceSummary}` : '',
    p.doNotSay.length ? `- Never say: ${p.doNotSay.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function ideaBlock(ctx: MasterContext): string {
  return [
    `IDEA (priority ${MASTER_CONTEXT_PRIORITIES.idea}):`,
    `- Title: ${ctx.ideaTitle}`,
    ctx.ideaDescription ? `- Description: ${ctx.ideaDescription}` : '',
    ctx.niches.length ? `- Topic area: ${ctx.niches.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function sourcesBlock(ctx: MasterContext): string {
  const list = ctx.sources
    .map(
      (s, i) =>
        `${handleFor(i)}. ${s.title}\n   ${s.url}\n   ${s.snippet || '(no excerpt)'}`
    )
    .join('\n')
  return [
    `SOURCES (priority ${MASTER_CONTEXT_PRIORITIES.researchSources}) — cite these by handle:`,
    list,
  ].join('\n')
}

function uploadsBlock(ctx: MasterContext): string {
  if (!ctx.uploadedDocs || ctx.uploadedDocs.length === 0) return ''
  const list = ctx.uploadedDocs.map((d) => `- ${d.title}: ${d.content}`).join('\n')
  return [`UPLOADED DOCS (priority ${MASTER_CONTEXT_PRIORITIES.uploadedDocs}):`, list].join('\n')
}

/**
 * Assemble the synthesizer's context through the Core curator (System 6). V1
 * PassthroughCurator keeps every non-empty block in priority order, so the result
 * matches the prior hand-ordered join — the curator now owns the keep/drop/order
 * decision (docs/01-architecture/context-system.md).
 */
async function assembleMasterContext(ctx: MasterContext): Promise<string> {
  const { text } = await assembleCreatorContext([
    { id: 'persona', priority: MASTER_CONTEXT_PRIORITIES.persona, text: personaBlock(ctx) },
    { id: 'idea', priority: MASTER_CONTEXT_PRIORITIES.idea, text: ideaBlock(ctx) },
    { id: 'sources', priority: MASTER_CONTEXT_PRIORITIES.researchSources, text: sourcesBlock(ctx) },
    { id: 'uploads', priority: MASTER_CONTEXT_PRIORITIES.uploadedDocs, text: uploadsBlock(ctx) },
  ])
  return text
}

function buildProduceUser(ctx: MasterContext, contextText: string): string {
  return [
    contextText,
    '',
    `Synthesize the Long-Form Master now. Aim for 4-6 sections and 1,200-1,600`,
    `words total — 800 is a hard floor, so clear it with margin. Every section`,
    `cited. Refined title should sharpen "${ctx.ideaTitle}".`,
  ].join('\n')
}

function buildPreserveImprove(grade: GradeReport): string {
  const preserve = grade.dimensionScores
    .filter((d) => d.score >= 8)
    .map((d) => `- ${d.name} (${d.score}/10) — keep this working.`)
  const improve = grade.dimensionScores
    .filter((d) => d.score < 8)
    .map((d) => `- ${d.name} (${d.score}/10): ${d.feedback}`)
  return [
    preserve.length ? 'PRESERVE (already strong — do not regress):' : '',
    ...preserve,
    improve.length ? 'IMPROVE (fix these):' : '',
    ...improve,
    grade.improvementPriorities.length
      ? `Priorities: ${grade.improvementPriorities.join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function renderPreviousMaster(
  previous: MasterArtifact,
  idToHandle: Map<string, string>
): string {
  return previous.sections
    .map((s) => {
      const cited = s.sourceRefs
        .map((r) => idToHandle.get(r.researchSourceId) ?? '?')
        .join(', ')
      const excerpt =
        s.contentMarkdown.length > 320
          ? `${s.contentMarkdown.slice(0, 320)}…`
          : s.contentMarkdown
      return `## ${s.heading}\n(cited: ${cited})\n${excerpt}`
    })
    .join('\n\n')
}

function buildReviseUser(args: SynthesizeReviseArgs, contextText: string): string {
  const { previous, grade } = args
  return [
    contextText,
    '',
    'A reviewer graded your previous Long-Form Master. Revise it.',
    '',
    buildPreserveImprove(grade),
    '',
    'YOUR PREVIOUS MASTER (revise this — keep the strong parts):',
    renderPreviousMaster(previous, idToHandleMap(previous.sources)),
    '',
    'Return the full revised master as JSON. Expand any thin section so the',
    'master stays well over 800 words (target 1,200-1,600). Keep every section',
    'cited and stay in the persona voice.',
  ].join('\n')
}

// ─── Response parsing ────────────────────────────────────────────────────────

interface RawSection {
  heading?: string
  contentMarkdown?: string
  sourceRefs?: { sourceId?: string; relevanceSnippet?: string }[]
}
interface RawSynthResponse {
  title?: string
  sections?: RawSection[]
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()
}

function parseSynthResponse(raw: string): RawSynthResponse | null {
  try {
    const parsed = JSON.parse(stripFences(raw))
    if (parsed && Array.isArray(parsed.sections)) return parsed as RawSynthResponse
    return null
  } catch {
    return null
  }
}

/** Map a parsed response into a MasterArtifact, resolving handles → ids. */
function toMasterArtifact(
  parsed: RawSynthResponse,
  ctx: MasterContext,
  fallbackTitle: string
): MasterArtifact {
  const handleToId = handleToIdMap(ctx.sources)

  const sections: MasterSection[] = (parsed.sections ?? []).map((s, i) => {
    const sourceRefs: MasterSourceRef[] = (s.sourceRefs ?? [])
      .map((r) => {
        const id = r.sourceId ? handleToId.get(r.sourceId.trim()) : undefined
        if (!id) return null
        return {
          researchSourceId: id,
          relevanceSnippet: r.relevanceSnippet?.trim() || 'Cited source',
        }
      })
      .filter((r): r is MasterSourceRef => r !== null)

    return {
      order: i + 1,
      heading: s.heading?.trim() ?? '',
      contentMarkdown: s.contentMarkdown?.trim() ?? '',
      sourceRefs,
    }
  })

  return {
    title: parsed.title?.trim() || fallbackTitle,
    sections,
    sources: ctx.sources,
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createLongFormSynthesizer(
  deps: LongFormSynthesizerDeps = {}
): LongFormSynthesizer {
  const model = deps.model ?? DEFAULT_MODEL
  const maxTokens = deps.maxTokens ?? DEFAULT_MAX_TOKENS
  const onCost = deps.onCost

  const client =
    deps.client ??
    (() => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set — cannot create synthesizer')
      }
      return new Anthropic({ apiKey })
    })()

  async function call(user: string): Promise<string> {
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: user }],
    })
    const textBlock = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    )
    onCost?.({
      source: 'synthesizer',
      model,
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
      costUSD: calculateCost(model, res.usage.input_tokens, res.usage.output_tokens),
    })
    return textBlock?.text ?? ''
  }

  /** Degenerate master — fails the validator, so the loop revises gracefully. */
  function emptyMaster(ctx: MasterContext): MasterArtifact {
    return { title: ctx.ideaTitle, sections: [], sources: ctx.sources }
  }

  return {
    async produce({ context }: SynthesizeProduceArgs): Promise<MasterArtifact> {
      const contextText = await assembleMasterContext(context)
      const text = await call(buildProduceUser(context, contextText))
      const parsed = parseSynthResponse(text)
      if (!parsed) return emptyMaster(context)
      return toMasterArtifact(parsed, context, context.ideaTitle)
    },

    async revise(args: SynthesizeReviseArgs): Promise<MasterArtifact> {
      const { context, previous } = args
      const contextText = await assembleMasterContext(context)
      const text = await call(buildReviseUser(args, contextText))
      const parsed = parseSynthResponse(text)
      // On a bad revise turn, keep the prior master rather than discarding work.
      if (!parsed) return previous
      const next = toMasterArtifact(parsed, context, previous.title)
      // If the revise produced nothing usable, preserve the previous master.
      return next.sections.length > 0 ? next : previous
    },
  }
}
