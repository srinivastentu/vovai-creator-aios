# 001 — Project Learnings: Foundations through Phase 3.5

- **Status:** Captured
- **Date:** 2026-04-13
- **Scope:** Everything built from Loop Engine v2 (LE-0 through LE-13) through Phase 3.4 (first real end-to-end text stage) and Phase 3.5 (proving-interface UI)
- **Author:** First retrospective — distilled from `docs/architecture/*`, `docs/quality/phase-3-4-final-assessment.md`, commit history, and code review

---

## TL;DR

- The Core vs Domain split is real — not aspirational — and it's the single most load-bearing decision in the codebase. Protect it.
- The Loop Engine's real innovation is **dependency injection** (`AgentExecutor`, `JudgeFunction`), not the state machine. That's why the same engine runs ideation, documents, and text without modification.
- **Quality comes from feedback precision, not iteration count.** The PRESERVE ≥8 / IMPROVE <8 revision rule delivered zero regressions across Phase 3.4 rounds 4–5.
- **Best-version tracking beats latest-version tracking.** Humans review the best artifact seen, not the most recent one — this changes what "iterating" means.
- Cross-model producer/judge (Claude produces, GPT-4o judges) is cheap insurance against model collapse. Same-family judges hide their own errors.
- The three-tier quality model — deterministic validator → LLM judge → domain auditor — is a pattern. Every new stage (images, video, music) needs all three designed before implementation.
- Phase 3.4 passes because text is *forgiving*. Images and video break the "revise" assumption and will force the tournament pattern to exist.
- Several integration-layer tensions exist (review-gate guards, cost enforcement, rubric validation). They are not blockers today but compound as concurrency and cost scale.

---

## 1. Context

We've completed the Loop Engine v2 branch (14 steps, 729 tests) and the first real end-to-end production stage — text generation, with full proving-interface UI. The engine has now run on two genuinely different domain configurations (ideation stages and document pipeline) with zero code changes to `core/`. That's the proof we were waiting for: the engine is stage-agnostic in practice, not just in theory.

Before we start the image / video / music stages (Phase 3.6+) and the tournament pattern, the learnings from the text stage deserve to be captured as durable guidance. A lot of this is currently implicit — carried in commit messages, in the Phase 3.4 assessment, in reviewer intuition. This doc freezes those learnings so future agents and engineers don't re-derive them.

CLAUDE.md is the *contract* — how we work. This doc is the *reasoning* — why the contract looks like that, what's proven, and what's still under stress.

---

## 2. What's Working (keep doing this)

### 2.1 Core vs Domain separation has teeth

The "one import rule" (`grep -r "from.*domain/" src/lib/core/` returns nothing) is honored in practice. The three-question test in [docs/architecture/core-domain-framework.md](../architecture/core-domain-framework.md) is actually applied when deciding where new code goes. The result: the Loop Engine works identically for ideation and document pipelines. Any new core file should pass the three-question test *before* it's committed, not after.

- Enforcement: `src/lib/core/engine/loop-engine.ts` uses `unknown` for stage context — the engine cannot even compile against a domain type by accident.
- Critical files: [src/lib/core/engine/types.ts](../../src/lib/core/engine/types.ts), [src/lib/core/engine/loop-engine.ts](../../src/lib/core/engine/loop-engine.ts)

### 2.2 Injected dependencies are the real innovation

`produce()`, `evaluate()`, `runLoop()`, `processReview()` are small pure functions that accept `AgentExecutor` and `JudgeFunction` as inputs. The engine never imports an agent, a prompt, a rubric, or a domain concept. The Domain Workflow *assembles* the executor and judge for each stage.

This is why Phase 3.4 and LE-12 (document pipeline proof) share one engine. Do not bypass this injection boundary — if core needs to "know" about a new artifact type, that's a smell and you should refactor the domain side instead.

### 2.3 PRESERVE / IMPROVE delivers zero regressions

The text-generation revision prompt explicitly says: dimensions scoring ≥ 8 must not be edited; dimensions scoring < 8 must be targeted. [Phase 3.4 final assessment](../quality/phase-3-4-final-assessment.md) confirms: 0 regressions across 10 revisions in rounds 4–5. Generic "make it better" feedback regresses; dimension-targeted feedback monotonically improves.

