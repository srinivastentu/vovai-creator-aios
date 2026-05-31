# CR-5 Sign-off Review — MMS Gemini + judge + rubrics

| | |
|---|---|
| **Step** | CR-5 — MMS Gemini + judge + rubrics (LinkedIn + article stages) |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `cda2c47` |
| **Tag** | `CR-5-mms-judge` |
| **Reviewed at** | 2026-05-31 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-5 is properly done and meets its action-plan scope. Every "Build" deliverable exists at its specified path and behaves as specified: a generic Core Gemini text path (capability-first dispatch so text models disambiguate from the prefix-sharing native image models), two registered text models, two 6-dimension rubrics whose weights sum to exactly 1.0000, a cross-model gateway-routed reasoning-first never-throw Gemini judge with the composite computed by code, the judge wired into both single-producer stages with a PRESERVE/IMPROVE revise path, and build-time Producer≠Judge enforcement. All five lenses returned pass / pass-with-nits, and I re-derived every deterministic gate clean. There were no blockers and no inter-lens disagreement on the verdict — only on whether the cost-ledger gap is a major or minor. I adjudicated it a **major** (not a blocker): it is a real forward-readiness defect that does not invalidate CR-5 (whose own $2.00 ceiling is measured by an accurate stage-local total) but would break the CR-12 acceptance budget assertion if left unaddressed. It is tracked due-before-CR-12. Verdict: **SIGN-OFF WITH FOLLOW-UPS**.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 (`tsc --noEmit` clean) |
| `npm run test` | exit 0 — 523 passed / 3 skipped (37 files) |
| `npm run build` | exit 0 (reported by orchestrator; spec gates satisfiable) |
| Import discipline (`core` → `domain`) | empty (PASS) — `grep -rEn "from ['\"][^'\"]*domain/" src/lib/core/` exit 1 |
| `prisma validate` / `migrate status` | valid; up to date (no migration needed — `bestScore Float?` existed from CR-1) |
| Rubric weight sums | LinkedIn 1.0000, article 1.0000 (re-computed) |

## What's correct (strengths)

