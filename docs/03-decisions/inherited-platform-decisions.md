# Inherited Platform Decisions

> Decisions made during VOVAI eLearn AIOS planning that apply
> unchanged to CreatorOS. These are platform-level (universal),
> not domain-level (eLearn-specific). The eLearn-specific ones —
> K-12 archetypes, video pipeline, ADDIE — are explicitly **not**
> carried over.

## How to read this document

Each entry below was a real decision in eLearn AIOS. The "Why this
applies to CreatorOS" note explains the reasoning. If a future
session questions one of these, this doc is the answer.

---

## 1. Custom engine vs agentic framework

**eLearn decision:** Build custom for production POC through
production UI. Migrate to LangGraph only at multi-tenant SaaS scale
(if ever).

**Why this applies to CreatorOS:** The Loop Engine, Cross-Critique
pattern, Tournament pattern, and multi-stage Domain Workflows do not
exist in any off-the-shelf framework. Adopting LangGraph at V1 would
mean reimplementing all of this on top of someone else's primitives
and inheriting their constraints. We use the custom engine that
eLearn already built and is already tested.

## 2. Cross-model evaluation

**eLearn decision:** Producer and judge use different LLM models.
Default: Claude produces, GPT-4o judges. (Inverted for some stages.)

**Why this applies to CreatorOS:** Self-preference bias is universal.
A model grading its own output systematically inflates scores.
CreatorOS extends this: in cross-critique, the judge must differ
from both producers AND the integrator. V1 uses Gemini as judge
specifically to maintain three-model separation.

## 3. Tech stack

**eLearn decision:**

| Layer | Choice |
|---|---|
| Frontend | Next.js 15+ App Router, React, TypeScript strict, Tailwind 4, shadcn/ui |
| Backend | Next.js Route Handlers (REST) |
| Database | PostgreSQL 16+ with Prisma 7 |
| Queue/Cache | Redis (BullMQ) — V2+ for CreatorOS |
| LLM (Production) | Claude Sonnet (Anthropic SDK) |
| LLM (Judge) | OpenAI GPT-4o (cross-model discipline) |
| Testing | Vitest |
| Package manager | npm |
| Auth | Clerk (V2+ for CreatorOS) |
| Billing | Stripe (V2+) |
| Deploy | Vercel |

**Why this applies to CreatorOS:** Forking from eLearn means inheriting
this stack. CreatorOS adds Gemini (via direct REST through MMS) for
the cross-critique judge. Image/voice/video providers from eLearn's
MMS catalog (fal.ai, Freepik, ElevenLabs, Runway, Suno) remain
registered but unused in V1.

## 4. Coding standards

**eLearn decision:**

- TypeScript strict. Never `any`.
- ES modules. 2-space indent. No semicolons.
- Functional React + hooks.
- Every state change emits an event.
- Every artifact is immutable.
- Every LLM call is tracked in the cost ledger.

**Why this applies to CreatorOS:** Same codebase, same standards.

## 5. Three-question test for every new file

**eLearn decision:** Before creating any file, ask:

1. Would this change for Film AIOS? (Core = No, Domain = Yes)
2. Does it contain domain words? (Core = No, Domain = Yes)
3. Could another AIOS use it as-is? (Core = Yes, Domain = No)

When in doubt, it's Domain.

**Why this applies to CreatorOS:** Identical reasoning. Substitute
"creator words" (persona, niche, hook, repurpose) for "domain words"
when evaluating.

## 6. The one import rule

**eLearn decision:** `domain/` may import from `core/`. Never the
reverse. Enforced by:

```bash
grep -rE "from ['\"][^'\"]*domain/" src/lib/core/
# must return nothing
```

**Why this applies to CreatorOS:** This is the architectural contract.
Without this rule, Core stops being portable, and the entire "build
multiple AIOSes on one platform" premise collapses.

Note: the original `CLAUDE.md` had `grep -r "from.*domain/"` which
matched comment lines (false positives). The corrected command uses
quoted-path matching to filter comments.