- Carry forward: every new stage's revise prompt must carry the PRESERVE/IMPROVE instruction. This is not a suggestion — it's the mechanism by which the loop converges instead of oscillates.

### 2.4 Best-version tracking changes incentives

The stage stores `bestArtifact` and `bestGrade` separately from the latest. If v3 regresses, v2 is still recoverable, and the human reviewer sees the best version seen — not the most recent. This shifts the operator's question from "did we iterate?" to "did we improve?".

- Critical files: [src/lib/core/agentic/stages/text-generation-stage.ts](../../src/lib/core/agentic/stages/text-generation-stage.ts)

### 2.5 Cross-model producer / judge combats model collapse

Claude produces; GPT-4o (and GPT-4o-mini for adversarial pass) judges. Different model families have different blind spots — same-family judges often rubber-stamp producer errors. The Phase 3.4 assessment catches concrete cases (the invented "20% synaptic weakening" stat; the Casgevy 2021 → 2023 date regression) that a same-family judge would have missed.

- Keep the producer/judge family asymmetry when adding new stages. Trivial to violate by accident; hard to debug when it happens.

### 2.6 Three-tier quality model

The text stage formalises a pattern worth generalising:

1. **Tier 1 — Deterministic validator** (cheap, no LLM): structural checks like word count, presence of required sections. Fail fast here before spending tokens.
2. **Tier 2 — LLM judge**: the rubric-based grader. Cross-model per §2.5.
3. **Tier 3 — Domain auditor**: stage-specific truth checks. For text: the fact auditor. For images (future): NSFW/brand-safety. For video: temporal coherence.

Every new stage needs all three designed *before* implementation starts.

### 2.7 Per-stage conversation isolation

LE-9 added `stageId` on `IdeationConversation` with a compound index `(blueprintId, stageId)`. Each stage's LLM conversation is isolated — the Component Recommender never sees the Curriculum Strategist's thread. This prevents context leakage between agents and keeps each stage's reasoning auditable on its own.

### 2.8 Cost tracking is at-source and pervasive

Every LLM call goes through [src/lib/core/agentic/pricing.ts](../../src/lib/core/agentic/pricing.ts) and every result carries `tokensIn`, `tokensOut`, `costUSD`, `modelUsed`. The text stage even breaks costs down by role (producer / judge / auditor). Aggregation up the tree (iteration → session → component → project) is a Domain Workflow responsibility — core stays pure.

---

## 3. Architectural Tensions (watch these)

### 3.1 `shouldContinue` edge case: best = v1 while v2 would elevate

The `shouldContinue` hook on `LoopStage` is elegant, but there's an observed edge case: if v1 is the highest-scoring iteration and passes threshold, but v2 would have triggered `elevateThreshold` (a dimension < 8.0), v3 never runs. The hook checks the *last* iteration's min dimension, not the min dimension across all iterations.

- Fix path: add a test covering "best = v1, v2 would elevate" and broaden the hook's check.
- Files: [src/lib/core/agentic/stages/text-generation-stage.ts](../../src/lib/core/agentic/stages/text-generation-stage.ts) ~L196–207, [src/lib/core/engine/types.ts](../../src/lib/core/engine/types.ts) ~L113

### 3.2 Fact auditor creates a new quality bottleneck

Accuracy scores now cluster 4.0–7.75 while other dimensions cluster 8.0–8.5. The auditor catches real errors *and* penalises correct-but-unverifiable claims. The loop's elevate mechanism is weak when accuracy is the limiting dimension — you can't "improve" accuracy without new evidence.

- Tension: **epistemic honesty vs. quality-score inflation**. The doc we chose honesty, which is right — but it means the elevate path needs an external-evidence tier (RAG / web search in Phase 11+), or accuracy thresholds need to be relaxed with a human gate.

### 3.3 Cost ceiling allows "one overrun"

