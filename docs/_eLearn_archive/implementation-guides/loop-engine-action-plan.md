# VOVAI Loop Engine v2 — Claude Code Action Plan

## COMPLETED — 2026-04-10

All 14 steps (LE-0 through LE-13) are complete. The Loop Engine v2 is built, tested, and verified.

| Metric | Value |
|--------|-------|
| **Total tests** | 641 (up from 385 at start) |
| **Branch** | `feature/loop-engine-v2` → merged to `main` |
| **Tags** | LE-0 through LE-13 (13 step tags + final docs tag) |
| **Core files** | `engine/` (3 files), `agentic/` (2 files), `review/` (4 files) |
| **Domain files** | `workflows/` (pipeline orchestrator, ideation config, rubrics, agents, production) |
| **Commits on branch** | 35 |
| **Architectural contract** | `grep -r "from.*domain/" src/lib/core/` returns nothing — held at every step |
| **Engine universality** | Proven at LE-12: document pipeline uses same core engine, different domain config |

**Deviations from original plan:**
- Step 1 originally had `inline_edit` as a ReviewAction type and 6 actions. Refined to 5 actions (inline editing is a UI behavior via `editedArtifact` field on any action, not a separate action type).
- Step 2 originally said "4 functions" — implementation has 5 (`createInitialState` added).
- Step 5 originally said "Phase 0: approve, reject, feedback, inline_edit" — refined to "approve, reject, feedback" (inline editing handled via `editedArtifact`).
- Steps 8-9 added Zod validation schemas and persistence layer not originally specified.
- Step 11 E2E split into 47 mock tests + 6 live integration tests (original plan just said "E2E test").

**The step descriptions below are preserved as historical record.**

---

## 14 Steps, Each = 1 Session, Each = Visible Progress
## Core/Domain Architecture

**Branch:** `feature/loop-engine-v2` (create from `main`)
**Rule:** ONE step per Claude Code session. Commit + tag after each.
**Starting point:** v1.0.0 on main (385 tests, code in `src/lib/project-component/`)

**Two categories:**
- Core (`src/lib/core/`) — machinery, domain-agnostic, portable
- Domain (`src/lib/domain/`) — eLearning-specific configuration

**Four systems:**
1. Loop Engine (`src/lib/core/engine/`) — runs ONE stage loop
2. Agentic System (`src/lib/core/agentic/`) — agent execution machinery
3. Human Review System (`src/lib/core/review/`) — gate enforcement machinery
4. Domain Workflow (`src/lib/domain/workflows/`) — eLearning orchestration

**The one rule:** `domain/` imports from `core/`. Never the reverse.

---

## STEP 0: Folder restructure
**You will see:** Same code, new locations. All 385 tests still pass.
**Time:** ~30 min

```
Read CLAUDE.md. Create branch feature/loop-engine-v2 from main.

Restructure the file tree. This is a MOVE operation — no logic changes.
Every test must pass after this step.

1. Create new folder structure:
   src/lib/core/           (empty for now, new code goes here in later steps)
   src/lib/domain/workflows/

2. Move existing code:
   src/lib/project-component/ → src/lib/domain/workflows/

3. Update ALL import paths across the codebase:
   - Every file that imports from 'src/lib/project-component/...'
     should now import from 'src/lib/domain/workflows/...'
   - Use find-and-replace across the entire src/ directory
   - Also update: API route files, test files, page components

4. Update tsconfig paths if any path aliases reference project-component

5. Do NOT rename any files or functions — only move and update imports

Run: npm run typecheck && npm run test && npm run build
ALL 385 tests must pass. This is purely mechanical.
```

**Checkpoint:**
```bash
npm run typecheck                    # pass
npm run test                         # all 385 pass
npm run build                        # pass
ls src/lib/domain/workflows/         # all files present
ls src/lib/project-component/        # should not exist
```

**Tag:** `git tag LE-0-folder-restructure`

---

