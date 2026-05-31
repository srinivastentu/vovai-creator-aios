# CR-2 Sign-off Review — Research stage end-to-end

| | |
|---|---|
| **Step** | CR-2 — Research stage end-to-end (first visible output) |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `c52d79e` |
| **Tag** | `CR-2-research-stage` |
| **Reviewed at** | 2026-05-31 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-2 is **properly done** and I sign off with tracked follow-ups. Every deliverable the action-plan "Build" list enumerates exists at its specified path with the specified shape: a domain-agnostic Core web-search adapter, the Domain Research Agent + Source Curator + Research Judge, `RESEARCH_RUBRIC` (5 dims at 0.20 each, threshold 75), a deterministic ≥3-source/valid-URL validator running before the LLM judge, the `RESEARCH_STAGE` Standard loop, and a CLI that persists a draft `LongFormMaster` + `ResearchSource` rows and writes the dossier JSON. All five lenses returned pass / pass-with-nits; none found a blocker or a major. I independently re-derived the deterministic gates and verified every load-bearing finding against source. The one inter-lens nuance — the loop's termination decision ignoring the judge's per-dimension `passesThreshold` — was raised as a minor design-risk; I confirmed it is a **pre-existing Core convention** (`loop-engine.ts` was last modified in `6f15fd6` Phase 3.4 and is unchanged in CR-2), not a CR-2 regression, so it stays a tracked minor rather than a defect of this step. No issue invalidates CR-2 or breaks CR-3.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0 — 461 passed / 3 skipped (464 total); matches commit claim |
| `npm run build` | not re-run; typecheck + full test suite green (orchestrator-trusted) |
| Import discipline (`core` → `domain`) | empty (PASS) — grep exit 1 |
| `prisma validate` / `migrate status` | valid; "Database schema is up to date!" (no new migration — CR-1 already created the consumed tables) |
| Live run artifact on disk | [tmp/runs/cross-critique-idea/research-dossier.json](tmp/runs/cross-critique-idea/research-dossier.json): bestScore 88.5 (≥ 75), 8 sources, totalCostUSD $0.75 (< $1.00 ceiling), real `longFormMasterId` |

## What's correct (strengths)

