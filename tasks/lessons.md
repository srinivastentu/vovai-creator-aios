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

## Phase 4 entries — distilled from the image pipeline (MMS, providers, judge, validators, tournament, UI)

See `docs/decisions/002-image-pipeline-learnings.md` for the full retrospective.

---

**Date:** 2026-04-14
**What we learned:** Tournament (generate N → judge → keep best) is the right generalisation for media artifacts. Iterative-revise assumes the producer can sharpen a specific dimension of an existing draft; image / audio / video models cannot — a regeneration is a new seed.
**Root cause:** The text stage's `revise()` function is not meaningful for artifacts where no internal state persists between calls.
**Rule:** For image, audio, and video stages use the tournament runner in `core/engine/tournament.ts`. Do not retrofit the text `revise` loop onto media. The PRESERVE/IMPROVE prompt refinement from text is still used — but between rounds of different candidates, not between revisions of the same candidate.
**Applied to:** `docs/decisions/002-image-pipeline-learnings.md` §2.1, §4.1 · `docs/architecture/tournament-pattern.md` §1

---

**Date:** 2026-04-14
**What we learned:** When concurrent callers share a rate-limit bucket, a check-then-increment across an `await` point lets N callers all pass the limit check before any recorded consumption. Seen when the tournament's `requestMultiple` ran 5 models from the same provider in parallel and all cleared a 3/min limit.
**Root cause:** The quota check and the increment straddled an async yield; the event loop scheduled other continuations before the increment ran.
**Rule:** In any shared-quota gate (rate limiter, semaphore, budget), call the increment / reserve step synchronously *before* `await`-ing the guarded work. Reconcile on failure. Fix landed at `src/lib/core/models/gateway.ts` by calling `rateLimiter.recordRequest()` before `executeWithTimeout(...)`.
**Applied to:** `docs/decisions/002-image-pipeline-learnings.md` §4.2 · commit `05da6f3`

---

**Date:** 2026-04-15
**What we learned:** Provider URLs built with unescaped dynamic segments (`modelApiId`, task IDs) are injectable. API keys passed as URL query parameters leak into logs and error messages.
**Root cause:** String interpolation without `encodeURIComponent` + credential placement in the wrong part of the request.
**Rule:** Every dynamic URL segment must be passed through `encodeURIComponent`. Credentials go in headers, never in query strings. Shared helper `maskApiKey` in `core/models/providers/shared.ts` is applied at the `fetchWithTimeout` boundary before any error is surfaced.
**Applied to:** `docs/decisions/002-image-pipeline-learnings.md` §4.3 · commit `49debd6`

---

**Date:** 2026-04-16
**What we learned:** Async-poll providers (Freepik Mystic, future Runway) need a specific pattern: tight submit timeout, then a remaining-budget poll loop with exponential backoff and abort support. Bespoke per-provider loops drift and miss cancellation.
**Root cause:** Polling code written per-provider tends to reinvent backoff, abort handling, and timeout layering — often incorrectly.
**Rule:** Every async-poll provider reuses `pollUntilComplete` from `core/models/providers/shared.ts`. Never hand-roll a poll loop in a provider client. If the utility doesn't fit a new provider's shape, extend the utility, don't fork it.
**Applied to:** `docs/decisions/002-image-pipeline-learnings.md` §2.3 · `src/lib/core/models/providers/shared.ts` · `src/lib/core/models/providers/freepik.ts`

---

**Date:** 2026-04-17
**What we learned:** Vision-model judges have the same calibration drift as text-model judges. Without explicit score bands, GPT-4o vision clustered competent images at 8.5+ and the rubric lost discrimination.
**Root cause:** Judges default to "be kind" unless the system prompt forces discrimination.
**Rule:** Every judge prompt (text, image, audio, video) must include an explicit calibration paragraph with numeric bands: "7 = competent production quality, 8 = professional, 9+ = exceptional — rare. Do not inflate." Make it a template shared across judges.
**Applied to:** `docs/decisions/002-image-pipeline-learnings.md` §4.6 · `src/lib/core/agentic/judges/image-judge.ts` · commit `314d29e`