## STEP 1: Loop Engine — types
**System:** Core / Engine
**You will see:** New interfaces. Zero domain imports.
**Time:** ~20 min

```
Read CLAUDE.md. I'm on step 1. Folder restructure done (LE-0).

Create src/lib/core/engine/types.ts — System 1 (Loop Engine).
This file must have ZERO imports from domain/ or any other core/ system.

Types to define:

LoopStage<T> = { id, agents: AgentConfig[], rubric: RubricDefinition,
  threshold: number, maxIterations: number, minIterations: number,
  loopPattern: 'standard' | 'strategic' | 'tournament' | 'nested',
  validator?: (artifact: T) => ValidationResult }

LoopState<T> = { stageId, status: LoopStatus, currentArtifact: T | null,
  bestArtifact: T | null, bestGrade: GradeReport | null,
  iterations: IterationRecord[], loopCount: number,
  humanFeedback: string[], costUSD: number }

LoopStatus = 'idle' | 'generating' | 'validating' | 'evaluating' |
  'revising' | 'presenting' | 'awaiting_review' | 'approved'

ReviewAction = { type: 'approve' | 'reject' | 'feedback' |
  'inline_edit' | 'use_segments' | 'mix_produce',
  message?: string, editedArtifact?: unknown }

GradeReport, DimensionScore, RubricDefinition, RubricDimension,
IterationRecord, AgentConfig, ValidationResult (same as before)

Injected dependency types:
  type AgentExecutor = (agents: AgentConfig[], context: unknown,
    state: LoopState<unknown>) => Promise<unknown>
  type JudgeFunction = (artifact: unknown,
    rubric: RubricDefinition) => Promise<GradeReport>

Create src/lib/core/engine/index.ts — re-exports.

Run: npm run typecheck
Verify: grep -r "domain/" src/lib/core/  → returns nothing
```

**Checkpoint:**
```bash
npm run typecheck
grep -r "from.*domain/" src/lib/core/    # NOTHING
```

**Tag:** `git tag LE-1-engine-types`

---

## STEP 2: Loop Engine — four functions
**System:** Core / Engine
**You will see:** Loop functions working with mock agents and judges.
**Time:** ~30 min

```
Read CLAUDE.md. I'm on step 2. Types done (LE-1).

Create src/lib/core/engine/loop-engine.ts — System 1.
ZERO imports from domain/ or other core/ systems.

Functions:
1. createInitialState<T>(stageId): LoopState<T>
2. async produce<T>(stage, state, context, agentExecutor): Promise<T>
3. async evaluate<T>(artifact, rubric, judge): Promise<GradeReport>
4. runLoop<T>(stage, state, context, agentExecutor, judge): Promise<LoopState<T>>
   — ONE iteration, caller loops
5. processReview<T>(state, action: ReviewAction): LoopState<T>
   — handles all 6 action types

Tests at tests/unit/core/loop-engine.test.ts:
- createInitialState returns idle
- runLoop with mock score 90 → presenting after minIterations
- runLoop with mock score 50 → revising until max
- processReview for all 6 actions
- bestArtifact tracking
- minIterations enforced

Run: npm run typecheck && npm run test -- tests/unit/core/loop-engine
Verify: grep -r "from.*domain/" src/lib/core/  → nothing
```

**Checkpoint:**
```bash
npm run typecheck
npm run test -- tests/unit/core/loop-engine.test.ts    # all pass
grep -r "from.*domain/" src/lib/core/                  # NOTHING
```

**Tag:** `git tag LE-2-loop-functions`

---

## STEP 3: Generic rubric grader
**System:** Core / Agentic (machinery) + Domain (backward compat wrapper)
**You will see:** Any rubric can grade any artifact.
**Time:** ~25 min

