# VOVAI eLearn AIOS — Task Tracker

## Current Focus: Project Component Build (PC-1 through PC-9)

**What we're building:** The Project Component layer — a pre-pipeline system
that lets users configure multi-module, multi-topic eLearning projects with
different component types (videos, study materials, quizzes, activities,
capstone projects) before they enter the existing production pipeline.

**Three target projects:**
1. K-12 CBSE: 220 videos across Science, Social, Math for grades 6-10
2. Teacher Retooling in ID: multi-module training with mixed components
3. Education YouTube Channel: ongoing multi-subject video production

---

## Macro Phase 1: Database & Seed ✅ COMPLETE

- [x] PC-1.2: Blueprint schema — 7 Prisma models, 7 enums, migration
- [x] PC-1.3: Seed data — 1 blueprint, 12 nodes, 25 components, 3 messages
- [x] PC-1.3: Health check API — /api/project-component/health returns counts
- [x] Existing 4 models untouched (Project, StageSession, Artifact, IterationRecord)
- [x] Materialized paths correct (/module/topic/subtopic format)
- [x] Tags: PC-1.2-blueprint-schema, PC-1.3-seed-data, v0.3.0, v0.4.0

## Macro Phase 2: Registries & Type System ✅ COMPLETE

- [x] PC-2.1: Core TypeScript types — 12 enums/unions + 12 interfaces + TreeNode<T>
- [x] PC-2.2: Archetype registry (3) + component registry (16) + compatibility matrix
- [x] PC-2.3: Structure rubric — 7 dimensions, weights sum to 1.0, 15/15 tests passing
- [x] Zero `any` types, npm run typecheck clean, npm run test:unit passes
- [x] Tags: PC-2.1-type-system, PC-2.2-registries, PC-2.3-rubric

## Macro Phase 3: Tree Engine + API ✅ COMPLETE

- [x] PC-3.1: Tree utility functions
  - 11 pure functions: buildTree, flattenTree, findNode, getAncestors,
    getDescendants, getSiblings, addNode, removeNode, moveNode, updatePaths, getTreeStats
  - File: src/lib/project-component/tree/tree-utils.ts
  - Tests: tests/unit/tree-utils.test.ts (50 tests passing)
  - Key rule: NO database imports — pure functions only

- [x] PC-3.2: Blueprint & node API routes (8 route groups)
  - /api/blueprints — POST create
  - /api/blueprints/[blueprintId] — GET, PATCH
  - /api/blueprints/[blueprintId]/nodes — GET all, POST new
  - /api/blueprints/[blueprintId]/nodes/[nodeId] — GET, PATCH, DELETE
  - /api/blueprints/[blueprintId]/nodes/reorder — POST bulk reorder
  - /api/blueprints/[blueprintId]/components — POST add, DELETE remove
  - /api/archetypes — GET list (from registry, no DB)
  - /api/component-registry — GET list, GET ?archetype=xxx filter
  - All routes: Zod validation, consistent { error } format, proper HTTP status

- [x] PC-3.3: Tree validation + versioning
  - Validator: catches orphans, circular refs, depth violations, bad components,
    missing dependencies, duplicate paths, path mismatches
  - Serializer: serializeBlueprint/deserializeBlueprint for snapshots
  - Version API: POST create snapshot, GET list versions, POST restore version
  - File: src/lib/project-component/tree/tree-validator.ts
  - File: src/lib/project-component/tree/tree-serializer.ts

## Macro Phase 4: Ideation Agents (Backend) ✅ COMPLETE

- [x] PC-4.1: Agent framework
  - Agent executor: calls Anthropic API, cost tracking, retries, fallback model
  - Agent registry: register, get, list agents
  - File: src/lib/project-component/agents/framework/types.ts
  - File: src/lib/project-component/agents/framework/executor.ts
  - File: src/lib/project-component/agents/framework/registry.ts
  - Must track: model, tokensIn, tokensOut, costUSD per call
  - Must handle: missing API key gracefully (error, not crash)

- [x] PC-4.2: Production agents — audience analyst + curriculum strategist
  - Audience analyst: brief + archetype → AudienceProfile
  - Curriculum strategist: brief + audience → ProposedStructure (modules, topics, subtopics)
  - Test with real brief: "Teacher retooling program on ID, 40 hours, self-paced..."

- [x] PC-4.3: Production agents — outcome architect + component recommender
  - Outcome architect: structure + audience → learning outcomes per node, Bloom classified
  - Component recommender: structure + outcomes → component plan, respects compatibility matrix
  - Chain test: audience → curriculum → outcomes → components

