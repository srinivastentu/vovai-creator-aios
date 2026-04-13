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
  /** Opt-OUT of appending CITATION_HYGIENE + OPENING_DE_TEMPLATING to every
   *  system prompt. Default: false (addons are appended automatically). */
  skipDefaultAddons?: boolean
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_FALLBACK = 'claude-haiku-4-5-20251001'
const DEFAULT_MAX_TOKENS = 2048

export const CITATION_HYGIENE = [
  'CITATION HYGIENE (mandatory):',
  '- Do NOT use citation-shaped phrases without naming a primary source:',
  '  forbidden unless followed by a named org/paper/author-year: "according to",',
  '  "studies suggest", "research indicates", "based on data from", "experts agree",',
  '  "historical analyses show", "reports indicate".',
  '- If you cannot name a specific source, use an honest hedge instead: "estimates',
  '  vary", "roughly", "on the order of", "by some accounts".',
  '- Named sources are welcome: "the 2020 Nobel Prize in Chemistry", "NREL\'s 2023',
  '  report", "Doudna and Charpentier\'s 2012 paper". Vague citation-theatre is not.',
].join('\n')

export const OPENING_DE_TEMPLATING = [
  'OPENING PARAGRAPH — avoid over-used templates:',
  '- Do NOT open with: "Every [time-unit]…", "[Something] has undergone a dramatic',
  '  transformation", "[Person], a [role]… forever changed", "In a world where…".',
  '- Pick ONE of these opening strategies instead:',
  '  (a) a counterintuitive fact the reader does not expect,',
  '  (b) a named person performing a specific, concrete action,',
  '  (c) a concrete scene tied to a specific time and place,',
  '  (d) a question the reader has probably wondered about themselves.',
].join('\n')

export const DEFAULT_PROMPT_ADDONS = `\n\n${CITATION_HYGIENE}\n\n${OPENING_DE_TEMPLATING}`

// Per-dimension improvement strategies — describe HOW to improve each
// well-known text-rubric dimension. Keyed by dimensionId with a name-based
// fallback so this stays resilient to rubric renames.
const IMPROVE_STRATEGIES: Record<string, string> = {
  depth:
    'Deepen with ONE concrete example per revised paragraph — a named case study, a specific date, or a step-by-step mechanism. Do NOT introduce more than 2 new technical terms across the whole revision, and every new term must be paired with a plain-English gloss or a concrete example. Terminology without narrative is not depth — it is jargon.',
  clarity:
    'Sharpen existing sentences. Replace vague noun-phrases with specific ones. Collapse run-on sentences. Add a transitional phrase where two ideas feel disconnected.',
  engagement:
    'Strengthen the opening hook, add one memorable analogy, or tie an abstract idea to a concrete, relatable situation. Do not rewrite wholesale — make surgical inserts.',
  accuracy:
    'Use concrete, verifiable numbers to support claims. Round figures from reliable sources ("roughly 20%", "over 250 cities", "about 90% cost reduction") demonstrate research and build credibility. Use hedging language ("approximately", "roughly", "on the order of") where exact figures are uncertain. Do NOT strip all numbers — vague language ("a fraction", "some", "many") weakens the article. Only remove or fix figures that are false, fabricated-sounding, or use false precision on uncertain claims.',
  structure:
    'Tighten section order and transitions. Only add or rename sections if feedback specifically calls that out.',
}

function strategyFor(d: DimensionScore): string | null {
  const byId = IMPROVE_STRATEGIES[d.dimensionId]
  if (byId) return byId
  const byName = IMPROVE_STRATEGIES[d.name.toLowerCase()]
  return byName ?? null
}

