# SUPERSEDED

> **This guide is superseded by the Loop Engine v2 action plan.**
> See: [`loop-engine-action-plan.md`](./loop-engine-action-plan.md)
>
> The `src/lib/project-component/` path referenced below was moved to
> `src/lib/domain/workflows/` in LE-0. The core/domain architecture
> described in the action plan replaces this guide's structure.
> Preserved as historical context.

---

# VOVAI eLearnOS — Project Component
# ADAPTED IMPLEMENTATION GUIDE v2.0
## For the Existing vovai-elearn-aios Codebase

**Version:** 2.0 (Adapted)
**Date:** March 28, 2026
**Codebase:** github.com/srinivastentu/vovai-elearn-aios
**Stack:** Next.js 15, Prisma 7, TypeScript 6, Tailwind 4, npm, Vitest
**Convention Source:** CLAUDE.md (engine vs product, 4 loop patterns, visual-first)

---

## HOW THIS DIFFERS FROM v1.0

| v1.0 (Original) | v2.0 (Adapted) |
|---|---|
| Drizzle ORM | **Prisma 7** (your existing ORM) |
| pnpm | **npm** (your package manager) |
| Start from scratch | **Add to existing codebase** |
| New project scaffolding | **PC-1.1 SKIPPED** (already done) |
| PC-1.2 schema | **DONE** (just committed as PC-1.2-blueprint-schema) |
| Standalone loop engine | **Uses your existing engine.ts patterns** |
| Generic coding style | **Follows CLAUDE.md rules** (no semicolons, 2-space, no `any`, ES modules) |
| Build then show UI | **Visual-first** (UI with sample data first, engine behind) |

---

## GOLDEN RULES (same as v1.0, adapted)

1. **ONE micro-phase = ONE Claude Code session.** Never combine two.
2. **Copy-paste the EXACT prompt** into Claude Code. It will read CLAUDE.md automatically.
3. **Run EVERY checkpoint** before moving on. Fix failures in the SAME session.
4. **Git commit + tag** after every micro-phase: `git tag PC-X.Y-description`
5. **If CC gets confused:** Say "STOP. Show me `find src/lib/project-component -type f` and run `npm run typecheck`"
6. **If debugging exceeds 15 min:** New session with: "I'm on micro-phase PC-X.Y. Here's the error: [paste]. Fix ONLY this."
7. **CLAUDE.md rule:** Before changing 3+ files, CC must explain plan and get your approval.
8. **Visual-first rule:** Build UI with sample/mock data FIRST, then wire up the backend.

---

## YOUR EXISTING FILE MAP

```
src/
├── app/
│   ├── (pages)/
│   │   ├── dashboard/page.tsx          ← existing dashboard
│   │   └── project/
│   │       ├── new/page.tsx            ← existing project creation
│   │       └── [id]/page.tsx           ← existing project detail
│   ├── api/projects/route.ts           ← existing API
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                             ← shadcn components
│   ├── project/                        ← stage-card, versions
│   └── dashboard/project-card.tsx
├── lib/
│   ├── engine.ts                       ← THE recursive loop engine
│   ├── pipeline.ts                     ← pipeline stage config
│   ├── types.ts                        ← core type definitions
│   ├── db.ts                           ← Prisma client
│   ├── utils.ts
│   └── validations/project.ts          ← Zod schemas
├── generated/prisma/                   ← Prisma generated client
└── types/css.d.ts

prisma/
└── schema.prisma                       ← 4 existing + 7 NEW models (PC-1.2 done)
```

### WHERE NEW FILES GO (nothing existing gets touched)

```
src/lib/project-component/              ← NEW: all project component logic
├── types.ts                            ← TypeScript interfaces
├── archetypes.ts                       ← 3 archetype definitions
├── component-registry.ts               ← 16 component definitions
├── compatibility.ts                    ← archetype ↔ component matrix
├── rubrics/
│   └── structure-rubric.ts             ← 7-dimension rubric + scoring
├── tree/
│   ├── tree-utils.ts                   ← 11 pure functions
│   ├── tree-validator.ts               ← structural validation
│   └── tree-serializer.ts              ← snapshot/restore
├── ideation/
│   ├── phase-manager.ts                ← state machine
│   ├── loop-engine.ts                  ← recursive brainstorming loop
│   └── conversation-manager.ts         ← DB persistence
├── agents/
│   ├── framework/
│   │   ├── types.ts                    ← agent interfaces
│   │   ├── executor.ts                 ← calls Anthropic API
│   │   └── registry.ts                 ← agent registry
│   ├── audience-analyst.ts
│   ├── curriculum-strategist.ts
│   ├── outcome-architect.ts
│   ├── component-recommender.ts
│   ├── structure-optimizer.ts
│   ├── rubric-grader.ts
│   ├── devils-advocate.ts
│   └── orchestrator.ts
└── production/
    ├── handoff.ts                      ← creates StageSession jobs
    └── cost-estimator.ts

src/app/api/                            ← NEW API routes alongside existing
├── blueprints/
│   ├── route.ts                        ← POST: create blueprint
│   └── [blueprintId]/
│       ├── route.ts                    ← GET, PATCH
│       ├── nodes/
│       │   ├── route.ts               ← GET all, POST new
│       │   ├── [nodeId]/route.ts      ← GET, PATCH, DELETE
│       │   └── reorder/route.ts       ← POST bulk reorder
│       ├── components/route.ts         ← component CRUD
│       ├── ideation/
│       │   ├── start/route.ts
│       │   ├── message/route.ts
│       │   ├── grade/route.ts
│       │   └── approve/route.ts
│       └── versions/route.ts

src/app/(pages)/project/[id]/          ← NEW pages alongside existing
├── ideation/page.tsx                   ← Chat brainstorming UI
├── structure/page.tsx                  ← Canvas tree editor
├── configure/page.tsx                  ← Wizard configuration
└── launch/page.tsx                     ← Production handoff

src/components/project-component/       ← NEW components
├── chat/
├── canvas/
├── wizard/
└── shared/
```

