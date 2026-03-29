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

## Macro Phase 3: Tree Engine + API ← CURRENT

- [x] PC-3.1: Tree utility functions
  - 11 pure functions: buildTree, flattenTree, findNode, getAncestors,
    getDescendants, getSiblings, addNode, removeNode, moveNode, updatePaths, getTreeStats
  - File: src/lib/project-component/tree/tree-utils.ts
  - Tests: tests/unit/tree-utils.test.ts (50 tests passing)
  - Key rule: NO database imports — pure functions only

- [ ] PC-3.2: Blueprint & node API routes (8 route groups)
  - /api/blueprints — POST create
  - /api/blueprints/[blueprintId] — GET, PATCH
  - /api/blueprints/[blueprintId]/nodes — GET all, POST new
  - /api/blueprints/[blueprintId]/nodes/[nodeId] — GET, PATCH, DELETE
  - /api/blueprints/[blueprintId]/nodes/reorder — POST bulk reorder
  - /api/blueprints/[blueprintId]/components — POST add, DELETE remove
  - /api/archetypes — GET list (from registry, no DB)
  - /api/component-registry — GET list, GET ?archetype=xxx filter
  - All routes: Zod validation, consistent { error } format, proper HTTP status

- [ ] PC-3.3: Tree validation + versioning
  - Validator: catches orphans, circular refs, depth violations, bad components,
    missing dependencies, duplicate paths, path mismatches
  - Serializer: serializeBlueprint/deserializeBlueprint for snapshots
  - Version API: POST create snapshot, GET list versions, POST restore version
  - File: src/lib/project-component/tree/tree-validator.ts
  - File: src/lib/project-component/tree/tree-serializer.ts

## Macro Phase 4: Ideation Agents (Backend)

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

- [ ] PC-4.5: Orchestrator agent
  - Master coordinator: routes human input to specialist agents
  - Manages phase transitions: brainstorm → structure → refinement → review
  - Test 3-turn conversation flow
  - All 8 agents registered in registry

## Macro Phase 5: Recursive Loop Engine

- [ ] PC-5.1: Phase state machine
  - PHASE_TRANSITIONS: brainstorm→structure→refinement→review→approved
  - canTransition, getNextPhase (auto-routes based on grade score)
  - IdeationLoopState interface, createInitialState
  - File: src/lib/project-component/ideation/phase-manager.ts

- [ ] PC-5.2: Loop engine core
  - runIdeationStep: runs ONE step, selects agents by phase
  - processHumanFeedback: approve / feedback / restructure
  - Auto-refinement: score < 75 AND loopCount < 5 → refine automatically
  - Force human review after 5 loops
  - File: src/lib/project-component/ideation/loop-engine.ts

- [ ] PC-5.3: Ideation API + conversation persistence
  - Conversation manager: createConversation, addMessage, getMessages
  - API: /ideation/start, /ideation/message, /ideation/grade, /ideation/approve
  - All messages persisted to Prisma (IdeationConversation + IdeationMessage)
  - Full flow testable via curl

## Macro Phase 6: Chat Ideation UI (Visual-First)

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

## Lessons Learned

See `tasks/lessons.md` for patterns and corrections captured during implementation.