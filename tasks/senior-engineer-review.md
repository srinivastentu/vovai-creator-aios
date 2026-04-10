# Senior Engineer Review — Pre-LE-0 Sign-off

**Date:** 2026-04-10
**Reviewer:** Claude (Senior Engineer role)
**Branch:** feature/loop-engine-v2
**Purpose:** Final checkpoint before loop-engine-v2 refactor begins

---

## Executive Summary

The codebase is in excellent health for a pre-v1 system. All 385 tests pass, typecheck is clean, production build succeeds, and there are zero `any` types in hand-written code. The architecture is well-documented and the 14-step action plan is sound. Security posture is strong with Zod validation on all mutating endpoints and cost guards on all AI-calling paths.

**There are ZERO blockers.** The codebase is ready for LE-0 (folder restructure).

The primary risk in LE-0 is the **225 import path changes** needed across src/, tests/, and scripts/. The barrel import `@/lib/project-component` (used 36 times in src/) is the single highest-risk path — if the new barrel isn't set up identically, it cascades failures across the entire app. Mitigation: do barrel first, run typecheck after each batch of updates.

**Verdict: APPROVED FOR LE-0**

---

## A. Codebase Health

| Check | Result | Status |
|-------|--------|--------|
| A1. Test suite | **385 tests, 17 files, ALL PASS** (786ms) | PASS |
| A2. Typecheck | **Clean** — zero errors | PASS |
| A3. Build | **Success** — 12 static pages, 28 routes compiled | PASS |
| A4. Linter | **Not configured** — `next lint` is deprecated in Next.js 16, no standalone eslint.config.js exists | INFO |
| A5. TODO/FIXME/HACK | 31 TODOs found — all are intentional placeholders (Ring-5 auth/rate-limiting, engine.ts stubs) | INFO |
| A6. console.log | **1 instance** — executor.ts:130 (agent cost logging). Intentional diagnostic, not leaked data. | INFO |
| A7. Hardcoded secrets | **None found** — API keys loaded from process.env (ANTHROPIC_API_KEY, DATABASE_URL, IDEATION_COST_LIMIT_USD) | PASS |
| A8. Codebase size | **121 hand-written files, ~20,851 LOC** (excludes generated Prisma code). 148 total files / 43,381 LOC including generated. | INFO |

### Findings

- **[INFO] A4: ESLint not configured standalone.** `next lint` is deprecated in Next.js 16. No `eslint.config.js` at project root. Build still lints internally. Recommend setting up standalone ESLint config during or after the refactor.
- **[INFO] A5: TODOs are all intentional.** 31 TODOs — 27 are "Ring-5: Add auth/rate limiting" (expected pre-auth), 4 are engine.ts stubs (will be replaced by LE-2). None block LE-0.
- **[INFO] A6: console.log in executor.ts.** Single instance logs agent cost telemetry. This is useful during development. Convert to structured logging when Ring 2 infra is built.

---

## B. Architecture Alignment Audit

### B1. File Migration Table

29 files in `src/lib/project-component/` need to move to `src/lib/domain/workflows/`:

