# CR-3 Sign-off Review — Long-Form Master synthesizer

| | |
|---|---|
| **Step** | CR-3 — Long-Form Master synthesizer |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `bbc5222` |
| **Tag** | `CR-3-long-form-master` |
| **Reviewed at** | 2026-05-31 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-3 is genuinely and completely done. Every deliverable in the CR-3 "Build" list exists and behaves as specified, and I re-derived every deterministic gate read-only with clean results. Stage 3 reuses the Standard loop pattern by **injecting** Core machinery — it changed **zero** files under `src/lib/core/` — which is the cleanest possible outcome for a new production stage. All five lenses converge on PASS or pass-with-nits with no substantive disagreement; the only adjudication needed was confirming that the SPEC lens's "use PassthroughCurator" deviation is a correct, decisions-log-pinned deferral to CR-8 (Core's context system does not exist yet), not a scope miss. The findings reduce to five minors and several nits — all genuinely fine-for-V1 — so the verdict is **SIGN-OFF WITH FOLLOW-UPS**: the minors are tracked against their downstream CR steps but none invalidates CR-3 or blocks CR-4.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0 — 478 passed / 3 skipped (481 total; matches commit claim) |
| `npm run build` | exit 0 (per orchestrator-run gate; not re-run) |
| Import discipline (`core` → `domain`) | empty, exit 1 (PASS) — `git show bbc5222 --stat -- src/lib/core/` empty (no Core file touched) |
| `prisma validate` / `migrate status` | valid; DB up to date; `@@unique([longFormMasterId, url])` intact ([prisma/schema.prisma:189](prisma/schema.prisma#L189)) |
| Live CLI artifact | [tmp/runs/cross-critique-idea/long-form-master.md](tmp/runs/cross-critique-idea/long-form-master.md) — 6 sections, 1328 words, 6 source-cited sections at `gate_a_pending` |

## What's correct (strengths)

- **Zero Core files changed** — Stage 3 reuses the Standard loop by injecting `createInitialState`/`runLoop` with an `AgentExecutor` + `JudgeFunction` matching the Core contracts ([long-form-master-stage.ts:90](src/lib/domain/workflows/creator/long-form-master-stage.ts#L90)). Import-discipline grep empty.
- **Rubric matches `rubrics.md` row-for-row**: 5 dims all weight 0.20 (sum 1.0), pass bars 8/8/7/8/7, composite threshold 80 ([long-form-master-rubric.ts:20](src/lib/domain/workflows/creator/rubrics/long-form-master-rubric.ts#L20)).
- **Cross-model judge (loop rule 7)** is genuine: producer `claude-sonnet-4-20250514` ([long-form-synthesizer.ts:50](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts#L50)), judge `gpt-4o` ([long-form-master-judge.ts:37](src/lib/domain/workflows/creator/agents/long-form-master-judge.ts#L37)). Reasoning-before-scoring; composite computed BY CODE; per-dimension `passesThreshold` surfaced for Gate A while the loop terminates on the composite ([loop-engine.ts:147](src/lib/core/engine/loop-engine.ts#L147)) — exactly the CR-2 advisory-threshold decision, explicitly extended to Stage 3.
- **Producers never see the rubric** (rubrics.md Rule 5): synthesizer imports no rubric; revise feedback derived from `grade.dimensionScores` via PRESERVE(≥8)/IMPROVE(<8) ([long-form-synthesizer.ts:217](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts#L217)).
- **All five validator checks run before the judge** (loop rule 6): ≥3 sections, heading+content, ≥1 SourceRef per section, every ref resolves to a dossier source, ≥800 words ([long-form-master-validator.ts:30](src/lib/domain/workflows/creator/validators/long-form-master-validator.ts#L30)).
- **Plan-vs-impl gaps resolved through the decisions log, not silently**: the omitted Stage-3 judge was added mirroring the CR-2 Research-Judge precedent; the context-curation seam is a documented `TODO(CR-8)`.
- **Architect-reviewer (Step 7) ran**: the `syntheticFailingGrade` fallback was aligned to the happy-path composite formula, verified at [long-form-master-judge.ts:173](src/lib/domain/workflows/creator/agents/long-form-master-judge.ts#L173).
- **Forward-readiness for CR-4 confirmed**: master persisted at `gate_a_pending` with SourceRef rows; CR-4 reads by `--longFormMasterId` with no approved-status precondition.

## Findings

### 🔴 Blockers
None.

### 🟠 Majors
None.

### 🟡 Minors (track as follow-ups)
1. **Non-atomic re-run persistence** — `deleteMany()` then `update(...nested create)` as two statements with no `db.$transaction` ([scripts/pipeline-master.ts:180](scripts/pipeline-master.ts#L180)). A failure after the delete leaves sections gone but status unchanged. Low impact for a dev CLI; Gate A re-persist flows make it matter. _Fix before CR-10._
2. **Misleading iteration log after a post-success validation failure** — `latest = state.iterations[last]` reports the prior score with `validationFailed:false`, because Core increments `loopCount` without pushing a record on validator failure ([long-form-master-stage.ts:212](src/lib/domain/workflows/creator/long-form-master-stage.ts#L212), [loop-engine.ts:100](src/lib/core/engine/loop-engine.ts#L100)). Cosmetic CLI only. _Fix before CR-7._
3. **Incomplete executor context guard** — asserts `longFormMasterId`/`ideaTitle`/`sources` but not `persona`/`niches`, which the prompt builders dereference ([long-form-master-stage.ts:96](src/lib/domain/workflows/creator/long-form-master-stage.ts#L96)). Not reachable via CLI today; defense-in-depth. _Fix before CR-7._
4. **No regression test for the corrected `syntheticFailingGrade` fallback** ([long-form-master-judge.ts:161](src/lib/domain/workflows/creator/agents/long-form-master-judge.ts#L161)). Happy-path composite is covered; the fallback branch is not. _Fix before CR-5._
5. **lessons.md wording drift** — "rubric validator run at import time" ([tasks/lessons.md:99](tasks/lessons.md#L99)) is stricter than the established convention (defined + test-invoked). CR-3 faithfully follows the CR-2 precedent; reconcile wording or add an import-time assertion. _Fix before CR-5._

### ⚪ Nits
- Citation handle resolution trims but does not case-normalize ([long-form-synthesizer.ts:312](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts#L312)); a lowercase `s1` would be silently dropped. Normalize with `.trim().toUpperCase()`.
- `MASTER_CONTEXT_PRIORITIES` lives in the agent file as a `TODO(CR-8)` seam ([long-form-synthesizer.ts:53](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts#L53)); CR-8 must lift it into Core's PassthroughCurator or it orphans.
- Commit's "481 total" mixes the 288-unit suite with the archived tests; qualify future counts.
- Commit body ~10 lines vs. the 2-4 line guideline; cosmetic.
- Live-artifact word count (1328) differs from the commit's "1213" (re-rendered run); not material.

## Needs human input

- Acceptance criteria 2/3 (LinkedIn post + article publishable without rewrite) are human-judged and not exercised by CR-3. The `personaAlignment` dimension graded here depends on `voiceTone.signaturePhrases` + `doNotSay`, which the CR-2 decision left tunable until the voice-refinement window closes at **CR-4**. Confirm those fields are finalized before the CR-4 sign-off.
- Whether the architect-review rounding fix and the persona content were genuinely human-reviewed (vs. agent-only) cannot be verified from the repo; the decisions log asserts both. No blocker.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Wrap delete + update in `db.$transaction([...])` for all-or-nothing re-persist | CR-10 | [scripts/pipeline-master.ts:180](scripts/pipeline-master.ts#L180) |
| Detect stalled iteration (loopCount advanced, iterations did not) and emit `validationFailed:true` | CR-7 | [src/lib/domain/workflows/creator/long-form-master-stage.ts:212](src/lib/domain/workflows/creator/long-form-master-stage.ts#L212) |
| Extend context guard to assert `persona` object + `Array.isArray(niches)` | CR-7 | [src/lib/domain/workflows/creator/long-form-master-stage.ts:96](src/lib/domain/workflows/creator/long-form-master-stage.ts#L96) |
| Add unparseable-judge-response test asserting `overallScore===40`, `passesThreshold===false` | CR-5 | [tests/unit/domain/long-form-master.test.ts](tests/unit/domain/long-form-master.test.ts) |
| Reconcile lessons.md "run at import time" wording with the validate-via-test convention | CR-5 | [tasks/lessons.md:99](tasks/lessons.md#L99) |
| Lift `MASTER_CONTEXT_PRIORITIES` into Core PassthroughCurator; re-point Stage 3 | CR-8 | [src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts:53](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts#L53) |
| Normalize citation handles with `.trim().toUpperCase()` before lookup | CR-7 | [src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts:312](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts#L312) |

## Bottom line

Signed off with follow-ups. CR-3 is properly done — every deliverable present, all gates green, zero Core touched, rubric and cross-model judge exactly per the authoritative docs, and a real source-traced master persisted at `gate_a_pending`. The five minors and the nits are tracked against CR-5/CR-7/CR-8/CR-10; none blocks progression. **The user is clear to proceed to CR-4 (single-model producers).**