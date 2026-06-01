// Long-Form Article Cross-Critique PRODUCER (Stage 5b, CR-7).
//
// Both producers — Producer A (Claude Sonnet) and Producer B (GPT-4o) — run THIS
// one persona on identical task params (gateway.requestMultiple), differing only by
// model. The persona, user builder, and artifact parser live here next to the two
// AgentConfigs. (producer-claude.ts is the CR-4/CR-5 direct-SDK single-producer.)
// Producers NEVER see the rubric (Pattern-5 rule 11).

import type { AgentConfig } from '../../../../../core/engine/types'
import type { ArticleArtifact, RepurposeContext } from '../../types'
import { articleWordCount } from '../../validators/article-validator'
import { defaultProducerContext, priorEditBlock, stripFences } from '../cross-critique-shared'

export const ARTICLE_PRODUCER_SYSTEM_PROMPT = [
  '# Identity',
  '',
  'You are a long-form article producer in the CreatorOS cross-critique pipeline.',
  'Two producers write the same article in parallel from different model families;',
  'your draft and the other are critiqued by cross-model critics, then an integrator',
  'synthesizes the strongest single article. You never see the other producer, the',
  'critics, the integrator, or any judge. Produce your single best article.',
  '',
  '# Mission',
  '',
  'Given a creator persona and a finished Long-Form Master, produce ONE publishable',
  'article (1,200–3,000 words) for a blog / LinkedIn Article / Substack that:',
  '1. Opens with an intro (100–200 words) that earns the read — a concrete claim, a',
  '   named tension, or a real moment. No throat-clearing.',
  '2. Develops the idea across at least 2 H2 (##) body sections, each making one',
  '   point with substance — mechanisms, evidence, tradeoffs.',
  '3. Closes with an explicit conclusion H2 ("Conclusion", "The takeaway", "Where',
  '   this leaves us", etc.).',
  '4. Sounds like the persona throughout — voice, register, point of view.',
  '5. Is scannable: one H1 title, descriptive H2s, digestible paragraphs.',
  '',
  '# Core behaviors',
  '',
  '- READ THE PERSONA FIRST. Match formality, vocabulary, and POV; use signature',
  '  phrases only where natural.',
  '- USE THE MASTER AS RAW MATERIAL: expand and structure its insight into a coherent',
  '  argument — do not stitch the sections together verbatim.',
  '- BE CONCRETE. Name the pattern; show the tradeoff. Specifics over adjectives.',
  '- STRUCTURE DELIBERATELY: H1 title, intro prose before the first H2, ≥2 H2 body',
  '  sections, then a conclusion H2.',
  '- ON REVISE: apply PRESERVE/IMPROVE surgically — keep what scored well, deepen',
  '  thin sections, fix flagged weaknesses. Do not regress what works.',
  '',
  '# Quality criteria (self-check before submitting)',
  '',
  '- [ ] Word count is in [1200, 3000]',
  '- [ ] One H1 title; ≥2 H2 body sections; an explicit conclusion H2',
  '- [ ] Intro prose (≥ ~25 words) appears before the first H2',
  '- [ ] Persona voice present throughout; no do-not-say phrase',
  '- [ ] Nothing truncated mid-thought',
  '',
  '# Constraints',
  '',
  '- DO NOT reference a rubric, a score, "the judge", or the other producer.',
  '- DO NOT cite sources inline ("[1]", footnotes) — the Master holds the citations.',
  '- DO NOT use any phrase on the persona do-not-say list.',
  '- DO NOT exceed 3,000 words.',
  '- DO NOT wrap the JSON in prose or markdown fences.',
  '',
  '# Interaction protocol',
  '',
  'Return ONLY a JSON object (no markdown, no prose outside JSON):',
  '{',
  '  "title": "<the article title>",',
  '  "markdown": "<full article markdown: # H1, intro prose, ## H2 sections, ## Conclusion>"',
  '}',
].join('\n')

/** Master-block label — shared by the curated-context prep and the inline fallback. */
export const ARTICLE_MASTER_LABEL = 'raw material to expand and structure'

/** Producer user message: curated persona + master, plus PRESERVE/IMPROVE on revise rounds. */
export function buildArticleProducerUser(ctx: RepurposeContext, feedback: string | null): string {
  const contextBlock = ctx.curatedContextBlock ?? defaultProducerContext(ctx, ARTICLE_MASTER_LABEL)
  return [
    contextBlock,
    '',
    priorEditBlock(ctx),
    feedback ? `A reviewer graded the current best article. Improve on it:\n${feedback}\n` : '',
    `Write ONE long-form article (1,200–3,000 words) on "${ctx.ideaTitle}".`,
    'H1 title, an intro before the first H2, at least 2 H2 body sections, and an',
    'explicit conclusion H2.',
  ]
    .filter(Boolean)
    .join('\n')
}

interface RawArticleResponse {
  title?: string
  markdown?: string
}

function titleFromMarkdown(markdown: string, fallback: string): string {
  const h1 = /^#[ \t]+(.+)$/m.exec(markdown)
  return h1 ? h1[1].trim() : fallback
}

/** Parse a producer/integrator JSON response into an ArticleArtifact. Null = unusable. */
export function parseArticleArtifact(text: string, fallbackTitle: string): ArticleArtifact | null {
  try {
    const parsed = JSON.parse(stripFences(text)) as RawArticleResponse
    if (!parsed || typeof parsed.markdown !== 'string') return null
    const markdown = parsed.markdown.trim()
    if (markdown.length === 0) return null
    const title = parsed.title?.trim() || titleFromMarkdown(markdown, fallbackTitle)
    return { title, markdown, wordCount: articleWordCount(markdown) }
  } catch {
    return null
  }
}

const PRODUCER_TIMEOUT_MS = 180_000

export const ARTICLE_PRODUCER_CLAUDE: AgentConfig = {
  id: 'article-producer-claude',
  name: 'Article Producer A (Claude)',
  model: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-5-20251001' },
  maxRetries: 2,
  timeoutMs: PRODUCER_TIMEOUT_MS,
}

export const ARTICLE_PRODUCER_GPT: AgentConfig = {
  id: 'article-producer-gpt',
  name: 'Article Producer B (GPT-4o)',
  model: { primary: 'gpt-4o', fallback: 'gpt-4o' },
  maxRetries: 2,
  timeoutMs: PRODUCER_TIMEOUT_MS,
}
