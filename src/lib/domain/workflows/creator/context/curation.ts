// CreatorOS context curation — Domain configuration for the Context Engineering
// System (System 6). This is the noun to Core's verb: it decides WHICH curator
// runs per stage and WHAT priority each creator context block carries. The
// curation MACHINERY — priority-desc packing, drop-order, the ContextCurator
// contract — is Core (src/lib/core/context). Domain imports Core; never the
// reverse (grep-check stays empty).
//
// V1 wires the Core PassthroughCurator at Stage 3 (Long-Form Master synthesis)
// and Stage 5 (both cross-critique producers). Under the default budget nothing
// is dropped, so curation is a no-op on output — the value is the seam: a V2
// curator (summarization, relevance ranking) replaces the curator instance below
// with zero changes to any stage's prompt code.
// See docs/01-architecture/context-system.md.

import { PassthroughCurator } from '../../../../core/context/passthrough-curator'
import type { ContextBudget, CuratedContext } from '../../../../core/context/types'

/**
 * Conventional context-block priorities (context-system.md "V1 priority
 * assignments"). Higher = more important; the curator keeps high-priority blocks
 * and orders them first. These are the single source of truth for the per-stage
 * priority numbers — Stage 3 and Stage 5 both read from here.
 */
export const CREATOR_CONTEXT_PRIORITIES = {
  /** Persona voice/audience/brand — never drop. */
  persona: 10,
  /** The current Idea. */
  idea: 10,
  /** Curated research sources (Stage 3 input). */
  researchSources: 8,
  /** The Long-Form Master, when it is the input to repurpose (Stage 5). */
  longFormMaster: 8,
  /** Prior iteration's judge feedback (PRESERVE/IMPROVE). */
  judgeFeedback: 7,
  /** Uploaded reference documents. */
  uploadedDocs: 6,
  /** Prior iteration's artifact. */
  priorArtifact: 5,
} as const

/** A rendered, priority-tagged context block. Blank blocks are dropped pre-curation. */
export interface PriorityBlock {
  id: string
  priority: number
  text: string
}

/**
 * V1 budget: generous. A modern producer window (200K+ tokens) fits one Long-Form
 * Master, a persona, and judge feedback with room to spare, so V1 curation never
 * drops. The seam exists so a V2 curator can tighten this without touching any
 * stage's prompt code.
 */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = { maxTokens: 180_000 }

// V1 default curator. The per-stage curator CHOICE lives here in Domain; the
// behaviour lives in Core. Swap this line to upgrade every CreatorOS stage at once.
const creatorCurator = new PassthroughCurator()

export interface AssembledContext {
  /** Kept blocks joined highest-priority-first — the curated context string. */
  text: string
  /** Full CuratedContext (kept/compressed/dropped + decisions) for inspection/logging. */
  curated: CuratedContext
}

/**
 * Run priority-tagged blocks through the V1 curator and return the joined,
 * priority-ordered context string. Blank blocks are skipped. Under the default
 * budget everything fits, so `text` is the non-empty blocks concatenated
 * highest-priority-first, separated by a blank line.
 */
export async function assembleCreatorContext(
  blocks: PriorityBlock[],
  budget: ContextBudget = DEFAULT_CONTEXT_BUDGET,
): Promise<AssembledContext> {
  const sources = blocks
    .filter((b) => b.text.trim().length > 0)
    .map((b) => ({
      id: b.id,
      content: b.text,
      priority: b.priority,
      byteSize: b.text.length,
    }))
  const curated = await creatorCurator.curate(sources, budget)
  const text = curated.kept.map((s) => String(s.content)).join('\n\n')
  return { text, curated }
}