[text-generation-stage.ts](../../src/lib/core/agentic/stages/text-generation-stage.ts) ~L206 accepts one overrun rather than forfeit the elevate at the budget boundary. Pragmatic, but non-deterministic in production. A request at 99% of budget can still spend 120%.

- Needs a decision: is one overrun acceptable under per-customer budgets? If not, tighten before the image stage (where per-call costs are higher and one overrun is more costly).

### 3.4 Review state transitions lack guards

`processReview()` transitions status from `revising` → `generating` on feedback, but doesn't check whether a gate is currently open or whether the status is already `approved`. Out-of-order actions (feedback after approval) are not prevented. Not a bug under single-reviewer UI flow; becomes a bug under concurrent reviewers or multi-tab use.

### 3.5 `mix_produce` and `use_segments` — plumbing absent

Both review actions have case handlers in `processReview()`, but the follow-up logic just sets status to `'generating'`. The shape is reserved; the mechanism isn't built. We should not advertise these actions in the UI until the plumbing lands.

### 3.6 Rubric schema validation is partial

The text rubric (`TEXT_RUBRIC`) validates weights sum to 1.0 and threshold bounds. The ideation rubrics (brief / audience / component / handoff) have no corresponding `validate*Rubric()` checks. A typo in a weight cascades silently.

- Easy fix: add runtime validation for every rubric at import time. Do this *before* adding image / video rubrics.

### 3.7 Cost is recorded post-hoc, never blocked pre-call

`CostGuard` sums costs; it does not refuse to make a call that will exceed the project budget. Today's risk is small (text costs are low). Image and video calls will be 10–100× more expensive per call — pre-call budget enforcement needs to exist before we turn those on.

### 3.8 Agent fallback token accounting

If Claude Sonnet times out and Haiku is called, the token *estimate* from Sonnet is still used in accounting. Error is ~$0.02 per call but compounds silently. Fix: re-read the actual response's model and recompute cost.

---

## 4. Non-Obvious Insights

### 4.1 The state machine is standard; injection is the innovation

`IDLE → GENERATING → EVALUATING → REVISING → PRESENTING → AWAITING_REVIEW → APPROVED` is unremarkable. What's unusual is that the engine accepts the executor and judge as inputs and has no knowledge of what they do. That's why one engine runs ideation and text. New engineers often assume the state machine is the innovation and try to "extend" it; resist that — extend the stage configuration instead.

### 4.2 Quality is feedback precision, not iteration count

More iterations with generic "improve this" feedback causes regressions. Fewer iterations with PRESERVE-≥8 / IMPROVE-<8 feedback yields monotonic improvement. If a stage is regressing, the fix is almost always in the revise prompt, not in the iteration budget.

### 4.3 Phase 3.4 passes because text is forgiving

Text can always be revised incrementally. An LLM can take a draft and sharpen one dimension. **Image and video models cannot.** You don't "revise" a generated video — you regenerate it, possibly with a new seed / prompt / model. This breaks the engine's current assumption that revise produces a continuous improvement trajectory. Phase 3.6+ will force the tournament pattern (generate N, judge N, keep the best) to actually exist in code — it's only in architecture docs today.

### 4.4 Cost aggregation is a Domain responsibility

Core records per-call cost accurately. Rolling up to "this lesson cost $3.12" is Domain Workflow code, not engine code. This is the right split, but it means nothing aggregates automatically — someone has to wire it per stage type. Missing this wire is how we end up with great per-iteration telemetry and no project-level accounting.

### 4.5 Constraints are declarative, not hardcoded

[src/lib/domain/workflows/component-registry.ts](../../src/lib/domain/workflows/component-registry.ts) encodes `attachableAt`, `dependsOn`, and `estimatedCost` per component. There is no "video before quiz" rule in imperative code anywhere; the registry says `quiz.dependsOn = ['study_material']` and the handoff validator enforces it. When adding new component types, add them declaratively — never as a hardcoded sequence check.

### 4.6 Stage order is configurable per project

`PIPELINE_PHASE_ORDER` is a default, overridable by `ProjectBlueprint.workflowTemplate.productionOrder`. If a user says "meta before videos," that's respected (with dependency validation). Don't assume the default order is universal.