---

**Date:** 2026-04-18
**What we learned:** Google's public docs listed `imagen-4-fast` and `imagen-4-standard` as valid API model IDs. The v1beta API returns 404 for those strings. Correct IDs are versioned and tier-gated. Separately, `gemini-3.1-flash-image-preview` (nanobanan-2) 503s on free-tier keys. Both were added to the catalog before sandbox verification, then disabled post-ship.
**Root cause:** Provider documentation and the actual API don't always agree; tier differences (free vs paid) aren't always documented.
**Rule:** Before adding a model to `src/lib/core/models/config/model-inventory.ts`, call the provider sandbox with the exact `apiModelId` and the tier that will be used in production. Confirm a successful response. Document the verification in the commit message — the next agent will re-learn this the hard way unless it is written down. Disabled models stay in the catalog with a `disabled` flag and a reason comment; they do not get silently removed.
**Applied to:** `docs/decisions/002-image-pipeline-learnings.md` §3.5, §4.7 · commits `d40e787`, `6923435`

---

**Date:** 2026-04-19
**What we learned:** A tournament UI that only shows the current round erodes the user's trust in "best-version tracking" — when round 3 is worse than round 1, users see worse work and assume the system regressed. Phase 4.5 fixed this with a two-column layout: current round on the left, best-so-far on the right.
**Root cause:** "Best ≠ latest" is an invisible property unless the UI makes it visible.
**Rule:** Any tournament-powered stage UI must render best-so-far separately from the current round. Keep the best artifact pinned until replaced by a strictly higher-scoring one. This mirrors the `bestArtifact` / `bestGrade` separation the engine already tracks internally.
**Applied to:** `docs/decisions/002-image-pipeline-learnings.md` §2.7 · `src/app/generate/image/page.tsx` · commit `314d29e`

---

**Date:** 2026-04-19
**What we learned:** Regenerate-with-feedback logic initially lived in the image page component and duplicated the prompt-augmentation rules. Moving it into `useImageTournament` (commit `3e41b50`) made the audio/video pages cheap to build.
**Root cause:** Prompt orchestration (augment original prompt with user feedback before dispatching to tournament) is stage logic, not presentation logic.
**Rule:** For every `/generate/*` page, the hook owns orchestration (prompt augmentation, tournament dispatch, state merging); the page component renders. Copy-paste the `useImageTournament` shape for `useAudioTournament`, `useVideoTournament`, etc.
**Applied to:** `docs/decisions/002-image-pipeline-learnings.md` §2.8 · `src/hooks/useImageTournament.ts`

---

## Phase 5 entries — distilled from the Phase 5.0 + 5.1A signoff (ElevenLabs, output paths, cost calc)

---

**Date:** 2026-04-20
**What we learned:** Naming carries semantic weight. `estimateCost` implied pre-call budget-check; the function was actually post-call final-cost calculation. Name first, docstring second — a good name prevents the misread before the docstring is read. Cheap to fix at birth, expensive six months later.
**Root cause:** Function was introduced with a generic verb (`estimate*`) that conflicts with the prevailing convention in budget / planning code, where `estimate*` means pre-call. The docstring that would have clarified it was also missing.
**Rule:** When a function operates on a `ProviderResult` — i.e. *after* the provider call has returned — it must be named `calculate*` / `compute*Final*` (or similar post-call verb), and the JSDoc must state "post-call" in the first line. Reserve `estimate*` for pre-call / projection helpers. Apply this check to every new helper in `core/models/` and `core/agentic/`.
**Applied to:** `src/lib/core/models/gateway.ts` (`estimateCost` → `calculateFinalCost` + JSDoc)

---

