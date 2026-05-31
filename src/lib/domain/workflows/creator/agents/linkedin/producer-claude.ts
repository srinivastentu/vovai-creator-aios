// LinkedIn Post Producer (Stage 5a) — Claude Sonnet.
// Domain configuration: knows WHAT to produce (a publishable LinkedIn post in
// the persona's voice, compressed from the Long-Form Master) and HOW to shape
// it for the platform. The HOW-to-call-Claude machinery is the Anthropic SDK;
// cost tracking goes through Core pricing.
//
// CR-5 status: single producer in a Standard loop with a real cross-model judge
// (Gemini). produce → validate → judge → revise. On revise the producer gets
// PRESERVE/IMPROVE feedback derived from the judge's grade (loop rule 4), never
// the rubric (rubrics.md Rule 5). CR-7 adapts this into Producer A of the
// Cross-Critique pattern (a parallel GPT producer, mutual critics, an integrator).

import Anthropic from '@anthropic-ai/sdk'
import { calculateCost } from '../../../../../core/agentic/pricing'
import type { GradeReport } from '../../../../../core/engine/types'
import type { LinkedInArtifact, RepurposeContext, RepurposeCostEvent } from '../../types'

export interface LinkedInProducerDeps {
  client?: Anthropic
  model?: string
  onCost?: (event: RepurposeCostEvent) => void
  maxTokens?: number
}

export interface LinkedInProduceArgs {
  context: RepurposeContext
}

export interface LinkedInReviseArgs {
  context: RepurposeContext
  previous: LinkedInArtifact
  grade: GradeReport
}

export interface LinkedInProducer {
  produce(args: LinkedInProduceArgs): Promise<LinkedInArtifact>
  revise(args: LinkedInReviseArgs): Promise<LinkedInArtifact>
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 2048

const SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are the LinkedIn post producer for the CreatorOS content pipeline. You',
  'turn a finished Long-Form Master into ONE publishable LinkedIn post (1,300–',
  "3,000 characters) in the creator's voice. You run as the single producer in a",
  'Standard quality loop: produce → validate → judge → revise. You do NOT see a',
  'rubric; between iterations you receive PRESERVE/IMPROVE feedback.',
  '',
  '# Mission',
  '',
  'Given a Long-Form Master and a creator persona, produce one LinkedIn post that:',
  '1. Hooks the reader in the first 3 lines (1–2 short sentences each).',
  '2. Sounds like the persona — not a generic AI writer.',
  '3. Compresses the central insight of the Master into a scannable post without',
  '   losing the point. Pick the single strongest idea; do not summarize all of it.',
  '4. Uses blank-line paragraph breaks for scannability — no walls of text.',
  '5. Closes with ONE clear thought, question, or CTA — not all three.',
  '',
  '# Core behaviors',
  '',
  '- READ THE PERSONA FIRST. Match its formality, vocabulary, and point of view.',
  '  Reach for its signature phrases where they fit naturally; never force them.',
  '- WRITE FOR THE FIRST THREE LINES. They earn the rest of the read. Open with a',
  '  specific claim, a named tension, or a concrete moment — never a throat-clear.',
  '- USE THE MASTER AS RAW MATERIAL, not text to paraphrase. Extract the strongest',
  '  insight and build the post around it.',
  '- BE CONCRETE. Name the pattern, show the tradeoff. Specifics over adjectives.',
  '- ON REVISE: apply PRESERVE/IMPROVE surgically — keep what scored well, fix the',
  '  flagged weaknesses. Do not regress what already works.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] First 3 lines pass the "would I keep scrolling?" test',
  '- [ ] Character count is in [1300, 3000]',
  '- [ ] At least 2 blank-line paragraph breaks (no walls of text)',
  '- [ ] Persona voice present (formality, vocabulary, POV)',
  '- [ ] No phrase from the persona do-not-say list',
  '- [ ] One closing thought, not three',
  '',
  '# Constraints',
  '',
  '- DO NOT include rubric text (you have none) or address "the judge".',
  '- DO NOT cite sources inline ("[1]", footnotes) — LinkedIn posts do not.',
  '- DO NOT add hashtags unless the persona explicitly specifies hashtag patterns.',
  '- DO NOT exceed 3,000 characters under any circumstances.',
  '- DO NOT use any phrase on the persona do-not-say list.',
  '- DO NOT wrap the JSON in prose or markdown fences.',
  '',
  '# Interaction protocol',
  '',
  'Return ONLY a JSON object (no markdown, no prose outside JSON):',
  '{',
  '  "content": "<the LinkedIn post, plain text with \\n line breaks and \\n\\n paragraph breaks>"',
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
    `LONG-FORM MASTER — "${ctx.masterTitle}" (raw material; extract the strongest insight):`,
    body,
  ].join('\n')
}

function buildUser(ctx: RepurposeContext): string {
  return [
    personaBlock(ctx),
    '',
    masterBlock(ctx),
    '',
    `Write ONE LinkedIn post (1,300–3,000 characters) on "${ctx.ideaTitle}".`,
    'Hook in the first 3 lines. Use blank-line paragraph breaks. One closing thought.',
  ].join('\n')
}

/** PRESERVE/IMPROVE feedback from the judge's grade (loop rule 4). No rubric text. */
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

function buildReviseUser(args: LinkedInReviseArgs): string {
  const { context: ctx, previous, grade } = args
  return [
    personaBlock(ctx),
    '',
    masterBlock(ctx),
    '',
    'A reviewer graded your previous LinkedIn post. Revise it.',
    '',
    buildPreserveImprove(grade),
    '',
    'YOUR PREVIOUS POST (revise this — keep the strong parts):',
    previous.text,
    '',
    `Return ONE revised LinkedIn post (1,300–3,000 characters) on "${ctx.ideaTitle}" as JSON.`,
    'Keep the hook, paragraph breaks, and persona voice. One closing thought.',
  ].join('\n')
}

interface RawResponse {
  content?: string
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
    if (parsed && typeof parsed.content === 'string') return parsed as RawResponse
    return null
  } catch {
    return null
  }
}

/** Build the artifact, recomputing charCount in code (never trust the LLM count). */
function toArtifact(text: string): LinkedInArtifact {
  const clean = text.trim()
  return { text: clean, charCount: clean.length }
}

export function createLinkedInProducer(deps: LinkedInProducerDeps = {}): LinkedInProducer {
  const model = deps.model ?? DEFAULT_MODEL
  const maxTokens = deps.maxTokens ?? DEFAULT_MAX_TOKENS
  const onCost = deps.onCost

  const client =
    deps.client ??
    (() => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set — cannot create LinkedIn producer')
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
    const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    onCost?.({
      source: 'producer',
      model,
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
      costUSD: calculateCost(model, res.usage.input_tokens, res.usage.output_tokens),
    })
    return textBlock?.text ?? ''
  }

  return {
    async produce({ context }: LinkedInProduceArgs): Promise<LinkedInArtifact> {
      const text = await call(buildUser(context))
      const parsed = parseResponse(text)
      // On unparseable output, return an empty post — the validator fails it and
      // the loop revises (produces again) rather than crashing.
      return toArtifact(parsed?.content ?? '')
    },

    async revise(args: LinkedInReviseArgs): Promise<LinkedInArtifact> {
      const text = await call(buildReviseUser(args))
      const parsed = parseResponse(text)
      // On a bad revise turn, keep the prior post rather than discarding work.
      if (!parsed?.content) return args.previous
      return toArtifact(parsed.content)
    },
  }
}