### 4.7 Producer-judge boundary is enforced by convention, not type

Nothing at the type level stops someone from wiring the same Claude model as both producer and judge. It's convention + PR review. Worth adding a lint / type guard before the codebase gets more contributors, because this is the kind of thing that regresses silently and degrades quality for weeks before anyone notices.

---

## 5. Operating Principles (carry these forward)

1. **Three-question test before commit.** Any new file in `core/` must pass: (a) would this change for a different AIOS? (No), (b) does it contain domain words? (No), (c) could another AIOS use it as-is? (Yes).
2. **Every new stage ships with a Tier-1 / Tier-2 / Tier-3 quality model.** Validator, judge, auditor — all three designed before any agent is wired.
3. **Revise prompts must carry PRESERVE ≥8 / IMPROVE <8 explicitly.** Generic revision instructions are how regressions happen.
4. **Capture hard-won insights in `tasks/lessons.md` in the same session that finds them.** That file is currently empty; Phase 3.4 alone justifies 4–5 entries.
5. **Schema-validate every new rubric at import time.** Add the validator alongside the rubric, in the same PR.
6. **Cross-model producer / judge.** Never wire the same model family on both sides of the loop.
7. **Best-version tracking, not latest-version.** Humans review the best seen; never silently replace it with a worse iteration.
8. **Declarative constraints beat hardcoded sequences.** Add `dependsOn` / `attachableAt` to the registry; never write an imperative order check.
9. **Cost aggregation is wired per stage type.** Write the rollup when the stage lands, not later.
10. **Guard review-gate state transitions before shipping concurrent review.** Single-reviewer today is load-bearing; don't scale without guards.

---

## 6. Open Questions (to resolve in future decision docs)

- **Image stage mechanism:** tournament-of-N with aesthetic judge, or iterative-regen-with-feedback? Text's "revise" doesn't map; this is a genuine choice.
- **Accuracy-bottleneck fix:** introduce a RAG / web-search tier, or relax the accuracy threshold and gate uncertain claims with a human review action?
- **Cost enforcement model:** quota-based pre-call block, or budget-exhaustion alert with operator override?
- **Review-gate concurrency:** lock on gate open (pessimistic), or last-writer-wins (optimistic with audit log)?
- **Agent prompt versioning:** prompts are currently module-level strings. At what point do we give them a versioning story (Git-backed history, A/B evaluation, prompt registry)?

Each of these deserves its own decision doc (`002-…`, `003-…`) when we pick it up.

---

## 7. Pointers

**Architecture docs:**

- [docs/architecture/core-domain-framework.md](../architecture/core-domain-framework.md)
- [docs/architecture/recursive-loop-engine.md](../architecture/recursive-loop-engine.md)
- [docs/architecture/system-overview.md](../architecture/system-overview.md)
- [docs/architecture/elearn-pipeline.md](../architecture/elearn-pipeline.md)

**Quality assessment:**

- [docs/quality/phase-3-4-final-assessment.md](../quality/phase-3-4-final-assessment.md)

**Core engine (do not change without re-validating the one-import rule):**

- [src/lib/core/engine/loop-engine.ts](../../src/lib/core/engine/loop-engine.ts)
- [src/lib/core/engine/types.ts](../../src/lib/core/engine/types.ts)
- [src/lib/core/agentic/grader.ts](../../src/lib/core/agentic/grader.ts)
- [src/lib/core/agentic/pricing.ts](../../src/lib/core/agentic/pricing.ts)
- [src/lib/core/agentic/stages/text-generation-stage.ts](../../src/lib/core/agentic/stages/text-generation-stage.ts)

**Domain (where eLearning concepts live):**

- [src/lib/domain/workflows/pipeline-orchestrator.ts](../../src/lib/domain/workflows/pipeline-orchestrator.ts)
- [src/lib/domain/workflows/component-registry.ts](../../src/lib/domain/workflows/component-registry.ts)
- [src/lib/domain/workflows/archetypes.ts](../../src/lib/domain/workflows/archetypes.ts)

**Process:**

- [tasks/lessons.md](../../tasks/lessons.md) — currently empty; populate per Principle #4.