```
Read CLAUDE.md. I'm on step 3. Loop functions done (LE-2).

Create src/lib/core/agentic/grader.ts — generic grading machinery.
Uses RubricDefinition from core/engine/types.ts.
Does NOT import from domain/.

1. async gradeArtifact(artifact: unknown, rubric: RubricDefinition,
   judgeModel: string, apiKey: string): Promise<GradeReport>
   - Builds prompt from rubric dimensions (generic, no domain words)
   - Calls judge model (GPT-4o)
   - Returns GradeReport

2. calculateWeightedScore(dimensionScores: DimensionScore[]): number
   Pure math, no API.

3. checkThresholds(grade: GradeReport, rubric: RubricDefinition):
   { passes: boolean, failingDimensions: string[] }

4. createJudgeFunction(apiKey: string): JudgeFunction
   Returns function compatible with engine's evaluate()

Update domain/workflows/agents/rubric-grader.ts to be a thin wrapper
that calls core/agentic/grader.ts. Existing tests must still pass.

Tests at tests/unit/core/grader.test.ts:
- Weighted score calculation
- Threshold checking with failing dimensions
- Existing structure grading still works (backward compat)

Run: npm run typecheck && npm run test -- tests/unit
```

**Checkpoint:**
```bash
npm run typecheck
npm run test -- tests/unit/core/grader.test.ts         # new tests
npm run test -- tests/unit/rubric.test.ts              # existing 15 pass
grep -r "from.*domain/" src/lib/core/                  # NOTHING
```

**Tag:** `git tag LE-3-generic-grader`

---

## STEP 4: Four new ideation rubrics
**System:** Domain (eLearning-specific rubric definitions)
**You will see:** 5 rubrics total using core's RubricDefinition type.
**Time:** ~20 min

```
Read CLAUDE.md. I'm on step 4. Grader done (LE-3).

Create rubrics in src/lib/domain/workflows/rubrics/ using
RubricDefinition type imported from src/lib/core/engine/types.ts.

1. brief-rubric.ts — BRIEF_RUBRIC: 5 dims, threshold 75
2. audience-rubric.ts — AUDIENCE_RUBRIC: 5 dims, threshold 75
3. component-rubric.ts — COMPONENT_RUBRIC: 5 dims, threshold 75
4. handoff-rubric.ts — HANDOFF_RUBRIC: 5 dims, threshold 80
5. Update existing structure-rubric.ts to also export as RubricDefinition

Each dimension: id, name, weight, passThreshold, description, criteria.
Weights sum to 1.0. Test verifies this for all 5.

Run: npm run typecheck && npm run test -- tests/unit/rubric
```

**Checkpoint:**
```bash
npm run typecheck
npm run test -- tests/unit/rubric    # all pass
```

**Tag:** `git tag LE-4-ideation-rubrics`

---

## STEP 5: Human Review System
**System:** Core / Review
**You will see:** Independent review module with gate enforcement.
**Time:** ~20 min

```
Read CLAUDE.md. I'm on step 5. Rubrics done (LE-4).

Create src/lib/core/review/ — System 3 (Human Review machinery).
Imports from core/engine/types.ts only. ZERO imports from domain/.

1. types.ts — ReviewGate, ReviewResult, ReviewerAssignment
2. gate.ts — createGate(), isGateOpen(), enforceHumanSovereignty()
3. actions.ts — validateReviewAction(), getAvailableActions(phaseContext)
   Phase 0: approve, reject, feedback, inline_edit
   Phases 1-5: all 6 actions
4. index.ts — re-exports

Tests at tests/unit/core/review-system.test.ts:
- Gate open only when awaiting_review
- Sovereignty throws on direct approval bypass
- Correct actions per phase context
- Invalid transitions rejected

Run: npm run typecheck && npm run test -- tests/unit/core/review
Verify: grep -r "from.*domain/" src/lib/core/  → nothing
```

**Checkpoint:**
```bash
npm run typecheck
npm run test -- tests/unit/core/review-system.test.ts  # pass
grep -r "from.*domain/" src/lib/core/                  # NOTHING
```

**Tag:** `git tag LE-5-review-system`

---

