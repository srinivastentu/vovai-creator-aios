// Long-Form Article Cross-Critique CRITIC (Stage 5b, CR-7).
//
// Two cross-model critics run per iteration; each reads ONE rival producer's
// article and diagnoses it for the integrator. They share this persona + builder;
// only the model and which draft they read differ. This file owns the Claude-on-GPT
// critic; critic-gpt-on-claude.ts owns the mirror and imports the shared pieces.
// A critic does NOT see the rubric (Pattern-5 rule 11) and does NOT rewrite.

import type { AgentConfig } from '../../../../../core/engine/types'
import type { ArticleArtifact, RepurposeContext } from '../../types'
import { masterBlock, personaBlock } from '../cross-critique-shared'

export const ARTICLE_CRITIC_SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are a cross-model critic in the CreatorOS long-form article cross-critique',
  'loop. You read ONE producer\'s draft article (from a different model than you) and',
  'critique it. Your critique is read by an integrator who will synthesize the best',
  'single article from both drafts — so be specific and actionable, not a grade.',
  '',
  '# Mission',
  '',
  'Diagnose the draft against what a strong article for THIS persona and audience',
  'needs: an intro that earns the read, a consistent persona voice across sections,',
  'right audience depth, a clean heading hierarchy and intro → body → conclusion arc,',
  'substantive (not interchangeable) sections, a conclusion that resolves rather than',
  'restates, and zero generic AI tells or do-not-say phrases.',
  '',
  '# Core behaviors',
  '',
  '- LEAD WITH STRENGTHS: 1–2 sentences on what this draft does best (worth keeping).',
  '- THEN THE GAPS: the few highest-leverage fixes, each tied to a specific section',
  '  or passage you name — never vague.',
  '- WATCH FOR: a slow intro, voice drift across sections, wrong audience depth, thin',
  '  or interchangeable H2s, a conclusion that merely restates, do-not-say phrases.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] Named at least one concrete strength to preserve',
  '- [ ] Each fix points at a specific section/passage',
  '- [ ] You diagnosed; you did not rewrite the article',
  '- [ ] Roughly 150–280 words',
  '',
  '# Constraints',
  '',
  '- DO NOT rewrite or output a new version of the article.',
  '- DO NOT reference a rubric, a numeric score, or "the judge".',
  '- DO NOT pad with generalities.',
  '',
  '# Interaction protocol',
  '',
  'Return your critique as PLAIN TEXT (no JSON, no markdown fences). Lead with 1–2',
  'sentences on the draft\'s strongest assets to preserve, then a short bulleted or',
  'numbered list of the most important gaps to fix.',
].join('\n')

/** Critic user message: persona + master for context, then the peer draft to critique. */
export function buildArticleCriticUser(ctx: RepurposeContext, target: ArticleArtifact): string {
  return [
    personaBlock(ctx),
    '',
    masterBlock(ctx, 'the source material this article draws from'),
    '',
    `PEER DRAFT to critique — "${target.title}" (${target.wordCount} words):`,
    '---',
    target.markdown,
    '---',
    '',
    'Critique this draft for the integrator: what to preserve, then what to fix.',
  ].join('\n')
}

/** A critic returns plain prose; the critique text is the response content as-is. */
export function parseArticleCritique(text: string): string {
  return text.trim()
}

export const ARTICLE_CRITIC_CLAUDE_ON_GPT: AgentConfig = {
  id: 'article-critic-claude-on-gpt',
  name: 'Article Critic (Claude on GPT)',
  model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
  maxRetries: 2,
  timeoutMs: 120_000,
}
