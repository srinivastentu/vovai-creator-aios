# VOVAI eLearn AIOS — Architectural Contract

> AI-powered eLearning video production platform. Autonomous agent teams research, script, visualise, narrate, and assemble eLearning videos — humans guide and approve at every critical gate.

## Two-Level Architecture (NEVER confuse)

- **Level 1 (Engine):** The platform code you are building. TypeScript/Next.js with orchestrator, recursive loop engine, registries, grading, review interface. Same engine regardless of content type.
- **Level 2 (Product):** eLearn AIOS. Configured via registries (agents, rubrics, pipelines, domain knowledge). Adding Film AIOS later = new config files, NOT new engine code.
- **Test:** If a new media type requires changes to `src/lib/engine.ts`, the engine isn't flexible enough.

## Tech Stack (Mac)

- **Frontend:** Next.js 14+, React, TypeScript strict, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API routes, Python scripts (media processing)
- **Database:** PostgreSQL (Homebrew), Prisma ORM, Redis (queue/cache)
- **AI:** Anthropic SDK (Claude — producing), OpenAI (GPT-4o — judging, vision), fal.ai (images), ElevenLabs (voice), Runway/Kling (video), Suno (music)
- **Media:** FFmpeg (Homebrew) — assembly, rendering, format conversion
- **Auth:** Clerk | **Billing:** Stripe | **Deploy:** Vercel

## The Recursive Loop Engine — Complete Architecture

The engine supports FOUR loop patterns through configuration. Same `runLoop()` function, different behaviour based on `StageConfig`.

### Pattern 1: Standard Loop (proven, Ring 1)
```
Produce → Validate → Evaluate → Checkpoint → Threshold → Review
```
One agent iterates toward quality. Used for: scripts, voiceover, captions, assembly.

### Pattern 2: Strategic + Production Loop (designed, Ring 1+)
```
[Strategic Phase] Research → Plan → Human Confirms Goal
         ↓
[Production Phase] Standard Loop runs
```
Multiple sub-agents analyse the goal BEFORE production begins. The strategic phase is OPTIONAL — human can bypass it. Used for: Discovery (Stage 1), complex project setup.

### Pattern 3: Tournament Loop (designed, Ring 2)
```
Produce ×N (parallel models) → Evaluate ALL → Rank → Winner ≥ threshold?
  YES → Present to human
  NO  → Round 2: top models retry with revised prompts → Evaluate ALL rounds
```
Multiple AI models compete in parallel. Judge evaluates all entries. Used for: images, video, music — where variety matters more than iteration.

### Pattern 4: Nested Inner Loop (agent-level, via prompting)
```
Agent internally: Plan sub-steps → Execute each → Replan if needed → Output artifact
         ↓
Outer loop: Standard evaluate → threshold cycle
```
The agent runs its own plan-execute-replan cycle BEFORE outputting. Implemented via agent prompt instructions, not engine code changes.

### Core Functions
- `produce()` — Agent generates artifact from goal + context + feedback
- `evaluate()` — Judge grades artifact against weighted rubric (5 dimensions)
- `runLoop()` — Orchestrates the cycle. Reads StageConfig to select pattern.
- `processReview()` — Handles 5 human actions (see below)

### Loop Rules (ALL patterns)
- Minimum 2 iterations enforced, even if v1 scores above threshold
- Track BEST version, not just current — escalation presents best, not last
- Checkpoint after every iteration — no work is ever lost
- Dimension-aware revision: PRESERVE dimensions ≥8, IMPROVE dimensions <8
- Human feedback applied once then cleared (prevent over-optimisation)
- Deterministic validators run BEFORE LLM Judge (cheap catches first)
- Cross-model judging: Producer and Judge MUST use different models

## Five Human Review Actions