---

## BIG PICTURE: 9 MACRO PHASES (34 micro-phases, ~14 days)

```
MACRO 1: Database & Seed ............................ 2 micro-phases (Day 1)
         PC-1.2 DONE ✅ | PC-1.3 remaining

MACRO 2: Registries & Type System .................. 3 micro-phases (Day 1-2)
MACRO 3: Tree Engine (CRUD + API) .................. 3 micro-phases (Day 2-3)
MACRO 4: Ideation Agents (Backend) ................. 5 micro-phases (Day 3-5)
MACRO 5: Recursive Loop Engine ..................... 3 micro-phases (Day 5-6)
MACRO 6: Chat Ideation UI (Visual-First) ........... 4 micro-phases (Day 6-8)
MACRO 7: Canvas Structure UI ....................... 4 micro-phases (Day 8-10)
MACRO 8: Wizard + Production Handoff ............... 4 micro-phases (Day 10-12)
MACRO 9: Testing, Security & Polish ................ 3 micro-phases (Day 12-14)

TOTAL: 31 remaining micro-phases + 1 done = 32 (2 fewer than v1.0 — no scaffolding)
```

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 1: DATABASE & SEED
# ═══════════════════════════════════════════════════════════

**Goal:** Database schema + seed data for testing.
**Status:** PC-1.2 DONE ✅ (7 models, 7 enums migrated)

---

## Micro-Phase 1.2: Blueprint Schema ✅ COMPLETE

**Git Tag:** `PC-1.2-blueprint-schema`
**Status:** Done. 7 new Prisma models added alongside existing 4.

---

## Micro-Phase 1.3: Seed Data + API Health Check

**What this does:** Creates sample data so you can build UI against real records.

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-1.3 of the Project Component build.
Schema is migrated (PC-1.2 done). I need seed data for visual-first development.

Create a seed script at scripts/seed-project-component.ts that:

1. Finds OR creates a test Project (use existing Project model):
   { name: "Teacher Retooling in ID", topic: "Instructional Design",
     targetAudience: "Mid-career CBSE teachers", durationMinutes: 2400 }

2. Creates a ProjectBlueprint linked to that project:
   { archetype: "course",
     hierarchyLabels: {"level0":"Course","level1":"Module","level2":"Topic","level3":"Subtopic"},
     targetAudience: { description: "Mid-career teachers...", experienceLevel: "5-15 years" },
     enabledComponents: ["video","study_material","quiz","activity","capstone"],
     ideationPhase: "brainstorm" }

3. Creates ProjectNodes (a realistic tree):
   - Module 1: "Foundations of ID" (depth 0)
     - Topic 1.1: "What is Instructional Design?" (depth 1)
       - Subtopic 1.1.1: "History of ID" (depth 2)
       - Subtopic 1.1.2: "ID Roles & Responsibilities" (depth 2)
     - Topic 1.2: "Learning Theories" (depth 1)
       - Subtopic 1.2.1: "Behaviorism" (depth 2)
       - Subtopic 1.2.2: "Constructivism" (depth 2)
   - Module 2: "ADDIE Framework" (depth 0)
     - Topic 2.1: "Analysis Phase" (depth 1)
     - Topic 2.2: "Design Phase" (depth 1)
   - Module 3: "Digital Tools for ID" (depth 0)
     - Topic 3.1: "Authoring Tools" (depth 1)

   Set materialized paths like "/foundations-of-id/what-is-id/history-of-id"
   Set slugs using the title (slugified)

4. Creates NodeComponents for each topic:
   - Every topic gets: video (core) + quiz (core)
   - Topics 1.1, 1.2, 2.1, 2.2 also get: study_material (recommended)
   - Topic 1.2 also gets: activity (recommended)
   - Blueprint level: capstone (core)

5. Creates one IdeationConversation with 3 sample messages:
   - human: "I need a teacher retooling program on instructional design..."
   - facilitator: "Based on your brief, I see a 3-module professional training..."
   - pedagogy_expert: "For mid-career teachers, I recommend experiential learning..."

6. Console.log a summary: X projects, X blueprints, X nodes, X components, X messages

Add to package.json scripts:
  "db:seed:pc": "npx tsx scripts/seed-project-component.ts"

Also add an API health check at src/app/api/project-component/health/route.ts:
  - Query: count of blueprints, nodes, components
  - Return: { status: "ok", counts: { blueprints: N, nodes: N, components: N } }

Run the seed: npm run db:seed:pc
Test the health: curl http://localhost:3000/api/project-component/health
```

### Checkpoints:

- [ ] **SEED:** `npm run db:seed:pc` completes without errors
- [ ] **DATA:** `npx prisma studio` shows data in all 7 new tables
- [ ] **TREE:** ProjectNodes have correct parent-child relationships
- [ ] **PATHS:** Materialized paths are correct (/module/topic/subtopic format)
- [ ] **HEALTH:** API returns correct counts
- [ ] **EXISTING:** Existing Project model data is NOT affected
- [ ] **BUILD:** `npm run build` passes
- [ ] **TYPES:** `npm run typecheck` passes

### Git:
```bash
git add -A
git commit -m "feat(project-component): seed data + health check API

