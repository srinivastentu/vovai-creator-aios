# VOVAI eLearn AIOS — Lessons Learned

## Format
**Date:** YYYY-MM-DD
**What went wrong / What we learned:** [description]
**Root cause:** [why]
**Rule:** [specific rule to prevent recurrence or carry forward]
**Applied to:** [CLAUDE.md / docs/decisions/ / rules / hooks / code]

---

## Seed Entries — distilled from Phase 3.4/3.5 and `docs/decisions/001-project-learnings-phase-3.md`

These are the lessons we carry into the next production stages (image, audio, video, code, design). Each entry is a standing rule — violating it regresses quality, cost, or architecture.

---

**Date:** 2026-04-13
**What we learned:** The Loop Engine's real innovation is dependency injection (`AgentExecutor`, `JudgeFunction`), not the state machine. One engine now runs ideation, documents, and text unchanged.
**Root cause:** Engines that hardcode agents or artifact types can't generalise. The injection boundary is what made Phase 3.4 + LE-12 possible without touching `core/`.
**Rule:** Never let `core/` know what agents exist or what artifact types are being produced. Extend stage configuration in `domain/`, never the engine.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §2.2, §4.1

---

**Date:** 2026-04-13
**What we learned:** Revision prompts that say "make it better" produced regressions. Dimension-targeted prompts — PRESERVE ≥ 8, IMPROVE < 8 — delivered 0 regressions across 10 revisions in Phase 3.4 rounds 4–5.
**Root cause:** Generic revision instructions let the model rewrite the good parts. Dimension-scoped instructions align with how human writers actually revise.
**Rule:** Every new stage's revise prompt must explicitly say: dimensions scoring ≥ 8 must not be edited; dimensions scoring < 8 must be targeted. Non-negotiable.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §2.3, §4.2

---

**Date:** 2026-04-13
**What we learned:** Tracking `bestArtifact` and `bestGrade` separately from the latest iteration changes what humans review. Reviewers see the best version seen, not the most recent. Shifts incentive from "did we iterate" to "did we improve."
**Root cause:** Latest-version-only systems silently replace good work with worse iterations when the model regresses.
**Rule:** Every stage must track best-version alongside latest-version. Present the best to humans.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §2.4

---

**Date:** 2026-04-13
**What we learned:** Claude produces, GPT-4o judges, GPT-4o-mini runs adversarial critic. Same-family judges rubber-stamp producer errors. Cross-family caught real bugs in Phase 3.4 (invented "20% synaptic weakening" stat; Casgevy date 2021 → 2023 regression).
**Root cause:** LLMs of the same family share blind spots. A judge that shares the producer's priors won't catch the producer's mistakes.
**Rule:** Producer and judge must be from different model families. Add an adversarial-critic pass (cheap model) for error hunting.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §2.5

---

**Date:** 2026-04-13
**What we learned:** Quality needs three tiers: Tier-1 deterministic validator (cheap, no LLM), Tier-2 LLM judge (rubric-based, cross-model), Tier-3 domain auditor (stage-specific). Phase 3.4 only worked because all three exist for text.
**Root cause:** Skipping Tier-1 burns tokens on structurally-broken output. Skipping Tier-3 lets domain-specific errors (facts, safety, brand) through.
**Rule:** Every new stage needs all three tiers designed *before* implementation starts. For images: structural validator, aesthetic judge, NSFW/brand auditor. For video: duration/coherence validator, pacing judge, temporal-coherence auditor.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §2.6

---

**Date:** 2026-04-13
**What we learned:** The fact auditor caps accuracy at 4.0–7.75 while other dimensions cluster at 8.0–8.5. It flags unverifiable-but-correct claims. Elevate path can't fix this — the model has no new evidence.
**Root cause:** Auditors that only lower scores create dead-end dimensions. The loop has no mechanism to fetch external evidence.
**Rule:** When an auditor introduces a quality bottleneck the loop can't escape, pair it with an external-evidence tier (RAG / web search / human gate) — don't just let it cap scores.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §3.2

---

**Date:** 2026-04-13
**What we learned:** Text is forgiving — an LLM can revise a draft and sharpen one dimension. Image and video models cannot. You don't "revise" a generated video; you regenerate with new seed / prompt / model.
**Root cause:** The loop engine's "revise" assumes a continuous improvement trajectory. Non-text artifacts break this assumption.
**Rule:** For image/audio/video stages, implement the tournament pattern (generate N, judge N, keep best) instead of iterative revise. The loop engine supports this via `shouldContinue` and batched produce — don't retrofit the text-style revise loop onto media.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §4.3

---