| Action | Behaviour |
|--------|-----------|
| **Approve** | Lock artifact. Stage complete. Pipeline advances. |
| **Feedback** | Re-enter loop with feedback as highest-priority revision (up to 3 more iterations). |
| **Reject** | Fresh start. No previous context. Forces fundamentally different approach. |
| **Use Segments** | Approve parts, reject others. Approved parts locked, rejected parts re-enter loop. |
| **Mix & Produce** | Combine elements from different versions or tournament entries into a new artifact. |

## Seven Architectural Principles

1. **Event-Driven:** All state changes emit events. Components react, never poll.
2. **Artifact-Centric:** The artifact is the fundamental unit of work.
3. **Immutable History:** Never delete or overwrite artifact versions.
4. **Agent Composability:** Agents are stateless. Receive context, produce artifact, return.
5. **Human Sovereignty:** No artifact enters approved state without explicit human action.
6. **Cost Transparency:** Every LLM call is metered, tracked, attributable.
7. **Graceful Degradation:** On failure, preserve all state, resume from last stable point.

## eLearn Pipeline (16 stages, built in rings)

```
Ring 1: Discovery → Script → Script Review [GATE]
Ring 2: + Image Prompts → Image Gen (Tournament) → Storyboard → Storyboard Review [GATE]
Ring 3: + Voice-Over → Video Gen → Music/SFX → Assembly
Ring 4: + Captions → Final Render → QA → Delivery [GATE]
Ring 5: + Multi-tenant, Auth, Billing, Deployment
```

Which loop pattern each stage uses:
- Stages 1: Strategic + Standard (research before scripting)
- Stages 2, 8, 11-16: Standard loop
- Stages 5, 9, 10: Tournament loop (multiple models compete)
- Stages 3, 7, 14, 16: Human review gates (no agent, just review)
- Stages 4, 6: Standard loop with agent inner planning

## Build & Test Commands

```bash
npm run dev              # Dev server → http://localhost:3000
npm run build            # Production build
npm run test             # All tests
npm run lint             # ESLint
npm run typecheck        # TypeScript strict
npx prisma migrate dev   # Database migrations
npx prisma studio        # Visual database browser
```

## Coding Standards

- MUST use TypeScript strict mode. NEVER use `any`.
- ES modules (import/export), NOT CommonJS. 2-space indent. No semicolons.
- Functional React + hooks. Tailwind utilities only. shadcn/ui components.
- Every state change MUST emit an event. Every artifact version is immutable.
- Every LLM call MUST include cost tracking (model, tokens, cost).

## Testing Rules

- Write failing tests first, then implement.
- Verify recursive loop completes end-to-end. Test all 5 review actions.
- Mock all AI providers in tests. Use fixture files for media.
- `npm run typecheck && npm run test -- --bail` before every commit.

## Task Management

1. **Plan First:** Write plan to `tasks/todo.md`.
2. **Verify Plan:** Check in with me before coding.
3. **Track Progress:** Mark items complete as you go.
4. **Explain Changes:** High-level summary at each step.
5. **Document Results:** Add review section to `tasks/todo.md`.
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections.

## Session Rules

- Plan mode for ANY task with 3+ steps or architectural decisions.
- If something goes sideways, STOP and re-plan.
- IMPORTANT: Before changing 3+ files, explain your plan and get my approval.
- Follow Visual-First: build UI with sample data FIRST, then engine behind it.
- When given a bug: just fix it. Don't ask for hand-holding.

## Compact Instructions

When compacting, ALWAYS preserve:
- The two-level architecture (engine vs. eLearn product)
- The 4 loop patterns (standard, strategic+production, tournament, nested)
- The recursive loop: `produce() → evaluate() → runLoop() → processReview()`
- The current Ring and which stages are complete
- Active tasks from `tasks/todo.md`

## @imports

@docs/architecture/system-overview.md
@docs/architecture/recursive-loop.md
@docs/architecture/elearn-pipeline.md
@docs/agents/persona-template.md
@docs/rubrics/rubric-schema.json
@package.json
