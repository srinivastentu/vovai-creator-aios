# CR-12 Sign-off Review — V1 Acceptance Test (v1.0)

| | |
|---|---|
| **Step** | CR-12 — V1 acceptance test + decisions log + tag v1.0 |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `e840c41` |
| **Tag** | `CR-12-acceptance` (+ `v1.0`) |
| **Reviewed at** | 2026-06-01 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-12 — the final V1 step, tagged `v1.0` at HEAD `e840c41` — is properly done. The acceptance harness runs the canonical BuildOS / Agentic-AI scenario end-to-end with real models against the **real production path** (it reuses the same stage factories and persistence helpers the CLI uses), auto-approves both gates, and asserts all five mechanized acceptance criteria — including DB-persisted section→sourceRef traceability and idea-completion via the same `bothArtifactTypesApproved` helper the production Gate B server action calls. All five lenses returned PASS / pass-with-nits with no blockers and no majors; I independently re-derived every deterministic gate (typecheck exit 0; 702 passed / 3 skipped across 53 files; prisma valid + no drift; import-discipline grep empty) and confirmed every load-bearing claim. The only points of tension — cost asserted on the per-stage sum rather than the spec's literal `CostLedger.getTotal`, and cosine ≤ 0.92 treated as a warning rather than a hard gate — are both correctly reconciled in favor of the higher-precedence authoritative sources (decisions log > action plan), and the cost deviation makes the check *stricter*, not weaker. The verdict carries follow-ups (not a clean sign-off) because a few minors are worth tracking: the headline judge-retry reliability fix and the `thinkingBudget` threading have no direct unit test, the open CR-9 CI-provisioning item is unconfirmed, and this sign-off report must still be committed to complete the series. None of these invalidate v1.0.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0 — 53 files, 702 passed / 3 skipped |
| `npm run build` | not re-run (trusted from session; no app-route changes in CR-12) |
| Import discipline (`core` → `domain`) | empty (PASS) |
| `prisma validate` / `migrate status` | valid; database schema up to date (no CR-12 migration — correct) |
| Tags on HEAD | `CR-12-acceptance` + `v1.0` both point at `e840c41`; commit carries Co-Authored-By trailer |
| Acceptance test discovery | `tests/e2e/v1-acceptance.test.ts` runs via dedicated `vitest.e2e.config.ts`, excluded from the main suite, skips cleanly without DB + model keys |

## What's correct (strengths)