| Current Path | New Path | Category | System |
|---|---|---|---|
| `src/lib/project-component/types.ts` | `src/lib/domain/workflows/types.ts` | Domain | 4 |
| `src/lib/project-component/index.ts` | `src/lib/domain/workflows/index.ts` | Domain | 4 |
| `src/lib/project-component/server.ts` | `src/lib/domain/workflows/server.ts` | Domain | 4 |
| `src/lib/project-component/archetypes.ts` | `src/lib/domain/workflows/archetypes.ts` | Domain | 4 |
| `src/lib/project-component/component-registry.ts` | `src/lib/domain/workflows/component-registry.ts` | Domain | 4 |
| `src/lib/project-component/compatibility.ts` | `src/lib/domain/workflows/compatibility.ts` | Domain | 4 |
| `src/lib/project-component/workflow-defaults.ts` | `src/lib/domain/workflows/workflow-defaults.ts` | Domain | 4 |
| `src/lib/project-component/rubrics/structure-rubric.ts` | `src/lib/domain/workflows/rubrics/structure-rubric.ts` | Domain | 4 |
| `src/lib/project-component/tree/tree-utils.ts` | `src/lib/domain/workflows/tree/tree-utils.ts` | Domain | 4 |
| `src/lib/project-component/tree/tree-validator.ts` | `src/lib/domain/workflows/tree/tree-validator.ts` | Domain | 4 |
| `src/lib/project-component/tree/tree-serializer.ts` | `src/lib/domain/workflows/tree/tree-serializer.ts` | Domain | 4 |
| `src/lib/project-component/agents/orchestrator.ts` | `src/lib/domain/workflows/agents/orchestrator.ts` | Domain | 4 |
| `src/lib/project-component/agents/audience-analyst.ts` | `src/lib/domain/workflows/agents/audience-analyst.ts` | Domain | 4 |
| `src/lib/project-component/agents/curriculum-strategist.ts` | `src/lib/domain/workflows/agents/curriculum-strategist.ts` | Domain | 4 |
| `src/lib/project-component/agents/outcome-architect.ts` | `src/lib/domain/workflows/agents/outcome-architect.ts` | Domain | 4 |
| `src/lib/project-component/agents/component-recommender.ts` | `src/lib/domain/workflows/agents/component-recommender.ts` | Domain | 4 |
| `src/lib/project-component/agents/structure-optimizer.ts` | `src/lib/domain/workflows/agents/structure-optimizer.ts` | Domain | 4 |
| `src/lib/project-component/agents/devils-advocate.ts` | `src/lib/domain/workflows/agents/devils-advocate.ts` | Domain | 4 |
| `src/lib/project-component/agents/rubric-grader.ts` | `src/lib/domain/workflows/agents/rubric-grader.ts` | Domain | 4 |
| `src/lib/project-component/agents/framework/types.ts` | `src/lib/domain/workflows/agents/framework/types.ts` | Domain (temporary) | 2→4 |
| `src/lib/project-component/agents/framework/registry.ts` | `src/lib/domain/workflows/agents/framework/registry.ts` | Domain (temporary) | 2→4 |
| `src/lib/project-component/agents/framework/executor.ts` | `src/lib/domain/workflows/agents/framework/executor.ts` | Domain (temporary) | 2→4 |
| `src/lib/project-component/ideation/loop-engine.ts` | `src/lib/domain/workflows/ideation/loop-engine.ts` | Domain (temporary) | 1→4 |
| `src/lib/project-component/ideation/phase-manager.ts` | `src/lib/domain/workflows/ideation/phase-manager.ts` | Domain | 4 |
| `src/lib/project-component/ideation/conversation-manager.ts` | `src/lib/domain/workflows/ideation/conversation-manager.ts` | Domain | 4 |
| `src/lib/project-component/ideation/cost-guard.ts` | `src/lib/domain/workflows/ideation/cost-guard.ts` | Domain | 4 |
| `src/lib/project-component/ideation/materializer.ts` | `src/lib/domain/workflows/ideation/materializer.ts` | Domain | 4 |
| `src/lib/project-component/production/handoff.ts` | `src/lib/domain/workflows/production/handoff.ts` | Domain | 4 |
| `src/lib/project-component/production/cost-estimator.ts` | `src/lib/domain/workflows/production/cost-estimator.ts` | Domain | 4 |

**Also affected (not moved, imports updated only):**
- `src/lib/engine.ts` — stub, will be replaced by core/engine in LE-2
- `src/lib/types.ts` — core types, stays at `src/lib/types.ts`
- `src/lib/db.ts` — database client, stays
- `src/lib/validations/*.ts` — 3 validation files, stay
- `src/components/project-component/**` — 15+ UI components need import updates
- `src/app/api/**` — 17 API routes need import updates
- `tests/unit/**` — 17 test files need import updates
- `scripts/**` — 3 scripts need import updates

### B2. Files Temporarily in Wrong System

Three file groups will initially land in `domain/workflows/` but contain machinery that later moves to `core/`:

| Files | Current System | Future System | When Moved |
|---|---|---|---|
| `agents/framework/{types,registry,executor}.ts` | Domain | Core/Agentic (System 2) | LE-3 or LE-10 |
| `ideation/loop-engine.ts` | Domain | Core/Engine (System 1) | LE-2 (replaced, not moved) |

This is expected and correct per the action plan — LE-0 is a pure move, later steps extract core machinery.

### B3. Cross-Boundary Imports (Future)

Currently all code lives in one directory so there are no cross-boundary violations. After LE-0, the following imports will cross the future core/domain boundary once core/ is created:

- `domain/workflows/agents/framework/executor.ts` imports Anthropic SDK directly (will be abstracted in LE-3)
- `domain/workflows/ideation/loop-engine.ts` contains loop logic (will be replaced by `core/engine/loop-engine.ts` in LE-2)

These are not violations during LE-0 — they become violations only after LE-2/LE-3 create the core alternatives.

### B4. Import Change Count

| Scope | References to Update | Method |
|---|---|---|
| src/ (app + lib + components) | 120 | find-and-replace `@/lib/project-component` → `@/lib/domain/workflows` |
| tests/ | 99 | find-and-replace `../../src/lib/project-component` → `../../src/lib/domain/workflows` |
| scripts/ | 6 | find-and-replace `../src/lib/project-component` → `../src/lib/domain/workflows` |
| **Total** | **225** | |

### B5. Circular Dependencies

**None detected.** `types.ts` has zero imports from sibling files. All dependency arrows flow one direction.

### B6. Path Aliases

`tsconfig.json` uses `@/*` → `./src/*` — generic alias, NOT project-component-specific. **No tsconfig changes needed for LE-0.**

---

## C. Dependency Audit

### C1. npm audit

| Severity | Count | Package | Fix |
|---|---|---|---|
| High | 2 | `vite` (path traversal + websocket), `defu` (prototype pollution) | `npm audit fix` |
| Moderate | 5 | `@anthropic-ai/sdk` (memory tool sandbox escape), `hono` + `@hono/node-server` (middleware bypass) | `npm audit fix --force` for SDK |
| **Total** | **7** | | |

### C2. SDK Versions