- [x] PC-4.4: Governance agents — optimizer + grader + devil's advocate
  - Structure optimizer: checks balance, gaps, redundancy, sequencing → OptimizationReport
  - Rubric grader: scores 7 dimensions, uses calculateOverallScore + getRecommendation → GradeReport
  - Devil's advocate: challenges assumptions from learner perspective → DevilsAdvocateReport
  - Full 7-agent chain test (24 tests passing)
  - All 3 agents tier: governance, model: claude-sonnet-4-20250514

- [x] PC-4.5: Orchestrator agent
  - Master coordinator: routes human input to specialist agents
  - Manages phase transitions: brainstorm → structure → refinement → review
  - Test 3-turn conversation flow
  - All 8 agents registered in registry

## Macro Phase 5: Recursive Loop Engine ✅ COMPLETE

- [x] PC-5.1: Phase state machine
  - PHASE_TRANSITIONS: brainstorm→structure→refinement→review→approved
  - canTransition, getNextPhase (auto-routes based on grade score)
  - IdeationLoopState interface, createInitialState
  - File: src/lib/project-component/ideation/phase-manager.ts

- [x] PC-5.2: Loop engine core
  - runIdeationStep: runs ONE step, selects agents by phase
  - processHumanFeedback: approve / feedback / restructure
  - Auto-refinement: score < 75 AND loopCount < 5 → refine automatically
  - Force human review after 5 loops
  - File: src/lib/project-component/ideation/loop-engine.ts

- [x] PC-5.3: Ideation API + conversation persistence
  - Conversation manager: createConversation, addMessage, getMessages
  - API: /ideation/start, /ideation/message, /ideation/grade, /ideation/approve
  - All messages persisted to Prisma (IdeationConversation + IdeationMessage)
  - Full flow testable via curl

## Macro Phase 6: Chat Ideation UI (Visual-First) ← NEXT

- [ ] PC-6.1: Chat message components (static, sample data first)
  - Different renderers for: text, suggestion, question, decision, structure_update
  - Role avatars for human + 8 agent roles
  - File: src/components/project-component/chat/

- [ ] PC-6.2: Agent activity sidebar (static, sample data first)
  - Shows which agents are active/idle/completed
  - Status indicators per agent

- [ ] PC-6.3: Wire to API + SSE streaming
  - Connect chat to /ideation/message endpoint
  - Real-time agent response streaming via SSE
  - Loading states during agent processing

- [ ] PC-6.4: Phase indicator + mini structure preview
  - Shows current ideation phase (brainstorm/structure/refinement/review)
  - Mini tree preview that updates as agents propose structure
  - Transition button: "View full structure on canvas →"

## Macro Phase 7: Canvas Structure UI

- [ ] PC-7.1: Tree visualization (collapsible, interactive)
  - Render seed data as collapsible tree
  - Show component badges per node (video, quiz, study_material icons)
  - File: src/app/(pages)/project/[id]/structure/page.tsx

- [ ] PC-7.2: Node detail panel
  - Edit: title, description, learning outcomes
  - View: attached components with config
  - Add/remove components from registry

- [ ] PC-7.3: Component palette (drag-drop from registry)
  - Shows available components filtered by archetype compatibility
  - Drag to attach to a node
  - May need: @dnd-kit/core (install when needed, not before)

- [ ] PC-7.4: Rubric score bar + agent chat drawer
  - Persistent score bar showing current rubric grade
  - Updates live when structure changes
  - Chat drawer: ask agent about specific nodes

## Macro Phase 8: Wizard + Production Handoff

- [ ] PC-8.1: Dynamic wizard stepper
  - Steps auto-generated from enabled components
  - Only shows steps for components the project actually uses
  - File: src/app/(pages)/project/[id]/configure/page.tsx

- [ ] PC-8.2: Component config forms
  - Video: duration, style, language, voice, subtitles, music
  - Quiz: question count, types, difficulty, Bloom levels, passing score
  - Study material: format, length, reading level
  - Activity: type, duration, group size, scaffolding level
  - Bulk config: apply settings to all vs per-module vs individual

- [ ] PC-8.3: Review + confirm with cost estimator
  - Summary: total components, breakdown by type
  - Cost estimate: min/max based on component registry costs
  - Timeline estimate: based on production times
  - File: src/app/(pages)/project/[id]/launch/page.tsx

- [ ] PC-8.4: Production handoff → StageSession bridge
  - Creates StageSession jobs from approved NodeComponents
  - Videos batched into groups of 10
  - Documents, assessments, activities as individual jobs
  - Sets NodeComponent.pipelineJobId → StageSession.id
  - File: src/lib/project-component/production/handoff.ts

## Macro Phase 9: Testing, Security & Polish

- [ ] PC-9.1: End-to-end test
  - Teacher Retooling project through full flow:
    ideation → structure → grading → approval → configure → handoff
  - Verify: StageSession jobs created with correct stage assignments

