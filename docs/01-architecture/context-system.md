# Context Engineering System (System 6)

> Location: `src/lib/core/context/`
> Status in V1: thin seam — interface + `PassthroughCurator` default.
> Zero curation logic. The point is the architectural boundary.

## Why this exists

Multi-stage pipelines pass artifacts between stages. The LLM context
window fills with stale tool outputs, prior-turn debris, and bulky
reference material. Without curation, attention degrades on what
actually matters. Important details get buried.

The Context System gives the platform a structured way to **select
what stays, compress what is useful but bulky, and drop the rest**
before each LLM call. It is machinery (Core), not configuration
(Domain).

## V1 scope — just the seam

One interface. One default implementation. Zero curation logic.

The point of V1 is to have the architectural boundary in place
so future curation can slot in without rework.

```typescript
// src/lib/core/context/types.ts

interface ContextSource {
  id: string                  // 'persona' | 'idea' | 'sources' | 'master' | 'feedback' | ...
  content: unknown
  priority: number            // higher = more important; default 5
  byteSize: number
}

interface ContextBudget {
  maxTokens: number
  maxBytes?: number
}

interface CuratedContext {
  kept: ContextSource[]       // included verbatim
  compressed: ContextSource[] // summarized (V1: always empty)
  dropped: ContextSource[]    // removed entirely
  metadata: {
    originalTokens: number
    finalTokens: number
    decisions: Array<{
      sourceId: string
      action: 'kept' | 'compressed' | 'dropped'
      reason: string
    }>
  }
}

interface ContextCurator {
  curate(sources: ContextSource[], budget: ContextBudget): Promise<CuratedContext>
}
```

## V1 default implementation: `PassthroughCurator`

```typescript
class PassthroughCurator implements ContextCurator {
  async curate(sources, budget) {
    // Sort by priority DESC.
    // Pack into budget using char-count / 4 as token approximation.
    // Higher-priority sources stay. Lowest-priority sources get dropped.
    // No compression. No LLM-based summarization. Zero added latency.
  }
}
```

Trusts the agent prompt to handle context. Concatenates all sources
up to budget; if over budget, drops lowest-priority sources first.

## V2+ extensions (designed, not built)

- **LLMSummarizationCurator** — uses a cheap model (Haiku-class) to
  summarize bulky sources (e.g., a 50-page uploaded PDF) into key
  facts before feeding into the producer's window. Trades latency
  for context efficiency.
- **RelevanceRankingCurator** — uses embeddings to rank retrieved
  sources by relevance to the current task, keeping top-N. Requires
  pgvector + the V2 semantic memory layer.
- **IterationAwareCurator** — knows which sources have been seen by
  prior iterations; drops repeats, keeps novel info. For loops with
  many iterations on the same artifact.
- **SemanticRetrieverCurator** — given a new Idea, retrieves top-K
  most similar past work (Long-Form Masters, approved Artifacts) for
  grounding context. This is how "the system learns Srinivas's voice
  automatically" works in V2+.

## Where it lives in the V1 pipeline

```
Stage 3: Long-Form Master Build
  inputs:  ResearchDossier (10-30 sources) + Persona + Idea + uploaded docs
  Context Curator:  decide which sources go into synthesizer's prompt
  Loop Engine produce():  synthesizer agent runs with curated context

Stage 5: LinkedIn Post Generation (cross-critique)
  inputs:  LongFormMaster (potentially huge) + Persona + LinkedIn config
  Context Curator:  select sections of Master relevant to short-form
  Cross-Critique loop:  producers run with curated subset, not full Master
```

V1 wires `PassthroughCurator` at both points. The curation **decision**
is in Domain (which curator to use per stage); the curation
**machinery** is in Core.

## The import rule still holds

`src/lib/core/context/` has zero imports from `src/lib/domain/`.
Domain decides which curator to use per stage; Core knows nothing
about LinkedIn or Long-Form Masters or any creator concept.

## V1 priority assignments (reference)

Priority is a hint to the curator. V1's `PassthroughCurator` uses it
for drop-order; V2+ curators may use it for compression decisions
too. Conventional assignments:

| Source kind | Priority |
|---|---|
| User query / current instruction | 10 |
| Persona (voice, audience, brand) | 10 |
| Current Idea | 10 |
| Selected research sources | 8 |
| Long-Form Master (when input to repurpose) | 8 |
| Uploaded reference documents | 6 |
| Prior iteration's artifact | 5 |
| Prior iteration's judge feedback | 7 |
| Tool outputs (web search raw) | 4 |
| Conversation history (older turns) | 3 |

Adjust per stage as needed; the numbers are conventions, not law.

## Why "thin seam" rather than "real curator" in V1

Two reasons:

1. **MVP discipline.** V1 ships with whatever context fits in the
   producer's window. Modern models have 200K+ token windows; for V1
   artifacts (one Long-Form Master, one Persona, one rubric), this is
   ample.
2. **Real curators need real data.** A relevance-ranking curator
   without an embedding index is useless. A summarization curator
   without measured cost/quality tradeoffs is premature. V2 builds
   curators against actual V1 traffic and tunes them on observed
   failures.

The seam is the contribution. The first time a stage hits context
overflow in production, we swap in a real curator; nothing in Core
or Domain code has to change to enable that swap.
