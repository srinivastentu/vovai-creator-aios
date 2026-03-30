# VOVAI eLearn AIOS

> Agentic AI-powered end-to-end eLearning & Training Operating System. From a single project brief to a fully structured, multi-component learning experience. Autonomous agent teams ideate, structure, design, produce, polish, and deliver complete eLearning projects — from multi-module courses with study materials, videos, assessments, activities, simulations, and capstone projects to single explainer videos. Supports K-12 curriculum courses, professional training programs, and ongoing content channels. Humans guide, review, and approve at every critical gate.

---

## Architectural Contract

### Two-Level Architecture (NEVER confuse)

The platform is built in two layers. Every decision you make should pass the separation test: "Am I changing the engine, or configuring a product?"

- **Level 1 — Engine (src/lib/engine.ts, src/lib/project-component/):** The universal platform machinery. Recursive loop engine, orchestrator, pipeline state machine, rubric grading, review interface, tree engine, agent executor framework. This code does NOT know what an "eLearning video" or a "quiz" is — it only knows artifacts, loops, grades, and gates. Written once. Never changes for new content types.
- **Level 2 — Product (config/, registries, agent prompts, rubric definitions):** The eLearning-specific configuration that tells the engine WHAT to build. Archetypes, component registry, pipeline stage configs, agent personas, domain rubrics. Adding Film AIOS or Creator AIOS later = new config files and registries, NOT new engine code.
- **The test:** If supporting a new content type requires changes to engine.ts or loop-engine.ts, the engine isn't flexible enough — refactor the engine, don't add a special case.
- **In practice:** New component type / archetype / agent → Level 2 (registry). Changing how loops or trees work → Level 1 (rare).

### Tech Stack (Mac)

- **Frontend:** Next.js 14+, React, TypeScript strict, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API routes, Python scripts (media processing)
- **Database:** PostgreSQL (Homebrew), Prisma ORM, Redis (queue/cache)
- **AI:** Anthropic SDK (Claude — producing), OpenAI (GPT-4o — judging, vision), fal.ai (images), ElevenLabs (voice), Runway/Kling (video), Suno (music)
- **Media:** FFmpeg (Homebrew) — assembly, rendering, format conversion
- **Auth:** Clerk | **Billing:** Stripe | **Deploy:** Vercel

### The Recursive Loop Engine

Four loop patterns, one `runLoop()` function, configured per stage:

1. **Standard:** Produce → Evaluate → Refine → Threshold → Review
2. **Strategic + Production:** Research → Plan → Confirm Goal → Standard Loop
3. **Tournament:** Produce ×N models → Judge ALL → Rank → Winner or Round 2
4. **Nested Inner:** Agent self-plans internally → Output → Standard evaluate cycle

Core functions: `produce()` → `evaluate()` → `runLoop()` → `processReview()`

Loop rules: min 2 iterations, track BEST version, checkpoint every iteration, dimension-aware revision (preserve ≥8, improve <8), feedback applied once then cleared, deterministic validators before LLM judge, cross-model judging (producer ≠ judge), cost tracking on every call, graceful degradation on failure.

Full details: @docs/architecture/recursive-loop-engine.md

### Five Human Review Actions

| Action | Behavior |
|--------|----------|
| **Approve** | Lock artifact. Stage complete. Pipeline advances. |
| **Feedback** | Re-enter loop with feedback (up to 3 more iterations). |
| **Reject** | Fresh start. No previous context. Different approach. |
| **Use Segments** | Approve parts, reject others. Rejected parts re-enter loop. |
| **Mix & Produce** | Combine elements from different versions into new artifact. |

### Seven Architectural Principles

1. **Event-Driven:** All state changes emit events. Components react, never poll.
2. **Artifact-Centric:** The artifact is the fundamental unit of work.
3. **Immutable History:** Never delete or overwrite artifact versions.
4. **Agent Composability:** Agents are stateless. Receive context, produce artifact, return.
5. **Human Sovereignty:** No artifact enters approved state without explicit human action.
6. **Cost Transparency:** Every LLM call is metered, tracked, attributable.
7. **Graceful Degradation:** On failure, preserve all state, resume from last stable point.
8. **User Sovereignty Over Defaults:** The system suggests, never enforces. Archetypes provide recommended defaults, but users can disable/enable ANY component at ANY level (Course, Module, Topic, Subtopic) at ANY time. No component is compulsory. No level has mandatory components. Subtopics have ZERO default components — they are structural only unless the user explicitly adds components. The system's job is to recommend; the user's job is to decide.

### eLearn Pipeline — 6 Phases

Documents first. Every phase builds on verified output from the phase before it. Full stage-level details: @docs/architecture/elearn-pipeline.md