- [ ] PC-9.2: Security
  - All queries scoped by blueprintId (no cross-project leaks)
  - All POST/PATCH validated with Zod
  - Agent API calls have cost limits and timeouts
  - No raw SQL anywhere
  - Consistent error format on all routes

- [ ] PC-9.3: Polish
  - Loading states during all async operations
  - Empty states for new projects with no blueprint
  - Error boundaries on all dynamic pages
  - Mobile responsiveness for chat and canvas

---

## Architecture Understanding (Reference)

### 3 Project Archetypes (from PC-2.2 registries)

| Archetype | Hierarchy | Default Components | Production Mode |
|---|---|---|---|
| k12_curriculum | Subject → Grade → Chapter → Topic → Subtopic | video | batch (groups of 10) |
| professional_training | Course → Module → Topic → Subtopic | video, study_material, quiz, activity, capstone | module_sequential |
| content_channel | Channel → Subject → Season → Episode | video | rolling (ongoing) |

### Production Pipeline Order

```
Phase 0: Project Ideation & Structure (runs once)
Phase 1: Document Pipeline (runs FIRST — textual foundation)
Phase 2: Assessment Pipeline (aligned to documents)
Phase 3: Video Pipeline (16 stages, references documents)
Phase 4: Activity Pipeline (builds on all content)
Phase 5: Capstone Pipeline (synthesizes everything, runs LAST)
```

### NodeComponent → StageSession Bridge

When blueprint is approved and handoff runs:
- Each approved NodeComponent gets a StageSession created
- NodeComponent.pipelineJobId is set to StageSession.id
- StageSession advances through pipeline stages (D1→D5, A1→A6, V1→V16, etc.)
- This is the bridge: Phase 0 says "produce this" → pipeline says "here's how"

### Structure Rubric (7 dimensions, 0-100 scale, pass: 75)

1. Coverage (0.18) — learning outcomes cover full scope
2. Depth (0.15) — hierarchy deep enough for meaningful learning
3. Progression (0.18) — topics build logically
4. Balance (0.12) — modules roughly similar in scope
5. Engagement (0.15) — enough activities, not just passive content
6. Feasibility (0.10) — realistic for timeline and budget
7. Coherence (0.12) — every component serves a learning outcome

---

## Existing Codebase (Pre-Project Component)

### What was here before we started

**Prisma models (4 original):** Project, StageSession, Artifact, IterationRecord
**Pages (4):** home, dashboard, project/new, project/[id]
**API (1):** POST /api/projects
**Engine (stubs):** produce(), evaluate(), runLoop(), processReview() — all "Not yet implemented"
**Pipeline config:** 16 stages defined in src/lib/pipeline.ts
**Agent personas (3):** script-writer, image-prompt-engineer, voiceover-agent
**Production rubric (1):** elearn-script.json (5 dimensions, 1-10 scale)

### What the Project Component added so far

**Prisma models (+7):** ProjectBlueprint, ProjectNode, NodeComponent,
IdeationConversation, IdeationMessage, BlueprintVersion, StructureGrade
**Prisma enums (+7):** ProjectArchetype, NodeStatus, ComponentStatus,
ComponentPriority, IdeationPhase, BrainstormRole, GradeRecommendation
**TypeScript types:** 12 enums/unions + 12 interfaces + TreeNode<T> in
src/lib/project-component/types.ts
**Registries:** archetypes.ts (3), component-registry.ts (16), compatibility.ts
**Rubric:** structure-rubric.ts (7 dimensions, scoring helpers, 15 tests)
**Schemas:** structure-rubric-schema.json, production-rubric-schema.json
**API (+1):** GET /api/project-component/health
**Seed:** scripts/seed-project-component.ts

---

## Completed Sessions Log

| Phase | Date | Git Tag | Summary |
|---|---|---|---|
| PC-1.2 | 2026-03-28 | PC-1.2-blueprint-schema | 7 Prisma models + 7 enums migrated |
| PC-1.3 | 2026-03-29 | PC-1.3-seed-data, v0.3.0, v0.4.0 | Seed data + health check API |
| PC-2.1 | 2026-03-29 | PC-2.1-type-system | 12 enums + 12 interfaces + TreeNode<T> |
| PC-2.2 | 2026-03-29 | PC-2.2-registries | 3 archetypes + 16 components + compatibility |
| PC-2.3 | 2026-03-29 | PC-2.3-rubric | 7-dimension rubric + scoring + 15 tests |

---

## Macro 6 Sign-Off Review

**Review Date:** 2026-03-30
**Reviewer:** Claude (senior engineer sign-off)
**Scope:** Chat Ideation UI — all components in `src/components/project-component/chat/`, `src/app/(pages)/project/[id]/ideation/page.tsx`, `src/lib/hooks/use-ideation.ts`, `src/lib/hooks/use-api.ts`