**Date:** 2026-04-20
**What we learned:** Never widen a discriminated union back to `string`. `unit: 'image' | ... | string` looks like a union but the trailing `| string` collapses it to `string` at the type level. The compiler cannot catch typo'd or invented units. Add new literals explicitly; never use `| string` as an escape hatch.
**Root cause:** `| string` was added as a forward-compatibility pressure valve when new pricing units were anticipated. In practice, TypeScript folds the union into `string`, so every literal in the union becomes decorative — no exhaustiveness, no narrowing, no typo protection.
**Rule:** Literal-string unions in `src/lib/core/models/types.ts` and anywhere exhaustiveness matters must not include `| string`. When a new value is needed, add it as a literal member in the same PR. Grep for `| string` next to literal unions before accepting any new type that looks like it.
**Applied to:** `src/lib/core/models/types.ts` (`PricingEntry.unit` — dropped `| string`, added `'character'` explicitly)

---

**Date:** 2026-04-20
**What we learned:** Spec-literal test forms are not ceremony. When the spec mandates "test that wraps in try/catch and asserts catch is unreachable," implicit proof via return-value assertion doesn't substitute. Reviewer rubrics match on form, and more importantly, the literal form catches bugs the implicit form can't when a new throw path is added later.
**Root cause:** The ElevenLabs client's existing failure-path tests asserted `res.success === false`, which implicitly proves no-throw today. A future refactor that adds a `throw` inside one path would still pass those tests (the assertion is never reached) or fail them with a misleading stack, not a clear "execute() threw" signal.
**Rule:** When a provider / tool / boundary helper carries a "never throws / never leaks / never rejects" clause, add a dedicated parameterized test shaped exactly around that clause — `try { await fn() } catch (err) { throw new Error('...') }` — covering ~5 representative failure paths. This test is not redundant with other failure-path tests; it encodes the spec form so the spec can't silently regress.
**Applied to:** `src/lib/core/models/providers/__tests__/elevenlabs.test.ts` (new `it.each` — "execute never throws — … returns { success: false }")

---

## 2026-05-31 — Cascade-cancelled tool batch corrupted streaming output (CR-0)

**What happened:** During CR-0 fork bootstrap, one tool call in a batch (an `ls` of a nonexistent directory) failed. The cascade cancelled subsequent queued tool calls in that batch. The streamed tool-result block presented to the session contained partially-rendered output from the cancelled tools, interleaved with later results. Reading this corrupted stream, the session believed typecheck, tests, and build had all passed when they had not. A broken commit was pushed to main with a tag. Recovery was via amend + force-push after re-reading raw tool results and verifying ground truth by file-dumping.

**Root cause:** Trusting batched/streamed tool output as ground truth at a safety-critical gate (the pre-push verification).

**Fix:** At the pre-push gate in cr-step-protocol skill, do not trust prior session context. Re-run typecheck, test, and build as sequential separate tool calls. Wait for each to complete and read the exit code from its own dedicated tool result before invoking the next. Only after all three return 0 in fresh sequential calls does `git push` proceed. Cascade-cancellation cannot fool a tool that has not yet been called.

**Generalizable lesson:** Streamed/batched output can be corrupted by upstream cancellation. When the decision is safety-critical (push to main, force-push, irreversible action), require fresh sequential verification. Distrust narrative context; trust separate tool calls.

---

## 2026-05-31 — `prisma migrate dev` did not refresh model delegates (CR-1)

**What happened:** After writing the CR-1 schema and running
`npx prisma migrate dev --name cr_1_creator_schema` (which reported the
migration applied and the DB "in sync"), the seed script failed with
`TypeError: Cannot read properties of undefined (reading 'upsert')` —
`db.user` was `undefined`. The generated client at `src/generated/prisma`
still held the previous (empty-schema) model set. Running
`npx prisma generate` explicitly produced the 11 model files and the seed
then succeeded.

**Root cause:** This repo uses Prisma 7's `prisma-client` generator (ESM,
TS-source output to `src/generated/prisma`, driver-adapter via
`@prisma/adapter-pg`). In this configuration `migrate dev` did not refresh
the client's model delegates, so the runtime client exposed no
`db.<model>` accessors even though the migration applied cleanly.

**Fix / rule:** After ANY `schema.prisma` change, run `npx prisma generate`
explicitly before invoking any `tsx` script (seed, inspect, pipeline runner)
that imports the generated client. Quick check:
`ls src/generated/prisma/models/` should list one file per model; if stale
or missing models, regenerate.

