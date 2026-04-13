# VOVAI eLearn AIOS

> Agentic AI-powered end-to-end eLearning & Training Operating System. From a single project brief to a fully structured, multi-component learning experience. Humans guide, review, and approve at every critical gate.

---

## Architectural Contract

### Two-Category, Four-System Architecture

Every piece of code belongs to exactly one of two categories:

- **Core** (`src/lib/core/`) — Machinery. HOW things run. Domain-agnostic. Portable to any AIOS. Zero domain words anywhere.
- **Domain** (`src/lib/domain/`) — Configuration. WHAT runs. eLearning-specific. Contains all domain concepts, business rules, agent prompts, rubric definitions, pipeline configs.

**The one import rule:** `domain/` can import from `core/`. Never the reverse. No file inside `core/` ever imports from `domain/`. Enforced by: `grep -r "from.*domain/" src/lib/core/` must return nothing.

**The three-question test for any component:**
1. Would this change for Film AIOS? (Core = No, Domain = Yes)
2. Does it contain domain words? (Core = No, Domain = Yes)
3. Could another AIOS use it as-is? (Core = Yes, Domain = No)

### Four Systems

```
src/lib/core/                            <- CORE: Machinery (portable)
├── engine/                              <- System 1: Loop Engine
├── agentic/                             <- System 2: Agentic System
├── review/                              <- System 3: Human Review System
├── models/                              <- System 5: Model Management System (MMS)
├── tools/                               <- (future) Tool System
├── prompts/                             <- (future) Prompt System
├── context/                             <- (future) Context System
└── marketplace/                         <- (future) Marketplace System

src/lib/domain/                          <- DOMAIN: Configuration (eLearning-specific)
└── workflows/                           <- System 4: eLearning Domain Workflow
    ├── pipeline-orchestrator.ts
    ├── archetypes.ts
    ├── component-registry.ts
    ├── rubrics/
    ├── ideation/
    ├── production/
    ├── agents/
    ├── review-config.ts
    └── tree/
```

**System 1 — Loop Engine (`src/lib/core/engine/`):**
Runs ONE stage via `produce()` -> `evaluate()` -> `runLoop()` -> `processReview()`.
Agent and judge are injected (`AgentExecutor`, `JudgeFunction`), never imported.
4 patterns (standard, strategic+production, tournament, nested). 9 enforced rules.
State: `IDLE -> GENERATING -> EVALUATING -> (REVISING|PRESENTING) -> AWAITING_REVIEW -> APPROVED`.
See `docs/architecture/recursive-loop-engine.md` for full spec.

**System 2 — Agentic System (`src/lib/core/agentic/`):**
Agent execution machinery. Registry, executor with retries/timeouts/cost tracking, model router. Agent prompts, personas, and configs live in `domain/workflows/agents/`.

**System 3 — Human Review System (`src/lib/core/review/`):**
Gate enforcement. 5 actions: Approve, Reject, Feedback, Use Segments (phases 1-5), Mix & Produce (phases 1-5).
Artifacts editable during review. Reviewer roles in `domain/workflows/review-config.ts`.

**System 4 — eLearning Domain Workflow (`src/lib/domain/workflows/`):**
Pipeline orchestration, stage sequencing, archetypes, component registry, agent configs, rubrics.
6 phases: Phase 0 (ideation, runs once) -> Phases 1-5 (production per-component).
Order: Documents -> Assessments -> Videos -> Activities -> Capstone -> Meta.
8 human gates. See `docs/architecture/elearn-pipeline.md`.

**System 5 — Model Management System (`src/lib/core/models/`):**
Centralized gateway for ALL AI model calls. Model catalog, provider registry,
cost ledger, routing, rate limiting, health monitoring. Every AI call goes
through the gateway — no component talks directly to an AI provider.
Provider clients: fal-ai (Flux), OpenAI (DALL-E 3, GPT-4o vision),
Google Gemini (NanoBanana, Imagen 4), Freepik (Mystic).
See `docs/architecture/VOVAI_MMS_Architecture_v1.md`.

### Tech Stack

- **Frontend:** Next.js 15, React, TypeScript 6 strict, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API routes, Python scripts (media processing)
- **Database:** PostgreSQL (Homebrew), Prisma 7, Redis (queue/cache)
- **AI:** Anthropic SDK (Claude — producing), OpenAI (GPT-4o — judging), fal.ai, ElevenLabs, Runway/Kling, Suno
- **Testing:** Vitest | **Package manager:** npm
- **Auth:** Clerk | **Billing:** Stripe | **Deploy:** Vercel

### Architectural Principles

1. Event-driven  2. Artifact-centric  3. Immutable history  4. Stateless agents
5. Human sovereignty (no auto-approve)  6. Cost transparency (every LLM call tracked)
7. Graceful degradation  8. Modular & configurable — system suggests, user decides; no component mandatory

### Adding New Core Systems (Future)

Follow the Core vs Domain Separation Framework (`docs/architecture/core-domain-framework.md`). For any new system: list components, apply three-question test, place machinery in `core/[system]/`, place configuration in `domain/workflows/[system]/`, verify import rule.

---

## Build Progress — Loop Engine v2

**Branch:** `feature/loop-engine-v2` (14 steps, all complete, ready for merge to main)
**Tests:** 641 | **Architectural contract:** `grep -r "from.*domain/" src/lib/core/` returns nothing
**Action plan:** `docs/implementation-guides/loop-engine-action-plan.md`