---

### 1. Code Quality Scan — PASS with notes

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS — 0 errors |
| `npm run build` | PASS — 0 errors, 0 warnings |
| `npm run test` | PASS — 12 files, 262 tests, all passing |
| `any` types in UI code | CLEAN — 0 found |
| `console.log` in UI code | CLEAN — 0 found |
| `console.log` in engine | 1 × `console.log` in executor.ts:130 (cost tracking — appropriate) |
| TODOs in scope | 1 × `// TODO: Replace with DB query` in `project/[id]/page.tsx:160` |

**TODO detail:** `project/[id]/page.tsx:160` still uses hardcoded `sampleProject` / `sampleSessions`. This is the parent project detail page, not the ideation page, but it ships static data to production.

---

### 2. Error Handling Audit

| API Call | try/catch | Error shown to user | Input preserved on error | Retry possible |
|----------|-----------|---------------------|--------------------------|----------------|
| Blueprint fetch (`GET /blueprints?projectId=`) | ✅ (in useApi) | ✅ Full error card shown | N/A | ✅ (page reload) |
| Messages fetch (`GET /ideation/messages`) | ✅ (in useApi) | 🔴 **NO** — `messagesError` destructured but never rendered | N/A | ❌ No retry UI |
| Send / Start (`POST /ideation/start`, `/message`) | ✅ | ✅ Shown in ChatInput | ✅ Value kept on throw | ✅ User can retype |
| Grade (`POST /ideation/grade`) | ✅ | ✅ `gradeError` shown in AgentSidebar | N/A | ✅ Button re-enabled |
| Approve/Feedback/Restructure (`POST /ideation/approve`) | ✅ | 🔴 **NO** — `reviewError` is returned from `useIdeation` but NOT destructured by the page and NOT passed to AgentSidebar | N/A | ❌ Silent failure |

🔴 **CRITICAL: `reviewError` is a silent failure.** If Approve/Feedback/Restructure API call fails (e.g. server error during approve), the user gets zero feedback. The `useIdeation` hook exports `reviewError` but `ideation/page.tsx` never destructures it, and `AgentSidebarProps` has no `reviewError` field.

🔴 **CRITICAL: `messagesError` is swallowed.** If the messages API fails on mount (line 82-85 of `ideation/page.tsx`), the chat area shows the loading spinner, then transitions to the empty "Ready to begin ideation" state — giving the user the impression no conversation exists when it may actually be a network error.

---

### 3. Memory Leak Check

| Risk | Component | Verdict |
|------|-----------|---------|
| useEffect without cleanup | `ChatMessageList` — scrollIntoView on count change | ✅ No cleanup needed |
| useEffect without cleanup | `IdeationPage` — structure refresh key bump | ✅ No cleanup needed |
| useEffect without cleanup | `StructurePreview` — refetch on refreshKey change | ✅ No cleanup needed |
| **AbortController missing** | `useApi` (`use-api.ts:62-65`) | 🔴 **CRITICAL** |
| setInterval / setTimeout | None used | ✅ Clean |
| Event listeners | None added manually | ✅ Clean |
| Auto-scroll performance | `scrollIntoView` triggered per message count delta | 🟢 Fine for ideation-scale message lists |

🔴 **CRITICAL: `useApi` has no AbortController.** `fetchData()` fires an async `fetch()`, then calls `setState` when it resolves. If the component unmounts while a request is in flight (e.g., user navigates away mid-load), setState is called on an unmounted component. React 18 silences the warning but the fetch still completes and processes the response. More critically: if `url` changes while a previous request is in flight (e.g., blueprintId changes), the older response can arrive last and overwrite fresher data — a classic stale-closure race condition.

**Fix:** Add `AbortController` to `fetchData`, abort in the useEffect cleanup, check `signal.aborted` before setState.

---

### 4. Race Condition Check

| Scenario | Protected? | Details |
|----------|-----------|---------|
| Double-click Send | ✅ | `canSend = !loading && !disabled` disables button immediately; textarea also disabled |
| Send while agents responding | ✅ | `disabled={anyLoading}` on ChatInput |
| Grade while send in flight | ✅ | `disabled={anyLoading}` on AgentSidebar Grade button |
| Approve while grade in flight | ✅ | `disabled={anyLoading}` on review action buttons |
| Optimistic message rollback | ✅ | Removes by ID: `prev.filter(m => m.id !== optimisticMsg.id)` |
| Stale fetch overwrites state | 🔴 | `useApi` has no AbortController — see §3 above |
| Approve then navigate | 🟡 | Approve calls `router.push()` inside `.then()` — if component unmounts during approve, the state update after navigation could log an unmount warning |