- **The harness tests the real production path, not a reimplementation.** [tests/e2e/helpers/pipeline-runner.ts:25](tests/e2e/helpers/pipeline-runner.ts#L25) reuses `createResearchStage`/`createMasterStage`/`create{LinkedIn,Article}CrossCritiqueStage` and `buildMasterPersistence`/`buildArtifactPersistence`/`buildRepurposeContext`/`bothArtifactTypesApproved`; idea-completion runs through the same `bothArtifactTypesApproved` that drives the production Gate B action ([pipeline-runner.ts:395](tests/e2e/helpers/pipeline-runner.ts#L395)).
- **All five mechanized criteria are concretely asserted, traceability against persisted DB rows.** `everySectionHasSource` derives from `persistedMaster.sections[].sourceRefs.length` ([pipeline-runner.ts:283](tests/e2e/helpers/pipeline-runner.ts#L283),[:423](tests/e2e/helpers/pipeline-runner.ts#L423)); assertions at [v1-acceptance.test.ts:106](tests/e2e/v1-acceptance.test.ts#L106).
- **Cost Option B is the stricter, accurate total** — sums the four per-stage `totalCostUSD` (each its own engine-accumulated `cumulativeCostUSD`, no double-count) rather than the undercounting ledger, discharging the recurring CR-5/CR-7 cost-ledger MAJOR ([pipeline-runner.ts:404](tests/e2e/helpers/pipeline-runner.ts#L404); decisions log [:1356](docs/03-decisions/creator-decisions-log.md#L1356)).
- **Reliability fixes are root-cause, not gate-relaxation.** The synthesizer raises the prompt TARGET to 1,200–1,600 words while the spec validator floor `MIN_WORDS=800` stays untouched ([long-form-synthesizer.ts diff](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts)); the Core health-monitor time-based circuit-breaker recovery fixes a latent batch-run cascade deadlock and is zero-domain-word machinery ([health-monitor.ts:43](src/lib/core/models/health-monitor.ts#L43)); the gemini `thinkingBudget` param + MAX_TOKENS diagnostic is generic and flows through the gateway index signature with `typeof` narrowing ([google-gemini.ts:346](src/lib/core/models/providers/google-gemini.ts#L346)). Import-discipline grep stays empty.
- **Pattern-5 invariants survive the `gemini-2.5-pro` → `gemini-2.5-flash` judge swap.** The cross-critique config tests were *updated* to assert `assertCrossCritiqueModels(...).not.toThrow()` with flash (Rule 10 holds); Rules 11 + 12 unchanged; the CR-5 default is superseded with a proper `Supersedes` link ([gemini-text-judge.ts:39](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L39); decisions log [:1442](docs/03-decisions/creator-decisions-log.md#L1442)).
- **Discharged carry-forwards are real.** Cosine unit tests are thorough ([tests/unit/scripts/embedding-similarity.test.ts:13](tests/unit/scripts/embedding-similarity.test.ts#L13)); judge output budget raised to 16384 + thinkingBudget 4096; Gate-B null-bestArtifact throws; `producersSucceeded` present. The BuildOS persona was extracted byte-identically to a shared fixture so the test grades voice against the exact seeded persona ([prisma/fixtures/buildos.ts:20](prisma/fixtures/buildos.ts#L20); [prisma/seed.ts:18](prisma/seed.ts#L18)).
- **Milestone cadence is correct.** The 153-line CR-12 decisions section landed in the implementation commit (improving on the CR-9/10/11 two-commit cadence); run outputs write to `tests/e2e/output/acceptance-run-<timestamp>/` and are gitignored.

## Findings

### 🔴 Blockers

None.

### 🟠 Majors

None.

### 🟡 Minors (track as follow-ups)

1. **Judge transient-retry path is untested.** `JUDGE_MAX_RETRIES=3` + a backoff loop gated on `TRANSIENT_ERROR` ([gemini-text-judge.ts:73](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L73)) exist, but the only failure test uses error `'provider down'` ([judge-grading.test.ts:164](tests/unit/domain/judge-grading.test.ts#L164)) — which does NOT match the regex, exercising only the fail-fast path. The retry-then-succeed and exhaustion paths are unverified. _Track for V2._
2. **`thinkingBudget` threading + MAX_TOKENS diagnostic untested.** [google-gemini.ts:346](src/lib/core/models/providers/google-gemini.ts#L346),[:397](src/lib/core/models/providers/google-gemini.ts#L397) — no test asserts the request body carries `thinkingConfig.thinkingBudget` or that the new diagnostic surfaces. _Track for V2._
3. **Cosine criterion 4 unmet for the article (~0.98 vs 0.92), waived as a warning.** Correctly reconciled via the higher-precedence mechanization (decisions log [:74](docs/03-decisions/creator-decisions-log.md#L74); `cross-critique-pattern.md`) over the action plan's "must all hold"; the differentiator is demonstrably real on the LinkedIn artifact. Article iteration-divergence tuning is a V2 item ([v1-acceptance.test.ts:123](tests/e2e/v1-acceptance.test.ts#L123)).
4. **No `docs/sign-off-review/CR-12-sign-off.md` yet.** This audit is that sign-off; writing this report verbatim completes the CR-1..CR-12 series.
5. **CR-9 `[due before CR-12] CI must provision DATABASE_URL` unconfirmed.** DB-gated integration suites skip cleanly without the env ([v1-acceptance.test.ts:48](tests/e2e/v1-acceptance.test.ts#L48)); nothing forces them to run in CI, so they could pass vacuously. Record/accept the risk or wire provisioning.

### ⚪ Nits

- **Stale `gemini-2.5-pro` comments** after the flash swap — JSDoc on `JUDGE_MAX_OUTPUT_TOKENS`/`JUDGE_THINKING_BUDGET`/`JUDGE_MAX_RETRIES` ([gemini-text-judge.ts:42](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L42)) and `judgeModelId` "Default gemini-2.5-pro" in `cross-critique-stage.ts`. Functionally harmless; sweep to flash.
- **Untracked `scripts/demo-gate-b.ts`** (a CR-11 demo, never committed) lingers in the tree. Commit as a documented dev tool or gitignore.
- **No explicit architect-reviewer evidence** recorded for this code-bearing step; this report is the durable review record.
- **Acceptance-run DB accumulation** — `runFullPipeline` never cleans prior runs; assertions are master-scoped so correctness is unaffected. Optional `afterAll` cleanup.

## Needs human input

- **Criteria 2 & 3 are human-judged:** are the live-run LinkedIn post (91.3) and article (94) publishable without rewrite? Read `tests/e2e/output/acceptance-run-<timestamp>/` (`linkedin_post.txt` + `long_form_article.md`) and confirm before declaring V1 done.
- **Confirm CI provisioning** for the DB-gated integration suites (or accept the vacuous-skip risk).
- **Decide the fate of** `scripts/demo-gate-b.ts` (commit / gitignore / delete).

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Test the judge transient-retry path (retry-then-succeed + exhaustion→synthetic 40) | V2 | [tests/unit/domain/judge-grading.test.ts:164](tests/unit/domain/judge-grading.test.ts#L164) |
| Assert `thinkingConfig.thinkingBudget` is forwarded + MAX_TOKENS diagnostic surfaces | V2 | [tests/unit/mms-google-gemini-client.test.ts:468](tests/unit/mms-google-gemini-client.test.ts#L468) |
| Sweep stale `gemini-2.5-pro` comments to flash | V2 | [src/lib/domain/workflows/creator/agents/gemini-text-judge.ts:42](src/lib/domain/workflows/creator/agents/gemini-text-judge.ts#L42) |
| Route Stages 2/3 through the MMS gateway so `CostLedger.getTotal` becomes the single source of truth (Option A) | V2 | [tests/e2e/helpers/pipeline-runner.ts:404](tests/e2e/helpers/pipeline-runner.ts#L404) |
| Resolve untracked scratch file (commit or gitignore) | V2 | [scripts/demo-gate-b.ts:1](scripts/demo-gate-b.ts#L1) |
| Close CR-9 CI DATABASE_URL provisioning (or accept risk in log) | V2 | [tests/e2e/v1-acceptance.test.ts:48](tests/e2e/v1-acceptance.test.ts#L48) |
| Track article iteration-divergence tuning so the differentiator holds on both types | V2 | [tests/e2e/v1-acceptance.test.ts:123](tests/e2e/v1-acceptance.test.ts#L123) |

## Bottom line

**Signed off.** CR-12 is complete and v1.0 is properly earned: the acceptance test mechanizes every measurable criterion against the real pipeline, the live run passed under budget ($1.67, 17.3 min), the reliability fixes are clean and Core-portable, and the two spec deviations are correctly reconciled via the binding decisions log. The follow-ups are minor test-adequacy and hygiene items for V2 — none block the V1 milestone. The remaining gate is **human-judged publishability of the two artifacts**; once that is confirmed, V1 is done. Commit this report as `docs/sign-off-review/CR-12-sign-off.md` to complete the audit trail.