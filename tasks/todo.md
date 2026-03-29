# VOVAI eLearn AIOS — Task Tracker

## Current Phase: Ring 0 — Project Setup (Mac)

### Day 0: Setup
- [x] Run setup script — project structure created
- [x] Open in VS Code: `code vovai-elearn-aios`
- [x] Open Claude Code in VS Code (Cmd+Shift+P → "Claude Code: Open")
- [x] Tell Claude: "Read CLAUDE.md and tasks/todo.md. Confirm you understand."

### Day 1: Install Dependencies
- [x] Tell Claude: install Next.js 14, TypeScript, Tailwind, shadcn/ui
- [x] Tell Claude: install Prisma, set up PostgreSQL connection
- [x] Tell Claude: install Vitest for testing
- [x] Verify: `npm run dev` works, see page at http://localhost:3000

### Day 2: Database
- [x] Install PostgreSQL via Homebrew (if not installed)
- [x] Create database: vovai_elearn_dev
- [x] Tell Claude: create Prisma schema (projects, artifacts, grades, stages)
- [x] Run first migration: npx prisma migrate dev
- [ ] Verify: npx prisma studio shows tables

---

## Ring 1: Script Pipeline (Weeks 1-4)

### Week 1: UI Shell (Visual-First)
- [x] Dashboard page — project list with status
- [x] New project form — topic, audience, duration
- [ ] Project detail page — pipeline stages with status
- [ ] Review interface skeleton — script, scorecard, 3 buttons

### Week 2: Engine Core
- [ ] Implement core types (from src/lib/types.ts)
- [ ] Implement produce() — Claude API integration
- [ ] Implement evaluate() — GPT-4o cross-model judging
- [ ] Implement runLoop() — async generator with SSE
- [ ] Connect SSE to UI — real-time streaming

### Week 3: Review System + Script Agent
- [ ] Implement processReview() — approve/feedback/reject
- [ ] Connect review buttons to API
- [ ] Load Script Writer agent from config YAML
- [ ] Load script rubric from config JSON
- [ ] Integration test: topic → script → review → approve

### Week 4: Polish + Test
- [ ] End-to-end: create project, generate script, review, approve
- [ ] Cost tracking on every LLM call
- [ ] Iteration history display in UI
- [ ] Fix all bugs found during testing
- [ ] 🎯 MILESTONE: "The loop genuinely improves eLearning scripts"

---

## Ring 2: Visual Pipeline (Weeks 5-7)
- [ ] Image Prompt Engineer agent + rubric
- [ ] fal.ai integration (FLUX model)
- [ ] Tournament engine (multiple models, parallel)
- [ ] Image Judge (GPT-4o Vision)
- [ ] Style anchor pattern (Scene 1 = reference)
- [ ] Storyboard assembly view
- [ ] Storyboard review screen
- [ ] 🎯 MILESTONE: "Topic → Script → Images → Storyboard"

## Ring 3: Audio + Assembly (Weeks 8-10)
- [ ] ElevenLabs voice-over integration
- [ ] Runway/Kling video generation
- [ ] Music/SFX generation
- [ ] FFmpeg per-scene assembly
- [ ] Full assembly + transitions
- [ ] 🎯 MILESTONE: "Topic → complete eLearning video"

## Ring 4: Production UI (Weeks 11-14)
- [ ] Full production portal
- [ ] Workshop (prompt/rubric editors)
- [ ] Analytics dashboard
- [ ] 🎯 MILESTONE: "Complete, usable production system"

## Ring 5: Platform (Weeks 15-20)
- [ ] Multi-tenant + auth + billing
- [ ] Deployment
- [ ] First client project
- [ ] 🎯 MILESTONE: "Commercial platform, first paying client"

---

## Project Component Build Status

*Generated 2026-03-29 — full codebase audit*

### What exists today

**Prisma Models (11):**
- Project — core project entity (name, topic, audience, duration, status, ring)
- StageSession — one session per pipeline stage per project
- Artifact — immutable versioned content (script text, image URL, etc.)
- IterationRecord — one row per loop iteration with grade + cost
- ProjectBlueprint — archetype, hierarchy labels, audience, outcomes, enabled components
- ProjectNode — tree node (self-referential via parentId, materialized path)
- NodeComponent — production component attached to a node (video, quiz, etc.)
- IdeationConversation — brainstorm conversation linked to blueprint
- IdeationMessage — individual message in ideation conversation
- BlueprintVersion — immutable snapshot of blueprint + nodes + components
- StructureGrade — 7-dimension grade of blueprint quality

