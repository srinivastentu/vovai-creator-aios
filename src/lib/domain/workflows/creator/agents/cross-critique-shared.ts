// Shared rendering helpers for the Stage-5 Cross-Critique agent set (CR-7).
// Domain configuration: these turn a RepurposeContext (persona + Long-Form Master)
// and a judge GradeReport into the prompt blocks every cross-critique role reuses.
// Kept in one place so the producer / critic / integrator files (LinkedIn + article)
// don't each re-implement persona/master rendering or fence-stripping.

import type { GradeReport } from '../../../../core/engine/types'
import type { RepurposeContext } from '../types'
import { assembleCreatorContext, CREATOR_CONTEXT_PRIORITIES } from '../context/curation'

/** PERSONA block — the voice the producer/integrator must write in. */
export function personaBlock(ctx: RepurposeContext): string {
  const p = ctx.persona
  return [
    'PERSONA — write in this voice:',
    `- Name: ${p.name}`,
    p.voiceSummary ? `- Voice: ${p.voiceSummary}` : '',
    p.pointOfView ? `- Point of view: ${p.pointOfView}` : '',
    p.audienceSummary ? `- Audience: ${p.audienceSummary}` : '',
    p.signatureHooks.length ? `- Opening moves: ${p.signatureHooks.join('; ')}` : '',
    p.signaturePhrases.length
      ? `- Signature phrases (use where natural): ${p.signaturePhrases.join('; ')}`
      : '',
    p.doNotSay.length ? `- Never say: ${p.doNotSay.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** LONG-FORM MASTER block — the raw material the artifact is built from. */
export function masterBlock(ctx: RepurposeContext, label: string): string {
  const body = ctx.sections.map((s) => `## ${s.heading}\n${s.contentMarkdown}`).join('\n\n')
  return [`LONG-FORM MASTER — "${ctx.masterTitle}" (${label}):`, body].join('\n')
}

/**
 * The producer's stable context — persona + Long-Form Master — joined the way the
 * curator does (blank line between blocks). Used as the inline fallback when a
 * RepurposeContext has not been pre-curated (direct unit-test calls); the live
 * path uses the pre-curated `curatedContextBlock` from prepareRepurposeContext.
 */
export function defaultProducerContext(ctx: RepurposeContext, masterLabel: string): string {
  return [personaBlock(ctx), masterBlock(ctx, masterLabel)].join('\n\n')
}

/**
 * Curate the producer's stable context (persona + Long-Form Master) through the
 * Core ContextCurator (System 6) ONCE, before the cross-critique loop (CR-8), and
 * stash it on the context as `curatedContextBlock`. Producers then read it instead
 * of re-rendering persona+master each iteration. Per-iteration judge feedback is
 * deliberately NOT curated — it is a small, per-turn control signal (PRESERVE/
 * IMPROVE), appended raw by the producer builder. Under the V1 budget nothing is
 * dropped, so the curated block equals defaultProducerContext — the value is the
 * seam, not a behaviour change. docs/01-architecture/context-system.md.
 */
export async function prepareRepurposeContext(
  ctx: RepurposeContext,
  masterLabel: string,
): Promise<RepurposeContext> {
  const { text } = await assembleCreatorContext([
    { id: 'persona', priority: CREATOR_CONTEXT_PRIORITIES.persona, text: personaBlock(ctx) },
    {
      id: 'master',
      priority: CREATOR_CONTEXT_PRIORITIES.longFormMaster,
      text: masterBlock(ctx, masterLabel),
    },
  ])
  return { ...ctx, curatedContextBlock: text }
}

/**
 * PRESERVE/IMPROVE block derived from the judge's grade (loop rule 4 + Pattern-5
 * rule 11 — producers/integrator see this, NEVER the rubric). Null grade → ''.
 */
export function preserveImproveBlock(grade: GradeReport | null): string {
  if (!grade) return ''
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

/** Strip markdown code fences a model may wrap JSON in, before JSON.parse. */
export function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()
}
