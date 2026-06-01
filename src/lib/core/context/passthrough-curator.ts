// PassthroughCurator — the V1 default ContextCurator (Core machinery).
//
// Concatenates all sources up to the token budget, highest priority first; drops
// the lowest-priority sources that don't fit. No compression, no summarization,
// no LLM call, zero added latency. It trusts the agent prompt to handle whatever
// fits — for V1-scale inputs (a handful of bounded sources) a modern 200K-token
// window is ample, so nothing is dropped in practice.
//
// This class IS the seam. V2 curators (LLMSummarizationCurator,
// RelevanceRankingCurator, …) implement the same ContextCurator interface and
// replace this with zero changes to any Domain call site.
// See docs/01-architecture/context-system.md.

import {
  type ContextBudget,
  type ContextCurator,
  type ContextSource,
  type CuratedContext,
  type CurationDecision,
  estimateTokens,
} from './types'

export class PassthroughCurator implements ContextCurator {
  async curate(
    sources: ContextSource[],
    budget: ContextBudget,
  ): Promise<CuratedContext> {
    // Stable sort by priority DESC. JS Array.sort is stable (ES2019+), so equal
    // priorities keep their input order — the domain's intended block ordering is
    // preserved. The explicit index tiebreak documents and guarantees that intent.
    const ordered = sources
      .map((source, index) => ({ source, index }))
      .sort((a, b) => b.source.priority - a.source.priority || a.index - b.index)
      .map((x) => x.source)

    const kept: ContextSource[] = []
    const dropped: ContextSource[] = []
    const decisions: CurationDecision[] = []
    let usedTokens = 0
    let usedBytes = 0
    let originalTokens = 0

    // Greedy keep-if-fits in priority order. Because we descend by priority, the
    // first source that overflows the budget is the lowest-priority kept so far —
    // i.e. lowest-priority sources are dropped first, as specified. A later,
    // smaller source may still fit after a larger one was dropped (token-efficient).
    for (const source of ordered) {
      const tokens = estimateTokens(source.byteSize)
      originalTokens += tokens

      const fitsTokens = usedTokens + tokens <= budget.maxTokens
      const fitsBytes =
        budget.maxBytes === undefined || usedBytes + source.byteSize <= budget.maxBytes

      if (fitsTokens && fitsBytes) {
        kept.push(source)
        usedTokens += tokens
        usedBytes += source.byteSize
        decisions.push({
          sourceId: source.id,
          action: 'kept',
          reason: `kept (priority ${source.priority}, ~${tokens} tokens)`,
        })
      } else {
        dropped.push(source)
        const limit = !fitsTokens ? 'token' : 'byte'
        decisions.push({
          sourceId: source.id,
          action: 'dropped',
          reason: `dropped: ${limit} budget exceeded (priority ${source.priority})`,
        })
      }
    }

    return {
      kept,
      compressed: [], // V1: no summarization
      dropped,
      metadata: { originalTokens, finalTokens: usedTokens, decisions },
    }
  }
}
