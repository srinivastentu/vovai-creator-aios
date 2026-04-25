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
├── storage/                             <- Output path resolution (OUTPUT_DIRS)
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
Google Gemini (NanoBanana, Imagen 4), Freepik (Mystic), ElevenLabs (voice).
See `docs/architecture/VOVAI_MMS_Architecture_v1.md`.

**Storage (`src/lib/core/storage/`):**
Output path resolution. Exports `OUTPUT_DIRS` (text / image / voice / music / video / cost-ledger),
`resolveOutputPath(kind, filename)` (rejects traversal), and `ensureOutputDir(kind)`.
Base directory overridable via `OUTPUT_BASE_DIR`. Future home for cost-ledger persistence.

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

## Build Progress

**Branch:** `main`
**Tests:** 1033 (1024 passing + 9 gated-live skipped) across 62 files
**Architectural contract:** `grep -r "from.*domain/" src/lib/core/` returns nothing
**Action plan:** `docs/implementation-guides/loop-engine-action-plan.md`

### Loop Engine v2 (merged — 14 steps)

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

### Phase 3 — Text Generation (complete)

First real end-to-end production stage. Retrospective: [docs/decisions/001-project-learnings-phase-3.md](docs/decisions/001-project-learnings-phase-3.md).

| Phase | Commit | What Was Built |
|---|---|---|
| 3.1 | `8a39502` | Text producer adapter — PRESERVE/IMPROVE revise rule (dimensions ≥8 preserved, <8 targeted) |
| 3.2 | `52788a8` | OpenAI text judge + 5-dim rubric; cross-family producer/judge (Claude produces, GPT-4o judges) |
| 3.3 | `7e88a05` | Deterministic text validators — Tier-1 structural gates run before the judge |
| 3.4 | `6ac8bb9` | First real end-to-end text loop; best-version tracking separated from latest-version |
| 3.5 | `8ce29a6` | Text generation proving-interface UI at `/generate/text` |

### Phase 4 — Image Generation (complete)

Tournament pattern proven on a second artifact type. Retrospective: [docs/decisions/002-image-pipeline-learnings.md](docs/decisions/002-image-pipeline-learnings.md). Pattern spec: [docs/architecture/tournament-pattern.md](docs/architecture/tournament-pattern.md).

| Phase | Commit | What Was Built |
|---|---|---|
| 4.0A | `dde45b4` | MMS foundation — types, catalog, provider registry |
| 4.0B | `96d85d4` | MMS plumbing — cost ledger, router, rate limiter, health, gateway |
| 4.1A | `b555df5` | fal.ai Flux provider (Dev + Pro 1.1) + gateway timeout |
| 4.1-prep | `534d159` | Shared provider utilities, abort signal threading, timeout unification |
| 4.1C-fix | `49debd6` | URL-encode `modelApiId`; move API keys from query strings to headers; mask keys in errors |
| 4.1D | `29c3fc3` | Freepik Mystic provider + async-poll `pollUntilComplete` utility |
| 4.1E | `05da6f3` | MMS end-to-end integration tests + rate-limiter race fix (synchronous slot reservation) |
| 4.2 | `7814ef9` | Image judge — vision-based (GPT-4o) scoring via MMS gateway |
| 4.2 | — | Image rubric — 5 dimensions (prompt-alignment, visual-clarity, style-quality, technical-quality, completeness) |
| 4.3 | `37a0bfa` | Deterministic image validators — fileExists, fileSize, imageDimensions (Tier-1 pre-judge) |
| 4.4 | `bb29d35` | Tournament runner — parallel multi-model competition with judge ranking + PRESERVE/IMPROVE refinement |
| 4.5 | `db195b9` | `/generate/image` UI — tournament-powered, SSE streaming, two-column (current round + best-so-far) |
| 4.5-fix | `d40e787`, `6923435` | Disabled unverified Imagen 4 + `nanobanan-2`; humanised provider errors |
| 4.5-fix | `314d29e` | Judge calibration prompt (7 = competent, 8 = professional, 9+ = rare); validator threshold tuning |
| 4.5-refactor | `3e41b50` | Regenerate + feedback prompt augmentation moved from page component into `useImageTournament` hook |