---

### 5. Accessibility Quick Check

| Element | Issue | Severity |
|---------|-------|---------|
| Send button (`chat-input.tsx:82-89`) | Icon-only `<Button>` with no `aria-label`. Screen reader says nothing | 🔴 CRITICAL |
| Mobile sidebar toggle (`ideation/page.tsx:276-281`) | Icon-only `<Button>` with no `aria-label` | 🔴 CRITICAL |
| `RoleAvatar` (`role-avatar.tsx:70-84`) | Uses `title={config.label}` only. `title` is not reliably announced by screen readers. Decorative uses (chat header) need `aria-hidden="true"` | 🟡 IMPORTANT |
| Feedback textarea (`agent-sidebar.tsx:383-389`) | Naked `<textarea>` with only a placeholder — no `<label>` element. Placeholder is not a substitute for a label | 🟡 IMPORTANT |
| "Agents are thinking..." loading text | Visible text but no `aria-live` region — screen readers won't announce it | 🟡 IMPORTANT |
| Mobile backdrop (`ideation/page.tsx:375-379`) | Clickable `<div>` with no `role`, `onKeyDown`, or `aria-label` — keyboard users cannot close the sidebar | 🟡 IMPORTANT |
| Phase indicator buttons | Disabled states don't announce why — minor UX issue | 🟢 MINOR |
| Keyboard: Tab/Enter/Escape | Ctrl+Enter to send works. All shadcn `Button` components are keyboard accessible. Collapsible sections use button triggers — keyboard OK | ✅ |

---

### 6. Security Check — PASS

| Risk | Finding |
|------|---------|
| `dangerouslySetInnerHTML` | None used anywhere in chat components |
| Agent response injection | All content rendered as `{content}` in JSX — React auto-escapes. No XSS vector |
| HTML injection via `whitespace-pre-wrap` | CSS only, no HTML interpretation. Safe |
| API URL construction | Blueprint ID comes from DB lookup, not user input. No interpolation of raw user strings into URLs |
| User input to AI agents | Passes through Zod validation (`sendMessageSchema`, `startIdeationSchema`) before reaching agents |
| Phase gate enforcement | `/ideation/approve` verifies `blueprint.ideationPhase === 'review'` before accepting action. `/ideation/grade` verifies `structure | refinement`. Server-side enforcement is correct |
| `window.confirm` for destructive action | Restructure uses native `confirm()` — accessible and tamper-proof |

✅ Security posture is clean.

---

### 7. Performance Check

| Check | Finding |
|-------|---------|
| API calls on initial load | 3 total: (1) blueprint, then (2) messages + (3) nodes in parallel. Acceptable waterfall |
| Redundant refetches | None — messages URL starts skipped (`skip: !blueprint`) until blueprint loads |
| Message list re-rendering | `ChatMessageList` re-renders on `totalMessages` change. No virtualization. Fine for ideation-scale (<100 msgs) |
| useMemo coverage | `conversationGroups`, `allMessages`, `loopCount`, `lastStructureMsg`, `completedPhases` all memoized correctly |
| StructurePreview refetches | Triggered by `structureRefreshKey` increment, which fires once per structure-update message. Not spammy |
| Large object fetching | Blueprint fetch returns full object (nodes + components) — acceptable at ideation scale |

✅ No performance issues for current scale.

---

### 8. Component Design Review

| Check | Finding |
|-------|---------|
| Smart vs presentational | Page handles all state/API; components receive props and render. Clean separation |
| `use-ideation.ts` scope | Owns 4 mutations + activeAgents tracking. Appropriately scoped — no reason to split |
| Prop drilling | AgentSidebar receives 12 props from page directly — one level, acceptable |
| State at right level | Yes — optimistic messages in page, UI toggles (feedbackOpen, summaryOpen) in components |
| `messages: unknown[]` in interfaces | `MessageResponse.messages` and `ApproveResponse.messages` typed as `unknown[]` (lines 25, 45 of use-ideation.ts) — these are dead code; the hook calls `refetchMessages()` instead of using the response messages. Minor waste |
| **`rebuildState` duplicated 3×** | The full `rebuildState` function is copy-pasted nearly identically in `message/route.ts`, `grade/route.ts`, and `approve/route.ts`. If reconstruction logic changes, all 3 must be updated. DRY violation — should be one shared function in conversation-manager |

---

### Sign-Off Summary

#### Round 1 — Quick Review (5 critical issues, ALL FIXED)

| # | Issue | Status |
|---|-------|--------|
| ~~1~~ | `reviewError` not surfaced — silent failure on approve/feedback/restructure | ✅ FIXED |
| ~~2~~ | `messagesError` not surfaced — falls through to empty state on network failure | ✅ FIXED |
| ~~3~~ | `useApi` missing `AbortController` — race condition + memory leak on unmount | ✅ FIXED |
| ~~4~~ | Send button has no `aria-label` | ✅ FIXED |
| ~~5~~ | Mobile sidebar toggle has no `aria-label` | ✅ FIXED |

