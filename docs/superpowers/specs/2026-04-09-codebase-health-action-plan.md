# Codebase Health Action Plan

> Comprehensive remediation plan based on a 5-agent parallel audit of the VOVAI eLearn AIOS codebase.
> Created: 2026-04-09 | Branch: feature/ux-v2-conversational

---

## Context

A full codebase audit identified ~55 issues across architecture, API, database, frontend, testing, and configuration. Phase 0 (ideation) is substantially complete and well-tested. The primary gaps are: the stub production engine, architecture rule compliance, dev hygiene, and security.

## Audit Summary

| Category | P0 (Bugs) | P1 (Critical) | P2 (Important) | P3 (Minor) |
|----------|-----------|---------------|----------------|------------|
| Engine / Architecture | 1 | 4 | 3 | 2 |
| Pipeline Implementation | - | 3 | 2 | 1 |
| API Routes | - | 3 | 4 | 3 |
| Database / Schema | - | 2 | 3 | 2 |
| Frontend / UI | 1 | 3 | 6 | 4 |
| Tests | 1 | 2 | 2 | - |
| Config / Dependencies | - | 2 | 3 | 2 |
| Security | - | 2 | 1 | - |
| **Total** | **3** | **21** | **24** | **14** |

---

## Phase 1: Immediate Fixes (P0)

> Fix active bugs and broken CI. Do today.

### 1.1 Fix 2 failing tests in loop-engine.test.ts

**Problem:** Tests expect old behavior where audience analyst and curriculum strategist run in parallel. The implementation now runs them sequentially with an audience confirmation step in between.

**Fix:**
- Update test "runs audience analyst and curriculum strategist in parallel" to test the two-step flow: first call returns audience profile with `awaitingHuman: true`, second call (after confirmation) runs curriculum strategist
- Update test "does not advance if curriculum strategist fails" to first confirm audience, then test curriculum failure

**File:** `tests/unit/loop-engine.test.ts` (lines 270-307)

### 1.2 Fix dashboard fake data

**Problem:** `/dashboard` page renders hardcoded `sampleProjects` with fake IDs (`proj-001`, `proj-002`). Links 404.

**Fix:** Replace with `useApi<Project[]>('/api/projects')` — same pattern used in `RecentProjectsList.tsx`.

**File:** `src/app/(pages)/dashboard/page.tsx` (lines 7-41)

### 1.3 Fix awaitingAudienceConfirmation hardcoded false

**Problem:** Line 381 passes `awaitingAudienceConfirmation={false}` ignoring the backend's real value.

