# CR-4 Sign-off Review — Single-model producers (LinkedIn post + long-form article)

| | |
|---|---|
| **Step** | CR-4 — Single-model producers (LinkedIn post + long-form article) |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `e69b83f` |
| **Tag** | `CR-4-single-producers` |
| **Reviewed at** | 2026-05-31 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-4 is properly done. Every action-plan **Build** deliverable exists and behaves to spec: two rubric-blind Claude producers following the Forge persona template, two deterministic validators matching `docs/02-domain/rubrics.md` exactly, two Standard stage configs (min=1 / max=2 / threshold=70), the `pipeline:produce` CLI persisting `Artifact` rows, and 19 passing unit tests. The architecturally central design claim — the deterministic validator is CR-4's only real quality gate while the structural pass-judge is a no-op the loop only reaches after validation passes — holds against the actual Core engine. The single highest-stakes doc-precedence conflict (the action plan's hyphenated `derivedVia='cross-critique'` vs the binding underscored Prisma enum) was resolved correctly toward the higher-precedence reconciliation decision. All five lenses returned pass / pass-with-nits with **no blocker or major**; my independent re-derivation of every deterministic gate and every load-bearing claim corroborates them. The verdict is SIGN-OFF WITH FOLLOW-UPS — the step is complete and does not block CR-5; the residual minors/nits are tracked against their due steps. There was no inter-lens disagreement to adjudicate beyond severity wording, which I normalized (all DB-write-path / persona-doc / failure-terminal items are minor; provenance-label, token-cap, dead-config, telemetry items are nits).

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0 — 497 passed / 3 skipped (500), 36 files |
| CR-4 test file (`single-producers.test.ts`) | 19 passed / 19 |
| Import discipline (`core` → `domain`) | empty (PASS) — `grep -rE "from ['\"][^'\"]*domain/" src/lib/core/` exit 1 |
| `prisma validate` / `migrate status` | valid; "Database schema is up to date!" |
| Live-run artifacts on disk | `linkedin_post.md` = 1567 chars (in [1300,3000]); `long_form_article.md` = 1235 words / 5 H2 / final `## The Takeaway` (matches CONCLUSION_RE) |
| Git hygiene | one commit `e69b83f` with `Refs:` + Co-Authored-By trailer; `CR-4-single-producers` points at it; working tree clean |

## What's correct (strengths)

