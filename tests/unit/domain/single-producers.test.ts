import { describe, it, expect } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import {
  validateLinkedInPost,
  countParagraphBreaks,
  LINKEDIN_MIN_CHARS,
  LINKEDIN_MAX_CHARS,
} from '../../../src/lib/domain/workflows/creator/validators/linkedin-post-validator'
import {
  validateArticle,
  articleWordCount,
  h2Headings,
  ARTICLE_MIN_WORDS,
} from '../../../src/lib/domain/workflows/creator/validators/article-validator'
import {
  SINGLE_PRODUCER_STRUCTURAL_RUBRIC,
  createStructuralPassJudge,
  createLinkedInStage,
  createArticleStage,
  runProducerLoop,
  buildArtifactPersistence,
} from '../../../src/lib/domain/workflows/creator/single-producer-stage'
import type { Producer } from '../../../src/lib/domain/workflows/creator/single-producer-stage'
import type {
  ArticleArtifact,
  LinkedInArtifact,
  RepurposeContext,
} from '../../../src/lib/domain/workflows/creator/types'

// ─── Fixtures ───────────────────────────────────────────────────────────────

const PARA =
  'This is a concrete sentence about agentic AI loops and the tradeoffs builders actually hit. '
// A valid LinkedIn post: ≥2 hook lines, ≥2 blank-line breaks, in [1300, 3000] chars.
const VALID_LINKEDIN_TEXT = [
  'Here is a counter-intuitive claim about content generation.',
  'Most teams reach for the wrong loop.',
  '',
  PARA.repeat(11),
  '',
  PARA.repeat(11),
  '',
  'So which loop are you running?',
].join('\n')

const SENT =
  'Sequential cross critique synthesizes strengths across producers while tournament selection discards the losers entirely. '
function words(n: number): string {
  return SENT.repeat(n)
}
// A valid article: H1 + intro prose + ≥2 H2 body sections + a conclusion H2, ≥1200 words.
const VALID_ARTICLE_MD = [
  '# Why Sequential Cross-Critique Wins',
  '',
  'This intro runs well over twenty-five words because it must clear the intro gate and frame the central tension before any heading appears, explaining plainly why the loop choice matters for builders shipping real systems today.',
  '',
  '## The Architecture Gap',
  words(45),
  '',
  '## How It Works',
  words(45),
  '',
  '## The Takeaway',
  `${words(4)} The upshot is clear.`,
].join('\n')

const CONTEXT: RepurposeContext = {
  longFormMasterId: 'lfm-1',
  artifactType: 'linkedin_post',
  masterTitle: 'Why Sequential Cross-Critique Beats Tournament',
  ideaTitle: 'Why sequential cross-critique beats tournament for content generation',
  niches: ['agentic AI'],
  persona: {
    name: 'BuildOS Creator',
    voiceSummary: 'Conversational-expert, plain technical.',
    pointOfView: 'Show the machinery, name the tradeoffs.',
    audienceSummary: 'AI builders who ship',
    signaturePhrases: ['show you the machinery', 'here is the tradeoff'],
    signatureHooks: ['a counter-intuitive claim, then the proof'],
    doNotSay: ['game-changer', 'unleash'],
  },
  sections: [
    { heading: 'The Architecture Gap', contentMarkdown: 'Single-shot vs sequential.' },
    { heading: 'How It Works', contentMarkdown: 'Producers, critics, integrator.' },
  ],
}

function linkedinArtifact(text: string): LinkedInArtifact {
  return { text, charCount: text.length }
}

// ─── LinkedIn validator ───────────────────────────────────────────────────────