## STEP 6: Pipeline Orchestrator
**System:** Domain Workflow
**You will see:** Stage sequencing that calls core's Loop Engine.
**Time:** ~25 min

```
Read CLAUDE.md. I'm on step 6. Review system done (LE-5).

Create src/lib/domain/workflows/pipeline-orchestrator.ts — System 4.
IMPORTS from core/engine/ and core/review/. This is eLearning-specific.

1. IdeationPipeline type with stages, currentStageIndex, stageStates
2. createIdeationPipeline(blueprintId, stages): IdeationPipeline
3. getCurrentStage(pipeline), canAdvance(pipeline)
4. advancePipeline(pipeline): IdeationPipeline
5. isPipelineComplete(pipeline), getPipelineProgress(pipeline)
6. async runCurrentStage(pipeline, context, agentExecutor, judge):
   Calls core's runLoop() for one iteration. Updates pipeline state.
   Creates review gate when loop reaches 'presenting'.

Tests at tests/unit/domain/pipeline-orchestrator.test.ts:
- 5-stage pipeline starts at 0
- Cannot advance without approval
- Advances correctly, completes when all approved
- runCurrentStage calls core's runLoop (mock engine)

Run: npm run typecheck && npm run test -- tests/unit/domain/pipeline
```

**Checkpoint:**
```bash
npm run typecheck
npm run test -- tests/unit/domain/pipeline-orchestrator.test.ts  # pass
```

**Tag:** `git tag LE-6-pipeline-orchestrator`

---

## STEP 7: Ideation pipeline config
**System:** Domain Workflow
**You will see:** 5 stages wired with real agent configs + rubrics.
**Time:** ~20 min

```
Read CLAUDE.md. I'm on step 7. Orchestrator done (LE-6).

Create src/lib/domain/workflows/ideation/pipeline-config.ts:

ELEARN_IDEATION_STAGES wiring:
  brief → orchestratorConfig + BRIEF_RUBRIC + threshold 75
  audience → audienceAnalystConfig + AUDIENCE_RUBRIC + threshold 75
  structure → [curriculumConfig, outcomeConfig] + STRUCTURE_RUBRIC + threshold 75
  components → [componentConfig, optimizerConfig] + COMPONENT_RUBRIC + threshold 75
  handoff → handoffConfig + HANDOFF_RUBRIC + threshold 80

Export createElearnIdeationPipeline(blueprintId).

Test: create pipeline, verify 5 stages, verify rubrics match.

Run: npm run typecheck && npm run test
```

**Checkpoint:**
```bash
npm run typecheck
npm run test    # ALL tests pass
```

**Tag:** `git tag LE-7-ideation-config`

---

## STEP 8: API routes
**System:** Domain Workflow (API layer)
**You will see:** curl-able endpoints.
**Time:** ~30 min

```
Read CLAUDE.md. I'm on step 8. Config done (LE-7).

New routes alongside existing (don't break existing):

POST /api/blueprints/[id]/pipeline/start — creates pipeline
POST /api/blueprints/[id]/pipeline/stages/[stageId]/run — one loop iteration
POST /api/blueprints/[id]/pipeline/stages/[stageId]/review — human action
GET  /api/blueprints/[id]/pipeline/state — full state + progress

Mock agent executor for now. Real agents in step 10.

Run: npm run typecheck && npm run build
```

**Checkpoint:**
```bash
npm run typecheck && npm run build
npm run dev
curl -s -X POST localhost:3000/api/blueprints/test/pipeline/start | head
```

**Tag:** `git tag LE-8-api-routes`

---

## STEP 9: Per-stage conversations
**System:** Domain Workflow
**Time:** ~20 min

```
Read CLAUDE.md. Step 9. Add stageId to conversation manager.
Prisma migration if needed. Existing routes unchanged.

Run: npm run typecheck && npx prisma migrate dev && npm run test
```

**Checkpoint:**
```bash
npm run typecheck && npm run test    # all pass
```

**Tag:** `git tag LE-9-per-stage-conversations`

---