```
Phase 0: PROJECT IDEATION & STRUCTURE (runs once per project)
  0.1 Brief & archetype detection → 0.2 Audience & curriculum design →
  0.3 Outcomes & components → 0.4 Rubric grading (7 dims, ≥75 to pass) →
  0.5 Human review [GATE] → 0.6 Configuration wizard → 0.7 Production handoff

Phase 1: DOCUMENT PIPELINE (runs first — textual foundation)
  D1 Research → D2 Content generation → D3 Formatting →
  D4 Quality validation → D5 Review [GATE]
  Components: study_material, worksheet, flashcards, glossary, resource_library,
  mentor_checklist, discussion_prompt

Phase 2: ASSESSMENT PIPELINE
  A1 Outcome-to-question mapping → A2 Question generation →
  A3 Answer validation (cross-model) → A4 Difficulty calibration →
  A5 Quality review [GATE] → A6 Packaging (JSON/PDF/SCORM)
  Components: quiz, pre_assessment, post_assessment

Phase 3: VIDEO PIPELINE (16 stages)
  Script: V1 Discovery → V2 Script writing → V3 Script review [GATE]
  Visual: V4 Prompts → V5 Image gen (tournament) → V6 Storyboard → V7 Review [GATE]
  Audio:  V8 Voice-over → V9 Video gen (tournament) → V10 Music (tournament) →
          V11 Per-scene assembly → V12 Full assembly
  Finish: V13 Captions → V14 Render → V15 QA → V16 Delivery [GATE]
  Per-scene processing: V2, V4-V11 run once per scene (sceneIndex on Artifact)
  Components: video, video_short

Phase 4: ACTIVITY PIPELINE
  T1 Activity design → T2 Material generation → T3 Exemplar creation →
  T4 Quality validation → T5 Review [GATE]
  Components: activity, scenario_exercise

Phase 5: CAPSTONE PIPELINE (runs last — synthesizes all phases)
  C1 Capstone design → C2 Brief & rubric → C3 Support materials →
  C4 Review [GATE]
  Components: capstone_project

Production order: Documents → Assessments → Videos → Activities → Capstone → Meta
```

Which loop pattern each stage uses:
- Phase 0: Strategic + Standard (ideation agents brainstorm with human)
- Phase 1-2: Standard loop (produce → evaluate → refine)
- Phase 3: Mixed — Standard (script, assembly), Tournament (images, video, music)
- Phase 4-5: Strategic + Standard (design phase before production)
- Human gates: no agent, just review (0.5, D5, A5, V3, V7, V16, T5, C4)

---

## Claude Code Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### Visual-First Development
- IMPORTANT: Before changing 3+ files, explain your plan and get my approval
- Build UI with sample data FIRST, then engine behind it
- Follow this sequence: mock data → static UI → API routes → wire together

### Coding Standards
- MUST use TypeScript strict mode. NEVER use `any`
- ES modules (import/export), NOT CommonJS. 2-space indent. No semicolons
- Functional React + hooks. Tailwind utilities only. shadcn/ui components
- Every state change MUST emit an event. Every artifact version is immutable
- Every LLM call MUST include cost tracking (model, tokens, cost)

### Testing Rules
- Write failing tests first, then implement
- Verify recursive loop completes end-to-end. Test all 5 review actions
- Mock all AI providers in tests. Use fixture files for media
- `npm run typecheck && npm run test -- --bail` before every commit

### Core Principles
- **Simplicity First:** Make every change as simple as possible. Impact minimal code
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards
- **Minimal Impact:** Changes should only touch what's necessary. Avoid introducing bugs

### Task Management
1. **Plan First:** Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan:** Check in before starting implementation
3. **Track Progress:** Mark items complete as you go
4. **Explain Changes:** High-level summary at each step
5. **Document Results:** Add review section to `tasks/todo.md`
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections

### Build & Test Commands

```bash
npm run dev              # Dev server → http://localhost:3000
npm run build            # Production build
npm run test             # All tests
npm run lint             # ESLint
npm run typecheck        # TypeScript strict
npx prisma migrate dev   # Database migrations
npx prisma studio        # Visual database browser
npm run db:seed:pc       # Seed project component data
```

### Compact Instructions

When compacting, ALWAYS preserve:
- The two-level architecture (engine vs. eLearn product)
- The 4 loop patterns (standard, strategic+production, tournament, nested)
- The recursive loop: `produce() → evaluate() → runLoop() → processReview()`
- The 6 pipeline phases and current build progress
- Active tasks from `tasks/todo.md`

---

## @imports

@docs/architecture/system-overview.md
@docs/architecture/recursive-loop-engine.md
@docs/architecture/elearn-pipeline.md
@docs/agents/persona-template.md
@docs/rubrics/structure-rubric-schema.json
@docs/rubrics/production-rubric-schema.json
@package.json