**Fix:** Derive from messages data (check latest message's `structuredData.awaitingAudienceConfirmation`) or add to blueprint API response.

**File:** `src/app/(pages)/project/[id]/ideation/page.tsx` (line 381)

---

## Phase 2: Dev Hygiene (P1)

> Low-risk, high-value cleanup. This week.

### 2.1 Move test deps to devDependencies

Move from `dependencies` to `devDependencies`:
- `jsdom`
- `vitest`
- `@vitejs/plugin-react`
- `@testing-library/react`
- `@testing-library/jest-dom`

**File:** `package.json`

### 2.2 Fix vitest config

- Remove `passWithNoTests: true` (silent CI failures)
- Add `@vitest/coverage-v8` and coverage config targeting 80% engine / 60% UI

**File:** `vitest.config.ts`, `package.json`

### 2.3 Fix tsconfig target

Change `"target": "ES2017"` to `"target": "ES2022"`. Required for `AsyncGenerator` in engine.ts.

**File:** `tsconfig.json`

### 2.4 Remove unused dependency

`@base-ui/react` — no imports found in src/.

**File:** `package.json`

### 2.5 Delete dead code

- `src/components/project/version-a.tsx` — never imported
- `src/components/project/version-b.tsx` — never imported
- `src/components/project/version-c.tsx` — never imported

### 2.6 Extract duplicated constants

Create `src/lib/project-component/ui-constants.ts`:
- `PHASE_COLORS` (from agent-sidebar.tsx + project-top-bar.tsx)
- `scoreColor` / `barColor` (from artifact-panel.tsx + grade-report-modal.tsx)
- `STATUS_STYLES` (from tree-view.tsx + node-detail.tsx)

Update 6 importing files.

### 2.7 Add missing DB indexes

```prisma
model Artifact {
  // ... existing fields ...
  @@index([stageSessionId])
}

model IterationRecord {
  // ... existing fields ...
  @@index([stageSessionId])
}

model StageSession {
  // ... existing fields ...
  @@index([projectId])
}

// Also add version uniqueness:
model Artifact {
  @@unique([stageSessionId, version])
}
```

**File:** `prisma/schema.prisma`

---

## Phase 3: API & Data Layer Hardening (P1-P2)

> Next 1-2 weeks. Stabilize the API contracts.

### 3.1 Standardize API response envelope

Create `src/lib/api-response.ts` with `apiSuccess(data)` and `apiError(message, status)` helpers returning `{ success, data, error }`. Migrate all 20+ routes.

### 3.2 Fix N+1 in messages endpoint

Replace per-conversation `getMessages(convo.id)` loop with single query:
```typescript
db.ideationMessage.findMany({
  where: { conversationId: { in: conversationIds } },
  orderBy: { createdAt: 'asc' },
})
```

**File:** `src/app/api/blueprints/[blueprintId]/ideation/messages/route.ts`

### 3.3 Add phase guard to materialize endpoint

Check `blueprint.ideationPhase === 'approved'` before materializing. Return 409 otherwise.

**File:** `src/app/api/blueprints/[blueprintId]/materialize/route.ts`

### 3.4 Fix double cost-guard bypass in grade route

Add `checkCostLimit()` before the second `runIdeationStep` auto-continuation.

**File:** `src/app/api/blueprints/[blueprintId]/ideation/grade/route.ts`

### 3.5 Consolidate state rebuilder

Three separate implementations exist. Consolidate into `state-rebuilder.ts` and have `grade/route.ts` and `approve/route.ts` import from it.

### 3.6 Add Zod validation to projects/[projectId] PATCH

Only route using raw `body as {...}` cast.

**File:** `src/app/api/projects/[projectId]/route.ts`

### 3.7 Fix grades route null response

Return 404 with `{ error: 'No grades yet' }` instead of `NextResponse.json(null)`.

**File:** `src/app/api/blueprints/[blueprintId]/grades/route.ts`

### 3.8 Trim internal state from API responses

Stop returning full `IdeationLoopState` in approve/message/start responses. Return only: `{ phase, score, message, costUSD }`.

### 3.9 Persist Phase 0 costs to database

Write `IterationRecord` entries for ideation agent calls. Update `Project.totalCostUSD` after each step. The cost data exists in `AgentResult` — it just never reaches the DB.

---

## Phase 4: Architecture Rule Compliance (P2)

> Next 2-4 weeks. Enforce documented architecture rules.

### 4.1 Enforce minimum 2 iterations

Read `minIterations` from config. If `score >= threshold` but `loopCount < minIterations`, stay in refinement.

**File:** `src/lib/project-component/ideation/loop-engine.ts`

### 4.2 Track best version across iterations

After each refinement, compare `gradeReport.overallScore` to previous best. Persist `bestGrade` on blueprint or session.

### 4.3 Implement dimension-aware revision

When constructing refinement prompt: "Preserve: [dims >= 8]. Improve: [dims < 8] with specific feedback."

### 4.4 Clear human feedback after one iteration

After feedback is applied to one iteration, remove from state. Prevents over-optimization.

### 4.5 Add deterministic pre-validators

Before LLM rubric grader, run: >= 1 module, each module >= 1 topic, no empty descriptions, word counts within bounds.

**New file:** `src/lib/project-component/ideation/pre-validators.ts`

### 4.6 Decouple loop-engine from eLearning agents

Refactor to receive agent runner functions via config object instead of direct imports. Makes engine reusable for Film AIOS / Creator AIOS.

### 4.7 Move pipeline.ts stage definitions to config

Move 16-stage video pipeline from `src/lib/pipeline.ts` to config. Reconcile with `config/pipelines/elearn-aios-pipeline.json` (fix V8 dependency disagreement: V7 vs V3).

### 4.8 Implement event bus foundation

Simple in-process event emitter. Emit on: phase transitions, artifact creation, grade completion, review actions.

**New file:** `src/lib/events.ts`

---

## Phase 5: Frontend Polish (P2-P3)

> Parallel with Phase 3-4.

### 5.1 Replace window.confirm with AlertDialog

Two instances: `ideation/page.tsx:396` and `project/[id]/page.tsx:98`.

### 5.2 Add error state to GradePanel

Destructure and render `error` from `useApi` in `artifact-panel.tsx`.

### 5.3 Fix landing page design tokens

Replace hardcoded `bg-gray-950`, `text-white` with `bg-background`, `text-foreground`.

### 5.4 Add React error boundary

New file: `src/components/error-boundary.tsx`. Wrap app in `layout.tsx`.

### 5.5 Accessibility fixes

- Tree node rows: `role="treeitem"`, `tabIndex={0}`, keyboard handler
- ActivityCard expand: `aria-expanded`
- PcNav disabled tabs: `aria-disabled="true"`, use `<button disabled>`

### 5.6 Fix useEffect dependency

Destructure `startIdeation` from `ideation` before the dependency array in `use-project-page.ts:211`.

---

## Phase 6: Production Engine (P1 — when ready)

> The big one. Deferred until Phase 0 is solid.

### 6.1 Implement engine.ts core functions

- `produce()` — call configured agent, return Artifact
- `evaluate()` — call judge model (cross-model), return Grade
- `runLoop()` — full cycle with all rules enforced
- `processReview()` — all 5 human review actions

### 6.2 Define missing pipeline stages

Stage definitions for: Document (D1-D5), Assessment (A1-A6), Activity (T1-T5), Capstone (C1-C4), Meta. Reconcile with handoff phantom stage IDs (100, 200, 400, 500, 600).

### 6.3 Create missing agent configs + rubrics

YAML configs for all 10+ agents in elearn-aios-pipeline.json. Production rubrics per stage type.

### 6.4 Install missing dependencies

- `yaml` / `js-yaml` for agent YAML config loading
- `redis` / `ioredis` when queue processing is needed

### 6.5 Build cross-phase content referencing

Pass completed artifacts from earlier phases as context to later phase agents.

### 6.6 Add authentication (Ring 5)

Address all `TODO(Ring-5)` comments. Integrate Clerk auth middleware across all routes.

---

## Dependency Graph

```
Phase 1 (immediate) ──── no deps
    │
Phase 2 (hygiene) ────── no deps, parallel with Phase 1
    │
Phase 3 (API) ────────── after Phase 1 (tests passing)
    │
Phase 4 (architecture) ─ after Phase 3 (state rebuilder consolidated)
    │               │
Phase 5 (frontend) ───── parallel with Phase 3 & 4
    │
Phase 6 (engine) ─────── after Phase 4 (event bus, decoupled engine)
```

## Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1 | ~1 hour | Low |
| Phase 2 | ~3 hours | Low |
| Phase 3 | ~2 days | Medium |
| Phase 4 | ~1 week | Medium |
| Phase 5 | ~1 day | Low |
| Phase 6 | ~2-4 weeks | High |
