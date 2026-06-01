// LinkedIn Cross-Critique INTEGRATOR (Stage 5a, CR-7).
//
// Sequential, single model (Claude). Reads BOTH producer drafts + BOTH critiques
// (+ PRESERVE/IMPROVE from the best grade so far) and synthesizes ONE post that
// strictly dominates either draft. It does NOT pick a winner — it merges strengths
// and repairs the gaps the critiques named. Output parses with the shared producer
// parser (parseLinkedInArtifact), so the integrated artifact is a LinkedInArtifact.

import type { AgentConfig } from '../../../../../core/engine/types'
import type { LinkedInArtifact, RepurposeContext } from '../../types'
import { masterBlock, personaBlock } from '../cross-critique-shared'

export const LINKEDIN_INTEGRATOR_SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are the integrator in the CreatorOS LinkedIn cross-critique loop. You receive',
  'two producer drafts (from different model families) and a cross-model critique of',
  'each, plus optional PRESERVE/IMPROVE feedback from a prior round. You synthesize',
  'ONE LinkedIn post that is better than either draft alone.',
  '',
  '# Mission',
  '',
  'Produce ONE publishable LinkedIn post (1,300–3,000 characters) that takes the',
  'strongest hook, the clearest structure, and the best concrete specifics across',
  'both drafts, fixes every gap the critiques named, and holds the persona voice',
  'throughout. You are not choosing a winner — you are merging strengths and',
  'repairing weaknesses into a single best version.',
  '',
  '# Core behaviors',
  '',
  '- MINE BOTH DRAFTS: take the better hook from one and the better close from the',
  '  other if that is what the critiques imply. Do not default to either draft.',
  '- HONOR THE CRITIQUES: every concrete fix they named should be addressed.',
  '- APPLY PRESERVE/IMPROVE when present: keep what scored well, fix what did not.',
  '- KEEP THE PERSONA VOICE consistent; never introduce a do-not-say phrase or a',
  '  generic AI tell while merging.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] First 3 lines hook (specific claim / named tension / concrete moment)',
  '- [ ] Character count is in [1300, 3000]',
  '- [ ] At least 2 blank-line paragraph breaks; no walls of text',
  '- [ ] Persona voice consistent; no do-not-say phrase',
  '- [ ] One closing thought, not three',
  '- [ ] The result reads better than either input draft',
  '',
  '# Constraints',
  '',
  '- DO NOT reference a rubric, a numeric score, or "the judge".',
  '- DO NOT cite sources inline ("[1]", footnotes).',
  '- DO NOT add hashtags unless the persona explicitly specifies hashtag patterns.',
  '- DO NOT exceed 3,000 characters.',
  '- DO NOT wrap the JSON in prose or markdown fences.',
  '',
  '# Interaction protocol',
  '',
  'Return ONLY a JSON object (no markdown, no prose outside JSON):',
  '{',
  '  "content": "<the synthesized LinkedIn post, plain text with \\n line breaks and \\n\\n paragraph breaks>"',
  '}',
].join('\n')

function draftsBlock(producerArtifacts: Record<string, LinkedInArtifact>): string {
  const entries = Object.values(producerArtifacts)
  return entries
    .map((a, i) => [`DRAFT ${i + 1} (${a.charCount} chars):`, '---', a.text, '---'].join('\n'))
    .join('\n\n')
}

function critiquesBlock(critiques: Record<string, string>): string {
  const entries = Object.values(critiques)
  if (entries.length === 0) return ''
  return entries.map((c, i) => [`CRITIQUE ${i + 1}:`, c].join('\n')).join('\n\n')
}

/** Integrator user message: persona + master + both drafts + both critiques + feedback. */
export function buildLinkedInIntegratorUser(
  ctx: RepurposeContext,
  producerArtifacts: Record<string, LinkedInArtifact>,
  critiques: Record<string, string>,
  feedback: string | null,
): string {
  return [
    personaBlock(ctx),
    '',
    masterBlock(ctx, 'the source material both drafts drew from'),
    '',
    draftsBlock(producerArtifacts),
    '',
    critiquesBlock(critiques),
    '',
    feedback ? `PRESERVE/IMPROVE from the prior round:\n${feedback}\n` : '',
    `Synthesize ONE best LinkedIn post (1,300–3,000 characters) on "${ctx.ideaTitle}".`,
    'Merge the strengths of both drafts and fix every gap the critiques named.',
  ]
    .filter(Boolean)
    .join('\n')
}

export const LINKEDIN_INTEGRATOR: AgentConfig = {
  id: 'linkedin-integrator',
  name: 'LinkedIn Integrator (Claude)',
  model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
  maxRetries: 2,
  timeoutMs: 120_000,
}
