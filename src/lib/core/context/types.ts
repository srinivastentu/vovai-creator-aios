// Context Engineering System (System 6) — Core machinery (the verb, not the noun).
//
// Domain-agnostic by construction: this module knows nothing about personas,
// Long-Form Masters, LinkedIn posts, or any creator concept. It defines the
// curation CONTRACT — what a context source is, what a budget is, what a curated
// result looks like, and what a curator does. Domain decides WHICH curator runs
// per stage and WHAT priority each source gets; Core decides HOW packing works.
//
// V1 ships only this contract plus the PassthroughCurator default (passthrough-
// curator.ts). The point of V1 is the seam: a V2 curator (summarization,
// relevance ranking) implements ContextCurator and slots in with zero changes to
// any Domain call site. See docs/01-architecture/context-system.md.
//
// The one import rule holds: this file imports nothing from src/lib/domain.

/** A single candidate block of context the curator may keep, compress, or drop. */
export interface ContextSource {
  /** Stable identifier for this source (e.g. 'system' | 'task' | 'reference' | 'history'). */
  id: string
  /** The payload. Opaque to Core — Domain renders/reads it. Usually a string. */
  content: unknown
  /** Higher = more important. Drives keep-order and drop-order. Default 5. */
  priority: number
  /** Size of `content` in characters/bytes; the token estimate derives from it. */
  byteSize: number
}

/** The ceiling a curator packs context into. `maxBytes` is an optional hard cap. */
export interface ContextBudget {
  maxTokens: number
  maxBytes?: number
}

/** What a curator did to one source. V1 only ever produces 'kept' | 'dropped'. */
export type CurationAction = 'kept' | 'compressed' | 'dropped'

/** Per-source audit trail entry — why a source was kept, compressed, or dropped. */
export interface CurationDecision {
  sourceId: string
  action: CurationAction
  reason: string
}

/** The result of a curation pass: kept verbatim, compressed (V1: always empty), dropped. */
export interface CuratedContext {
  /** Included verbatim, in the order the curator chose (V1: priority DESC). */
  kept: ContextSource[]
  /** Summarized before inclusion. V1: always empty (no summarization). */
  compressed: ContextSource[]
  /** Removed entirely (over budget). */
  dropped: ContextSource[]
  metadata: {
    /** Estimated tokens across ALL input sources. */
    originalTokens: number
    /** Estimated tokens across the kept (+ compressed) sources. */
    finalTokens: number
    decisions: CurationDecision[]
  }
}

/**
 * The curation contract. One method: select what stays, compress what is useful
 * but bulky, drop the rest — before an LLM call. Async because V2 curators may
 * call a model (summarization) or an embedding index (relevance ranking); the V1
 * PassthroughCurator resolves immediately with zero added latency.
 */
export interface ContextCurator {
  curate(sources: ContextSource[], budget: ContextBudget): Promise<CuratedContext>
}

/** Conventional priority when a source supplies none (context-system.md). */
export const DEFAULT_CONTEXT_PRIORITY = 5

/** Token approximation: ~4 characters per token (context-system.md). */
export const CHARS_PER_TOKEN = 4

/** Estimate tokens from a byte/character size using the V1 chars-per-token heuristic. */
export function estimateTokens(byteSize: number): number {
  return Math.ceil(Math.max(0, byteSize) / CHARS_PER_TOKEN)
}