### Phase 5 — Audio Generation (in progress)

Tournament pattern extending to voice + music. Active spine in [tasks/todo.md](tasks/todo.md). MMS gateway is now the single point for character-based pricing.

| Phase | Commit | What Was Built |
|---|---|---|
| 5.0 | `37679ff` | `OUTPUT_DIRS` constant + path helpers in [src/lib/core/storage/output-paths.ts](src/lib/core/storage/output-paths.ts) — text / image / voice / music / video / cost-ledger |
| 5.0 | `0382bbd`, `63c7751` | Provider image output + `/api/images` route routed through `OUTPUT_DIRS.image` |
| 5.0 | `a2abb9d` | Regression guard test against hard-coded output paths. Tagged `v5.1.0` |
| 5.1A | `1690484` | Character-based pricing in MMS gateway cost estimator (per-1k-character tiering) |
| 5.1A | `a716427` | ElevenLabs voice-synthesis provider client — [src/lib/core/models/providers/elevenlabs.ts](src/lib/core/models/providers/elevenlabs.ts) |
| 5.1A | `4f448f4` | Registered ElevenLabs provider + 3 voice models in MMS catalog |
| 5.1A | `596ac28` | Wired ElevenLabs client into gateway when `ELEVENLABS_API_KEY` is set |
| 5.1A | `dd39290` | ElevenLabs ↔ gateway integration tests |
| 5.1D | `eaeafdc` | Signoff fixes — `calculateFinalCost` rename, explicit no-throw test, unit-union tightening |
| 5.1D | `2abb9b9`, `5b74288` | Consolidated OUTPUT_DIRS + ElevenLabs learnings into contract & MMS spec; documented eleven-v3 disabled-reason |

**Upcoming (5.1B/C/E → 5.5):** voice rubric + Tier-3 auditor judge, voice validators, tournament CLI dry-run, Suno music client (5.2), generic `TournamentRunner<T>` + SSE helper extraction (5.3), `/generate/audio` UI (5.4), retro `003-audio-pipeline-learnings.md` + `v2.2.0-audio-generation` tag (5.5). Tracked tech debt: TD-3..TD-11 in [tasks/todo.md](tasks/todo.md) — TD-10 (pre-call budget check) and TD-11 (structured provider error codes) are Phase 6 hard-blockers.

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
10. **Tracker snapshot at spec kickoff** — at the start of every new micro-phase spec, paste the current state of the relevant `tasks/todo.md` section verbatim into the spec before entering plan mode. Keeps architect and executor working from the same text.

### Coding Standards

- TypeScript strict. No `any`. ES modules. 2-space indent. No semicolons.
- Never widen a literal-string union with `| string` — add new literal members explicitly. `| string` collapses the union at the type level and silently defeats exhaustiveness and typo protection.
- Functional React + hooks. Tailwind. shadcn/ui.
- Loop Engine takes injected deps — never imports agents.
- Pipeline orchestration in Domain Workflow, never in Loop Engine.

### Testing

- `npm run typecheck && npm run test -- --bail` before every commit
- 1033+ tests must pass (1024 + 9 gated-live). `grep -r "from.*domain/" src/lib/core/` must return nothing.

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
- Tournament pattern spec: `docs/architecture/tournament-pattern.md` (media artifacts — image, audio, video)
- Model Management System spec: `docs/architecture/VOVAI_MMS_Architecture_v1.md`
- Core vs domain framework: `docs/architecture/core-domain-framework.md`
- Pipeline stages: `docs/architecture/elearn-pipeline.md`
- Agent persona template: `docs/agents/persona-template.md`
- Rubric schemas: `docs/rubrics/structure-rubric-schema.json`, `docs/rubrics/production-rubric-schema.json`
- Project learnings (retrospectives):
  - `docs/decisions/001-project-learnings-phase-3.md` — text stage (through Phase 3.5)
  - `docs/decisions/002-image-pipeline-learnings.md` — image stage, MMS, tournament (through Phase 4.5)
- Accumulated lessons: `tasks/lessons.md` — read and extend as work proceeds