- Realistic Teacher Retooling project with 3 modules, 7 topics, 4 subtopics
- 15+ NodeComponents (video, quiz, study_material, activity, capstone)
- Sample ideation conversation with 3 messages
- Health check endpoint at /api/project-component/health"
git tag PC-1.3-seed-data
git push origin main --tags
```

### MACRO 1 EXIT GATE:
```
✅ 7 new Prisma models migrated (PC-1.2)
✅ Seed data populated with realistic project structure
✅ Health check API works
✅ Prisma Studio shows correct relationships
✅ Existing models untouched
```

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 2: REGISTRIES & TYPE SYSTEM
# ═══════════════════════════════════════════════════════════

**Goal:** Define all TypeScript types, archetype registry, component registry, and rubric.
These are config files — no database, no API, just pure TypeScript.
**Duration:** 1 day (3 sessions)

---

## Micro-Phase 2.1: Core TypeScript Types

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-2.1.
Seed data done (PC-1.3). Now I need the type system for the Project Component.

Create src/lib/project-component/types.ts

IMPORTANT: Follow CLAUDE.md coding standards:
- TypeScript strict, NEVER use `any` — use `unknown` or proper types
- ES modules (import/export)
- 2-space indent, no semicolons
- Types should be compatible with the Prisma generated types but independent

Export these types (write them out fully, not abbreviated):

1. ProjectArchetype — union type matching the Prisma enum values
2. BloomLevel — 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
3. IdeationPhase — matching Prisma enum
4. LearningOutcome — { id, text, bloomLevel, measurable, assessmentComponentId?, status }
5. AudienceProfile — { primaryAudience: { description, ageRange?, educationLevel,
   professionalRole?, experienceLevel, learningContext, motivations[], painPoints[],
   technologyComfort }, prerequisiteKnowledge[], learningPreferences: {
   preferredModalities[], attentionSpan, practicePreference } }
6. ProjectNodeType — full node shape including children array for tree building
7. AttachedComponentType — component shape with config and scoring
8. ProjectBlueprintType — full blueprint shape with nodes array
9. ComponentDefinition — registry entry shape (id, name, description, icon, category,
   deliverableType, deliverableFormat[], pipelineType, estimatedCost, configSchema,
   attachableAt[], maxPerNode, dependsOn[], produces[])
10. ArchetypeDefinition — registry entry (id, name, description, hierarchy, maxDepth,
    defaultComponents[], availableComponents[], productionMode)
11. GradeReport — { overallScore, passesThreshold, dimensionScores[], strengths[],
    weaknesses[], recommendation, specificImprovements[] }
12. IdeationMessageType — { id, conversationId, role, messageType, content,
    structuredData?, createdAt }

Also export utility types:
- TreeNode<T> — generic tree node with children
- ComponentCategory — 'content' | 'assessment' | 'activity' | 'meta'
- ProductionMode — 'batch' | 'module_sequential' | 'rolling'

Verify: npm run typecheck
```

### Checkpoints:

- [ ] **FILE:** `src/lib/project-component/types.ts` exists with 12+ exports
- [ ] **STRICT:** No `any` types anywhere (grep for it)
- [ ] **STYLE:** No semicolons, 2-space indent
- [ ] **TYPECHECK:** `npm run typecheck` passes

### Git:
```bash
git add -A
git commit -m "feat(project-component): core TypeScript type system — 12 interfaces"
git tag PC-2.1-type-system
git push origin main --tags
```

---

## Micro-Phase 2.2: Archetype & Component Registries

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-2.2.
Type system done (PC-2.1). Now I need the configuration registries.

Create THREE files using types from src/lib/project-component/types.ts:

FILE 1: src/lib/project-component/archetypes.ts
Export PROJECT_ARCHETYPES — Record<string, ArchetypeDefinition> with 3 entries:

1. k12_curriculum:
   - name: "K-12 Curriculum-Aligned Course"
   - hierarchy: { level0: "Subject", level1: "Grade", level2: "Chapter",
                  level3: "Topic", level4: "Sub-topic" }
   - maxDepth: 4
   - defaultComponents: ['video']
   - availableComponents: ['video','study_material','quiz','practice_worksheet','flashcards']
   - productionMode: 'batch'

2. professional_training:
   - name: "Professional Training Course"
   - hierarchy: { level0: "Course", level1: "Module", level2: "Topic", level3: "Subtopic" }
   - maxDepth: 3
   - defaultComponents: ['video','study_material','quiz','activity','capstone_project']
   - availableComponents: ALL 16 component types
   - productionMode: 'module_sequential'

3. content_channel:
   - name: "Content Channel / Ongoing Production"
   - hierarchy: { level0: "Channel", level1: "Subject", level2: "Season", level3: "Episode" }
   - maxDepth: 3
   - defaultComponents: ['video']
   - availableComponents: ['video','video_short','study_material','quiz']
   - productionMode: 'rolling'

Also export: getArchetype(id: string): ArchetypeDefinition
            listArchetypes(): ArchetypeDefinition[]

FILE 2: src/lib/project-component/component-registry.ts
Export COMPONENT_REGISTRY — Record<string, ComponentDefinition> with 16 components:

Content (5): video, video_short, study_material, practice_worksheet, flashcards
Assessment (3): quiz, pre_assessment, post_assessment
Activity (3): activity, scenario_exercise, capstone_project
Meta (5): discussion_prompt, glossary, resource_library, certificate, mentor_checklist