**Generalizable lesson:** With the Prisma 7 `prisma-client` (TS-source)
generator + driver adapter, treat `prisma generate` as a separate required
step after migrations — `migrate dev`'s "in sync" message refers to the
database, not necessarily the generated client. Relevant to CR-2/CR-3 seed
and pipeline scripts.

---

## Commit trailer omitted on CR-6 (2026-05-31)

**What happened:** The CR-6 code commit was authored as `VOVAI Founder`
(matching CR-1..CR-5) but omitted the harness's `Co-Authored-By` trailer.
The sign-off audit flagged the omission as a minor follow-up.

**Fix / rule:** The repo's CR-1..CR-5 commits all omit the trailer, so CR-6
matched local convention — but the harness convention is to include it.
Going forward, append the `Co-Authored-By` trailer on CR-step commits
(code + docs follow-up) unless the user says otherwise. Author stays
`VOVAI Founder`.

**Generalizable lesson:** When a harness/global instruction and the local
repo convention disagree on a low-stakes commit detail, follow the harness
instruction and note the divergence rather than silently matching local
history.

---

## The first live end-to-end run surfaces what mocks never do (CR-12, 2026-06-01)

**What happened:** Every CR step through CR-11 passed on mocked/small runs. The
CR-12 acceptance test — the FIRST full pipeline run against real models with a
real (longer) master — failed twice and exposed four defects no prior step hit:
(1) the synthesizer treated the validator's 800-word **floor** as a target and
undershot to ~700; (2) the gemini-2.5-pro judge's **thinking tokens** blew the
`maxOutputTokens` budget on a long article → MAX_TOKENS → synthetic 40; (3) the
judge had **no retry**, so one transient 503 corrupted the grade; (4) the health
monitor had **no time-based recovery**, so one bad patch of failures deadlocked
the provider "down" for the whole process.

**Fix / rule:** When a prompt states a hard floor/ceiling, give the model a
TARGET well inside the safe zone (margin), never the boundary — models aim at the
stated number and miss by ~10–15%. For LLM-as-judge with a thinking model: bound
the thinking budget AND raise the output cap (thinking counts against output),
retry transient 5xx/429 before any synthetic fallback, and prefer the
faster/lighter model (flash) when its calibration matches. For any process-global
circuit breaker (health monitor): it MUST have time-based recovery, or a batch
run cascades on the first transient blip.

**Generalizable lesson:** Don't relax a spec gate to make a run pass — fix the
producer to clear it (the decisions log's "tune prompts, don't relax the bar"
applies to every gate, not just cost). And budget a real live run before
declaring a pipeline done: mocks prove the wiring, only real models prove the
prompts, the token budgets, and the failure-handling.

---

## Run the live acceptance the moment the harness is built (CR-12, 2026-06-01)

**What happened:** The acceptance harness was correct on the first try, but the
live run still cost three full ~17-min runs + several isolated probes to get
green, because each failure surfaced a new layer (synthesizer → judge tokens →
judge retry → health deadlock). Debugging each in ISOLATION against an
already-persisted master/artifact (via the CLI scripts / a tiny judge probe) was
far cheaper than re-running the whole pipeline each time.

**Fix / rule:** When a long live pipeline fails mid-way, reproduce the failing
STAGE in isolation against the rows the failed run already persisted (the draft
master, the produced artifact) before re-running end-to-end. A 30-second judge
probe beats a 17-minute pipeline re-run for diagnosing a judge bug.

**Generalizable lesson:** Match the reproduction cost to the bug. Isolate the
smallest failing unit; only re-run the full thing to confirm the composed fix.

---

## Adding new lessons

Append new entries here whenever:
- A correction teaches a reusable rule
- A production stage surfaces a non-obvious constraint
- A tension flagged in `docs/decisions/` is resolved (note the resolution)
- A principle in `docs/decisions/` is violated and caught in review

Keep entries short. The rule is the reusable part — the rest is context so the rule doesn't get misapplied.