**Prisma Enums (10):**
- ProjectStatus (draft, in_progress, completed)
- SessionStatus (idle, generating, evaluating, presenting, awaiting_review, approved)
- IterationOutcome (revised, presented, escalated, approved)
- ProjectArchetype (course, workshop, certification, tutorial, bootcamp, microlearning)
- NodeStatus (draft, ideating, structured, approved, in_production, completed)
- ComponentStatus (planned, configured, queued, in_production, completed, skipped)
- ComponentPriority (core, recommended, optional)
- IdeationPhase (brainstorm, structure, refinement, review, approved)
- BrainstormRole (human, facilitator, researcher, pedagogy_expert, audience_analyst, structure_architect, creative_director, critic, synthesizer)
- GradeRecommendation (approve, revise, restructure, reject)

**Page Routes (4):**
- src/app/page.tsx — home / landing
- src/app/(pages)/dashboard/page.tsx — project list (sample data)
- src/app/(pages)/project/new/page.tsx — create project form (connected to API)
- src/app/(pages)/project/[id]/page.tsx — project detail with 3 view tabs (sample data)

**API Routes (2):**
- src/app/api/projects/route.ts — POST: create project (Zod validated)
- src/app/api/project-component/health/route.ts — GET: count blueprints/nodes/components

**src/lib files (6):**
- src/lib/types.ts — Artifact, Grade, ReviewAction, IterationRecord, CostRecord, StageConfig, StageSession, Project, LoopEvent
- src/lib/engine.ts — produce(), evaluate(), runLoop(), processReview() — all stubs (throw "Not yet implemented")
- src/lib/pipeline.ts — STAGES[] (16 stages), RINGS[], getStage(), getLoopLabel()
- src/lib/utils.ts — cn() utility for Tailwind class merging
- src/lib/db.ts — Prisma client singleton (PrismaPg adapter)
- src/lib/validations/project.ts — createProjectSchema (Zod)

**UI Components (11):**
- src/components/ui/button.tsx — shadcn button
- src/components/ui/card.tsx — shadcn card
- src/components/ui/input.tsx — shadcn input
- src/components/ui/badge.tsx — shadcn badge
- src/components/ui/label.tsx — shadcn label
- src/components/ui/textarea.tsx — shadcn textarea
- src/components/dashboard/project-card.tsx — project card for dashboard
- src/components/project/stage-card.tsx — pipeline stage card
- src/components/project/version-a.tsx — grid view of stages
- src/components/project/version-b.tsx — timeline view of stages
- src/components/project/version-c.tsx — sidebar view of stages

**Config Files (5):**
- config/agents/elearn-aios/script-writer.yml — Script Writer agent persona
- config/agents/elearn-aios/image-prompt-engineer.yml — Image Prompt Engineer persona
- config/agents/elearn-aios/voiceover-agent.yml — Voice-Over agent persona
- config/rubrics/elearn-script.json — Script quality rubric (5 dimensions, 1-10 scale)
- config/pipelines/elearn-aios-pipeline.json — 16-stage pipeline definition

**Doc/Schema Files (3):**
- docs/rubrics/rubric-schema.json — Production rubric schema (5 dimensions, 1-10)
- docs/rubrics/structure-rubric-schema.json — Structure rubric schema (7 dimensions, 0-100)
- docs/rubrics/production-rubric-schema.json — Production rubric schema (5 dimensions, 1-10)

**Scripts (1):**
- scripts/seed-project-component.ts — Seeds project, blueprint, 12 nodes, 25 components, 3 ideation messages

**Generated (Prisma Client):**
- src/generated/prisma/ — 11 model files + client + enums + types (auto-generated, do not edit)

---

### What the Project Component adds

#### Macro 2: Registries & Types

**TypeScript types:**
- src/lib/types/project-component.ts — Blueprint, ProjectNode, NodeComponent TS interfaces (mirrors Prisma but for app layer)
- src/lib/types/ideation.ts — IdeationConversation, IdeationMessage, BrainstormRole types
- src/lib/validations/blueprint.ts — Zod schemas for blueprint creation, node CRUD, component config

**Structure rubric (actual instance, not just schema):**
- config/rubrics/elearn-structure.json — 7-dimension rubric instance (coverage, depth, progression, balance, engagement, feasibility, coherence)