Each must have: id, name, description, icon (lucide icon name), category,
deliverableType, deliverableFormat[], pipelineType, estimatedProductionTime string,
estimatedCost { min, max, currency: 'USD' }, configSchema (with defaults),
attachableAt[] (which tree levels), maxPerNode, required boolean, dependsOn[], produces[]

Use FULL realistic values — not placeholders.

Also export: getComponent(type: string): ComponentDefinition | undefined
            listComponents(category?: string): ComponentDefinition[]
            getComponentsForLevel(depth: number): ComponentDefinition[]

FILE 3: src/lib/project-component/compatibility.ts
Export COMPONENT_COMPATIBILITY — per-archetype component compatibility:

k12_curriculum:
  recommended: ['video','quiz','practice_worksheet','flashcards']
  optional: ['study_material','glossary','video_short']
  unavailable: ['capstone_project','scenario_exercise','mentor_checklist','certificate']

professional_training:
  recommended: ['video','study_material','quiz','activity','capstone_project','post_assessment']
  optional: everything else except practice_worksheet and video_short
  unavailable: ['practice_worksheet','video_short']

content_channel:
  recommended: ['video']
  optional: ['video_short','study_material','quiz']
  unavailable: everything else

Export: getCompatibleComponents(archetype: string): { recommended, optional, unavailable }
       isComponentAvailable(archetype: string, componentType: string): boolean

Verify: npm run typecheck
```

### Checkpoints:

- [ ] **ARCHETYPES:** 3 definitions with all fields populated
- [ ] **COMPONENTS:** 16 definitions with realistic configs
- [ ] **COMPAT:** Matrix covers all 3 archetypes × 16 components
- [ ] **HELPERS:** All getter functions work
- [ ] **TYPECHECK:** Passes
- [ ] **NO ANY:** Zero `any` types

### Git:
```bash
git add -A
git commit -m "feat(project-component): archetype (3) + component (16) registries + compatibility"
git tag PC-2.2-registries
git push origin main --tags
```

---

## Micro-Phase 2.3: Project Structure Rubric

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-2.3.
Registries done (PC-2.2). Now the rubric system.

Create src/lib/project-component/rubrics/structure-rubric.ts

Export STRUCTURE_RUBRIC with 7 evaluation dimensions:

1. coverage (weight: 0.18, pass: 70)
   "Do learning outcomes cover the full scope?"
2. depth (weight: 0.15, pass: 65)
   "Is the hierarchy deep enough for meaningful learning?"
3. progression (weight: 0.18, pass: 75)
   "Do topics build logically on each other?"
4. balance (weight: 0.12, pass: 65)
   "Are modules roughly similar in scope and complexity?"
5. engagement (weight: 0.15, pass: 70)
   "Are there enough activities, not just passive content?"
6. feasibility (weight: 0.10, pass: 60)
   "Is scope realistic for timeline and budget?"
7. coherence (weight: 0.12, pass: 70)
   "Does every component serve a learning outcome?"

Each dimension: { id, name, weight, passThreshold, description,
  criteria: { excellent: string, good: string, adequate: string, poor: string } }

Overall pass threshold: 75
Weights must sum to exactly 1.0

Also export these functions:
  calculateOverallScore(dimensionScores: { dimensionId: string, score: number }[]):
    { overallScore: number, passesThreshold: boolean, failingDimensions: string[] }

  getRecommendation(overallScore: number, failingDimensions: string[]):
    'approve' | 'revise' | 'restructure' | 'reject'
    - >= 85 and 0 failing → approve
    - >= 75 and <= 1 failing → revise
    - >= 60 → restructure
    - < 60 → reject

Write a test at tests/unit/rubric.test.ts using vitest:
  - Test that weights sum to 1.0
  - Test calculateOverallScore with known inputs
  - Test all 4 recommendation thresholds
  - Test that a dimension below its passThreshold is flagged

Run: npm run test:unit
```

### Checkpoints:

- [ ] **RUBRIC:** 7 dimensions, weights sum to 1.0
- [ ] **SCORING:** calculateOverallScore is pure function
- [ ] **RECOMMEND:** All 4 thresholds produce correct recommendation
- [ ] **TESTS:** `npm run test:unit` passes (at least rubric tests)
- [ ] **TYPECHECK:** Passes

### Git:
```bash
git add -A
git commit -m "feat(project-component): 7-dimension structure rubric + scoring + tests"
git tag PC-2.3-rubric
git push origin main --tags
```

### MACRO 2 EXIT GATE:
```
✅ 12+ TypeScript types defined and compiling
✅ 3 archetypes registered
✅ 16 components registered with realistic configs
✅ Compatibility matrix covering all combinations
✅ Rubric with 7 dimensions and tested scoring
✅ npm run typecheck + npm run test:unit both pass
```

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 3: TREE ENGINE (CRUD + API)
# ═══════════════════════════════════════════════════════════

**Goal:** Pure tree functions + API routes for managing project structure.
**Duration:** 2 days (3 sessions)

---

## Micro-Phase 3.1: Tree Utility Functions

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-3.1.
Registries done (PC-2.3). Now building the tree engine.

Create src/lib/project-component/tree/tree-utils.ts

These are PURE FUNCTIONS — no database, no side effects. They operate on
arrays of ProjectNodeType from our types.ts.

Export 11 functions:

1. buildTree(flatNodes): nested tree with children populated
2. flattenTree(rootNodes): flat array with children stripped
3. findNode(tree, nodeId): recursive search, returns node or null
4. getAncestors(flatNodes, nodeId): root → parent chain
5. getDescendants(tree, nodeId): all children recursively
6. getSiblings(flatNodes, nodeId): same-parent nodes
7. addNode(flatNodes, newNode, parentId): adds with auto depth/path/sortOrder
8. removeNode(flatNodes, nodeId): removes node + all descendants
9. moveNode(flatNodes, nodeId, newParentId, newSortOrder): moves with path update
10. updatePaths(flatNodes): recalculates all materialized paths
11. getTreeStats(tree): { totalNodes, maxDepth, componentBreakdown }