describe('validateLinkedInPost', () => {
  it('accepts a well-formed post in range with paragraph breaks + hook lines', () => {
    const result = validateLinkedInPost(linkedinArtifact(VALID_LINKEDIN_TEXT))
    expect(result.valid).toBe(true)
    expect(VALID_LINKEDIN_TEXT.length).toBeGreaterThanOrEqual(LINKEDIN_MIN_CHARS)
    expect(VALID_LINKEDIN_TEXT.length).toBeLessThanOrEqual(LINKEDIN_MAX_CHARS)
  })

  it('rejects a post under the character floor', () => {
    const codes = validateLinkedInPost(linkedinArtifact('Too short.\n\nStill short.\n\nEnd.')).errors.map(
      (e) => e.code
    )
    expect(codes).toContain('too_short')
  })

  it('rejects a post over the character ceiling', () => {
    const tooLong = PARA.repeat(40) // ~3600 chars
    const codes = validateLinkedInPost(linkedinArtifact(tooLong)).errors.map((e) => e.code)
    expect(codes).toContain('too_long')
  })

  it('rejects an in-range wall of text with too few paragraph breaks', () => {
    const wall = PARA.repeat(20) // ~1840 chars, no blank-line breaks
    const result = validateLinkedInPost(linkedinArtifact(wall))
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('too_few_paragraph_breaks')
  })

  it('countParagraphBreaks counts blank-line separators', () => {
    expect(countParagraphBreaks('a\n\nb\n\nc')).toBe(2)
    expect(countParagraphBreaks('one block')).toBe(0)
  })
})

// ─── Article validator ────────────────────────────────────────────────────────

describe('validateArticle', () => {
  function article(markdown: string): ArticleArtifact {
    return { title: 'T', markdown, wordCount: articleWordCount(markdown) }
  }

  it('accepts a well-formed article: H1 + intro + ≥2 H2 + conclusion, in word range', () => {
    const result = validateArticle(article(VALID_ARTICLE_MD))
    expect(result.valid).toBe(true)
    expect(articleWordCount(VALID_ARTICLE_MD)).toBeGreaterThanOrEqual(ARTICLE_MIN_WORDS)
  })

  it('rejects an article under the word floor', () => {
    const md = '# T\n\nShort intro of a dozen words goes right here now.\n\n## A\nbody\n\n## Conclusion\nend'
    const codes = validateArticle(article(md)).errors.map((e) => e.code)
    expect(codes).toContain('too_short')
  })

  it('rejects an article with fewer than 2 H2 sections', () => {
    const md = [
      '# T',
      '',
      'A real intro that comfortably clears the twenty-five word minimum so the intro gate is satisfied here today for sure and well beyond it.',
      '',
      '## Conclusion',
      words(90),
    ].join('\n')
    const codes = validateArticle(article(md)).errors.map((e) => e.code)
    expect(codes).toContain('too_few_h2')
  })

  it('rejects an article with no intro before the first H2', () => {
    const md = ['# T', '## The Architecture Gap', words(45), '', '## The Takeaway', words(45)].join('\n')
    const codes = validateArticle(article(md)).errors.map((e) => e.code)
    expect(codes).toContain('missing_intro')
  })

  it('rejects an article whose final H2 is not a conclusion', () => {
    const md = [
      '# T',
      '',
      'A real intro that comfortably clears the twenty-five word minimum so the intro gate is satisfied here today for sure.',
      '',
      '## The Architecture Gap',
      words(45),
      '',
      '## How It Works',
      words(45),
    ].join('\n')
    const codes = validateArticle(article(md)).errors.map((e) => e.code)
    expect(codes).toContain('missing_conclusion')
  })

  it('h2Headings extracts heading text', () => {
    expect(h2Headings('# H1\n\n## One\nbody\n\n## Two\nbody')).toEqual(['One', 'Two'])
  })
})

// ─── Structural rubric + judge (CR-4 placeholders) ────────────────────────────

describe('SINGLE_PRODUCER_STRUCTURAL_RUBRIC', () => {
  it('has weights summing to 1.0 and a completeness dimension ≥ 0.20', () => {
    const sum = SINGLE_PRODUCER_STRUCTURAL_RUBRIC.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(0.001)
    const completeness = SINGLE_PRODUCER_STRUCTURAL_RUBRIC.dimensions.find((d) => d.id === 'completeness')
    expect(completeness?.weight).toBeGreaterThanOrEqual(0.2)
  })
})

describe('createStructuralPassJudge', () => {
  it('returns a passing grade (composite ≥ threshold) for any artifact', async () => {
    const judge = createStructuralPassJudge()
    const grade = await judge({}, SINGLE_PRODUCER_STRUCTURAL_RUBRIC)
    expect(grade.overallScore).toBe(80)
    expect(grade.passesThreshold).toBe(true)
  })
})

// ─── Stage loop (mocked) ──────────────────────────────────────────────────────