- **Textbook Core/Domain split.** The one new Core file [src/lib/core/agentic/adapters/web-search-adapter.ts:20](src/lib/core/agentic/adapters/web-search-adapter.ts#L20) is genuinely domain-agnostic machinery with an injectable `WebSearchRunner` type and zero domain words/imports; all CreatorOS configuration lives in Domain. Import-discipline grep returns empty.
- **Exact spec fidelity.** `RESEARCH_RUBRIC` ([src/lib/domain/workflows/creator/rubrics/research-rubric.ts:18](src/lib/domain/workflows/creator/rubrics/research-rubric.ts#L18)) matches [docs/02-domain/rubrics.md:124](docs/02-domain/rubrics.md#L124) exactly — 5 dims each weight 0.20 / pass 7, threshold 75; `RESEARCH_STAGE` is `loopPattern: 'standard'`, threshold 75, min 2 / max 3 ([src/lib/domain/workflows/creator/research-stage.ts:31](src/lib/domain/workflows/creator/research-stage.ts#L31)); the validator enforces ≥3 sources + http(s) URLs ([src/lib/domain/workflows/creator/validators/research-validator.ts:7](src/lib/domain/workflows/creator/validators/research-validator.ts#L7)) and runs before the judge ([src/lib/core/engine/loop-engine.ts:97](src/lib/core/engine/loop-engine.ts#L97)).
- **Loop discipline upheld.** Core `runLoop` runs ONE iteration; the Domain driver sequences iterations; `AgentExecutor`/`JudgeFunction` are injected. A sub-threshold dossier can never reach disk (`bestArtifact` is set only after the validator passes at [src/lib/core/engine/loop-engine.ts:131](src/lib/core/engine/loop-engine.ts#L131)).
- **Cross-model judging + code-computed scoring.** The Stage-2 judge is GPT-4o ([src/lib/domain/workflows/creator/agents/research-judge.ts:30](src/lib/domain/workflows/creator/agents/research-judge.ts#L30)) — cross-family vs the Claude producer (loop rule 7) — reasoning-first, temperature 0, deterministically seeded, composite computed by Core `calculateWeightedScore` not the LLM ([src/lib/domain/workflows/creator/agents/research-judge.ts:258](src/lib/domain/workflows/creator/agents/research-judge.ts#L258)).
- **Honest, regression-grade tests.** All 4 spec-named cases exist plus a genuine guard proving an 84/100 composite with `completeness=6` yields `passesThreshold=false` ([tests/unit/domain/research-stage.test.ts:246](tests/unit/domain/research-stage.test.ts#L246)).
- **Transparent scope governance.** The only deviation from the plan's 2-agent list — the Research Judge — is a structural necessity and is explicitly logged with rationale in the same commit ([docs/03-decisions/creator-decisions-log.md](docs/03-decisions/creator-decisions-log.md)), including the verified-accurate claim that the legacy `createOpenAITextJudge` can't be reused ([src/lib/core/agentic/rubrics/text-rubric.ts:99](src/lib/core/agentic/rubrics/text-rubric.ts#L99) hard-requires a `structure_completeness` dimension).
- **Clean git hygiene.** One well-formed implementation commit with correct title, body, `Refs:`, and Co-Authored-By trailer; tag sits on HEAD.

## Findings

### 🔴 Blockers
None.

### 🟠 Majors
None.

### 🟡 Minors (track as follow-ups)
1. **Loop ignores per-dimension pass bars** — the continue/present decision reads only `grade.overallScore >= stage.threshold` and never `grade.passesThreshold` (which the judge computes from per-dimension bars). A dossier with a failing dimension but a passing composite is accepted. Not a CR-2 regression — `loop-engine.ts` is unchanged in CR-2 (last touched in Phase 3.4 `6f15fd6`); inherited Core convention ([src/lib/core/engine/loop-engine.ts:147](src/lib/core/engine/loop-engine.ts#L147)). _Resolve before CR-3 (Gate-A-critical, threshold 80)._
2. **No `@@unique([longFormMasterId, url])` on `ResearchSource`** — schema has only `@@index` ([prisma/schema.prisma:174](prisma/schema.prisma#L174)); the on-disk dossier omits persisted row ids, so CR-3's URL→id `SourceRef` mapping leans on application-level curator dedupe. _Pin before CR-3._
3. **Per-stage cost not persisted** — `totalCostUSD` is tracked in-process and written to the dossier JSON but not to a ledger/StageSession; explicit `TODO(CR-9)` at [scripts/pipeline-research.ts:97](scripts/pipeline-research.ts#L97). _Close before CR-12 (acceptance budget < $5.00)._
4. **Agents don't follow the Forge `AgentConfig` template** — Stage-2 agents are factory functions with flat string-array prompts ([src/lib/domain/workflows/creator/agents/research-agent.ts:41](src/lib/domain/workflows/creator/agents/research-agent.ts#L41)), diverging from [docs/02-domain/agents-and-personas.md](docs/02-domain/agents-and-personas.md) and the `agent-persona-creation` skill. CR-2 Build list didn't mandate the shape, but CR-4/5/7 cross-critique agents will. _Pick one convention before CR-4._
5. **Stale persona DRAFT banner** — [docs/02-domain/buildos-persona.md:2](docs/02-domain/buildos-persona.md#L2) still reads "DRAFT — Srinivas to review/edit before CR-1 seeds it", yet CR-1 seeded it (`eb01b5a`) and CR-2 consumes it. _Flip before CR-3._
6. **No committed CR-2 sign-off artifact** despite the commit asserting "architect-reviewer APPROVE" — only `CR-1-sign-off.md` existed under `docs/sign-off-review/`. This report closes the gap. _Going forward, commit the artifact or drop unverifiable approval claims._

### ⚪ Nits
- Live dossier landed at exactly 8 sources (the floor); `DEFAULT_MAX_SOURCES=12` makes the spec's 15 ceiling unreachable ([src/lib/domain/workflows/creator/agents/source-curator.ts:31](src/lib/domain/workflows/creator/agents/source-curator.ts#L31)). Cosmetic.
- On revise, the dossier keeps `previous.query` while `buildReviseQuery` was actually run, so the judge/JSON show the seed query ([src/lib/domain/workflows/creator/agents/research-agent.ts:170](src/lib/domain/workflows/creator/agents/research-agent.ts#L170)).
- Failing-path composite uses a slightly different rounding pipeline than the main path; identical behavior ([src/lib/domain/workflows/creator/agents/research-judge.ts:143](src/lib/domain/workflows/creator/agents/research-judge.ts#L143)).
- Judge is GPT-4o while the CLAUDE.md addendum's "V1 judge is Gemini" note is Stage-5-scoped; GPT-4o is correct and documented for Stage 2.
- Untracked `bibliography/` scratch dir in the working tree; add to `.gitignore` or remove.

## Needs human input

- Confirm the **BuildOS seed persona was actually reviewed/edited** before being relied upon — `buildos-persona.md` is still labeled DRAFT yet CR-1 seeded it and CR-2 grades against it. The acceptance test's voice-fidelity criterion depends on this.
- Acceptance-test criteria 2 and 3 (posts publishable without rewrite) are human-judged and out of scope for CR-2; flagged for CR-12.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Have the loop honor `passesThreshold`, or down-document the per-dimension bars | CR-3 | [src/lib/core/engine/loop-engine.ts:147](src/lib/core/engine/loop-engine.ts#L147) |
| Add `@@unique([longFormMasterId, url])` and/or write persisted source ids to the dossier JSON | CR-3 | [prisma/schema.prisma:174](prisma/schema.prisma#L174) |
| Unify the agent-authoring convention (Forge `AgentConfig` template vs factory) or log the exception | CR-4 | [src/lib/domain/workflows/creator/agents/research-agent.ts:41](src/lib/domain/workflows/creator/agents/research-agent.ts#L41) |
| Flip `buildos-persona.md` status from DRAFT to seeded/approved | CR-3 | [docs/02-domain/buildos-persona.md:2](docs/02-domain/buildos-persona.md#L2) |
| Persist `totalCostUSD` to a durable ledger / StageSession | CR-12 | [scripts/pipeline-research.ts:97](scripts/pipeline-research.ts#L97) |
| Add `bibliography/` to `.gitignore` (or remove it) | CR-3 | [.gitignore:1](.gitignore#L1) |

## Bottom line

**Signed off with follow-ups.** CR-2 is properly done — every spec deliverable is present and correct, all deterministic gates pass (464 tests, import rule clean, schema valid), the Core/Domain split is exemplary, and the live run proves the stage end-to-end. No blockers or majors. The user is **clear to proceed to CR-3**, carrying the six tracked follow-ups — two of which (loop `passesThreshold` handling and the `ResearchSource` URL→id contract) are cheapest to address at the start of CR-3 itself.