- **Validator-before-judge architecture is sound and load-bearing.** [loop-engine.ts:96](src/lib/core/engine/loop-engine.ts#L96)-106 runs `stage.validator` BEFORE `evaluate()` and short-circuits to `'revising'` on failure, so CR-4's deterministic validator is the only real quality gate and the structural pass-judge ([single-producer-stage.ts:91](src/lib/domain/workflows/creator/single-producer-stage.ts#L91)-112) is a no-op the loop only reaches after validation passes. Composite math (8 × 1.0 × 10 = 80 ≥ threshold 70) reuses the same `calculateWeightedScore`/`checkThresholds` the real judges will use.
- **Validators match `rubrics.md` EXACTLY**, including the "first 3 lines exist" hook check the action-plan Build list omitted: LinkedIn charCount [1300,3000] + ≥2 paragraph breaks + ≥3 hook lines ([linkedin-post-validator.ts:14](src/lib/domain/workflows/creator/validators/linkedin-post-validator.ts#L14)), article wordCount [1200,3000] + ≥2 H2 + explicit intro + conclusion-regex ([article-validator.ts:16](src/lib/domain/workflows/creator/validators/article-validator.ts#L16)). Confirmed against [rubrics.md:177](docs/02-domain/rubrics.md#L177)-178.
- **Doc-precedence applied correctly on the highest-stakes conflict.** Code uses the binding underscored enum `'cross_critique'` ([single-producer-stage.ts:335](src/lib/domain/workflows/creator/single-producer-stage.ts#L335),353; [schema.prisma:52](prisma/schema.prisma#L52)) over the action plan's stale hyphenated prose — decisions log > action plan, honored.
- **Producers are rubric-blind** per rubrics.md Rule 5 / Pattern-5 Rule 11; the only rubric mentions are explicit "You do NOT see a rubric" disclaimers ([linkedin/producer-claude.ts:42](src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts#L42),75). char/word counts are recomputed in code, never trusting the LLM ([linkedin:148](src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts#L148)).
- **No divergence from the approved persona baseline.** Both producers consume `signaturePhrases` + `doNotSay` unchanged ([linkedin:99](src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts#L99)-100, [article:103](src/lib/domain/workflows/creator/agents/article/producer-claude.ts#L103)-104).
- **Clean architecture + protocol hygiene.** 11 changed files all under `src/lib/domain/` (zero Core touched); all deps injected and overridable for fully-mocked tests; Stage 5 modeled as sibling stages per pipeline-v1.md; the architect-reviewer demonstrably ran (decisions log: min=1 "Resolves the CR-4 architect-review warning"); a 72-line CR-4 decisions block landed in the same commit, each decision verifiable in code.

## Findings

### 🔴 Blockers
None.

### 🟠 Majors
None.

### 🟡 Minors (track as follow-ups)
1. **DB-write path untested** — the "successful iteration creates Artifact row" case is covered by the pure mapping test plus the live run, but the `db.artifact.create` call is hand-mapped field-by-field and has no automated test, so a future field-mapping drift would not be caught ([pipeline-produce.ts:168](scripts/pipeline-produce.ts#L168)). _Fix before CR-5._
2. **Validator-failure path does not count toward maxIterations** — [loop-engine.ts:100](src/lib/core/engine/loop-engine.ts#L100)-105 returns `'revising'` without consulting `atMaxIterations`, so a never-valid producer terminates only at the domain hardCap `maxIterations*2+4 = 8` ([single-producer-stage.ts:285](src/lib/domain/workflows/creator/single-producer-stage.ts#L285)). Bounded, cost-tracked, pre-existing in CR-2/CR-3. _Fix before CR-7._
3. **Persona voice-refinement window not closed in doc** — CR-4 consumed `signaturePhrases` + `doNotSay` unchanged, but [buildos-persona.md:142](docs/02-domain/buildos-persona.md#L142)-143 still reads "tunable until CR-4"; the doc was last touched in CR-2 (098fe26). No actual divergence — pure doc-tense gap. _Fix before CR-5._
4. **Failure-terminal paths untested** — producer-throws-on-first-iteration ([single-producer-stage.ts:297](src/lib/domain/workflows/creator/single-producer-stage.ts#L297)), validator-always-fails (bestArtifact null), and the default max=2 + one-failure boundary have no test ([single-producers.test.ts:209](tests/unit/domain/single-producers.test.ts#L209)). _Fix before CR-5._

### ⚪ Nits
- `derivedVia='cross_critique'` on single-producer artifacts is a forward-compat over-claim, explicitly sanctioned by the action plan + decisions log; no V1 logic distinguishes provenance via this field, so no current exposure ([single-producer-stage.ts:335](src/lib/domain/workflows/creator/single-producer-stage.ts#L335)).
- Article producer caps at `max_tokens=8192` ([article/producer-claude.ts:33](src/lib/domain/workflows/creator/agents/article/producer-claude.ts#L33)); a long article in JSON can truncate → parse fails → graceful re-produce, costing an extra call. Consider raising or fenced-markdown output in CR-7.
- `maxRetries`/`timeoutMs` on the AgentConfigs are inert in CR-4 (the SDK call uses no abort signal) ([single-producer-stage.ts:116](src/lib/domain/workflows/creator/single-producer-stage.ts#L116)-134). Wire or drop.
- CLI iteration telemetry reports `version=state.loopCount`, which the engine bumps on validator failures too ([single-producer-stage.ts:305](src/lib/domain/workflows/creator/single-producer-stage.ts#L305)). Cosmetic.
- Core `IterationRecord` hard-codes cost=0 ([loop-engine.ts:119](src/lib/core/engine/loop-engine.ts#L119)) while real cost is tracked out-of-band; CR-11's history panel must read the out-of-band figure.

## Needs human input

- **Acceptance-test criteria 2 & 3 (publishable without rewrite) are human-judged.** The live-run artifacts (`tmp/runs/cross-critique-idea/linkedin_post.md`, `long_form_article.md`) satisfy the mechanical validators, but editorial publishability is Srinivas's call. CR-4 is single-producer (no judge, no cross-critique); the final V1 voice/quality bar is set by CR-5 + CR-7, so a modest read here is expected and not a CR-4 defect.
- **Confirm the BuildOS persona `signaturePhrases` + `doNotSay` are FINAL as of CR-4.** The code consumed them unchanged; if any wording is still to be tuned, do it now and re-run `db:seed` before CR-5 producers iterate against them.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Add a DB-mocked test asserting `db.artifact.create` payload equals `buildArtifactPersistence` output | CR-5 | [scripts/pipeline-produce.ts:168](scripts/pipeline-produce.ts#L168) |
| Close the persona voice-refinement window in the doc (banner + checklist → "CLOSED at CR-4") | CR-5 | [docs/02-domain/buildos-persona.md:142](docs/02-domain/buildos-persona.md#L142) |
| Add failure-terminal tests for `runProducerLoop` (throw / never-valid / default max=2 + one failure) | CR-5 | [tests/unit/domain/single-producers.test.ts:209](tests/unit/domain/single-producers.test.ts#L209) |
| Count validator failures toward maxIterations (or document the hardCap fail-safe) | CR-7 | [src/lib/core/engine/loop-engine.ts:100](src/lib/core/engine/loop-engine.ts#L100) |
| Route per-iteration cost into `IterationRecord` (or document the loop-driver total as authoritative) | CR-11 | [src/lib/core/engine/loop-engine.ts:119](src/lib/core/engine/loop-engine.ts#L119) |

## Bottom line

Signed off with follow-ups. CR-4 is genuinely complete: all deterministic gates pass (typecheck 0, 497/3-skip, import-discipline clean, prisma valid, live artifacts on disk satisfying both validators), every Build deliverable is present and to spec, and no blocker or major exists. You are clear to proceed to **CR-5 (MMS Gemini + judge + rubrics)**. Carry the five tracked follow-ups into their due steps — the three CR-5 items (DB-write test, persona doc close-out, failure-terminal tests) are quick and best done alongside the judge wiring.