describe('createLinkedInStage + runProducerLoop', () => {
  it('one iteration produces a validated, structurally-passed artifact', async () => {
    const mock: Producer<LinkedInArtifact> = {
      async produce() {
        return linkedinArtifact(VALID_LINKEDIN_TEXT)
      },
    }
    const stage = createLinkedInStage({ producer: mock })
    const result = await runProducerLoop({ stage, context: CONTEXT })

    expect(result.bestArtifact?.text).toBe(VALID_LINKEDIN_TEXT)
    expect(result.bestScore).toBe(80)
    expect(result.finalState.status).toBe('presenting')
    expect(result.iterations).toHaveLength(1)
  })

  it('re-produces when the validator rejects the first draft, then presents the valid one', async () => {
    let calls = 0
    const mock: Producer<LinkedInArtifact> = {
      async produce() {
        calls += 1
        return calls === 1 ? linkedinArtifact('Too short.') : linkedinArtifact(VALID_LINKEDIN_TEXT)
      },
    }
    const events: { validationFailed: boolean }[] = []
    const stage = createLinkedInStage({ producer: mock, maxIterations: 3 })
    const result = await runProducerLoop({
      stage,
      context: CONTEXT,
      onIteration: (e) => events.push({ validationFailed: e.validationFailed }),
    })

    expect(calls).toBe(2)
    expect(events[0].validationFailed).toBe(true) // first draft failed the validator
    expect(result.bestArtifact?.text).toBe(VALID_LINKEDIN_TEXT)
    expect(result.finalState.status).toBe('presenting')
  })

  it('tracks producer cost via the injected Anthropic client', async () => {
    // claude-sonnet pricing: (1000/1e6)*3 + (800/1e6)*15 = 0.015 per call.
    const fakeAnthropic = {
      messages: {
        create: async () => ({
          content: [{ type: 'text', text: JSON.stringify({ content: VALID_LINKEDIN_TEXT }) }],
          usage: { input_tokens: 1000, output_tokens: 800 },
        }),
      },
    } as unknown as Anthropic

    const stage = createLinkedInStage({ client: fakeAnthropic })
    const result = await runProducerLoop({ stage, context: CONTEXT })

    expect(result.bestArtifact?.text).toBe(VALID_LINKEDIN_TEXT)
    expect(stage.getTotalCostUSD()).toBeCloseTo(0.015, 5)
  })
})

describe('createArticleStage + runProducerLoop', () => {
  it('produces a validated article via the injected Anthropic client', async () => {
    const fakeAnthropic = {
      messages: {
        create: async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ title: 'Why Sequential Cross-Critique Wins', markdown: VALID_ARTICLE_MD }),
            },
          ],
          usage: { input_tokens: 1500, output_tokens: 1200 },
        }),
      },
    } as unknown as Anthropic

    const ctx: RepurposeContext = { ...CONTEXT, artifactType: 'long_form_article' }
    const stage = createArticleStage({ client: fakeAnthropic })
    const result = await runProducerLoop({ stage, context: ctx })

    expect(result.bestArtifact?.markdown).toBe(VALID_ARTICLE_MD)
    expect(result.bestArtifact?.wordCount).toBeGreaterThanOrEqual(ARTICLE_MIN_WORDS)
    expect(result.finalState.status).toBe('presenting')
  })
})

// ─── Persistence mapping ──────────────────────────────────────────────────────

describe('buildArtifactPersistence', () => {
  it('maps a LinkedIn artifact to an Artifact row payload (forward-compat fields)', () => {
    const payload = buildArtifactPersistence(
      'linkedin_post',
      linkedinArtifact(VALID_LINKEDIN_TEXT),
      0.0231
    )
    expect(payload.artifactType).toBe('linkedin_post')
    expect(payload.derivedVia).toBe('cross_critique')
    expect(payload.status).toBe('awaiting_review')
    expect(payload.parentArtifactIds).toEqual([])
    expect(payload.bestScore).toBeNull()
    expect(payload.costUSD).toBeCloseTo(0.0231, 6)
    expect(payload.content).toEqual(linkedinArtifact(VALID_LINKEDIN_TEXT))
  })

  it('carries an explicit bestScore when one is supplied (CR-5 path)', () => {
    const payload = buildArtifactPersistence(
      'long_form_article',
      { title: 'T', markdown: VALID_ARTICLE_MD, wordCount: articleWordCount(VALID_ARTICLE_MD) },
      0.4,
      82.5
    )
    expect(payload.artifactType).toBe('long_form_article')
    expect(payload.bestScore).toBe(82.5)
  })
})
