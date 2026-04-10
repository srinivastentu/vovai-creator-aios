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

## Workflow

1. **Plan first** — plan mode for 3+ step tasks. Re-plan if things go sideways.
2. **Subagents** — offload research/exploration. One task per subagent.
3. **Self-improve** — after ANY correction, update `tasks/lessons.md`.
4. **Verify** — never mark done without proving it works. Tests, logs, evidence.
5. **Elegance** — for non-trivial changes, ask "is there a more elegant way?"
6. **Autonomous** — given a bug, just fix it. Zero hand-holding.
7. **Visual-first** — mock data -> static UI -> API routes -> wire together.
8. **Approval gate** — before changing 3+ files, explain plan and get approval.

### Coding Standards

- TypeScript strict. No `any`. ES modules. 2-space indent. No semicolons.
- Functional React + hooks. Tailwind. shadcn/ui.
- Loop Engine takes injected deps — never imports agents.
- Pipeline orchestration in Domain Workflow, never in Loop Engine.

### Testing

- `npm run typecheck && npm run test -- --bail` before every commit
- 385+ tests must pass. `grep -r "from.*domain/" src/lib/core/` must return nothing.

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