export function buildRevisePrompt(args: {
  goal: string
  previous: Artifact<string>
  grade: GradeReport
  humanFeedback?: string
}): string {
  const { goal, previous, grade, humanFeedback } = args
  const preserve = grade.dimensionScores.filter((d) => d.score >= 8)
  const improve = grade.dimensionScores.filter((d) => d.score < 8)
  const allStrong = improve.length === 0 && preserve.length > 0

  const fmt = (d: DimensionScore) =>
    `- ${d.name} (${d.score}/10): ${d.feedback}`

  const fmtWithStrategy = (d: DimensionScore) => {
    const strat = strategyFor(d)
    const base = fmt(d)
    return strat ? `${base}\n    Strategy: ${strat}` : base
  }

  const originalWordCount = previous.content.trim().split(/\s+/).filter(Boolean).length
  const minWords = Math.round(originalWordCount * 0.85)
  const maxWords = Math.round(originalWordCount * 1.15)

  const human = humanFeedback
    ? `\n\nHuman reviewer also said: ${humanFeedback}`
    : ''

  // ELEVATE mode — all dimensions ≥ 8. A full rewrite risks regression.
  // Ask for 2–3 surgical enhancements to the dimensions closest to 8.
  if (allStrong) {
    const elevateTargets = [...preserve]
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
    const elevateBlock = [
      'ELEVATE mode — all dimensions already scored ≥ 8. Do NOT rewrite the article.',
      'Your task is to make 2–3 surgical enhancements that push one or two dimensions from "professional" toward "exceptional".',
      '',
      `Dimensions closest to 8 (focus here): ${elevateTargets
        .map((d) => `${d.name} (${d.score}/10)`)
        .join(', ')}`,
      '',
      'Pick 2–3 of the following, no more:',
      '- Add ONE memorable analogy or concrete example that makes an abstract idea stick.',
      '- Strengthen ONE transition between sections so the argument flows better.',
      '- Deepen ONE paragraph with a single "why it matters" insight.',
      '- Sharpen ONE sentence for maximum impact.',
      '- Rewrite the opening sentence to use a different rhetorical strategy if the current one follows a generic template ("Every X…", "dramatic transformation", etc.).',
      '',
      'CONSTRAINTS:',
      `- Length must stay within ±10% of the original (${originalWordCount} words). Target ${Math.round(originalWordCount * 0.9)}–${Math.round(originalWordCount * 1.1)} words.`,
      '- Do NOT rewrite existing strong paragraphs. Do NOT add new sections.',
      '- If a dimension scored ≥ 8 and drops in the revision, that is a FAILURE.',
    ].join('\n')

    return [
      `You previously produced this text for the goal: "${goal}"`,
      '',
      `--- PREVIOUS VERSION (v${previous.version}) ---`,
      previous.content,
      '--- END PREVIOUS ---',
      '',
      `A judge scored it ${grade.overallScore}/10 with all dimensions ≥ 8.`,
      '',
      elevateBlock + human,
      '',
      'Return only the revised text, no preamble.',
    ].join('\n')
  }

  const preserveBlock = preserve.length
    ? [
        `PRESERVE these strengths (scored >= 8):`,
        preserve.map(fmt).join('\n'),
        '',
        'PRESERVE RULES (MANDATORY):',
        '- Do NOT rewrite, replace, or significantly expand paragraphs that contribute to preserved dimensions.',
        '- Do NOT remove rhetorical devices, analogies, or narrative elements from preserved sections.',
        '- You may make minor word-level edits to preserved sections only if needed for coherence with improved sections.',
        '- If in doubt, leave preserved content unchanged.',
        '- A dimension that scored >= 8 and drops in the revision is a FAILURE. Prioritize protecting preserved dimensions over improving weak ones.',
      ].join('\n')
    : 'PRESERVE: (no strengths scored >= 8 yet)'

  const improveBlock = [
    `IMPROVE these weaknesses:`,
    improve.map(fmtWithStrategy).join('\n'),
    '',
    'IMPROVE BY DEEPENING, NOT EXPANDING:',
    '- Improve weak dimensions by enhancing EXISTING sections — better explanations, stronger examples, more specific details.',
    '- Do NOT add entirely new sections or topics unless the structure dimension specifically requires it.',
    `- Target length should stay within ±15% of the original (${originalWordCount} words). Revision should be ${minWords}-${maxWords} words.`,
    '- Surgical revision means changing specific sentences and paragraphs, not appending new content.',
    '- When deepening, prefer a concrete example or narrative over adding jargon or terminology.',
    '',
    'PROTECT CANONICAL FACTS:',
    '- Any specific percentage, date, named person, named study, or named case study present in the previous version MUST be retained in the revision unless it is factually wrong.',
    '- If you are uncertain about a figure, hedge it ("roughly 90%", "about 250 cities") rather than delete it.',
    '- Removing a correct, specific figure to "sound safer" is a regression.',
  ].join('\n')

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
  const skipDefaultAddons = opts.skipDefaultAddons ?? false
  const withAddons = (systemPrompt: string): string =>
    skipDefaultAddons ? systemPrompt : systemPrompt + DEFAULT_PROMPT_ADDONS

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
        withAddons(args.systemPrompt),
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
        withAddons(args.systemPrompt),
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