- All deterministic gates pass on a clean working tree; the import-discipline grep returns nothing (comment-safe), prisma validates, migrations are up to date.
- Both rubrics match [docs/02-domain/rubrics.md](docs/02-domain/rubrics.md) dimension-for-dimension: 6 dims each, weights summing to exactly 1.0000 ([linkedin-post-rubric.ts:21](src/lib/domain/workflows/creator/rubrics/linkedin-post-rubric.ts#L21), [article-rubric.ts:21](src/lib/domain/workflows/creator/rubrics/article-rubric.ts#L21)), completeness 0.20 (Forge ADOPT 6), passThreshold 80, concrete 1/4/7/9 anchors.
- The Gemini judge satisfies every rubrics.md authoring rule: reasoning-first, composite computed by code via Core `calculateWeightedScore × 10` ([gemini-text-judge.ts:234](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L234)), fresh context (only rubric + artifact + persona; never critiques/producer reasoning), gateway-routed ([gemini-text-judge.ts:185](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L185)), and never-throw (synthetic failing grade on any failure).
- Producer≠Judge cross-model discipline (loop rule 7 / Pattern-5 rule 10) enforced at stage-build time by `assertCrossModel` ([single-producer-stage.ts:221](src/lib/domain/workflows/creator/single-producer-stage.ts#L221)) and unit-tested both standalone and via stage rejection ([judge-grading.test.ts:201](tests/unit/domain/judge-grading.test.ts#L201)).
- Correct Core/Domain split with the import rule intact: the only Core change (`callGeminiText` + 2 catalog entries) is zero-domain-words machinery dispatched capability-first ([google-gemini.ts:310](src/lib/core/models/providers/google-gemini.ts#L310)); the two judges are thin Domain wrappers over a shared factory; the judge is injected into `runLoop` as a `JudgeFunction`, never imported by the engine.
- Producers gained a `revise()` that derives PRESERVE/IMPROVE feedback from the judge grade and never includes rubric text ([linkedin/producer-claude.ts:137](src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts#L137)); a strong test exercises the full fail→revise→pass loop.
- Every deviation from the action-plan letter is recorded in the CR-5 decisions log with rationale and supersession links ([creator-decisions-log.md:467](docs/03-decisions/creator-decisions-log.md#L467)).
- Git hygiene: one well-formed implementation commit on the tagged commit with `Refs:` + Co-Authored-By trailer; tag resolves to HEAD; working tree clean.

## Findings

### 🔴 Blockers

None. The step is complete and does not break CR-6 (pure Core, unblocked).

### 🟠 Majors

1. **Cost-ledger bypass will undercount the CR-12 acceptance budget.** Producer LLM calls invoke `client.messages.create(...)` directly and account spend via `calculateCost(...) → onCost` (a stage-local accumulator), bypassing the Core `CostLedger` ([linkedin/producer-claude.ts:219](src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts#L219)). Only the gateway-routed Gemini judge lands in the ledger ([gateway.ts:296](src/lib/core/models/gateway.ts#L296)); the CR-2/CR-3 OpenAI judges also bypass it. The action plan's CR-12 criterion reads `Total cost (CostLedger.getTotal) < $5.00` ([v1-action-plan.md:943](docs/04-plans/v1-action-plan.md#L943)); since producers are the dominant spend, `getTotal()` would drastically undercount the run. CR-5 itself is unaffected — its $2.00 ceiling is measured by the accurate stage total `getTotalCostUSD()` ([single-producer-stage.ts:322](src/lib/domain/workflows/creator/single-producer-stage.ts#L322)). _Track; due before CR-12._

### 🟡 Minors (track as follow-ups)

1. **Gemini 2.5 thinking-budget.** The judge sets no `maxOutputTokens` ([gemini-text-judge.ts:185](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L185)); gemini-2.5-pro thinks by default, and a `finishReason='MAX_TOKENS'` empty-text response is treated as a hard failure → synthetic 40 ([google-gemini.ts:390](src/lib/core/models/providers/google-gemini.ts#L390)), which can collapse a strong artifact and drive a needless costly revise. _Fix before CR-7 (fold into the planned judge-calibration pass)._
2. **PRESERVE/IMPROVE boundary vs pass bar.** Producers split PRESERVE at `score >= 8` / IMPROVE at `score < 8` ([linkedin/producer-claude.ts:140](src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts#L140)), but the rubric per-dimension pass bar is 7, so 7–7.75 dimensions (already passing) get polished. Likely intentional but undocumented; confirm it is not churning acceptable dimensions. _Document before CR-7._
3. **Stage threshold (75) vs rubric.passThreshold (80) divergence.** Correct and documented (loop terminates on 75 per [loop-engine.ts:147](src/lib/core/engine/loop-engine.ts#L147); passesThreshold is advisory at 80), but `grade.passesThreshold` reads false for a presented 75–79 artifact, which could mislead the CR-11 Gate-B UI author. _Drive the Gate-B UI from terminationReason/bestScore, not passesThreshold; due before CR-11._
4. **No gateway-level text-routing integration test.** Text routing is asserted only at the provider unit level; [mms-integration.test.ts:132](tests/unit/mms-integration.test.ts#L132) covers only the image route. A verification action, not an enumerated deliverable. _Add before CR-7._

### ⚪ Nits

- Action-plan still names `gemini-1.5-*` ([v1-action-plan.md:554](docs/04-plans/v1-action-plan.md#L554)) while code uses `gemini-2.5-*`; the decisions log supersedes it (verified via a live ListModels probe), so harmless — optionally align the plan.
- The judge receives a `personaContext` block ([gemini-text-judge.ts:179](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L179)) beyond rubric + artifact — a reasonable in-spirit extension to grade personaFit/audienceFit, a minor literal deviation from cross-critique-pattern.md Rule 10 not noted in the log. Cross-context isolation intact.
- `modelFamily()` classifies by id substring with a raw-id fallthrough ([single-producer-stage.ts:208](src/lib/domain/workflows/creator/single-producer-stage.ts#L208)); back it with the MMS catalog providerId when centralized in Core (CR-6).

## Needs human input

- The CR-5 live-run quality (LinkedIn 91.3→92.6, article →94.6, 9+ across dimensions, ~$0.11) and the publishable-without-rewrite judgment are human-judged (acceptance criteria 2 and 3). The decisions log notes the judge under-uses the lower scoring bands; confirm the high scores reflect genuine quality, not leniency, before relying on the 75 threshold as a real quality gate.
- Confirm the PRESERVE/IMPROVE boundary intent: should 7–7.75 dimensions be left alone or deliberately polished toward 8? The code currently polishes them.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Resolve cost-ledger / `getTotal` inconsistency (route producers + OpenAI judges through the gateway, OR aggregate stage totals in the CR-12 helper); pin the choice in the log | CR-12 | [src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts:219](src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts#L219); assertion at [docs/04-plans/v1-action-plan.md:943](docs/04-plans/v1-action-plan.md#L943) |
| Bound the Gemini judge output budget (`maxOutputTokens`) and/or surface `finishReason==='MAX_TOKENS'` distinctly | CR-7 | [src/lib/domain/workflows/creator/agents/gemini-text-judge.ts:185](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L185); [src/lib/core/models/providers/google-gemini.ts:390](src/lib/core/models/providers/google-gemini.ts#L390) |
| Centralize the model-family overlap guard in Core; back classification with catalog providerId | CR-6 | [src/lib/domain/workflows/creator/single-producer-stage.ts:203](src/lib/domain/workflows/creator/single-producer-stage.ts#L203) |
| When ramping the stage bar to 80, update `SINGLE_PRODUCER_THRESHOLD` (not the rubric); add a pointer comment near `passThreshold` | CR-7 | [src/lib/domain/workflows/creator/single-producer-stage.ts:58](src/lib/domain/workflows/creator/single-producer-stage.ts#L58) |
| Add a text-scoring gateway-route integration assertion for a gemini-2.5-* modelId | CR-7 | [tests/unit/mms-integration.test.ts:132](tests/unit/mms-integration.test.ts#L132) |
| Align action-plan CR-5 model names to gemini-2.5-* | CR-6 | [docs/04-plans/v1-action-plan.md:554](docs/04-plans/v1-action-plan.md#L554) |

## Bottom line

Signed off with follow-ups. CR-5 is complete, in scope, and clears every deterministic gate; the user is clear to proceed to **CR-6** (cross-critique types + runtime, pure Core, unblocked). The one major — the producer cost-ledger bypass — must be resolved before **CR-12** so the acceptance budget assertion measures the full run; the remaining items are minors/nits tracked above.
