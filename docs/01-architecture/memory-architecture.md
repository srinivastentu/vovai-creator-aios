# Memory Architecture

> Every agentic system has four kinds of memory. CreatorOS handles
> all four, but the mechanisms and storage backends differ. This
> document names them explicitly so the architecture is
> self-documenting and so future contributors don't conflate them.

## The four memory types

| Memory type | Lifespan | Where it lives in CreatorOS | V1 status |
|---|---|---|---|
| **Short-term** (LLM working context) | Within one LLM call | Inside the producer / critic / judge prompts during one Loop Engine iteration | ✅ Implicit |
| **Episodic** (session history) | Within one Workspace's pipeline run | `IterationRecord[]` on `StageSession` + `humanFeedback[]` + reviewer comments. Survives crashes, can be resumed. | ✅ V1 |
| **Knowledge Base** (curated reference) | Persistent across pipeline runs | `CreatorPersona` (voice DNA, audience, brand), `LongFormMaster` (per-topic raw material), Skills library, uploaded reference docs | ✅ V1 |
| **Long-term semantic** (retrievable by similarity) | Persistent + searchable | **Not in V1.** V2 adds PostgreSQL `pgvector` + embedding index over Long-Form Masters, past Ideas, past Artifacts | ❌ V2 |

## Why this matters

Most failures in long-running agent systems trace back to one of
these memory types being either absent or misnamed. By naming them
explicitly:

- We see V1's gap is **long-term semantic memory** (no Vector DB).
  For one workspace with one Long-Form Master and one LinkedIn post,
  this is fine. It becomes a problem the moment the creator has 20
  past posts and wants the system to *learn from their archive*
  during new production.

- We see that **Knowledge Base** memory is already well-distributed
  across CreatorPersona, LongFormMaster, and Skills. We don't need a
  new system in V1 — we need to make sure the Context Curator (System
  6) knows how to pull from each.

- We see that **Episodic** memory in the Loop Engine is already
  best-in-class because of `IterationRecord` immutability and
  best-version tracking (Forge ADOPT 2-3).

## V2 plan for long-term semantic memory

Add `pgvector` extension to the PostgreSQL DB. Embed:

- Every saved Long-Form Master section (chunked, 512-token chunks)
- Every approved Artifact (`linkedin_post`, `long_form_article`, ...)
  with persona + niche metadata
- Every Idea description in the Idea Log

Provide a `SemanticRetrieverCurator` (one of the Context Engineering
System's curator implementations) that, given a new Idea, retrieves
top-K most similar past work for grounding context. This becomes
how the producer "knows what Srinivas sounds like" automatically —
no manual style-guide updates needed.

## V1 implications

- Persona voice/tone fields must be detailed enough to substitute
  for "the system reads your past posts." User describes their voice
  carefully in CRUD form.
- The seeded BuildOS persona for the acceptance test will be
  hand-crafted to be voice-rich. We'll know V2's semantic memory is
  needed when the user's third or fourth persona requires the same
  hand-crafting effort.
- Episodic memory carries iteration history through Gate A and
  Gate B — the iteration history panel in Gate B is a direct surface
  of `IterationRecord[]`.

## Reference

Implementation:
- `prisma/schema.prisma` — `IterationRecord`, `StageSession`,
  `CreatorPersona`, `LongFormMaster`, `LongFormSection`, `SourceRef`
- `src/lib/core/engine/types.ts` — `LoopState.iterations`,
  `LoopState.humanFeedback`
- `src/lib/core/context/` — the curator interface that V2's semantic
  retriever will plug into