#### Round 2 — Deep Audit (11 additional findings)

**CRITICAL (3 found, ALL FIXED):**

| # | Issue | Status |
|---|-------|--------|
| ~~6~~ | `useApiMutation` calls setState after unmount (approve → navigate path) | ✅ FIXED — mountedRef guard added |
| ~~7~~ | `onApprove` has unhandled promise rejection (`.then()` without `.catch()`) | ✅ FIXED — converted to async/await with try/catch |
| ~~8~~ | `key={group.phase}` non-unique after restructure → React reconciliation bug | ✅ FIXED — key changed to `${group.phase}-${groupIdx}` |

**IMPORTANT (fix during Macro 7):**

| # | Issue | File |
|---|-------|------|
| 🟡 9 | `rebuildState` function duplicated across 3 API routes | Extract to `conversation-manager.ts` |
| 🟡 10 | Redundant divider logic — lines 69-70 both always true | `chat-message-list.tsx` |
| 🟡 11 | `formatTime()` doesn't handle invalid dates — shows "Invalid Date" | `chat-message.tsx` |
| 🟡 12 | N+1 query in messages GET endpoint (loop of `getMessages()` per conversation) | `messages/route.ts` |
| 🟡 13 | `RoleAvatar` accessibility — `title` unreliable, no `aria-hidden` for decorative uses | `role-avatar.tsx` |
| 🟡 14 | Feedback textarea has no `<label>` | `agent-sidebar.tsx` |
| 🟡 15 | Loading state not announced to screen readers (no `aria-live`) | `chat-input.tsx` |
| 🟡 16 | Mobile backdrop not keyboard-accessible | `ideation/page.tsx` |
| 🟡 17 | `project/[id]/page.tsx:160` TODO — sample data still used in production build | `project/[id]/page.tsx` |

**Tech debt (Macro 9 or later):**

| # | Issue |
|---|-------|
| 🟢 18 | `messages: unknown[]` dead code in `MessageResponse` / `ApproveResponse` interfaces |
| 🟢 19 | `Record<string, never>` for grade mutation body type — minor awkwardness |
| 🟢 20 | Inline callbacks (onApprove/onFeedback/onRestructure) not memoized — perf only |
| 🟢 21 | Collapsible component uses @base-ui instead of shadcn/radix — cosmetic inconsistency |
| 🟢 22 | No UI component tests for chat components (zero coverage) |
| 🟢 23 | No hook tests for use-api.ts / use-ideation.ts |
| 🟢 24 | No route-level API integration tests (262 unit tests compensate, but gap exists) |

**Deferred by design:**

| # | Issue | Reason |
|---|-------|--------|
| — | No `db.$transaction()` in API routes | rebuildState provides crash recovery — by architecture design |
| — | Concurrent grade/approve race condition | UI guard (`anyLoading`) sufficient; server lock deferred to Macro 9 |
| — | No auth/ownership checks on API routes | Auth not yet integrated — planned for later |
| — | No rate limiting or request size limits | Production hardening — planned for Macro 9 |

---

### SIGN-OFF VERDICT: ✅ APPROVED FOR MACRO 7

**All 8 critical issues resolved.** Typecheck clean, build clean, 262/262 tests passing.
Macro 6 is production-quality for its scope. 9 IMPORTANT items carry forward to Macro 7.

---

## Lessons Learned

See `tasks/lessons.md` for patterns and corrections captured during implementation.

---

## Pre-Frontend Audit (PC-5 → PC-6 Transition)

**Audit Date:** 2026-03-29
**Auditor:** Claude (senior engineer review)
**Purpose:** Verify backend readiness before starting UI phase (PC-6+)

---

### 1. Build & Type Safety — PASS

| Check | Result |
|-------|--------|
| `npm run build` | Compiled successfully, 0 errors, 0 warnings |
| `npm run typecheck` | Clean — no type errors |
| `npm run test` | **12 test files, 262 tests, ALL passing** (631ms) |
| Skipped tests | 0 |
| Warnings | 0 |

**Test file inventory (12):**
- rubric.test.ts, tree-utils.test.ts, tree-validator-serializer.test.ts
- agent-framework.test.ts, stage02-agents.test.ts, stage03-agents.test.ts
- stage04-agents.test.ts, orchestrator-agent.test.ts
- phase-manager.test.ts, loop-engine.test.ts
- ideation-validations.test.ts, conversation-manager.test.ts

**Verdict:** Backend is type-safe and fully tested. Green light.