**Ideation agent personas (8 brainstorm roles):**
- config/agents/elearn-aios/facilitator.yml
- config/agents/elearn-aios/researcher.yml
- config/agents/elearn-aios/pedagogy-expert.yml
- config/agents/elearn-aios/audience-analyst.yml
- config/agents/elearn-aios/structure-architect.yml
- config/agents/elearn-aios/creative-director.yml
- config/agents/elearn-aios/critic.yml
- config/agents/elearn-aios/synthesizer.yml

*Subtotal: ~12 files*

#### Macro 3: Tree Engine + API

**Engine logic:**
- src/lib/project-component/tree-engine.ts — CRUD for ProjectNode tree (add/move/delete/reorder nodes, materialized path management)
- src/lib/project-component/blueprint-engine.ts — Create/update blueprint, archetype logic, hierarchy label mapping
- src/lib/project-component/component-rules.ts — Rules for which components attach at which depth (modules get overview/assessment, topics get production components, subtopics are structural only)

**API routes:**
- src/app/api/project-component/blueprint/route.ts — GET/POST/PUT blueprint
- src/app/api/project-component/nodes/route.ts — GET (tree), POST (add node)
- src/app/api/project-component/nodes/[id]/route.ts — GET/PUT/DELETE single node
- src/app/api/project-component/components/route.ts — GET/POST components for a node

*Subtotal: ~7 files*

#### Macro 4: Ideation Agents

**Engine logic:**
- src/lib/project-component/ideation-engine.ts — Orchestrate multi-agent brainstorm: route turns to appropriate agent, manage conversation phases (brainstorm -> structure -> refinement -> review)
- src/lib/project-component/agent-loader.ts — Load YAML agent persona, construct system prompt, call AI provider

**API routes:**
- src/app/api/project-component/ideation/route.ts — GET/POST conversations
- src/app/api/project-component/ideation/[id]/messages/route.ts — GET messages, POST new message (triggers agent response)

*Subtotal: ~4 files*

#### Macro 5: Loop Engine (Structure Grading)

**Engine logic:**
- src/lib/project-component/structure-grader.ts — Grade blueprint against 7-dimension structure rubric using GPT-4o as judge
- src/lib/project-component/structure-loop.ts — Refinement loop: grade -> identify weak dimensions -> auto-revise OR escalate to human -> re-grade (max N iterations)

**API routes:**
- src/app/api/project-component/grade/route.ts — POST: trigger grading, GET: latest grade

*Subtotal: ~3 files*

#### Macros 6-8: UI Pages & Components

**Pages:**
- src/app/(pages)/project/[id]/blueprint/page.tsx — Blueprint overview + archetype selector + hierarchy editor
- src/app/(pages)/project/[id]/ideation/page.tsx — Multi-agent brainstorm chat interface
- src/app/(pages)/project/[id]/structure/page.tsx — Interactive tree editor + structure scorecard

**Components:**
- src/components/project-component/blueprint-header.tsx — Archetype badge, audience, outcomes summary
- src/components/project-component/archetype-selector.tsx — Visual picker for 6 archetypes
- src/components/project-component/node-tree.tsx — Collapsible tree view with drag-and-drop
- src/components/project-component/node-editor.tsx — Edit node title, description, outcomes, notes
- src/components/project-component/component-list.tsx — Components per node with priority/status
- src/components/project-component/ideation-chat.tsx — Chat bubbles with role avatars + structured suggestions
- src/components/project-component/structure-scorecard.tsx — 7-dimension radar chart + grade display

*Subtotal: ~10 files*

#### Macro 9: Handoff + Integration

**Engine logic:**
- src/lib/project-component/handoff.ts — Convert approved NodeComponents to StageSession pipeline jobs (set pipelineJobId, create sessions)

**API routes:**
- src/app/api/project-component/handoff/route.ts — POST: trigger handoff for approved blueprint

*Subtotal: ~2 files*

#### Tests (throughout all macros)

- tests/unit/tree-engine.test.ts
- tests/unit/component-rules.test.ts
- tests/unit/blueprint-engine.test.ts
- tests/unit/ideation-engine.test.ts
- tests/unit/structure-grader.test.ts
- tests/unit/handoff.test.ts

*Subtotal: ~6 files*

**TOTAL NEW FILES: ~44**

---

### Architecture Understanding Check

**1. What is the difference between Level 1 (engine) and Level 2 (product)?**