IMPORTANT:
- Use slugify for path generation (install slugify if not present)
- Paths format: "/module-slug/topic-slug/subtopic-slug"
- Sort children by sortOrder ascending
- addNode should auto-calculate: depth = parent.depth + 1, sortOrder = max sibling + 1

Write tests at tests/unit/tree-utils.test.ts using vitest.
Test with a sample tree: 3 modules, 6 topics, 4 subtopics.
Test: buildTree ↔ flattenTree round-trip, findNode, addNode, removeNode cascades.

Run: npm run test:unit
```

### Checkpoints:

- [ ] **PURE:** No imports from prisma, db, or API modules (verify with grep)
- [ ] **11 FUNCTIONS:** All exported and typed
- [ ] **TESTS:** All tree tests pass
- [ ] **ROUND-TRIP:** buildTree → flattenTree → buildTree produces identical tree
- [ ] **CASCADE:** removeNode removes all descendants

### Git:
```bash
git add -A
git commit -m "feat(project-component): 11 tree utility functions + tests"
git tag PC-3.1-tree-utils
git push origin main --tags
```

---

## Micro-Phase 3.2: Blueprint & Node API Routes

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-3.2.
Tree utils done (PC-3.1). Now API routes.

Create these Next.js API routes. Use Zod for validation (already in package.json).
Use the Prisma client from src/lib/db.ts.
Follow the pattern from existing src/app/api/projects/route.ts.

ROUTE 1: src/app/api/blueprints/route.ts
  POST — Create blueprint for an existing project
    Body: { projectId, archetype?, hierarchyLabels?, targetAudience?, enabledComponents? }
    Auto-fills defaults from archetype registry
    Returns 201 + created blueprint

ROUTE 2: src/app/api/blueprints/[blueprintId]/route.ts
  GET — Get blueprint with full node tree (include nodes + components)
  PATCH — Update blueprint fields

ROUTE 3: src/app/api/blueprints/[blueprintId]/nodes/route.ts
  GET — All nodes flat (client builds tree via tree-utils)
  POST — Add node { title, parentId?, description?, sortOrder? }
    Auto-calculates: slug, depth, path (using tree-utils)

ROUTE 4: src/app/api/blueprints/[blueprintId]/nodes/[nodeId]/route.ts
  GET — Single node with components
  PATCH — Update node fields
  DELETE — Delete node + all descendants (Prisma cascade or manual)

ROUTE 5: src/app/api/blueprints/[blueprintId]/nodes/reorder/route.ts
  POST — Bulk reorder: [{ nodeId, parentId, sortOrder }]

ROUTE 6: src/app/api/blueprints/[blueprintId]/components/route.ts
  POST — Add component to a node: { nodeId, componentType, config?, priority? }
    Validate componentType exists in COMPONENT_REGISTRY
  DELETE — Remove component by componentId (query param)

ROUTE 7: src/app/api/archetypes/route.ts
  GET — List all archetypes from registry (no DB)

ROUTE 8: src/app/api/component-registry/route.ts
  GET — List all components from registry
  GET ?archetype=xxx — Filter by compatible components

FOR ALL ROUTES:
- Zod validation on request bodies
- Consistent error format: { error: string }
- HTTP status: 200/201/400/404/500
- Try/catch with logged errors
- Use Prisma includes for nested data

Show me curl commands to test each route.
```

### Checkpoints:

- [ ] **8 ROUTE FILES** created
- [ ] **ZOD:** All POST/PATCH have validation schemas
- [ ] **CRUD:** Can create blueprint → add nodes → add components via curl
- [ ] **DELETE:** Deleting node removes children
- [ ] **REGISTRY:** Archetype and component endpoints return registry data
- [ ] **BUILD:** `npm run build` passes
- [ ] **EXISTING:** `src/app/api/projects/route.ts` is untouched

### Git:
```bash
git add -A
git commit -m "feat(project-component): 8 API route groups for blueprint/node/component CRUD"
git tag PC-3.2-api-routes
git push origin main --tags
```

---

## Micro-Phase 3.3: Tree Validation + Versioning

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-3.3.
API routes done (PC-3.2). Now validation and versioning.

Create TWO utility files:

FILE 1: src/lib/project-component/tree/tree-validator.ts
Export validateTree(blueprint, nodes, components):
  Returns { valid: boolean, errors: { code, nodeId?, message }[] }

Checks:
1. No orphan nodes (parentId must exist or be null)
2. No circular parent references
3. Depth doesn't exceed archetype maxDepth
4. Components are valid for their node's level (check registry attachableAt)
5. Component dependencies met (post_assessment needs quiz to exist)
6. No duplicate paths within same blueprint
7. Materialized paths match actual parent chain

FILE 2: src/lib/project-component/tree/tree-serializer.ts
Export:
  serializeBlueprint(blueprint, nodes, components): JSON snapshot
  deserializeBlueprint(snapshot): { blueprint, nodes, components }

Add versioning API:
  src/app/api/blueprints/[blueprintId]/versions/route.ts
    POST — Create version snapshot
    GET — List all versions

  src/app/api/blueprints/[blueprintId]/versions/[version]/restore/route.ts
    POST — Restore from snapshot