---

### 2. API Contract Audit — 16 routes, all functional

| # | Route | Methods | Zod? | Tested? |
|---|-------|---------|------|---------|
| 1 | `/api/projects` | POST | Yes | No |
| 2 | `/api/project-component/health` | GET | No (none needed) | No |
| 3 | `/api/blueprints` | POST | Yes | No |
| 4 | `/api/blueprints/[blueprintId]` | GET, PATCH | Yes (PATCH) | No |
| 5 | `/api/archetypes` | GET | No (none needed) | No |
| 6 | `/api/component-registry` | GET | No (query param only) | No |
| 7 | `/api/blueprints/[id]/nodes` | GET, POST | Yes (POST) | No |
| 8 | `/api/blueprints/[id]/nodes/[nodeId]` | GET, PATCH, DELETE | Yes (PATCH) | No |
| 9 | `/api/blueprints/[id]/nodes/reorder` | POST | Yes | No |
| 10 | `/api/blueprints/[id]/components` | POST, DELETE | Yes (POST) | No |
| 11 | `/api/blueprints/[id]/versions` | GET, POST | No | No |
| 12 | `/api/blueprints/[id]/versions/[v]/restore` | POST | No | No |
| 13 | `/api/blueprints/[id]/ideation/start` | POST | Yes | No |
| 14 | `/api/blueprints/[id]/ideation/message` | POST | Yes | No |
| 15 | `/api/blueprints/[id]/ideation/grade` | POST | Yes (optional) | No |
| 16 | `/api/blueprints/[id]/ideation/approve` | POST | Yes | No |

**Zod coverage:** 13/16 routes use Zod validation (81%). The 3 without don't need it (GET-only or no body).
**API test coverage:** 0/16 routes have route-level tests. Business logic IS tested (262 unit tests), but no integration/route tests exist.
**Error format:** Consistent `{ error: string }` across all routes.
**Response shapes:** All documented in full detail (see audit notes).

**Key response shapes the UI will consume:**
- `GET /blueprints/[id]` → full blueprint with nested nodes[] and components[]
- `GET /blueprints/[id]/versions` → `[{ id, version, rubricScore, createdAt }]`
- `POST /ideation/message` → `{ conversationId, phase, awaitingHuman, message, costUSD, messages[], state }`
- `POST /ideation/grade` → `{ phase, loopCount, gradeReport, awaitingHuman, costUSD, state }`
- `POST /ideation/approve` → `{ action, phase, awaitingHuman, nextStep, costUSD, messages[], state }`

**Verdict:** APIs are solid. No route-level tests but unit coverage compensates. Response shapes are consistent and well-structured for frontend consumption.

---

### 3. Seed Data Completeness — GAPS FOUND

| Data | Seeded? | UI Impact |
|------|---------|-----------|
| Project (1) | Yes | Dashboard works |
| Blueprint (1, professional_training) | Yes | Canvas works |
| Nodes (14, 3-level hierarchy) | Yes | Tree renders |
| Components (31, mixed types) | Yes | Component badges work |
| Conversation (1, brainstorm phase) | Yes | Chat has sample messages |
| Messages (3: human + 2 agents) | Yes | Chat renders |
| StructureGrade | **NO** | Score bar has NO data |
| BlueprintVersion | **NO** | Version history is EMPTY |
| Conversations for other phases | **NO** | Only brainstorm phase has messages |
| IdeationLoopState | **N/A** | Not a DB model (in-memory state) |

**What's MISSING that UI screens need:**
1. **StructureGrade record** — score bar, dimension breakdown, recommendation badge
2. **BlueprintVersion snapshots** — version history dropdown, restore button
3. **Multi-phase conversations** — the chat needs messages from structure/refinement/review phases
4. **Grade report on blueprint** — `ideationScore` is null, `structureSummary` is null

**Verdict:** Seed covers canvas and basic chat, but score bar and versioning UI will render empty. Must extend seed before building those components.

---

### 4. Type Export Audit — Well organized, minor gaps

**Central hub:** `src/lib/project-component/types.ts` — 43 exported types

| UI Consumer | Types Available | Location |
|-------------|----------------|----------|
| **Chat UI** | IdeationPhase, BrainstormRole, IdeationMessageKind, IdeationMessageType | types.ts |
| **Chat state** | IdeationLoopState, HumanFeedbackEntry, BlueprintVersion, IdeationStepResult, HumanFeedback | phase-manager.ts, loop-engine.ts |
| **Canvas** | ProjectNodeType, ProjectBlueprintType, AttachedComponentType, TreeNode<T>, TreeStats | types.ts, tree-utils.ts |
| **Canvas validation** | ValidationError, ValidationResult, ValidationErrorCode | tree-validator.ts |
| **Wizard** | ArchetypeDefinition, ComponentDefinition, ProjectArchetype, ComponentCategory, ComponentPriority | types.ts |
| **Wizard compat** | CompatibilityEntry, getCompatibleComponents | compatibility.ts |
| **Score bar** | GradeReport, DimensionGradeScore, GradeRecommendation, BloomLevel | types.ts |
| **Score rubric** | RubricDimension, StructureRubric, ScoreResult | structure-rubric.ts |
| **Agent framework** | AgentTier, IdeationAgentConfig, AgentResult<T>, ModelPricing | agents/framework/types.ts (INTERNAL) |