| Step | Tag | What Was Built |
|------|-----|----------------|
| LE-0 | `LE-0-folder-restructure` | Moved `project-component/` → `domain/workflows/`. All 385 tests pass at new paths. |
| LE-1 | `LE-1-engine-types` | Core engine types: LoopStage, LoopState, GradeReport, RubricDefinition, AgentExecutor, JudgeFunction. 13 exports, zero domain imports. |
| LE-2 | `LE-2-loop-functions` | 5 core functions: createInitialState, produce, evaluate, runLoop, processReview. 25 tests, 9 loop rules enforced. |
| LE-3 | `LE-3-generic-grader` | Generic rubric grader in core/agentic. gradeArtifact, calculateWeightedScore, checkThresholds. 17 tests. |
| LE-4 | `LE-4-ideation-rubrics` | 4 new ideation rubrics (brief, audience, component, handoff) + structure compat. 27 tests, 454 total. |
| LE-5 | `LE-5-review-system` | Human Review System in core/review. Gate enforcement, 5 actions, sovereignty checks. 28 tests. |
| LE-6 | `LE-6-pipeline-orchestrator` | Pipeline orchestrator in domain/workflows. 8 functions, 26 tests, bridges all core systems. |
| LE-7 | `LE-7-ideation-config` | 5 ideation stages wired with real agent configs + rubrics. 20 tests, explicit stage deps. |
| LE-8 | `LE-8-api-routes` | 4 pipeline API routes (start, run, review, state). Zod schemas, mock executor. Integration tests. |
| LE-9 | `LE-9-per-stage-conversations` | Per-stage conversation isolation. Prisma migration, 2 functions, 7 tests. |
| LE-10 | `LE-10-real-agents` | Agent bridge wiring real agents. Cost tracking integration. 14 tests, 579 total. |
| LE-11 | `LE-11-e2e-pipeline` | Full 5-stage pipeline E2E. 47 mock tests + 6 live tests, all 4 systems integrated. 626 total. |
| LE-12 | `LE-12-document-pipeline-proof` | Document pipeline proof — same engine, different domain config. 15 tests, 641 total. Engine universality proven. |
| LE-13 | `LE-13-docs-complete` | Final docs update, verification, merge to main. |

---

## Workflow

1. **Plan first** — plan mode for 3+ step tasks. Re-plan if things go sideways.
2. **Subagents** — offload research/exploration. One task per subagent.
3. **Self-improve** — after ANY correction, update `tasks/lessons.md`.
4. **Verify** — never mark done without proving it works. Tests, logs, evidence.
5. **Elegance** — for non-trivial changes, ask "is there a more elegant way?"
6. **Autonomous** — given a bug, just fix it. Zero hand-holding.
7. **Visual-first** — mock data -> static UI -> API routes -> wire together.
8. **Approval gate** — before changing 3+ files, explain plan and get approval.
9. **New stage kickoff** — before implementing a new production stage (image, audio, video, code, design, etc.), read `docs/decisions/` and `tasks/lessons.md` first. Apply the operating principles captured there, and add new entries as you discover them.

### Coding Standards

- TypeScript strict. No `any`. ES modules. 2-space indent. No semicolons.
- Functional React + hooks. Tailwind. shadcn/ui.
- Loop Engine takes injected deps — never imports agents.
- Pipeline orchestration in Domain Workflow, never in Loop Engine.

### Testing

- `npm run typecheck && npm run test -- --bail` before every commit
- 641+ tests must pass. `grep -r "from.*domain/" src/lib/core/` must return nothing.

### Core Principles

- **Simplicity First:** Make every change as simple as possible. Impact minimal code.
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** Changes should only touch what's necessary. Avoid introducing bugs.

### Task Management

1. **Plan First:** Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan:** Check in before starting implementation
3. **Track Progress:** Mark items complete as you go
4. **Explain Changes:** High-level summary at each step
5. **Document Results:** Add review section to `tasks/todo.md`
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections

### Build & Test Commands

```bash
npm run dev              # Dev server -> http://localhost:3000
npm run build            # Production build
npm run test             # All tests
npm run lint             # ESLint
npm run typecheck        # TypeScript strict
npx prisma migrate dev   # Database migrations
npx prisma studio        # Visual database browser
npm run db:seed:pc       # Seed project component data
npm run test:e2e         # E2E test
```

### Compact Instructions

When compacting, ALWAYS preserve:
- Two categories: core (machinery) vs domain (configuration)
- Four systems: Loop Engine, Agentic, Review, Domain Workflow
- The one import rule: domain imports core, never reverse
- Loop Engine runs ONE stage, Domain Workflow sequences stages
- Core functions: `produce() -> evaluate() -> runLoop() -> processReview()`
- Injected dependencies: AgentExecutor, JudgeFunction
- Active tasks from `tasks/todo.md`

---

## Reference Docs (read on demand, not preloaded)

- Architecture overview: `docs/architecture/system-overview.md`
- Loop engine spec: `docs/architecture/recursive-loop-engine.md`
- Core vs domain framework: `docs/architecture/core-domain-framework.md`
- Pipeline stages: `docs/architecture/elearn-pipeline.md`
- Agent persona template: `docs/agents/persona-template.md`
- Rubric schemas: `docs/rubrics/structure-rubric-schema.json`, `docs/rubrics/production-rubric-schema.json`
- Project learnings (retrospectives): `docs/decisions/` — read before any new production stage
- Accumulated lessons: `tasks/lessons.md` — read and extend as work proceeds