Level 1 (Engine) is the platform code: the recursive loop engine (`runLoop`, `produce`, `evaluate`, `processReview`), the orchestrator, registries, grading system, and review interface. It is media-agnostic — the same engine works for scripts, images, videos, music, or any future content type.

Level 2 (Product) is the eLearn AIOS configuration: agent personas (YAML), rubrics (JSON), pipeline definitions (JSON), domain knowledge. Adding a "Film AIOS" or "Podcast AIOS" later means creating new config files — NOT modifying `src/lib/engine.ts`. If a new media type requires engine changes, the engine isn't flexible enough.

**2. Which pipeline phase runs FIRST and why?**

Phase 0 (Project Component / Ideation) runs first. Before any production can happen, the system needs to know WHAT to produce: how many modules, topics, and subtopics exist, what components each needs (video, quiz, study material), and what learning outcomes to target. Phase 0 brainstorms, structures, grades, and gets human approval on the blueprint. Only then can the 16-stage production pipeline (Phases 1-5) begin processing individual NodeComponents through discovery, scripting, image gen, voiceover, assembly, etc.

**3. How does NodeComponent.pipelineJobId bridge to StageSession?**

`NodeComponent.pipelineJobId` is a foreign key pointing to `StageSession.id`. When the blueprint is approved and handoff occurs:
- Each approved NodeComponent (e.g., "video" for "Learning Theories" topic) gets a new StageSession created for it
- The StageSession's `stageId` points to Stage 1 (Discovery) of the 16-stage pipeline
- `pipelineJobId` is set to this StageSession's ID
- The production pipeline then advances that StageSession through stages 1 -> 2 -> 3 -> ... -> 16
- This is the bridge: Phase 0 says "produce a video for this topic" (NodeComponent), and the pipeline says "here's how we'll produce it" (StageSession chain)

**4. What are the 7 structure rubric dimensions?**

Per `docs/rubrics/structure-rubric-schema.json` and the `StructureGrade.dimensionScores` comment:
1. **Coverage** — Are all necessary topics addressed? No critical gaps?
2. **Depth** — Is the level of detail appropriate for the audience and duration?
3. **Progression** — Does learning build logically from foundations to advanced concepts?
4. **Balance** — Are modules/topics reasonably balanced in scope and weight?
5. **Engagement** — Does the structure support varied, engaging learning experiences?
6. **Feasibility** — Can this structure be realistically produced within constraints (time, budget, tools)?
7. **Coherence** — Do all parts fit together into a unified, consistent whole?

Scored on 0-100 scale (not 1-10 like production rubrics). Pass threshold default: 75.

**5. What are the project archetypes and their production modes?**

The `ProjectArchetype` enum defines 6 archetypes, which group into 3 production modes:

| Production Mode | Archetypes | Characteristics |
|---|---|---|
| **Full Curriculum** | `course`, `certification`, `bootcamp` | All components enabled (video, quiz, study_material, activity, capstone). Deep hierarchy (3+ levels). Full pipeline with all 16 stages. Longest production. |
| **Focused Training** | `workshop`, `tutorial` | Selective components (video + activity primary). Shallower hierarchy (2 levels). Fewer stages needed. Medium production. |
| **Bite-Sized** | `microlearning` | Minimal components (video only or video + quiz). Flat hierarchy (1-2 levels). Streamlined pipeline. Fastest production. |

The archetype drives: which `enabledComponents` are available, how deep the hierarchy goes, and which pipeline stages are actually needed for each NodeComponent.

**6. What loop pattern does Phase 0 (ideation) use?**

Phase 0 uses **Pattern 2: Strategic + Production Loop**.

- **Strategic Phase:** Multiple specialist agents (facilitator, researcher, pedagogy_expert, audience_analyst, structure_architect, creative_director, critic, synthesizer) brainstorm in a multi-turn conversation. They analyze the project brief, discuss approaches, and propose structure. This is the "research before production" phase.
- **Production Phase:** The synthesizer/structure_architect assembles the brainstorm output into a concrete blueprint (nodes + components). This structure is then graded against the 7-dimension structure rubric.
- **Loop:** If the grade is below threshold (75), the system identifies weak dimensions and refines. Up to `maxRefinementLoops` (default 5) before forcing human review.
- **Human Gate:** Human reviews the graded structure with 4 actions: approve, revise, restructure, reject (mapped from `GradeRecommendation` enum).
