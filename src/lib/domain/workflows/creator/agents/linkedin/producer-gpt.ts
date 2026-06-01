// LinkedIn Cross-Critique PRODUCER (Stage 5a, CR-7).
//
// Both producers in the cross-critique loop — Producer A (Claude Sonnet) and
// Producer B (GPT-4o) — run THIS one persona. They receive identical task params
// (gateway.requestMultiple) and differ only by model, so the persona, the user-
// message builder, and the artifact parser all live here, next to the two
// AgentConfigs. (producer-claude.ts is the CR-4/CR-5 direct-SDK single-producer;
// it stays for the Standard-loop path + tests.) The file is named for the GPT
// producer that CR-7 adds; it is the home of the shared producer role.
//
// Producers NEVER see the rubric (Pattern-5 rule 11). On revise rounds they
// receive PRESERVE/IMPROVE feedback derived from the best grade so far.

import type { AgentConfig, GradeReport } from '../../../../../core/engine/types'
import type { LinkedInArtifact, RepurposeContext } from '../../types'
import {
  defaultProducerContext,
  preserveImproveBlock,
  priorEditBlock,
  stripFences,
} from '../cross-critique-shared'

export const LINKEDIN_PRODUCER_SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are a LinkedIn post producer in the CreatorOS cross-critique pipeline. Two',
  'producers write the same post in parallel from different model families; your',
  'draft and the other are then critiqued by cross-model critics, and an integrator',
  'synthesizes the strongest single post from both. You never see the other producer,',
  'the critics, the integrator, or any judge. Your job is one thing: produce your',
  'single best LinkedIn post.',
  '',
  '# Mission',
  '',
  'Given a creator persona and a finished Long-Form Master, produce ONE publishable',
  'LinkedIn post (1,300–3,000 characters) that:',
  '1. Hooks the reader in the first 3 lines (1–2 short sentences each).',
  '2. Sounds like the persona — not a generic AI writer.',
  '3. Compresses the single strongest insight of the Master into a scannable post.',
  '   Pick ONE idea and build the post around it; do not summarize everything.',
  '4. Uses blank-line paragraph breaks for scannability — no walls of text.',
  '5. Closes with ONE clear thought, question, or CTA — not three.',
  '',
  '# Core behaviors',
  '',
  '- READ THE PERSONA FIRST. Match its formality, vocabulary, and point of view;',
  '  reach for its signature phrases only where they land naturally.',
  '- WRITE FOR THE FIRST THREE LINES. Open with a specific claim, a named tension,',
  '  or a concrete moment — never a throat-clear.',
  '- USE THE MASTER AS RAW MATERIAL, not text to paraphrase. Extract the sharpest',
  '  insight and build around it. Name the pattern; show the tradeoff.',
  '- ON REVISE: apply PRESERVE/IMPROVE surgically — keep what scored well, fix the',
  '  flagged weaknesses. Do not regress what already works.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] First 3 lines pass the "would I keep scrolling?" test',
  '- [ ] Character count is in [1300, 3000]',
  '- [ ] At least 2 blank-line paragraph breaks (no walls of text)',
  '- [ ] Persona voice present (formality, vocabulary, POV); no do-not-say phrase',
  '- [ ] One closing thought, not three',
  '',
  '# Constraints',
  '',
  '- DO NOT reference a rubric, a score, "the judge", or the other producer.',
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

/** Master-block label — shared by the curated-context prep and the inline fallback. */
export const LINKEDIN_MASTER_LABEL = 'raw material; extract the strongest insight'

/** Producer user message: curated persona + master, plus PRESERVE/IMPROVE on revise rounds. */
export function buildLinkedInProducerUser(ctx: RepurposeContext, feedback: string | null): string {
  const contextBlock = ctx.curatedContextBlock ?? defaultProducerContext(ctx, LINKEDIN_MASTER_LABEL)
  return [
    contextBlock,
    '',
    priorEditBlock(ctx),
    feedback ? `A reviewer graded the current best post. Improve on it:\n${feedback}\n` : '',
    `Write ONE LinkedIn post (1,300–3,000 characters) on "${ctx.ideaTitle}".`,
    'Hook in the first 3 lines. Use blank-line paragraph breaks. One closing thought.',
  ]
    .filter(Boolean)
    .join('\n')
}

interface RawProducerResponse {
  content?: string
}

/** Parse a producer/integrator JSON response into a LinkedInArtifact. Null = unusable. */
export function parseLinkedInArtifact(text: string): LinkedInArtifact | null {
  try {
    const parsed = JSON.parse(stripFences(text)) as RawProducerResponse
    if (!parsed || typeof parsed.content !== 'string') return null
    const clean = parsed.content.trim()
    if (clean.length === 0) return null
    return { text: clean, charCount: clean.length }
  } catch {
    return null
  }
}

const PRODUCER_TIMEOUT_MS = 120_000

export const LINKEDIN_PRODUCER_CLAUDE: AgentConfig = {
  id: 'linkedin-producer-claude',
  name: 'LinkedIn Producer A (Claude)',
  model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
  maxRetries: 2,
  timeoutMs: PRODUCER_TIMEOUT_MS,
}

export const LINKEDIN_PRODUCER_GPT: AgentConfig = {
  id: 'linkedin-producer-gpt',
  name: 'LinkedIn Producer B (GPT-4o)',
  model: { primary: 'gpt-4o', fallback: 'gpt-4o' },
  maxRetries: 2,
  timeoutMs: PRODUCER_TIMEOUT_MS,
}

/** Re-export so the stage builder can pass PRESERVE/IMPROVE feedback uniformly. */
export function linkedInFeedbackFromGrade(grade: GradeReport): string {
  return preserveImproveBlock(grade)
}