Write a test:
  1. Create blueprint with seed data
  2. Snapshot it (version 1)
  3. Add a new node
  4. Snapshot (version 2)
  5. Restore version 1
  6. Verify node count matches version 1

Run: npm run test:unit
```

### Checkpoints:

- [ ] **VALIDATOR:** Catches orphan nodes, deep trees, bad components
- [ ] **SERIALIZER:** Round-trip produces identical data
- [ ] **VERSIONING:** Create → modify → restore works
- [ ] **TESTS:** All passing

### Git:
```bash
git add -A
git commit -m "feat(project-component): tree validation + blueprint versioning with restore"
git tag PC-3.3-tree-versioning
git push origin main --tags
```

### MACRO 3 EXIT GATE:
```
✅ 11 pure tree functions with tests
✅ 8 API route groups with Zod validation
✅ Tree validator catches 7 error types
✅ Blueprint versioning with snapshot/restore
✅ All tests passing, build passing
```

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 4: IDEATION AGENTS (BACKEND)
# ═══════════════════════════════════════════════════════════

**Goal:** Build all 8 ideation agents. These use your existing Anthropic SDK.
**Duration:** 2-3 days (5 sessions)
**KEY INSIGHT:** These agents follow your engine.ts pattern — produce() → evaluate() → loop

---

## Micro-Phase 4.1: Agent Framework

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-4.1.
Tree engine done (PC-3.3). Now the agent execution framework.

This should follow the patterns from src/lib/engine.ts — agents are stateless,
receive context, produce artifact, return. Every LLM call MUST include cost tracking.

Create src/lib/project-component/agents/framework/types.ts:
  - IdeationAgentConfig: { id, name, tier, model: { primary, fallback }, maxRetries, timeoutMs }
  - AgentResult<T>: { agentId, success, output: T, durationMs, modelUsed, tokensIn, tokensOut, costUSD, error? }

Create src/lib/project-component/agents/framework/executor.ts:
  Export: executeIdeationAgent<T>(config, systemPrompt, userMessage, outputSchema?): AgentResult<T>
  
  This function:
  1. Calls Anthropic API using the SDK from package.json (@anthropic-ai/sdk)
  2. Uses config.model.primary, falls back to config.model.fallback on failure
  3. If outputSchema provided, instructs model to return JSON matching it
  4. Parses and validates response
  5. Tracks: duration, tokens, cost (use $3/MTok input, $15/MTok output for sonnet)
  6. Retries up to config.maxRetries
  7. Respects config.timeoutMs
  8. EMITS cost data (console.log for now, will be events later)

Create src/lib/project-component/agents/framework/registry.ts:
  - registerAgent(config)
  - getAgent(id)
  - listAgents()

Test: call executeIdeationAgent with a simple prompt, verify it returns
a typed result with cost tracking.

IMPORTANT: The executor must handle the case where ANTHROPIC_API_KEY is not
set — return a graceful error, don't crash.
```

### Checkpoints:

- [ ] **EXECUTOR:** Makes successful API call to Claude
- [ ] **COST:** Response includes tokenIn, tokenOut, costUSD
- [ ] **FALLBACK:** Falls back on invalid primary model
- [ ] **TIMEOUT:** Respects timeout setting
- [ ] **GRACEFUL:** Returns error (not crash) when API key missing
- [ ] **TYPECHECK:** Passes with strict types

### Git:
```bash
git add -A
git commit -m "feat(project-component): agent execution framework with cost tracking"
git tag PC-4.1-agent-framework
git push origin main --tags
```

---

## Micro-Phase 4.2: Production Agents (Audience + Curriculum)

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-4.2.
Agent framework done (PC-4.1).

Create 2 production agents:

AGENT 1: src/lib/project-component/agents/audience-analyst.ts
  Export: runAudienceAnalyst(brief, archetype): Promise<AgentResult<AudienceProfile>>
  System prompt: Analyze project brief, profile target audience, recommend modalities
  Model: claude-sonnet-4-20250514

AGENT 2: src/lib/project-component/agents/curriculum-strategist.ts
  Export: runCurriculumStrategist(brief, archetype, audienceProfile, constraints?):
    Promise<AgentResult<ProposedStructure>>
  System prompt: Propose hierarchical course structure with modules, topics, subtopics.
    Include sequencing rationale and 2 alternative structures.
  Model: claude-sonnet-4-20250514

Define ProposedStructure type in types.ts if not already there:
  { courseTitle, courseDescription, modules: [{ title, description, topics: [{ title,
    description, keyConcepts[], estimatedMinutes, subtopics?, difficulty, bloomLevel }] }],
    sequencingRationale, alternativeStructures[], confidenceScore }

Register both agents in the registry.

Test with your real brief:
  "I'm building a teacher retooling program on instructional design for mid-career
  CBSE teachers (5-15 years experience). About 40 hours total, self-paced with
  optional mentor support. Must be experiential and outcome-focused."

Print the audience profile and proposed structure.
```

### Checkpoints:

- [ ] **AUDIENCE:** Returns valid profile with motivations, pain points
- [ ] **CURRICULUM:** Returns 3+ modules with topics and subtopics
- [ ] **COST:** Both log their API costs
- [ ] **REGISTERED:** Both appear in agent registry

### Git:
```bash
git add -A
git commit -m "feat(project-component): audience analyst + curriculum strategist agents"
git tag PC-4.2-production-agents-1
git push origin main --tags
```

---

## Micro-Phase 4.3: Production Agents (Outcomes + Components)

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-4.3.
First 2 agents done (PC-4.2).

AGENT 3: src/lib/project-component/agents/outcome-architect.ts
  Takes proposed structure + audience → generates learning outcomes per node
  Every outcome: SMART, Bloom-classified, mapped to assessment
  Returns: OutcomesMap with bloom distribution stats

AGENT 4: src/lib/project-component/agents/component-recommender.ts
  Takes structure + outcomes + audience + enabled components
  For each node: recommends components from COMPONENT_REGISTRY
  Respects COMPONENT_COMPATIBILITY for the archetype
  Returns: ComponentPlan with per-node recommendations, costs, 3 budget tiers

Import and use getCompatibleComponents() from compatibility.ts.
Import and use getComponent() from component-registry.ts.

Chain test: audience → curriculum → outcomes → components
Print: total components, cost range, breakdown by type
```

