// Long-Form Article Cross-Critique INTEGRATOR (Stage 5b, CR-7).
//
// Sequential, single model (Claude). Reads BOTH producer drafts + BOTH critiques
// (+ PRESERVE/IMPROVE) and synthesizes ONE article that strictly dominates either
// draft. Output parses with parseArticleArtifact (shared with the producer).

import type { AgentConfig } from '../../../../../core/engine/types'
import type { ArticleArtifact, RepurposeContext } from '../../types'
import { masterBlock, personaBlock } from '../cross-critique-shared'

export const ARTICLE_INTEGRATOR_SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are the integrator in the CreatorOS long-form article cross-critique loop. You',
  'receive two producer drafts (from different model families) and a cross-model',
  'critique of each, plus optional PRESERVE/IMPROVE feedback from a prior round. You',
  'synthesize ONE article that is better than either draft alone.',
  '',
  '# Mission',
  '',
  'Produce ONE publishable article (1,200–3,000 words) that takes the strongest',
  'intro, the clearest section architecture, the most substantive points, and the',
  'best concrete specifics across both drafts, fixes every gap the critiques named,',
  'and holds the persona voice end to end. You are not choosing a winner — you are',
  'merging strengths and repairing weaknesses into a single best version.',
  '',
  '# Core behaviors',
  '',
  '- MINE BOTH DRAFTS: take the better intro from one and the better section from the',
  '  other if the critiques imply it. Do not default to either draft.',
  '- HONOR THE CRITIQUES: every concrete fix they named should be addressed.',
  '- APPLY PRESERVE/IMPROVE when present: keep what scored well, deepen thin sections.',
  '- STRUCTURE DELIBERATELY: one H1 title, intro prose before the first H2, ≥2 H2',
  '  body sections, an explicit conclusion H2. Keep the persona voice consistent.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] Word count is in [1200, 3000]',
  '- [ ] One H1; intro before the first H2; ≥2 H2 body sections; conclusion H2',
  '- [ ] Persona voice consistent throughout; no do-not-say phrase',
  '- [ ] Nothing truncated mid-thought',
  '- [ ] The result reads better than either input draft',
  '',
  '# Constraints',
  '',
  '- DO NOT reference a rubric, a numeric score, or "the judge".',
  '- DO NOT cite sources inline ("[1]", footnotes).',
  '- DO NOT exceed 3,000 words.',
  '- DO NOT wrap the JSON in prose or markdown fences.',
  '',
  '# Interaction protocol',
  '',
  'Return ONLY a JSON object (no markdown, no prose outside JSON):',
  '{',
  '  "title": "<the article title>",',
  '  "markdown": "<full synthesized article markdown: # H1, intro prose, ## H2 sections, ## Conclusion>"',
  '}',
].join('\n')

function draftsBlock(producerArtifacts: Record<string, ArticleArtifact>): string {
  return Object.values(producerArtifacts)
    .map((a, i) =>
      [`DRAFT ${i + 1} — "${a.title}" (${a.wordCount} words):`, '---', a.markdown, '---'].join('\n'),
    )
    .join('\n\n')
}

function critiquesBlock(critiques: Record<string, string>): string {
  const entries = Object.values(critiques)
  if (entries.length === 0) return ''
  return entries.map((c, i) => [`CRITIQUE ${i + 1}:`, c].join('\n')).join('\n\n')
}

/** Integrator user message: persona + master + both drafts + both critiques + feedback. */
export function buildArticleIntegratorUser(
  ctx: RepurposeContext,
  producerArtifacts: Record<string, ArticleArtifact>,
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
    `Synthesize ONE best article (1,200–3,000 words) on "${ctx.ideaTitle}".`,
    'Merge the strengths of both drafts and fix every gap the critiques named.',
  ]
    .filter(Boolean)
    .join('\n')
}

export const ARTICLE_INTEGRATOR: AgentConfig = {
  id: 'article-integrator',
  name: 'Article Integrator (Claude)',
  model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
  maxRetries: 2,
  timeoutMs: 180_000,
}
