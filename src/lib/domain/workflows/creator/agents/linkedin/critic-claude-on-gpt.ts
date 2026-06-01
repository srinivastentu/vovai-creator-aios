// LinkedIn Cross-Critique CRITIC (Stage 5a, CR-7).
//
// Two cross-model critics run per iteration; each reads ONE rival producer's post
// and diagnoses it for the integrator. They share this persona + user builder; only
// the model and which draft they read differ (see criticAssignments in the stage).
// This file owns the Claude-on-GPT critic (Claude reads the GPT producer's draft);
// critic-gpt-on-claude.ts owns the mirror and imports the shared pieces here.
//
// A critic does NOT see the rubric (Pattern-5 rule 11) and does NOT rewrite the
// post — it names what to PRESERVE and what to FIX, concretely, for the integrator.

import type { AgentConfig } from '../../../../../core/engine/types'
import type { LinkedInArtifact, RepurposeContext } from '../../types'
import { masterBlock, personaBlock } from '../cross-critique-shared'

export const LINKEDIN_CRITIC_SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are a cross-model critic in the CreatorOS LinkedIn cross-critique loop. You',
  'read ONE producer\'s draft post (from a different model than you) and critique it.',
  'Your critique is read by an integrator who will synthesize the best single post',
  'from both drafts — so be specific and actionable, not a grade.',
  '',
  '# Mission',
  '',
  'Diagnose the draft against what a strong LinkedIn post for THIS persona and',
  'audience needs: a hook that earns the first 3 lines, a consistent persona voice,',
  'audience fit, feed-native scannability, one clean closing thought, and zero',
  'generic AI tells or do-not-say phrases. Tell the integrator what to keep and what',
  'to fix.',
  '',
  '# Core behaviors',
  '',
  '- LEAD WITH STRENGTHS: 1–2 sentences on what this draft does best (worth keeping).',
  '- THEN THE GAPS: the few highest-leverage fixes, each tied to a specific line or',
  '  passage you quote — never vague ("make it punchier").',
  '- WATCH FOR: a soft or buried hook, voice drift into generic AI prose, wrong',
  '  audience level, walls of text, a muddled or multi-headed close, do-not-say',
  '  phrases, hype.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] Named at least one concrete strength to preserve',
  '- [ ] Each fix points at a specific line/passage',
  '- [ ] You diagnosed; you did not rewrite the post',
  '- [ ] Roughly 120–220 words',
  '',
  '# Constraints',
  '',
  '- DO NOT rewrite or output a new version of the post.',
  '- DO NOT reference a rubric, a numeric score, or "the judge".',
  '- DO NOT pad with generalities; every sentence earns its place.',
  '',
  '# Interaction protocol',
  '',
  'Return your critique as PLAIN TEXT (no JSON, no markdown fences). Lead with 1–2',
  'sentences on the draft\'s strongest assets to preserve, then a short bulleted or',
  'numbered list of the most important gaps to fix.',
].join('\n')

/** Critic user message: persona + master for context, then the peer draft to critique. */
export function buildLinkedInCriticUser(ctx: RepurposeContext, target: LinkedInArtifact): string {
  return [
    personaBlock(ctx),
    '',
    masterBlock(ctx, 'the source material this post draws from'),
    '',
    `PEER DRAFT to critique (${target.charCount} chars):`,
    '---',
    target.text,
    '---',
    '',
    'Critique this draft for the integrator: what to preserve, then what to fix.',
  ].join('\n')
}

/** A critic returns plain prose; the critique text is the response content as-is. */
export function parseLinkedInCritique(text: string): string {
  return text.trim()
}

const CRITIC_TIMEOUT_MS = 120_000

export const LINKEDIN_CRITIC_CLAUDE_ON_GPT: AgentConfig = {
  id: 'linkedin-critic-claude-on-gpt',
  name: 'LinkedIn Critic (Claude on GPT)',
  model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
  maxRetries: 2,
  timeoutMs: CRITIC_TIMEOUT_MS,
}