### Checkpoints:

- [ ] **OUTCOMES:** Every topic gets Bloom-classified outcomes
- [ ] **COMPONENTS:** Respects compatibility matrix
- [ ] **COSTS:** Budget tiers are realistic
- [ ] **CHAIN:** All 4 agents chain without errors

### Git:
```bash
git add -A
git commit -m "feat(project-component): outcome architect + component recommender agents"
git tag PC-4.3-production-agents-2
git push origin main --tags
```

---

## Micro-Phase 4.4: Governance Agents (Optimizer + Grader + Critic)

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-4.4.

AGENT 5: src/lib/project-component/agents/structure-optimizer.ts
  Checks: balance, gaps, redundancy, sequencing issues
  Returns: OptimizationReport with health_score, critical_issues, actions

AGENT 6: src/lib/project-component/agents/rubric-grader.ts
  Scores against the 7 dimensions from structure-rubric.ts
  Uses calculateOverallScore() and getRecommendation()
  Returns: GradeReport matching our type
  Model: claude-sonnet-4-20250514 (premium for accuracy)

AGENT 7: src/lib/project-component/agents/devils-advocate.ts
  Challenges assumptions from learner's perspective
  "Will teachers actually complete a 40-hour self-paced course?"
  Returns: challenges array with severity and suggestions

Chain test: full 7-agent pipeline
Print: final grade score and top 3 challenges
```

### Checkpoints:

- [ ] **OPTIMIZER:** Detects imbalanced modules
- [ ] **GRADER:** Scores all 7 dimensions, uses rubric helpers
- [ ] **CRITIC:** Returns meaningful challenges
- [ ] **CHAIN:** Full 7-agent chain completes

### Git:
```bash
git add -A
git commit -m "feat(project-component): governance agents — optimizer, grader, critic"
git tag PC-4.4-governance-agents
git push origin main --tags
```

---

## Micro-Phase 4.5: Orchestrator Agent

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on Micro-Phase PC-4.5.

AGENT 8: src/lib/project-component/agents/orchestrator.ts
  The master conductor — coordinates all other agents.
  
  Export: runOrchestrator(input: {
    humanMessage: string
    currentPhase: IdeationPhase
    context: { brief?, archetype?, audienceProfile?, proposedStructure?,
      outcomesMap?, componentPlan?, gradeReport?, challenges?,
      conversationHistory: IdeationMessageType[] }
  }): Promise<AgentResult<{
    phaseAction: 'continue' | 'advance_phase' | 'request_human_input' | 'trigger_grading'
    nextPhase?: IdeationPhase
    agentsToRun: string[]
    humanFacingMessage: string
    structuredProposal?: unknown
  }>>

  System prompt must make the orchestrator:
  - PROACTIVE: suggest what comes next
  - TRANSPARENT: explain what agents are doing
  - DECISIVE: make phase transitions, don't ask "shall I?"
  - Follow the engine pattern: produce context → present → get human action

Test 3-turn conversation:
  Turn 1: "I need to build a teacher training course on instructional design"
  Turn 2: "About 40 hours, self-paced, for mid-career teachers"
  Turn 3: "Yes, proceed with that structure"

All 8 agents registered. Print agent list from registry.
```

### Checkpoints:

- [ ] **ORCHESTRATOR:** Returns structured decisions at each turn
- [ ] **REGISTRY:** All 8 agents registered and listed
- [ ] **PHASES:** Correctly routes through ideation phases

### Git:
```bash
git add -A
git commit -m "feat(project-component): orchestrator agent — all 8 agents complete"
git tag PC-4.5-orchestrator
git push origin main --tags
```

### MACRO 4 EXIT GATE:
```
✅ 8 agents created, tested, registered
✅ Full 8-agent chain runs end-to-end
✅ Cost tracking on every API call
✅ Orchestrator manages conversation flow
✅ Rubric grader uses the 7-dimension rubric
```

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 5: RECURSIVE LOOP ENGINE
# ═══════════════════════════════════════════════════════════

**Goal:** Wire agents into the recursive brainstorming loop using your engine patterns.
**KEY:** This uses the Strategic + Production loop pattern from CLAUDE.md.

---

## Micro-Phase 5.1: Phase State Machine

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on PC-5.1.

Create src/lib/project-component/ideation/phase-manager.ts

This follows the engine pattern: state machine controlling loop behavior.

Export:
  PHASE_TRANSITIONS: Record<IdeationPhase, IdeationPhase[]>
    brainstorm → [structure]
    structure → [refinement]
    refinement → [review]
    review → [approved, refinement]  // human decides
    approved → []  // terminal

  canTransition(from, to): boolean
  getNextPhase(current, gradeReport?): IdeationPhase
    - After refinement: if score >= 75 → review, else → refinement again
    - After review: human decision (approve or refine)

  IdeationLoopState interface:
    blueprintId, currentPhase, loopCount, maxLoops: 5
    All accumulated data fields
    conversationHistory, humanFeedback[]

  createInitialState(blueprintId, brief): IdeationLoopState

