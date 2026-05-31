# CR-6 Sign-off Review — Cross-Critique types + runtime

| | |
|---|---|
| **Step** | CR-6 — Cross-Critique types + runtime (Core Loop Engine extension) |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `afa70fc` |
| **Tag** | `CR-6-cross-critique-runtime` |
| **Reviewed at** | 2026-05-31 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-6 is a clean, complete, **Core-only** Loop Engine extension that adds Pattern 5 (Cross-Critique) as types + runtime with no domain wiring — exactly the action-plan scope. All six Pattern-5 rules are implemented and adversarially tested, every deterministic gate passes on re-derivation, and the one genuine doc-vs-doc tension (Rule 10's literal "Producer ≠ Integrator ≠ Judge" vs the canonical V1 config that reuses Claude as both Producer A and the Integrator) was resolved correctly in favor of the higher-precedence full-spec doc, with an explicit comment and a dedicated test. There are **no blockers and no correctness defects**. The one disagreement between lenses — the Decisions lens rated the half-discharged "[due before CR-6]" model-family-guard follow-up as **major**, the other four rated it **minor** — is adjudicated in favor of major *as a traceability obligation*: an unmet "due before CR-6" item with no recorded re-deferral will mislead a future reader. It does **not** invalidate the step (the deferral of the domain-caller migration is a defensible precedence call given CR-6's "zero domain imports" scope) and does **not** break CR-7. Hence **SIGN-OFF WITH FOLLOW-UPS**.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 (`tsc --noEmit`, no output) |
| `npm run test` | exit 0 — 544 passed / 3 skipped (38 files); cross-critique file 21/21 |
| `npm run build` | exit 0 |
| Import discipline (`core` → `domain`) | empty (PASS) — `grep -rEn "from ['\"][^'\"]*domain/" src/lib/core/` returns nothing (exit 1) |
| `prisma validate` | valid (CR-6 touches no schema, as expected) |
| Forward-readiness (CR-7 exports) | all symbols exported from [src/lib/core/engine/index.ts:16](src/lib/core/engine/index.ts#L16)-42 |

## What's correct (strengths)

- **Pure Core machinery, import discipline intact.** [cross-critique.ts:17](src/lib/core/engine/cross-critique.ts#L17)-31 imports only `../models/gateway`, `../models/types`, `./types` (Core→Core, identical to `tournament.ts`); `types.ts` stays import-free. The three domain-word occurrences are doc-comments stating what the engine does NOT know. Domain wiring is correctly left to CR-7.
- **All 6 Pattern-5 rules implemented and adversarially tested.** Rule 10 throws before any spend ([cross-critique.ts:204](src/lib/core/engine/cross-critique.ts#L204), proven by [cross-critique.test.ts:404](tests/unit/core/cross-critique.test.ts#L404)-416 asserting `requestMultiple`/`request` never called); Rule 11 producers get PRESERVE/IMPROVE only, rubric reaches only the judge ([cross-critique.ts:308](src/lib/core/engine/cross-critique.ts#L308)); Rule 12 hard cap terminates below minIterations ([cross-critique.ts:357](src/lib/core/engine/cross-critique.ts#L357)-364); Rule 6 validator before the costly judge ([cross-critique.ts:304](src/lib/core/engine/cross-critique.ts#L304)-311); Rule 9 graceful degradation; Rule 2 best-artifact (not last) tracking ([cross-critique.ts:344](src/lib/core/engine/cross-critique.ts#L344)-351, [cross-critique.test.ts:386](tests/unit/core/cross-critique.test.ts#L386)).
- **Doc-vs-doc tension resolved correctly via precedence.** Literal Rule 10 ([cross-critique-pattern.md:141](docs/01-architecture/cross-critique-pattern.md#L141)) would forbid the V1 config; the implementer honored the canonical full-spec shape (judge-disjointness only) with an explicit comment ([cross-critique.ts:62](src/lib/core/engine/cross-critique.ts#L62)-69) and a test ([cross-critique.test.ts:250](tests/unit/core/cross-critique.test.ts#L250)-257).
- **Composition over reimplementation** (binding 2026-05 decision): producers via `gateway.requestMultiple` ([cross-critique.ts:231](src/lib/core/engine/cross-critique.ts#L231)), critics via `Promise.all` of individual `gateway.request` (correct — distinct targets), only-new primitive is the sequential integrator ([cross-critique.ts:290](src/lib/core/engine/cross-critique.ts#L290)).
- **Exemplary tests:** 21 cases cover all 8 spec-named + 4 extras; assertions catch real regressions (spend-before-guard, last-vs-best, double-judge-cost).
- **Backward-compatible engine change.** `runLoop` gains an OPTIONAL 6th param with a clear throw if missing ([loop-engine.ts:88](src/lib/core/engine/loop-engine.ts#L88)-93); the required `LoopState.cumulativeCostUSD` field was absorbed via the three +1-line test-fixture edits (the synchronized-update pattern from the CR-0 lesson); `createInitialState` sets it to 0 ([loop-engine.ts:33](src/lib/core/engine/loop-engine.ts#L33)).
- **Strict-TS hygiene clean:** no `any`/`as any`/`| string`; `CrossCritiqueCallSpec.params` typed as `GatewayRequestParams` ([cross-critique.ts:131](src/lib/core/engine/cross-critique.ts#L131), architect W1); validator-before-judge addressed (architect W2).

## Findings

### 🔴 Blockers

None.

### 🟠 Majors

1. **Half-discharged "[due before CR-6]" model-family-guard follow-up, with the deferral unrecorded.** The CR-5 follow-up ([creator-decisions-log.md:592](docs/03-decisions/creator-decisions-log.md#L592)-598) had three clauses: (1) centralize the producer≠judge guard in Core, (2) back family classification with the MMS catalog `providerId` instead of substring matching, (3) remove the domain-local `assertCrossModel`/`modelFamily` duplication and have the Domain stage call the Core primitive. Only clause 1 landed ([cross-critique.ts:70](src/lib/core/engine/cross-critique.ts#L70),204). Clause 2 is still substring-matching ([cross-critique.ts:45](src/lib/core/engine/cross-critique.ts#L45)-60) and clause 3's domain copy persists ([single-producer-stage.ts:208](src/lib/domain/workflows/creator/single-producer-stage.ts#L208),221). The deferral to CR-7 is a **defensible precedence call** — the action plan scopes CR-6 as "ZERO domain imports / No Domain wiring yet", so migrating the domain caller cannot happen in CR-6 — but it was not recorded, leaving an unmet "due before CR-6" obligation with no trace. _This is a traceability gap, not a correctness defect; the step is functionally complete and CR-7 is fully unblocked._ _Fix before CR-7._

### 🟡 Minors (track as follow-ups)

1. **No `## CR-6 decisions` section** appended to the log, breaking the CR-2..CR-5 pattern ([creator-decisions-log.md](docs/03-decisions/creator-decisions-log.md)). Two interpretive decisions go untraced: the Rule-10 interpretation (so a future reader does not "fix" the guard to enforce literal three-way disjointness and break the V1 config) and the providerId/de-dup re-deferral. _Fix before CR-7._
2. **Rule-12 judge-cost hook defaults to 0.** ([cross-critique.ts:309](src/lib/core/engine/cross-critique.ts#L309)) `JudgeFunction` returns no cost, and the CR-5 Gemini judge surfaces cost via a separate `onCost` channel, so absent `options.getJudgeCostUsd` the dominant judge spend is invisible to the hard cap. CR-7 must wire it and add a test that a non-zero judge cost is counted before the budget check. _Fix before CR-7._
3. **Doc drift on `CrossCritiqueConfig` / `CrossCritiqueIterationRecord`.** The doc sketch ([cross-critique-pattern.md:76](docs/01-architecture/cross-critique-pattern.md#L76)-102) omits the necessary `critics: AgentConfig[]` field ([types.ts:124](src/lib/core/engine/types.ts#L124)) and declares `judgeGrade: GradeReport` where the implementation correctly uses `GradeReport | null` ([types.ts:149](src/lib/core/engine/types.ts#L149)) for rule-6/rule-9 degradation. Both are correct refinements; align the doc. _Fix before CR-7._
4. **`bestArtifact` may be null at `presenting`** if every iteration fails to grade ([cross-critique.ts:344](src/lib/core/engine/cross-critique.ts#L344)-366). Consistent with the standard loop (not a CR-6 regression), but the CR-11 Gate-B UI must render `terminationReason` gracefully rather than an empty artifact. _Fix before CR-11._
5. **Budget cap is per-iteration-boundary, not pre-call** ([cross-critique.ts:357](src/lib/core/engine/cross-critique.ts#L357)) — a single iteration can overshoot `maxBudgetUSD`. Fine for V1 (cap 2.00 vs ~$0.05-0.11/iteration observed in CR-5); track with TD-10 only if a future stage runs expensive models.

### ⚪ Nits

- CR-6 commit `afa70fc` omits the CLAUDE.md-mandated `Co-Authored-By` trailer all five prior CR commits carried. No history rewrite; add it to the follow-up commit and note in [tasks/lessons.md](tasks/lessons.md).
- Stale `TODO(CR-6)` at [single-producer-stage.ts:205](src/lib/domain/workflows/creator/single-producer-stage.ts#L205) — retarget to CR-7; Core now owns the canonical `classifyModelFamily` (strictly more complete).
- [cross-critique-pattern.md](docs/01-architecture/cross-critique-pattern.md) "Implementation references" calls `runCrossCritiqueIteration()` "internal", but it is a named export (correct — test-driven directly). Reword.
- `CrossCritiqueIterationRecord` sets `tokensIn:0`/`tokensOut:0` ([cross-critique.ts:322](src/lib/core/engine/cross-critique.ts#L322)) — same as the standard loop; true counts live in the CostLedger. Sum sub-call tokens later if the Gate-B panel ever shows them.

## Needs human input

- Confirm you accept the re-deferral of clause 2 ("back family classification with MMS catalog `providerId`") to CR-7. The substring-based `classifyModelFamily` classifies all V1 models (claude/gpt-4o/gemini) identically to a providerId resolver, so V1 correctness is unaffected; the catalog-backed resolver is an injectable seam ([cross-critique.ts:162](src/lib/core/engine/cross-critique.ts#L162)) CR-7 can wire. No repo evidence can confirm your intended step.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Append a `## CR-6 decisions` section recording the Rule-10 interpretation and the providerId/de-dup re-deferral | CR-7 | [creator-decisions-log.md:599](docs/03-decisions/creator-decisions-log.md#L599) |
| Replace domain `modelFamily`/`assertCrossModel` with the Core primitive; retarget the stale `TODO(CR-6)` | CR-7 | [single-producer-stage.ts:205](src/lib/domain/workflows/creator/single-producer-stage.ts#L205) |
| Wire `options.getJudgeCostUsd` from the gateway judge + add a non-zero-judge-cost budget test | CR-7 | [cross-critique.ts:309](src/lib/core/engine/cross-critique.ts#L309) |
| Add `critics` to the doc `CrossCritiqueConfig` snippet; change `judgeGrade` to `GradeReport \| null` | CR-7 | [cross-critique-pattern.md:76](docs/01-architecture/cross-critique-pattern.md#L76) |
| Render `terminationReason` gracefully when `bestArtifact` is null | CR-11 | Gate-B review page (created in CR-11) |
| Add `Co-Authored-By` trailer to the follow-up commit; note the omission | CR-7 | [tasks/lessons.md](tasks/lessons.md) |

## Bottom line

**Signed off with follow-ups.** CR-6 is truly done: the Core Cross-Critique runtime is correct, complete, and test-proven, all deterministic gates pass, and CR-7 is fully unblocked. Proceed to CR-7 (wire LinkedIn + article to cross-critique). Before CR-7 lands its first commit, append the `## CR-6 decisions` section, migrate the domain model-family guard to the Core primitive, and wire the judge-cost hook — these are the tracked obligations, none of which block progression.