// CR-8 — CreatorOS context-curation wiring tests.
// The Domain seam (creator/context/curation.ts) + its use at Stage 3 (synthesizer
// priorities) and Stage 5 (producer context prep). Proves the V1 PassthroughCurator
// path is byte-identical to the prior inline assembly — the curator is the seam,
// not a behaviour change.

import { describe, expect, it } from 'vitest'
import {
  CREATOR_CONTEXT_PRIORITIES,
  DEFAULT_CONTEXT_BUDGET,
  assembleCreatorContext,
} from '../../../src/lib/domain/workflows/creator/context/curation'
import {
  defaultProducerContext,
  prepareRepurposeContext,
} from '../../../src/lib/domain/workflows/creator/agents/cross-critique-shared'
import {
  LINKEDIN_MASTER_LABEL,
  buildLinkedInProducerUser,
} from '../../../src/lib/domain/workflows/creator/agents/linkedin/producer-gpt'
import {
  ARTICLE_MASTER_LABEL,
  buildArticleProducerUser,
} from '../../../src/lib/domain/workflows/creator/agents/article/producer-gpt'
import { MASTER_CONTEXT_PRIORITIES } from '../../../src/lib/domain/workflows/creator/agents/long-form-synthesizer'
import type { RepurposeContext } from '../../../src/lib/domain/workflows/creator/types'

const CONTEXT: RepurposeContext = {
  longFormMasterId: 'lfm-1',
  artifactType: 'linkedin_post',
  masterTitle: 'Why Sequential Cross-Critique Beats Tournament',
  ideaTitle: 'Why sequential cross-critique beats tournament',
  niches: ['agentic AI'],
  persona: {
    name: 'BuildOS Creator',
    voiceSummary: 'Conversational-expert, plain technical.',
    pointOfView: 'Show the machinery, name the tradeoffs.',
    audienceSummary: 'AI builders who ship',
    signaturePhrases: ['show you the machinery'],
    signatureHooks: ['a counter-intuitive claim, then the proof'],
    doNotSay: ['game-changer'],
  },
  sections: [
    { heading: 'The Architecture Gap', contentMarkdown: 'Single-shot vs sequential.' },
    { heading: 'How It Works', contentMarkdown: 'Producers, critics, integrator.' },
  ],
}

// ─── Priority table is the single source of truth ─────────────────────────────
describe('CREATOR_CONTEXT_PRIORITIES (context-system.md)', () => {
  it('matches the V1 priority assignments in the doc', () => {
    expect(CREATOR_CONTEXT_PRIORITIES).toEqual({
      persona: 10,
      idea: 10,
      researchSources: 8,
      longFormMaster: 8,
      judgeFeedback: 7,
      uploadedDocs: 6,
      priorArtifact: 5,
    })
  })

  it('Stage-3 MASTER_CONTEXT_PRIORITIES derive from the shared table (TODO(CR-8) discharged)', () => {
    expect(MASTER_CONTEXT_PRIORITIES.persona).toBe(CREATOR_CONTEXT_PRIORITIES.persona)
    expect(MASTER_CONTEXT_PRIORITIES.idea).toBe(CREATOR_CONTEXT_PRIORITIES.idea)
    expect(MASTER_CONTEXT_PRIORITIES.researchSources).toBe(CREATOR_CONTEXT_PRIORITIES.researchSources)
    expect(MASTER_CONTEXT_PRIORITIES.uploadedDocs).toBe(CREATOR_CONTEXT_PRIORITIES.uploadedDocs)
  })
})

// ─── assembleCreatorContext ───────────────────────────────────────────────────
describe('assembleCreatorContext', () => {
  it('joins kept blocks highest-priority-first, separated by a blank line', async () => {
    const { text, curated } = await assembleCreatorContext([
      { id: 'low', priority: 5, text: 'LOW' },
      { id: 'high', priority: 10, text: 'HIGH' },
    ])
    expect(text).toBe('HIGH\n\nLOW')
    expect(curated.kept.map((s) => s.id)).toEqual(['high', 'low'])
    expect(curated.dropped).toEqual([])
  })

  it('skips blank blocks before curation', async () => {
    const { text, curated } = await assembleCreatorContext([
      { id: 'persona', priority: 10, text: 'PERSONA' },
      { id: 'uploads', priority: 6, text: '   ' },
    ])
    expect(text).toBe('PERSONA')
    expect(curated.kept.map((s) => s.id)).toEqual(['persona'])
  })

  it('exposes a generous default budget so V1 never drops', () => {
    expect(DEFAULT_CONTEXT_BUDGET.maxTokens).toBeGreaterThanOrEqual(180_000)
  })
})

// ─── Stage 5 producer context prep ────────────────────────────────────────────
describe('prepareRepurposeContext (Stage 5 / CR-8)', () => {
  it('stashes the curated persona+master as curatedContextBlock', async () => {
    const prepared = await prepareRepurposeContext(CONTEXT, LINKEDIN_MASTER_LABEL)
    expect(prepared.curatedContextBlock).toBeDefined()
    expect(prepared.curatedContextBlock).toContain('BuildOS Creator')
    expect(prepared.curatedContextBlock).toContain('The Architecture Gap')
    // does not mutate the input
    expect(CONTEXT.curatedContextBlock).toBeUndefined()
  })

  it('is byte-identical to the inline fallback under the V1 passthrough budget', async () => {
    const prepared = await prepareRepurposeContext(CONTEXT, LINKEDIN_MASTER_LABEL)
    expect(prepared.curatedContextBlock).toBe(defaultProducerContext(CONTEXT, LINKEDIN_MASTER_LABEL))
  })
})

// ─── Producer builders consume the curated block, with a sync fallback ─────────
describe('producer builders use the curated context', () => {
  it('LinkedIn producer uses curatedContextBlock verbatim when present', () => {
    const prepared: RepurposeContext = { ...CONTEXT, curatedContextBlock: 'CURATED-MARKER-BLOCK' }
    const msg = buildLinkedInProducerUser(prepared, null)
    expect(msg).toContain('CURATED-MARKER-BLOCK')
    // the curated block replaced the raw persona render
    expect(msg).not.toContain('BuildOS Creator')
  })

  it('LinkedIn producer falls back to inline persona+master when not pre-curated', () => {
    const msg = buildLinkedInProducerUser(CONTEXT, null)
    expect(msg).toContain('BuildOS Creator')
    expect(msg).toContain('The Architecture Gap')
  })

  it('Article producer uses curatedContextBlock verbatim when present', () => {
    const ctx: RepurposeContext = {
      ...CONTEXT,
      artifactType: 'long_form_article',
      curatedContextBlock: 'CURATED-ARTICLE-BLOCK',
    }
    const msg = buildArticleProducerUser(ctx, null)
    expect(msg).toContain('CURATED-ARTICLE-BLOCK')
    expect(msg).not.toContain('BuildOS Creator')
  })

  it('Article producer falls back to inline persona+master when not pre-curated', () => {
    const msg = buildArticleProducerUser(CONTEXT, null)
    expect(msg).toContain('BuildOS Creator')
    expect(msg).toContain('The Architecture Gap')
  })

  it('article and LinkedIn master labels stay distinct', () => {
    expect(LINKEDIN_MASTER_LABEL).not.toBe(ARTICLE_MASTER_LABEL)
  })
})
