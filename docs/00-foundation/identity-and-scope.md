# CreatorOS — Identity and Scope (V1)

> One-page summary. For full specification see `docs/00-foundation/master-context.md`.

## What CreatorOS is

An agentic AI-powered **content production OS** for creators. One idea
in → multiple publishable artifacts out, each shaped to its platform,
each aligned to the creator's voice, each grounded in researched
sources, each refined through a multi-model dialectic.

CreatorOS is the second AIOS built on the VOVAI Core Platform.
The first was eLearn AIOS. The Core is reused verbatim.
The Domain (creator-specific) is new.

## What V1 ships

Exactly this — nothing more:

- 1 user (hardcoded local), multi-role schema designed in
- Persona CRUD (BuildOS persona seeded for the acceptance test)
- IdeaLog with niche tags
- Research stage (Anthropic web_search + uploaded PDFs)
- Long-Form Master synthesizer (structured sections + traceable sources)
- Gate A — source traceability review
- Repurpose to **2 artifact types**: `linkedin_post` + `long_form_article`
- Cross-Critique loop (Claude + GPT producers, mutual critique, Claude
  integrator, Gemini judge)
- Inline editing on all artifacts
- Regenerate (with fork-on-edit semantics)
- Cost tracking, audit log
- Gate B — per-artifact human review

## What V1 does NOT ship

LFM versioning, blog post / newsletter / X thread / image post /
carousel artifact types, multi-pattern cross-critique testbed,
YouTube transcripts, scheduling, publishing APIs, performance
feedback loop, video, audio, voice cloning, multi-tenant SaaS,
billing, Clerk auth, pgvector semantic memory.

All designed-in. None built in V1.

## The acceptance test

V1 is "done" when this passes consistently:

**Persona** "BuildOS Creator" → **Niche** AI / Agentic AI → **Idea**
"Agentic AI development" (Idea Coach proposes specific titles; user
picks one) → pipeline produces **1 LinkedIn post + 1 long-form article**
such that:

1. The Long-Form Master cites traceable sources (every section ↔ URL/upload)
2. The LinkedIn post is publishable without rewrite
3. The article is publishable without rewrite
4. Cross-critique produced substantively different versions across
   iterations (cosine similarity ≤ 0.92 between consecutive integrated
   artifacts; checked via `text-embedding-3-large`)
5. Total run < 30 minutes, total cost < $5.00 USD

Pass criteria 2 and 3 are human-judged. The others are mechanized.

## Phased roadmap (beyond V1)

| Phase | What's added |
|---|---|
| V2 | Blog post, newsletter, X post/thread, image post, carousel; LFM versioning + diff; multi-pattern cross-critique testbed; YouTube transcripts |
| V3 | Scheduling UI; LinkedIn/X/Meta publishing APIs; performance feedback loop |
| V4 | Short-form video (Reels/Shorts); long-form video; podcast; voice cloning |
| V5+ | Multi-tenant SaaS; trend intelligence; marketplace for personas/rubrics |

Architecture supports all of the above from day 1. Only V1 components
are built.

## The single insistence

Speed of MVP > breadth of features. We don't build a feature unless
the V1 acceptance test requires it. Everything else waits.