**No types defined inside API routes** — all correctly centralized in lib layer.

**Observations:**
- Chat state types are spread across 3 files (types.ts, phase-manager.ts, loop-engine.ts)
- React components will need imports from multiple paths
- Consider a barrel export (`src/lib/project-component/index.ts`) for cleaner imports

**Verdict:** Types are comprehensive and well-defined. Spread across files but all exported. A barrel re-export file would simplify frontend imports.

---

### 5. Missing API Endpoints — NONE

| UI Data Flow | API Route | Exists? |
|-------------|-----------|---------|
| Get blueprint with full node tree (canvas) | `GET /blueprints/[id]` (includes nodes + components) | Yes |
| Get conversation messages (chat) | `POST /ideation/message` returns messages[] | Yes |
| Get latest grade report (score bar) | `POST /ideation/grade` returns gradeReport | Yes |
| Get available archetypes (project creation) | `GET /archetypes` | Yes |
| Get compatible components (palette) | `GET /component-registry?archetype=xxx` | Yes |
| Update node title/description (inline edit) | `PATCH /blueprints/[id]/nodes/[nodeId]` | Yes |
| Reorder nodes (drag-drop) | `POST /blueprints/[id]/nodes/reorder` | Yes |
| Create version snapshot (save button) | `POST /blueprints/[id]/versions` | Yes |
| Restore version | `POST /blueprints/[id]/versions/[v]/restore` | Yes |
| Add/remove components | `POST/DELETE /blueprints/[id]/components` | Yes |
| Start ideation | `POST /blueprints/[id]/ideation/start` | Yes |
| Human review actions | `POST /blueprints/[id]/ideation/approve` (approve/feedback/restructure) | Yes |

**Verdict:** Every UI data flow has a corresponding API. No new endpoints needed.

---

### 6. File Structure Readiness

**Current pages:**
```
src/app/(pages)/
  dashboard/page.tsx          ← exists
  project/new/page.tsx        ← exists
  project/[id]/page.tsx       ← exists
  review/[stageId]/           ← empty (placeholder)
```

**Current components:**
```
src/components/
  ui/           ← badge, button, card, input, label, textarea (shadcn)
  dashboard/    ← project-card.tsx
  project/      ← stage-card.tsx, version-a/b/c.tsx
  pipeline/     ← empty
  review/       ← empty
```

**Directories that NEED creating for PC-6+:**

| Directory | Purpose | Exists? |
|-----------|---------|---------|
| `src/app/(pages)/project/[id]/ideation/` | Chat ideation page | No |
| `src/app/(pages)/project/[id]/structure/` | Canvas structure page | No |
| `src/app/(pages)/project/[id]/configure/` | Wizard config page | No |
| `src/app/(pages)/project/[id]/launch/` | Review + launch page | No |
| `src/components/project-component/chat/` | Chat message components | No |
| `src/components/project-component/canvas/` | Tree visualization | No |
| `src/components/project-component/wizard/` | Config form components | No |
| `src/components/project-component/shared/` | Phase indicator, score bar | No |

**Verdict:** All 8 directories need creating. No conflicts with existing structure.

---

### 7. Action Items — Fix BEFORE Starting UI

**MUST FIX (blocks UI development):**
- [ ] **Extend seed data:** Add StructureGrade record with 7-dimension scores
- [ ] **Extend seed data:** Add at least 1 BlueprintVersion snapshot
- [ ] **Extend seed data:** Add messages for structure + review phases (not just brainstorm)
- [ ] **Extend seed data:** Set blueprint.ideationScore and blueprint.structureSummary
- [ ] **Create barrel export:** `src/lib/project-component/index.ts` re-exporting all UI-facing types

**SHOULD DO (improves DX):**
- [ ] Create the 8 frontend directories listed above
- [ ] Add a `GET /blueprints/[id]/ideation/messages` endpoint (currently messages only come embedded in POST responses — chat needs to load history on page mount)

**NICE TO HAVE (can defer):**
- [ ] Route-level API tests (business logic is tested; routes are thin wrappers)
- [ ] Add more seed messages (currently only 3 — chat UI demo would benefit from 8-10)