| Package | Version | Latest | Notes |
|---|---|---|---|
| `@anthropic-ai/sdk` | ^0.80.0 | 0.87.0 | **Has security advisory** (GHSA-5474-4w2j-mq4c). Breaking change to fix. |
| `openai` | ^6.33.0 | current | Not yet imported — reserved for judging (GPT-4o) |
| `prisma` | ^7.6.0 | current | Prisma 7 with pg adapter |
| `@prisma/client` | ^7.6.0 | current | Matches prisma version |

### C3. Unused Dependencies

| Package | Status | Reason |
|---|---|---|
| `openai` | Listed but not imported | Reserved for LE-3 (judge function with GPT-4o) |

All other "seemingly unused" packages (vitest, tailwindcss, postcss, @types/*, etc.) are build tools, type definitions, or framework dependencies — correctly present.

### C4. Conflicts with Core/Domain Split

**None.** Dependencies are application-level (package.json), not tied to file structure. The split is purely internal.

### Findings

- **[WARNING] C1: Anthropic SDK has a security advisory.** The sandbox escape vulnerability (GHSA-5474-4w2j-mq4c) affects memory tool path validation. Fix requires `--force` (breaking change). Recommend updating during LE-0 since we're already touching all imports.
- **[WARNING] C1: vite and defu have HIGH severity vulnerabilities.** `npm audit fix` resolves both (non-breaking).
- **[INFO] C3: openai package unused.** Listed in dependencies but never imported. Will be needed in LE-3 for judge function. Keep.

---

## D. Database Schema Review

### D1. Models and Relationships

| Model | Fields | Relations | Purpose |
|---|---|---|---|
| Project | 10 | → StageSession[], → ProjectBlueprint? | Top-level project |
| StageSession | 10 | → Project, → Artifact[], → IterationRecord[], → NodeComponent[] | Loop execution session |
| Artifact | 8 | → StageSession | Immutable content versions |
| IterationRecord | 10 | → StageSession | Loop iteration history |
| ProjectBlueprint | 12 | → Project, → ProjectNode[], → IdeationConversation[], → BlueprintVersion[], → StructureGrade[] | Blueprint configuration |
| ProjectNode | 14 | → ProjectBlueprint, self-referential tree | Curriculum tree nodes |
| NodeComponent | 10 | → ProjectNode, → StageSession? | Component assignments |
| IdeationConversation | 5 | → ProjectBlueprint, → IdeationMessage[] | Chat conversations |
| IdeationMessage | 6 | → IdeationConversation | Individual messages |
| BlueprintVersion | 5 | → ProjectBlueprint | Snapshot history |
| StructureGrade | 6 | → ProjectBlueprint | Rubric grades |

**Totals: 11 models, 96 fields, 7 enums**

### D2. stageId for Per-Stage Conversations (LE-9)

`IdeationConversation` has `blueprintId` and `phase` but **no stageId**. The action plan (LE-9) explicitly calls for adding stageId via migration. The current schema is correct for pre-LE-9; the migration is planned.

### D3. Coupling to Old Architecture

`StageSession` uses `stageId: Int` — a numeric stage identifier. This works for both the old single-loop and new multi-stage pipeline. The `NodeComponent.pipelineJobId → StageSession` foreign key correctly links components to their production sessions. **No coupling issues.**

### D4. Missing Indexes

Current indexes:
- `ProjectNode`: `@@unique([blueprintId, path])`, `@@index([blueprintId, depth])`, `@@index([parentId])`
- `NodeComponent`: `@@index([nodeId])`, `@@index([pipelineJobId])`
- `IdeationConversation`: `@@index([blueprintId])`
- `IdeationMessage`: `@@index([conversationId])`
- `StructureGrade`: `@@index([blueprintId])`

**Missing but not critical:**
- `StageSession` has no index on `projectId` — will matter when querying all sessions for a project. Low priority for now.
- `Artifact` has no index on `stageSessionId` — acceptable with current data volumes.

### D5. Summary

**11 models, 96 fields, 7 enums. Schema is sound for LE-0.**

### Findings

- **[INFO] D2: stageId migration needed in LE-9.** Planned and accounted for.
- **[INFO] D4: Missing index on StageSession.projectId.** Not urgent at current scale.

---

## E. Test Coverage Assessment

### E1. Test Files and Counts

| Test File | describe/it blocks | Tests (Vitest) |
|---|---|---|
| security.test.ts | 75 | ~65 |
| tree-utils.test.ts | 63 | 50 |
| tree-validator-serializer.test.ts | 44 | ~40 |
| agent-framework.test.ts | 35 | ~30 |
| loop-engine.test.ts | 35 | ~30 |
| phase-manager.test.ts | 31 | ~25 |
| workflow-defaults.test.ts | 29 | ~25 |
| stage04-agents.test.ts | 29 | ~25 |
| handoff.test.ts | 27 | ~20 |
| stage03-agents.test.ts | 22 | ~20 |
| rubric.test.ts | 19 | 15 |
| ideation-validations.test.ts | 18 | ~15 |
| stage02-agents.test.ts | 18 | ~15 |
| conversation-manager.test.ts | 17 | ~15 |
| orchestrator-agent.test.ts | 14 | ~10 |
| workflow-validation.test.ts | 12 | ~10 |
| configurability-guardrails.test.ts | 8 | ~5 |
| **Total** | **496** | **385** |

### E2. System Coverage

| System | Has Tests? | Key Test Files |
|---|---|---|
| Loop Engine (ideation) | YES | loop-engine.test.ts, phase-manager.test.ts |
| Agentic (framework) | YES | agent-framework.test.ts, stage02/03/04-agents.test.ts, orchestrator-agent.test.ts |
| Rubric Grading | YES | rubric.test.ts |
| Tree Operations | YES | tree-utils.test.ts, tree-validator-serializer.test.ts |
| Security | YES | security.test.ts (65 tests!) |
| Workflow Config | YES | workflow-defaults.test.ts, workflow-validation.test.ts, configurability-guardrails.test.ts |
| Handoff/Production | YES | handoff.test.ts |
| Conversations | YES | conversation-manager.test.ts |
| Human Review Actions | **PARTIAL** | Tested within loop-engine.test.ts, not as standalone system |
| API Routes | **NO** | No route-level tests (acceptable pre-Ring 2) |

### E3. Critical Path Gaps

- **[INFO] No standalone review action tests.** Review is tested indirectly through loop-engine.test.ts. Will get its own test suite in LE-5 (Human Review System).
- **[INFO] No API route tests.** Routes are validated via E2E script, not unit tests. Acceptable for pre-Ring 2.

### E4. Implementation-Detail Tests

Tests are **behavior-focused**, not implementation-detail tests. They test:
- Function outputs given inputs (tree-utils, phase-manager, rubric)
- Agent registry lookups and config validation (agent-framework)
- Security boundaries (cost guard, error sanitization, input validation)
- State transitions (loop-engine, phase-manager)

**Very few tests will break from internal refactoring** — only import paths change.

### E5. Tests Importing from project-component

**ALL 17 test files** import from `../../src/lib/project-component/`. They use 15 distinct import paths.

Most-imported paths in tests:
- `types` (9 files)
- `agents/framework/registry` (5 files)
- `agents/framework/types` (4 files)
- `ideation/phase-manager` (3 files)
- `component-registry` (3 files)

### E6. Estimated Test Breakage from Folder Rename

**99 import statements** across 17 test files need updating. This is a mechanical find-and-replace:
```
../../src/lib/project-component/ → ../../src/lib/domain/workflows/
```

**Risk: LOW.** All changes are path-only. No logic changes. Typecheck will catch any missed paths.

### Findings

- **[INFO] E3: No standalone review system tests.** Will be created in LE-5.
- **[INFO] E5: All 17 test files need import path updates in LE-0.**

---

## F. Security Review

### F1. Input Validation

| Endpoint Type | Zod Validation | Count |
|---|---|---|
| POST/PATCH with request body | YES (safeParse) | 14/15 |
| POST without Zod | `/versions/[version]/restore` | 1 |
| GET-only (no body) | N/A | 7 |

### F2. Rate Limiting

**Not yet implemented** — all AI-calling endpoints have `// TODO(Ring-5): Add rate limiting` comments. This is expected pre-Ring 5 (auth infrastructure).

### F3. Authentication

**Not yet implemented** — all endpoints have `// TODO(Ring-5): Add authentication + authorization middleware`. Expected — Clerk integration planned for Ring 5.

### F4. SQL Injection

**No raw SQL anywhere.** All database access through Prisma ORM. No `$queryRaw` or `$executeRaw` calls in hand-written code.

### F5. Cost Guard

**Enforced on ALL 5 AI-calling endpoints:**
- `/ideation/start` — checkCostLimit before agent call
- `/ideation/message` — checkCostLimit before agent call
- `/ideation/ask` — checkCostLimit before agent call
- `/ideation/approve` — checkCostLimit before approval flow
- `/ideation/grade` — checkCostLimit before grading

Default limit: $5.00 (configurable via `IDEATION_COST_LIMIT_USD` env var).

### F6. API Key Storage

All API keys loaded from environment variables:
- `ANTHROPIC_API_KEY` — in executor.ts
- `DATABASE_URL` — in db.ts
- `IDEATION_COST_LIMIT_USD` — in cost-guard.ts

**No hardcoded secrets anywhere.**

### F7. Sensitive Data Logging

- `console.error` in API routes logs generic error objects (could leak stack traces in dev). Error sanitization is applied in responses.
- `console.log` in executor.ts logs model/tokens/cost — no sensitive data.
- Security headers configured in next.config.js (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy).

### F8. Security Posture

**Rating: GOOD for pre-auth stage.**

Strengths: Zod validation, Prisma ORM (no SQL injection), cost guard, error sanitization, security headers.
Planned: Auth (Ring 5), rate limiting (Ring 5).

### Findings

- **[WARNING] F1: `/versions/[version]/restore` POST has no Zod validation.** The version param comes from URL (not body), but the route should validate the version is a valid integer.
- **[INFO] F2/F3: No auth or rate limiting.** Expected and planned for Ring 5.

---

## G. Code Quality

### G1. `any` Types

**Zero `any` types in hand-written code.** All `any` occurrences are in `src/generated/prisma/` (auto-generated, not our code).

### G2. Coding Style Consistency

- **Zero semicolons** in `src/lib/` (hand-written code). Consistent with CLAUDE.md standards.
- **No `require()` calls** — all ES module imports.
- **2-space indentation** throughout.

### G3. Dead Code

- `src/lib/engine.ts` — **stub file with 4 unimplemented functions**. Will be replaced by `core/engine/loop-engine.ts` in LE-2. Not dead code, but dead weight.
- `src/lib/types.ts` — types imported by engine.ts stub. Will remain relevant as core types.
- `openai` dependency — installed but not imported (reserved for LE-3).

### G4. Files Over 500 Lines

| File | Lines | Notes |
|---|---|---|
| `components/project-component/canvas/node-detail.tsx` | 607 | Complex UI component — candidate for splitting |
| `lib/project-component/ideation/loop-engine.ts` | 555 | Will be replaced by core engine in LE-2 |
| `components/project-component/wizard/wizard-step-review.tsx` | 521 | Complex wizard step |
| `app/(pages)/project/[id]/configure/page.tsx` | 510 | Config page — large but cohesive |

### G5. Complexity Hotspots

- `ideation/loop-engine.ts` — deepest nesting (3-4 levels in phase orchestration). Will be rewritten in LE-2.
- `wizard-step-review.tsx` — complex form state management. Not affected by LE-0.

### G6. Code Quality Grade

**Grade: A-**

Strengths: Zero `any`, consistent style, good separation, comprehensive types, behavior-focused tests.
Minor deductions: 4 files over 500 lines, no standalone eslint config, engine.ts stub.

---

## H. Refactor Risk Assessment

### H1. Single Riskiest Thing About LE-0

**The barrel import `@/lib/project-component` is used 36 times in src/.** This is the single file where a mistake cascades everywhere. The barrel (`index.ts`) re-exports from 10 internal modules. If ANY re-export path is wrong after the move, 36+ files break simultaneously.

**Mitigation:** Move `index.ts` first, verify typecheck, then update consumers.

### H2. Most-Imported Files (Breakage Risk)

| Import Path | Times Referenced | Risk |
|---|---|---|
| `@/lib/project-component` (barrel) | 36 in src | **HIGHEST** |
| `project-component/types` | 9 in tests, 4 in src | HIGH |
| `project-component/agents/framework/registry` | 5 in tests | MEDIUM |
| `project-component/ideation/phase-manager` | 7 in src, 3 in tests | MEDIUM |
| `project-component/ideation/cost-guard` | 5 in src | MEDIUM |

### H3. Dynamic Imports

**None.** Zero `import()` expressions in hand-written code. All imports are static ES module imports. Find-and-replace will catch every reference.

### H4. Path Aliases

`tsconfig.json` uses `@/*` → `./src/*`. This is generic and does NOT reference `project-component`. **No tsconfig changes needed.**

### H5. Scripts, Configs, CI Files

| File | References | Update Needed |
|---|---|---|
| `package.json` | 2 npm scripts reference project-component paths | YES |
| `scripts/seed-project-component.ts` | filename + internal imports | YES (imports only; filename can stay or rename) |
| `scripts/test-e2e-project-component.ts` | filename + API path refs + internal imports | YES |
| `scripts/test-stage02-agents.ts` | 3 import paths | YES |
| `.github/`, Makefile, Dockerfile | Don't exist | N/A |

### H6. Rollback Plan

```bash
# If LE-0 breaks something:
git stash                                    # save any uncommitted work
git checkout main                            # return to known-good state
git branch -D feature/loop-engine-v2         # delete broken branch
git checkout -b feature/loop-engine-v2       # start fresh from main
```

Since LE-0 is the FIRST commit on the branch, rollback is trivially `git checkout main`. The 385 tests + typecheck serve as the completeness check — if they all pass after the move, it's correct.

### Findings

- **[WARNING] H5: package.json npm scripts reference project-component paths.** Must update `db:seed:pc` and `test:e2e` scripts.
- **[INFO] H1: Barrel import is highest-risk path.** Move and verify barrel first.

---

## I. Missing Pieces

### I1. CLAUDE.md References That Don't Exist Yet

| Reference | Exists? | When Created |
|---|---|---|
| `src/lib/core/engine/` | NO | LE-1 (types) + LE-2 (functions) |
| `src/lib/core/agentic/` | NO | LE-3 (grader) + LE-10 (bridge) |
| `src/lib/core/review/` | NO | LE-5 |
| `src/lib/core/tools/` | NO | Future (not in 14-step plan) |
| `src/lib/core/prompts/` | NO | Future |
| `src/lib/core/context/` | NO | Future |
| `src/lib/core/marketplace/` | NO | Future |
| `src/lib/domain/workflows/` | NO | LE-0 (move operation creates it) |
| `src/lib/domain/workflows/pipeline-orchestrator.ts` | NO | LE-6 |
| `src/lib/domain/workflows/review-config.ts` | NO | LE-5 |

**This is expected.** CLAUDE.md describes the TARGET architecture. LE-0 through LE-13 build toward it incrementally.

### I2. Agent Files

All 8 agent files are **fully implemented** (not stubs):
- orchestrator.ts, audience-analyst.ts, curriculum-strategist.ts, outcome-architect.ts
- component-recommender.ts, structure-optimizer.ts, devils-advocate.ts, rubric-grader.ts

Plus framework: types.ts, registry.ts, executor.ts — all implemented.

### I3. Rubric Files

**1 rubric file exists:** `structure-rubric.ts` (7 dimensions, weights sum to 1.0, 15 tests).
**4 rubrics planned but not yet created** — brief, audience, component, handoff rubrics will be created in LE-4. This is expected.

### I4. Seed Data

Seed script (`scripts/seed-project-component.ts`) creates:
- 1 project + 1 blueprint
- 12 nodes (modules/topics/subtopics)
- 25 components
- 3 ideation messages

**Sufficient for testing the new pipeline structure.** Additional seed data can be added as needed.

### I5. Action Plan Assumptions

The 14-step action plan assumes:

| Assumption | Status |
|---|---|
| 385 tests pass on main | VERIFIED |
| Code is in `src/lib/project-component/` | VERIFIED |
| `@/*` path alias exists | VERIFIED |
| No circular dependencies | VERIFIED |
| TypeScript strict mode | VERIFIED |
| Prisma 7 with pg adapter | VERIFIED |
| Anthropic SDK for producing agents | VERIFIED |
| OpenAI SDK for judging (GPT-4o) | INSTALLED but not imported — correct for LE-3 |
| No CI pipeline to break | VERIFIED (no .github/) |

**All assumptions hold.**

---

## Must Fix Before LE-0

**No blockers found.** The codebase is clean and ready.

---

## Fix During Refactor (Warnings)

| # | Finding | Category | When to Fix |
|---|---|---|---|
| W1 | Anthropic SDK has security advisory (GHSA-5474-4w2j-mq4c) | C1 | During LE-0 or immediately after |
| W2 | vite + defu HIGH severity vulnerabilities | C1 | `npm audit fix` during LE-0 |
| W3 | `/versions/[version]/restore` POST has no Zod validation | F1 | During LE-0 or LE-8 |
| W4 | package.json npm scripts reference old paths | H5 | During LE-0 (required) |

---

## Future Improvements (Info)

| # | Finding | Category | When |
|---|---|---|---|
| I1 | Set up standalone ESLint config (next lint deprecated) | A4 | Ring 2 |
| I2 | Convert console.log in executor.ts to structured logging | A6 | Ring 2 |
| I3 | Add index on StageSession.projectId | D4 | When query perf matters |
| I4 | Create standalone review system tests | E3 | LE-5 |
| I5 | Add API route tests | E2 | Ring 2 |
| I6 | Split node-detail.tsx (607 lines) | G4 | When touching that component |
| I7 | Add auth + rate limiting (27 TODOs) | F2/F3 | Ring 5 |

---

## Final Verdict

# APPROVED FOR LE-0

**Zero blockers. Codebase is healthy, well-tested, and well-documented.**

The 14-step action plan's assumptions all hold. The primary mechanical risk (225 import path changes) is mitigatable with find-and-replace + typecheck verification. The architecture docs accurately describe the target state, and the current code maps cleanly to the four-system split.

**Recommended LE-0 execution order:**
1. Create `src/lib/domain/workflows/` directory
2. Move `src/lib/project-component/` contents to new location
3. Update barrel import (`index.ts`) first, run typecheck
4. Find-and-replace all 120 src/ imports
5. Find-and-replace all 99 test imports
6. Find-and-replace all 6 script imports
7. Update package.json npm scripts (W4)
8. Run `npm audit fix` for non-breaking fixes (W2)
9. Run `npm run typecheck && npm run test && npm run build`
10. Delete `src/lib/project-component/` (should be empty)
11. Verify: `ls src/lib/project-component/` → "No such file or directory"

**Sign-off by:** Claude (Senior Engineer)
**Date:** 2026-04-10

---

## LE-0 Post-Completion Verification

**Verdict: LE-0 VERIFIED — Ready for LE-1**

**Date:** 2026-04-10
**Verifier:** Claude (Senior Engineer role)
**Branch:** feature/loop-engine-v2
**Commit:** b087f41 `refactor(LE-0): move project-component to domain/workflows — 29 files, ~122 import updates`

---

### A. Checklist Completion — PASS

All 11 phases (1–11) present. Every item is marked `[x]` complete.

| Phase | Items | Status |
|-------|-------|--------|
| 1. Create directories | 3 | All [x] |
| 2. Move files (29) | 29 | All [x] |
| 3. Barrel verification | 4 | All [x] |
| 4. Update src/ imports | 8 | All [x] |
| 5. Update test imports | 2 | All [x] |
| 6. Update script imports | 4 | All [x] |
| 7. Package.json scripts | 3 | All [x] |
| 8. Fix npm vulnerabilities | 2 | All [x] |
| 9. Clean up | 3 | All [x] |
| 10. Full verification | 6 | All [x] |
| 11. Commit | 4 | All [x] |
| **Total** | **68** | **All complete** |

Note: The user's estimate of "52 checklist items" was conservative — the actual count is 68 granular items across 11 phases. All are checked.

---

### B. File Structure Verification — PASS

**B.1: Old directory removed**
```
$ ls src/lib/project-component/
ls: No such file or directory
```

**B.2: File count**
```
$ find src/lib/domain/workflows/ -type f | wc -l
29
```

**B.3: All 29 files present — cross-referenced against B1 migration table:**

| Expected File | Present? |
|---|---|
| `types.ts` | YES |
| `index.ts` | YES |
| `server.ts` | YES |
| `archetypes.ts` | YES |
| `component-registry.ts` | YES |
| `compatibility.ts` | YES |
| `workflow-defaults.ts` | YES |
| `rubrics/structure-rubric.ts` | YES |
| `tree/tree-utils.ts` | YES |
| `tree/tree-serializer.ts` | YES |
| `tree/tree-validator.ts` | YES |
| `agents/orchestrator.ts` | YES |
| `agents/audience-analyst.ts` | YES |
| `agents/curriculum-strategist.ts` | YES |
| `agents/outcome-architect.ts` | YES |
| `agents/component-recommender.ts` | YES |
| `agents/structure-optimizer.ts` | YES |
| `agents/devils-advocate.ts` | YES |
| `agents/rubric-grader.ts` | YES |
| `agents/framework/types.ts` | YES |
| `agents/framework/registry.ts` | YES |
| `agents/framework/executor.ts` | YES |
| `ideation/loop-engine.ts` | YES |
| `ideation/phase-manager.ts` | YES |
| `ideation/conversation-manager.ts` | YES |
| `ideation/cost-guard.ts` | YES |
| `ideation/materializer.ts` | YES |
| `production/handoff.ts` | YES |
| `production/cost-estimator.ts` | YES |

**Zero missing. Zero extra files.**

**B.4: All 6 required subdirectories exist:**
- `agents/` — YES
- `agents/framework/` — YES
- `rubrics/` — YES
- `tree/` — YES
- `ideation/` — YES
- `production/` — YES

---

### C. Import Path Verification — PASS

| Check | Result |
|---|---|
| `grep -r "lib/project-component" src/` | **ZERO hits** |
| `grep -r "lib/project-component" tests/` | **ZERO hits** |
| `grep -r "lib/project-component" scripts/` | **ZERO hits** |
| `grep -r "@/lib/project-component" src/` | **ZERO hits** |

**No stale import references. Zero blockers.**

---

### D. Barrel Import Verification — PASS

**`index.ts`** — 10 re-export groups, all pointing to valid relative paths:
- `./types` → `types.ts` exists
- `./archetypes` → `archetypes.ts` exists
- `./component-registry` → `component-registry.ts` exists
- `./compatibility` → `compatibility.ts` exists
- `./workflow-defaults` → `workflow-defaults.ts` exists
- `./rubrics/structure-rubric` → `rubrics/structure-rubric.ts` exists
- `./tree/tree-utils` → `tree/tree-utils.ts` exists
- `./tree/tree-validator` → `tree/tree-validator.ts` exists
- `./tree/tree-serializer` → `tree/tree-serializer.ts` exists
- `./production/cost-estimator` → `production/cost-estimator.ts` exists
- `./ideation/phase-manager` → `ideation/phase-manager.ts` exists

**`server.ts`** — 3 re-export groups, all pointing to valid relative paths:
- `./production/handoff` → `production/handoff.ts` exists
- `./ideation/loop-engine` → `ideation/loop-engine.ts` exists
- `./ideation/conversation-manager` → `ideation/conversation-manager.ts` exists

**`npm run typecheck`** — **Clean, zero errors.**

---

### E. Full Test Suite — PASS

```
Test Files  17 passed (17)
     Tests  385 passed (385)
  Duration  813ms
```

**385/385 tests pass. Zero failures. Zero skipped.**

---

### F. Build Verification — PASS

```
✓ Compiled successfully in 1197ms
✓ Generating static pages (12/12)
```

- **12 static pages**, **29 routes** (21 dynamic API + 8 page routes)
- Build output clean, no warnings

---

### G. Cross-Reference Check — PASS

**5 API routes verified (sampled):**

| Route | Imports From | Valid? |
|---|---|---|
| `api/archetypes/route.ts` | `@/lib/domain/workflows/archetypes` | YES |
| `api/component-registry/route.ts` | `@/lib/domain/workflows/component-registry`, `compatibility`, `types` | YES |
| `api/blueprints/[id]/ideation/start/route.ts` | `@/lib/domain/workflows/ideation/conversation-manager`, `phase-manager`, `loop-engine`, `cost-guard` | YES |
| `api/blueprints/[id]/ideation/grade/route.ts` | `@/lib/domain/workflows/ideation/*`, `types` | YES |
| `api/blueprints/[id]/ideation/ask/route.ts` | `@/lib/domain/workflows/agents/framework/executor`, `cost-guard` | YES |

**5 test files verified (sampled):**

| Test File | Imports From | Valid? |
|---|---|---|
| `stage02-agents.test.ts` | `../../src/lib/domain/workflows/types`, `agents/framework/registry` | YES |
| `agent-framework.test.ts` | `../../src/lib/domain/workflows/agents/framework/types`, `registry` | YES |
| `loop-engine.test.ts` | `../../src/lib/domain/workflows/ideation/*`, `agents/*` (8 agents) | YES |
| `tree-utils.test.ts` | `../../src/lib/domain/workflows/tree/tree-utils`, `types` | YES |
| `handoff.test.ts` | `../../src/lib/domain/workflows/production/handoff`, `cost-estimator`, `component-registry` | YES |

**3 UI components verified (sampled):**

| Component | Imports From | Valid? |
|---|---|---|
| `canvas/node-detail.tsx` | `@/lib/domain/workflows` (barrel) | YES |
| `wizard/wizard-step-review.tsx` | `@/lib/domain/workflows` (barrel) | YES |
| `chat/chat-message.tsx` | `@/lib/domain/workflows` (barrel) | YES |

---

### H. Senior Review Warnings — MIXED

| # | Warning | Status | Details |
|---|---|---|---|
| W1 | Anthropic SDK security advisory | **INFO** | `package.json` still shows `^0.80.0`, installed version is `0.80.0`. `npm audit fix` (without `--force`) did NOT update this. The fix requires `--force` due to breaking changes. The todo item 8.1 note about "updated to 0.87.0" appears inaccurate — the SDK was NOT actually updated. 4 moderate vulnerabilities remain. **Not a blocker for LE-1** but should be addressed before any production deployment. |
| W2 | vite + defu HIGH vulnerabilities | **PASS** | Resolved. `npm audit` now shows only 4 moderate issues (SDK + hono). The 2 HIGH severity (vite path traversal, defu prototype pollution) no longer appear. |
| W3 | `/versions/[version]/restore` missing Zod | **INFO** | Still present — no Zod/safeParse in the restore route. Deferred to LE-8 as planned. Not blocking. |
| W4 | package.json scripts referencing old paths | **PASS** | Scripts reference filenames (`seed-project-component.ts`, `test-e2e-project-component.ts`), not lib paths. These are script filenames that were NOT renamed (per plan: "Script filenames — stay"). No stale lib path references in package.json. |

---

### I. Git State — PASS

**Status:** Clean working tree (only `tasks/todo.md` modified — expected).

**Recent commits:**
```
b087f41 refactor(LE-0): move project-component to domain/workflows — 29 files, ~122 import updates
1b2e56b chore: senior engineer review — pre-LE-0 sign-off
19324f9 docs: align all architecture docs - 5 review actions, four-system core/domain split
```

**Tags:**
```
LE-0-folder-restructure  (points to b087f41)
```

**Diff vs main:** 96 files changed, 2619 insertions, 984 deletions.

**Branch:** `feature/loop-engine-v2`, up to date with `origin/feature/loop-engine-v2`.

---

### J. Readiness for LE-1 — PASS

| Check | Result |
|---|---|
| `src/lib/core/` does NOT exist | Confirmed — "No such file or directory" |
| `src/lib/core/engine/` does NOT exist | Confirmed |
| `domain/workflows/` barrel exports work | Confirmed (typecheck clean) |
| All 385 tests pass | Confirmed |
| Build succeeds | Confirmed |
| Zero stale `lib/project-component` references | Confirmed |

---

### Remaining Concerns

1. **[INFO] Anthropic SDK still at 0.80.0** — Todo item 8.1 claims `npm audit fix` updated it to 0.87.0, but this did not actually happen (requires `--force`). The SDK has a moderate security advisory (GHSA-5474-4w2j-mq4c). Not blocking LE-1, but the todo record is inaccurate on this point.
2. **[INFO] 4 moderate npm vulnerabilities remain** — SDK sandbox escape + hono middleware bypass. Both require `--force` to fix (breaking changes). Acceptable for development; address before production.
3. **[INFO] `/versions/[version]/restore` still lacks Zod validation** — Deferred to LE-8 as planned.

---

### Summary

| Section | Result |
|---|---|
| A. Checklist Completion | **PASS** — 68/68 items complete across 11 phases |
| B. File Structure | **PASS** — 29/29 files, 6/6 subdirs, old dir removed |
| C. Import Paths | **PASS** — Zero stale references |
| D. Barrel Imports | **PASS** — All re-exports resolve, typecheck clean |
| E. Test Suite | **PASS** — 385/385 pass |
| F. Build | **PASS** — 12 pages, 29 routes |
| G. Cross-References | **PASS** — 13/13 sampled imports correct |
| H. Warnings | **MIXED** — W2/W4 fixed; W1 SDK not actually updated (INFO); W3 deferred (INFO) |
| I. Git State | **PASS** — Clean, tagged, pushed |
| J. LE-1 Readiness | **PASS** — core/ absent, all foundations solid |

---

# LE-0 VERIFIED — Ready for LE-1

**Sign-off by:** Claude (Senior Engineer)
**Date:** 2026-04-10