## STEP 10: Wire real agents
**System:** Core/Agentic bridge + Domain agent configs
**Time:** ~30 min

```
Read CLAUDE.md. Step 10.

Create src/lib/domain/workflows/agents/agent-bridge.ts:
Maps agent config IDs to actual agent functions.
Creates AgentExecutor and JudgeFunction for the pipeline.

NOTE: The bridge lives in DOMAIN because it maps eLearning-specific
agent IDs to implementations. Core's executor handles the actual
API calls, retries, cost tracking.

Update API routes to use real executor + judge.

Run: npm run typecheck && npm run build
```

**Checkpoint:**
```bash
npm run typecheck && npm run build
# Manual test (~$0.05):
curl -X POST localhost:3000/api/blueprints/{id}/pipeline/stages/brief/run
```

**Tag:** `git tag LE-10-real-agents`

---

## STEP 11: E2E test
**System:** All four
**Time:** ~25 min

```
Read CLAUDE.md. Step 11. Full 5-stage pipeline E2E.
Brief → Audience → Structure → Components → Handoff.
Costs ~$0.50. Verify all 385+ existing tests still pass.

Run: npm run test && npm run test:e2e
```

**Checkpoint:**
```bash
npm run test       # ALL existing pass
npm run test:e2e   # new E2E passes
```

**Tag:** `git tag LE-11-e2e-pipeline`

---

## STEP 12: Document Pipeline proof
**System:** Domain Workflow (proving core universality)
**Time:** ~20 min

```
Read CLAUDE.md. Step 12.

Create src/lib/domain/workflows/production/document-pipeline.ts.
Same core runLoop(), different domain config.
The engine doesn't know it's running documents — that's the proof.

Run: npm run typecheck && npm run test
```

**Checkpoint:**
```bash
npm run typecheck && npm run test
```

**Tag:** `git tag LE-12-document-pipeline-proof`

---

## STEP 13: Docs + merge
**System:** Documentation
**Time:** ~15 min

```
Read CLAUDE.md. Step 13. Update docs only. Verify everything.

Run: npm run typecheck && npm run build && npm run test
Final check: grep -r "from.*domain/" src/lib/core/  → NOTHING
```

**Checkpoint:**
```bash
npm run typecheck && npm run build && npm run test
grep -r "from.*domain/" src/lib/core/    # NOTHING — the architectural contract holds
git log --oneline --tags                 # LE-0 through LE-13
```

**Tag:** `git tag LE-13-docs-complete`
**Merge:** `git checkout main && git merge feature/loop-engine-v2`

---

## Summary

| Step | Category | System | What | Proof | Time |
|------|----------|--------|------|-------|------|
| 0 | Both | All | Folder restructure | 385 tests pass at new paths | 30m |
| 1 | Core | Engine | Types | typecheck + no domain imports | 20m |
| 2 | Core | Engine | 4 functions | Tests with mocks | 30m |
| 3 | Core | Agentic | Generic grader | Any rubric works | 25m |
| 4 | Domain | Workflow | 4 rubrics | Weights sum to 1.0 | 20m |
| 5 | Core | Review | Gate + actions | Sovereignty enforced | 20m |
| 6 | Domain | Workflow | Orchestrator | Sequencing works | 25m |
| 7 | Domain | Workflow | Pipeline config | 5 stages wired | 20m |
| 8 | Domain | Workflow | API routes | curl works | 30m |
| 9 | Domain | Workflow | Conversations | DB migration | 20m |
| 10 | Domain | Agents | Real agents | AI generates | 30m |
| 11 | All | All | E2E test | Full pipeline | 25m |
| 12 | Domain | Workflow | Doc pipeline | Same engine, diff config | 20m |
| 13 | — | Docs | Merge | Clean merge | 15m |

**Total: ~14 sessions, ~5.5 hours**

**The architectural contract verified at every step:**
```bash
grep -r "from.*domain/" src/lib/core/    # must ALWAYS return nothing
```