## 7. Eight architectural principles

**eLearn decision:**

1. Event-Driven — every state change emits an event
2. Artifact-Centric — every output is an immutable, versioned artifact
3. Immutable History — past artifacts are never edited, only superseded
4. Agent Composability — agents are small, named, reusable, use skills
5. Human Sovereignty — humans approve at every critical gate
6. Cost Transparency — every iteration tracks USD; aggregates up
7. Graceful Degradation — on failure, preserve state, resume from last stable point
8. User Sovereignty Over Defaults — system suggests, never enforces

**Why this applies to CreatorOS:** Universal. Particularly:

- Principle 3 (Immutable History) drives the **fork-on-regenerate**
  decision for inline-edit + regenerate UX.
- Principle 5 (Human Sovereignty) is why Gates A and B are
  non-bypassable in V1.
- Principle 6 (Cost Transparency) is why every cross-critique stage
  has `maxBudgetUSD` and a per-iteration cost record.

## 8. Multi-tenancy model (deferred)

**eLearn decision:**

- Tenant-scoped data: Projects, artifacts, grades, reviews, custom
  agents/skills/rubrics/prompts, brand profiles, users, billing,
  API keys
- Platform-shared: Platform agent templates, skill templates, model
  catalogue, platform policies
- Inheritance: platform provides defaults → tenants clone and
  customize → tenant copies are independent and versioned → platform
  template updates offered as optional upgrades, never forced

**Why this applies to CreatorOS:** V1 is single-tenant (one local
user) with the **schema designed multi-tenant from day 1**. The
`WorkspaceRole` enum exists. The `userId` and `workspaceId` foreign
keys exist. When Clerk wires in (V2+), this design absorbs the
multi-tenant case without schema churn.

## 9. Loop rules (all 9)

**eLearn decision:**

1. Minimum 2 iterations enforced
2. Track BEST version, not just current
3. Checkpoint after every iteration (immutable)
4. Dimension-aware revision (PRESERVE/IMPROVE per Forge ADOPT 1)
5. Human feedback applied once then cleared
6. Deterministic validators run BEFORE LLM judge
7. Cross-model judging
8. Cost tracking on every iteration
9. Graceful degradation

**Why this applies to CreatorOS:** Universal. CreatorOS adds 3
Pattern-5-specific rules (Producer ≠ Integrator ≠ Judge; producers
never see the rubric; budget cap is hard). The 9 universal rules are
unchanged.

## 10. Producer ≠ Judge discipline

**eLearn decision:** An agent cannot evaluate its own output. The
judge model must differ from the producer model.

**Why this applies to CreatorOS:** Universal. Extended for
cross-critique: producers, integrator, and judge must all differ at
the model level. Enforced at runtime in the cross-critique pattern.

---

## What we are explicitly NOT carrying over

These eLearn decisions are domain-specific and do NOT apply:

- K-12, Professional, Channel archetypes — replaced with creator
  personas (BuildOS, AgriOS, etc.)
- Bloom's Taxonomy classification — not applicable to creator content
- ADDIE pedagogical framework — not applicable
- 5-stage Phase 0 ideation (Brief → Audience → Structure → Components
  → Handoff) — replaced with CreatorOS pipeline (Idea → Research →
  Master → Repurpose → Save)
- Document / Assessment / Video / Activity / Capstone production
  pipelines — replaced with cross-critique production
- Tournament loop pattern as primary — Cross-Critique is primary in
  CreatorOS V1; Tournament remains in Core for V2 image generation
- Image generation pipeline (Flux / DALL-E / Freepik) — not in V1;
  designed for V2
- ElevenLabs voice / Suno music / Runway video — V4+
- 50-agent eLearn map — replaced with 12-agent CreatorOS map
- 106-skill eLearn library — replaced with smaller V1 creator skills

The MMS catalog still has these models/providers registered (image,
voice, video). They're available for V2+ artifact types without code
changes — just new domain configs.