**Date:** 2026-04-13
**What we learned:** The text stage accepts one cost-ceiling overrun at the boundary ("accept one overrun rather than forfeit the elevate"). Non-deterministic in production — a 99%-of-budget request can still spend 120%.
**Root cause:** Pragmatic dev-time choice that becomes a bug under per-customer budget caps or in higher-cost stages (image/video are 10–100× per call).
**Rule:** Before shipping image or video stages, replace the "one overrun" behaviour with a pre-call budget check. Blocking cost enforcement, not post-hoc recording.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §3.3, §3.7

---

**Date:** 2026-04-13
**What we learned:** `shouldContinue` checks the *last* iteration's min dimension, not the min across all iterations. If v1 is best overall and passes threshold, v2 dips, v3 never runs even when elevate was intended.
**Root cause:** State-transition logic assumed "best == latest."
**Rule:** State transitions around best-version must explicitly distinguish best-vs-latest. Add a test case for every new stage: "best = v1, v2 would elevate."
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §3.1

---

**Date:** 2026-04-13
**What we learned:** `processReview()` transitions from `revising` → `generating` on feedback without checking whether a gate is open or whether status is already `approved`. Works under single-reviewer UI; breaks under concurrent reviewers or multi-tab use.
**Root cause:** Review gates are created but don't actively prevent out-of-order actions.
**Rule:** Before introducing concurrent reviewer flows, add guards to `processReview()` that reject actions inconsistent with current gate state.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §3.4

---

**Date:** 2026-04-13
**What we learned:** The text rubric validates weight sums and threshold bounds at import. The four ideation rubrics (brief, audience, component, handoff) do not. A weight typo would cascade silently.
**Root cause:** Validation was added per-rubric rather than as a uniform import-time check.
**Rule:** Every rubric must have a `validate*Rubric()` function run at import time. Add the validator in the same PR as the rubric. Don't let image/video rubrics land without it.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §3.6

---

**Date:** 2026-04-13
**What we learned:** Component ordering rules (e.g., "flashcards depend on study_material") live declaratively in `component-registry.ts` as `dependsOn` and `attachableAt`. No imperative "video before quiz" check exists anywhere.
**Root cause:** Declarative constraints scale to new component types; imperative sequence checks don't.
**Rule:** When adding new component types (new stages, new content kinds), declare `dependsOn` and `attachableAt` in the registry. Never write an imperative order check.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §4.5

---

**Date:** 2026-04-13
**What we learned:** Cost is recorded at-source (every LLM call writes `tokensIn`, `tokensOut`, `costUSD`, `modelUsed`). But rolling up iteration → session → component → project is Domain Workflow code, wired per-stage. Missing this wire → great per-call telemetry, no project-level accounting.
**Root cause:** Core stays pure (correct), but Domain has to do the rollup plumbing (easy to skip).
**Rule:** When landing a new stage, wire cost aggregation in the same PR as the stage itself.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §4.4, §2.8

---

**Date:** 2026-04-13
**What we learned:** Nothing at the TypeScript level prevents wiring the same Claude model as both producer and judge. It's PR-review convention only.
**Root cause:** Producer-judge boundary is enforced by naming, not type system.
**Rule:** Add a type guard or lint rule preventing same-model producer/judge wiring before scaling to more contributors. Until then, every stage PR must explicitly state the producer family and judge family in its description.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §4.7

---

**Date:** 2026-04-13
**What we learned:** The three-question test (change for different AIOS? contains domain words? usable as-is by another AIOS?) is the gate for every new file in `core/`. Passing it is what kept the engine portable.
**Root cause:** Architectural separation requires an enforcement mechanism, not just a description.
**Rule:** Before committing a new file in `core/`, apply the three-question test. If in doubt, it belongs in `domain/`. Run `grep -r "from.*domain/" src/lib/core/` — it must return nothing.
**Applied to:** `CLAUDE.md`, `docs/architecture/core-domain-framework.md`, `docs/decisions/001-project-learnings-phase-3.md` §2.1, §5

---

**Date:** 2026-04-13
**What we learned:** `mix_produce` and `use_segments` review actions have case handlers in `processReview()` but the follow-up logic just sets status to `'generating'`. The UI must not advertise an action the backend can't execute.
**Root cause:** Reserved surface area shipped without plumbing.
**Rule:** Do not expose a review action in the UI until its full backend path is implemented and tested. Until then, these actions remain hidden or disabled.
**Applied to:** `docs/decisions/001-project-learnings-phase-3.md` §3.5

---

## Adding new lessons

Append new entries here whenever:
- A correction teaches a reusable rule
- A production stage surfaces a non-obvious constraint
- A tension flagged in `docs/decisions/` is resolved (note the resolution)
- A principle in `docs/decisions/` is violated and caught in review

Keep entries short. The rule is the reusable part — the rest is context so the rule doesn't get misapplied.