Write tests: transitions, guards, auto-routing based on score.
```

---

## Micro-Phase 5.2: Loop Engine Core

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on PC-5.2.

Create src/lib/project-component/ideation/loop-engine.ts

This follows the Strategic + Production loop pattern from engine.ts:
  [Strategic Phase] Agents brainstorm + propose
  [Production Phase] Build structure + evaluate + refine

Export:
  runIdeationStep(state): Promise<{ updatedState, awaitingHuman, humanMessage }>
    Runs ONE step, not the whole loop.
    Selects agents based on currentPhase.
    Updates state and determines next phase.

  processHumanFeedback(state, feedback): Promise<IdeationLoopState>
    Handles: approve, feedback (refine), restructure (restart)

Auto-refinement: if grader score < 75 AND loopCount < maxLoops,
  auto-advance to refinement without human input.

After 5 loops without passing, force human review anyway.
```

---

## Micro-Phase 5.3: Ideation API + Conversation Persistence

### Claude Code Prompt:

```
Read CLAUDE.md. I'm on PC-5.3.

Create conversation management + API routes:

src/lib/project-component/ideation/conversation-manager.ts
  - createConversation(blueprintId, phase)
  - addMessage(conversationId, role, content, messageType, structuredData?)
  - getMessages(conversationId)
  - getLatestConversation(blueprintId)

API Routes:
  /api/blueprints/[blueprintId]/ideation/start  — POST: begin brainstorming
  /api/blueprints/[blueprintId]/ideation/message — POST: send human message
  /api/blueprints/[blueprintId]/ideation/grade   — POST: trigger grading
  /api/blueprints/[blueprintId]/ideation/approve  — POST: approve/feedback/restructure

Each route persists messages and returns conversation updates.
Test full flow via curl.
```

### MACRO 5 EXIT GATE:
```
✅ Phase state machine with tested transitions
✅ Recursive loop with auto-refinement
✅ Conversation persistence in Prisma
✅ 4 ideation API endpoints
✅ Full flow testable via curl
```

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 6: CHAT IDEATION UI (VISUAL-FIRST)
# ═══════════════════════════════════════════════════════════

**CLAUDE.md rule: Visual-first — build UI with sample data FIRST, then wire engine.**

## MP 6.1: Chat message components (static, sample data)
## MP 6.2: Agent activity sidebar (static, sample data)
## MP 6.3: Wire to API + SSE streaming
## MP 6.4: Phase indicator + mini structure preview

**Exit:** Full brainstorming conversation in browser.

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 7: CANVAS STRUCTURE UI
# ═══════════════════════════════════════════════════════════

## MP 7.1: Tree visualization component (collapsible, from seed data)
## MP 7.2: Node detail panel (edit title, description, outcomes)
## MP 7.3: Component palette (drag from registry to node)
## MP 7.4: Rubric score bar + live updates

**Exit:** Visual tree editor with rubric scoring.

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 8: WIZARD + PRODUCTION HANDOFF
# ═══════════════════════════════════════════════════════════

## MP 8.1: Dynamic wizard stepper
## MP 8.2: Component config forms (video, quiz, material, activity)
## MP 8.3: Review + confirm with cost estimator
## MP 8.4: Production handoff (creates StageSession jobs via pipelineJobId bridge)

**Exit:** Approved project creates production jobs in existing pipeline.

---

# ═══════════════════════════════════════════════════════════
# MACRO PHASE 9: TESTING, SECURITY & POLISH
# ═══════════════════════════════════════════════════════════

## MP 9.1: End-to-end test (Teacher Retooling through full flow)
## MP 9.2: Security (input validation, error handling, cost limits)
## MP 9.3: Polish (loading states, empty states, error boundaries)

**Exit:** All 3 project archetypes work end-to-end.

---

# SECURITY CHECKLIST (apply at every macro phase)

## Database
- [ ] All queries scoped by blueprintId (no cross-project leaks)
- [ ] No raw SQL — always Prisma client
- [ ] JSON fields validated with Zod before storage
- [ ] Cascade deletes tested (node deletion removes children + components)

## API
- [ ] All POST/PATCH validated with Zod
- [ ] Consistent error format: { error: string }
- [ ] 404 for missing resources (not 500)
- [ ] Rate limiting on agent endpoints (expensive API calls)

## Agents
- [ ] Every LLM call has cost tracking (tokens + USD)
- [ ] Agent outputs validated against expected types
- [ ] Timeout enforced per agent call
- [ ] Max retry limits respected
- [ ] API key in .env only, never in code

## Frontend
- [ ] No raw HTML rendering from agent outputs
- [ ] Loading states during agent processing
- [ ] Error boundaries on all dynamic pages
- [ ] Optimistic UI with rollback on failure

---

# EMERGENCY RECOVERY

## Claude Code producing wrong code
```
git stash
git checkout PC-X.Y-description   # last working tag
# Start new CC session, paste micro-phase prompt again
```

## Build broken after session
```
npm run typecheck 2>&1 | head -20  # see errors
# New session: "Fix ONLY these TypeScript errors: [paste]"
```

## Database migration failed
```
npx prisma migrate reset          # WARNING: drops all data
npm run db:seed:pc                 # re-seed
```

## Agent returns garbage
```
# Check: ANTHROPIC_API_KEY set?
# Check: system prompt < 4000 tokens?
# Add to prompt: "Return ONLY valid JSON. No markdown. No explanation."
```

---

*End of Adapted Implementation Guide v2.0*
