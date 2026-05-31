<!-- ─────────────────────────────────────────────────────────────────────
PROVENANCE
This document originated in VOVAI eLearn AIOS. It is ported to CreatorOS
because the patterns it describes are Core machinery — universal across
AIOSes (eLearn, Creator, future Film/Book/Agri). The import rule still
holds: src/lib/core/ never imports from src/lib/domain/.

Adaptation note: This was authored during eLearn's loop engine refactor. The implementation details (4 functions, state machine, 9 rules) apply identically to CreatorOS. Phase-specific examples (ideation phases, video pipeline) are eLearn — read past them; the same shape applies to CreatorOS's Research → Master → Repurpose pipeline.
───────────────────────────────────────────────────────────────────── -->

# VOVAI eLearn AIOS — Recursive Loop Engine Handoff Document
## For a Focused Conversation on the Core Agentic Loop Architecture

---

## Why This Conversation Exists

The Project Component layer (v1.0.0) is built and working. But during implementation, a fundamental architectural misalignment was discovered: **we built ONE conversational loop with phases, instead of FIVE separate gated loops with individual rubrics.** Only the Structure stage has a proper rubric → refine → human gate cycle. The other four stages are single-pass with no quality enforcement.

This conversation fixes that by refactoring the recursive loop engine to be a **universal, reusable loop that runs independently at every stage** — each with its own rubric, its own agents, its own refinement cycle, and its own human approval gate.

---

## The Core Problem (From the Architecture Diagram)

The user's architectural diagram shows 5 separate recursive loops:

```
USER INPUT
    ↓
[PROJECT BRIEF]  →  [AUDIENCE]  →  [STRUCTURE]  →  [LEARNING COMPONENTS]  →  [PRODUCTION & HANDOFF]
   ↻ loop            ↻ loop        ↻ loop           ↻ loop                    ↻ loop
   ↑ rubric           ↑ rubric      ↑ rubric          ↑ rubric                  ↑ rubric
   ↑ human gate       ↑ human gate  ↑ human gate      ↑ human gate              ↑ human gate
```

Each loop follows the SAME engine pattern:
```
Agents produce artifact → Rubric grades it → Score ≥ threshold? →
  YES → Present to human → Approve / Reject / Feedback / Inline Edit + Move Next
  NO  → Agents refine with grade feedback → Loop again (max N iterations)
```

The human has 4 actions at every gate:
1. **Approve** — artifact locked, advance to next stage
2. **Reject** — fresh start, agents try again
3. **Feedback** — specific guidance, agents refine with feedback
4. **Inline Edit + Move Next** — human edits the artifact directly, implicitly approves

---

## What We Built vs What's Needed

### Currently Built (v1.0.0 on main)

| Stage | Has Loop? | Has Rubric? | Has Human Gate? | Has Inline Edit? |
|-------|-----------|-------------|-----------------|------------------|
| Project Brief | ❌ Single-pass | ❌ None | ❌ None | ❌ No |
| Audience | ❌ Single-pass | ❌ None | 🟡 Partial ("Looks good" button, no rubric) | ❌ No |
| Structure | ✅ Yes (auto-refine) | ✅ 7-dimension rubric | ✅ Approve/Feedback/Restructure | 🟡 Partial (materialize + CRUD) |
| Components | ❌ Bundled into structure | ❌ None | ❌ None | ❌ No |
| Handoff | ❌ Direct execution | ❌ None | ❌ None | ❌ No |

### What's Needed (5 Independent Gated Loops)

| Stage | Artifact Type | Rubric Dimensions | Agents Involved | Threshold |
|-------|--------------|-------------------|-----------------|-----------|
| **Brief** | ProjectBrief | Clarity, Specificity, Scope, Constraints, Objectives (5 dims) | Orchestrator | 75/100 |
| **Audience** | AudienceProfile | Specificity, Actionability, Prerequisites, Motivation Depth, Learning Context (5 dims) | Audience Analyst | 75/100 |
| **Structure** | ProjectStructure (tree) | Coverage, Depth, Progression, Balance, Engagement, Feasibility, Coherence (7 dims) | Curriculum Strategist, Outcome Architect | 75/100 |
| **Components** | ComponentPlan | Coverage, Appropriateness, Dependencies, Cost Feasibility, Alignment (5 dims) | Component Recommender, Structure Optimizer | 75/100 |
| **Handoff** | HandoffReadiness | Config Completeness, Cost Validation, Timeline Feasibility, Missing Items, Quality Score (5 dims) | Rubric Grader (meta) | 80/100 |

---

## The Universal Loop Engine (Level 1)

The refactored engine should be **completely generic** — it doesn't know about briefs, audiences, or structures. It only knows:

```typescript
interface LoopStage<TArtifact> {
  id: string                          // "brief", "audience", "structure", etc.
  agents: AgentConfig[]               // which agents produce the artifact
  rubric: RubricDefinition            // how to grade the artifact
  threshold: number                   // minimum score to pass (0-100)
  maxIterations: number               // max loops before forcing human review
  minIterations: number               // minimum loops (default 2)
  validator?: (artifact: TArtifact) => ValidationResult  // deterministic pre-check
}

interface LoopState<TArtifact> {
  stageId: string
  status: 'idle' | 'generating' | 'evaluating' | 'revising' | 'presenting' | 'awaiting_review' | 'approved'
  currentArtifact: TArtifact | null
  bestArtifact: TArtifact | null
  bestGrade: GradeReport | null
  iterations: IterationRecord[]
  loopCount: number
  humanFeedback: string[]
  costUSD: number
}

// The universal functions
produce<T>(stage: LoopStage<T>, state: LoopState<T>, context: unknown): Promise<T>
evaluate<T>(artifact: T, rubric: RubricDefinition): Promise<GradeReport>
runLoop<T>(stage: LoopStage<T>, state: LoopState<T>): Promise<LoopState<T>>
processReview<T>(state: LoopState<T>, action: ReviewAction): Promise<LoopState<T>>
```

### Pipeline Orchestrator

A pipeline is a sequence of stages, each running the universal loop:

```typescript
interface Pipeline {
  id: string
  stages: LoopStage<unknown>[]        // ordered sequence
  currentStageIndex: number
  stageStates: Map<string, LoopState<unknown>>
}

// Advances through stages sequentially
// Each stage must be approved before the next begins
runPipelineStep(pipeline: Pipeline): Promise<Pipeline>
```

### eLearning Configuration (Level 2)

The eLearning product configures 5 stages:

```typescript
const ELEARN_IDEATION_PIPELINE: Pipeline = {
  id: 'elearn-ideation',
  stages: [
    { id: 'brief', agents: [orchestratorConfig], rubric: BRIEF_RUBRIC, threshold: 75, maxIterations: 3 },
    { id: 'audience', agents: [audienceAnalystConfig], rubric: AUDIENCE_RUBRIC, threshold: 75, maxIterations: 3 },
    { id: 'structure', agents: [curriculumConfig, outcomeConfig], rubric: STRUCTURE_RUBRIC, threshold: 75, maxIterations: 5 },
    { id: 'components', agents: [componentConfig, optimizerConfig], rubric: COMPONENT_RUBRIC, threshold: 75, maxIterations: 3 },
    { id: 'handoff', agents: [handoffCheckerConfig], rubric: HANDOFF_RUBRIC, threshold: 80, maxIterations: 2 },
  ]
}
```

---

## Existing Codebase (What to Refactor)

### Engine Files (Level 1 — these change)

```
src/lib/engine.ts                              — produce(), evaluate(), runLoop(), processReview() STUBS
                                                  These need to become the real universal loop engine

src/lib/project-component/ideation/
├── phase-manager.ts                           — Current 5-phase state machine (brainstorm→structure→etc.)
│                                                REFACTOR: becomes a pipeline of independent loop stages
├── loop-engine.ts                             — Current runIdeationStep() + processHumanFeedback()
│                                                REFACTOR: each step becomes a LoopStage with its own loop
├── conversation-manager.ts                    — DB persistence for messages
│                                                KEEP: but extend to track per-stage conversations
└── cost-guard.ts                              — $5 cost limit per session
                                                  KEEP as-is
```

### Agent Files (Level 2 — mostly keep, add rubric integration)

```
src/lib/project-component/agents/
├── framework/
│   ├── types.ts                               — AgentResult<T>, IdeationAgentConfig
│   ├── executor.ts                            — executeIdeationAgent() with cost tracking
│   └── registry.ts                            — agent registry
├── audience-analyst.ts                        — KEEP, add rubric-compatible output
├── curriculum-strategist.ts                   — KEEP
├── outcome-architect.ts                       — KEEP
├── component-recommender.ts                   — KEEP, add rubric-compatible output
├── structure-optimizer.ts                     — KEEP
├── rubric-grader.ts                           — REFACTOR: make generic (grade any artifact against any rubric)
├── devils-advocate.ts                         — KEEP
└── orchestrator.ts                            — REFACTOR: becomes pipeline orchestrator
```

### Rubric Files (Level 2 — add 4 new rubrics)

```
src/lib/project-component/rubrics/
├── structure-rubric.ts                        — EXISTS: 7-dimension structure rubric
├── brief-rubric.ts                            — NEW: 5-dimension brief quality rubric
├── audience-rubric.ts                         — NEW: 5-dimension audience profile rubric
├── component-rubric.ts                        — NEW: 5-dimension component assignment rubric
└── handoff-rubric.ts                          — NEW: 5-dimension handoff readiness rubric
```

### API Routes (extend, don't break)

```
Current ideation routes:
  POST /ideation/start         — starts brainstorming
  POST /ideation/message       — sends human message
  POST /ideation/grade         — triggers grading
  POST /ideation/approve       — approve/feedback/restructure
  POST /ideation/ask           — quick agent question
  POST /ideation/confirm-audience — confirms audience profile
  POST /ideation/materialize   — converts proposed → DB nodes

Needed: each stage should use the same universal API pattern:
  POST /ideation/stages/[stageId]/run      — run one loop iteration
  POST /ideation/stages/[stageId]/review   — human review action
  GET  /ideation/stages/[stageId]/state    — current stage state
  GET  /ideation/pipeline/state            — full pipeline state
```

### Database (extend, don't change existing)

```
Existing models that map to the loop:
- StageSession         — one per stage, tracks status + best artifact + grade
- Artifact             — immutable versioned content
- IterationRecord      — one per loop iteration with grade + cost
- IdeationConversation — conversation per stage
- IdeationMessage      — messages within a conversation
- StructureGrade       — 7-dimension grade (generalize to any rubric)
- BlueprintVersion     — snapshot at any point

May need:
- Generalize StructureGrade → ArtifactGrade (or just use JSON on IterationRecord)
- Add stageId to IdeationConversation (to separate conversations per stage)
```

---

## Loop Rules (ALL stages, ALL patterns)

1. **Minimum 2 iterations** — even if v1 scores above threshold
2. **Track BEST version** — escalation presents best, not last
3. **Checkpoint every iteration** — immutable artifact versions, no work lost
4. **Dimension-aware revision** — preserve dimensions ≥8, improve dimensions <8
5. **Human feedback applied once then cleared** — prevent over-optimization
6. **Deterministic validators BEFORE LLM judge** — cheap checks first
7. **Cross-model judging** — producer ≠ judge
8. **Cost tracking on every iteration** — model, tokens, USD
9. **Graceful degradation** — on failure, preserve state, resume from last stable point

---

## Four Human Review Actions (at every gate)

| Action | Behavior | State After |
|--------|----------|-------------|
| **Approve** | Lock artifact, advance to next stage | APPROVED |
| **Reject** | Fresh start, no context carried | GENERATING (clean) |
| **Feedback** | Re-enter loop with feedback as priority | GENERATING (with feedback) |
| **Inline Edit + Move Next** | Human edits artifact directly, implicit approval | APPROVED (edited version) |

The "Inline Edit + Move Next" is NEW — currently not implemented. When the human edits an artifact inline (e.g., edits the structure tree), those edits create a new artifact version. A "Move to Next Phase" button then approves this edited version and advances the pipeline.

---

## Four Loop Patterns

The same engine supports all four through configuration:

1. **Standard:** One agent iterates. Used for: brief, audience, most stages.
2. **Strategic + Production:** Research phase → production phase. Used for: structure (analyze before building).
3. **Tournament:** Multiple models compete in parallel. Used for: image generation, video, music (production pipeline, not ideation).
4. **Nested Inner:** Agent self-plans internally. Used for: complex multi-step agents.

---

## Production Pipeline (Phases 1-5) — Uses the Same Engine

The ideation pipeline (Phase 0) is just the first pipeline. The production pipeline (Phases 1-5) uses the SAME loop engine for each production stage:

```
Phase 1: Document Pipeline      — D1→D5, each stage is a loop
Phase 2: Assessment Pipeline    — A1→A6, each stage is a loop
Phase 3: Video Pipeline         — V1→V16, each stage is a loop
Phase 4: Activity Pipeline      — T1→T5, each stage is a loop
Phase 5: Capstone Pipeline      — C1→C4, each stage is a loop
```

The refactored engine serves BOTH the ideation pipeline and the production pipeline. This is the true test of Level 1/Level 2 separation.

---

## Existing Test Coverage

- 385 unit tests across 17 files
- E2E test: full ideation → handoff flow
- Key test files:
  - `tests/unit/rubric.test.ts` — 15 tests on scoring
  - `tests/unit/tree-utils.test.ts` — 50 tests on tree operations  
  - `tests/unit/phase-manager.test.ts` — 25 tests on transitions
  - `tests/unit/loop-engine.test.ts` — 25 tests on loop behavior
  - `tests/unit/security.test.ts` — 57 tests on input validation
  - `tests/unit/handoff.test.ts` — 19 tests on production handoff
  - `tests/unit/configurability-guardrails.test.ts` — 5 tests on sovereignty

---

## Tech Stack

- **Runtime:** Next.js 15, TypeScript 6 (strict), Prisma 7, PostgreSQL
- **AI:** Anthropic SDK (Claude — producing), OpenAI (GPT-4o — judging)
- **Testing:** Vitest
- **Package manager:** npm
- **Coding standards:** No semicolons, 2-space indent, no `any`, ES modules, functional React

---

## Key Architecture Documents (in project knowledge)

- `CLAUDE.md` — Architectural contract, 8 principles, coding standards
- `recursive-loop.md` — Current loop engine spec (needs updating after refactor)
- `elearn-pipeline.md` — 6-phase production pipeline
- `structure-rubric-schema.json` — 7-dimension rubric schema (0-100 scale)
- `production-rubric-schema.json` — 5-dimension rubric schema (1-10 scale)

---

## Implementation Priority

### Phase 1: Universal Loop Engine (Level 1)
1. Define `LoopStage<T>`, `LoopState<T>`, `Pipeline` interfaces
2. Implement universal `produce()`, `evaluate()`, `runLoop()`, `processReview()`
3. Implement `PipelineOrchestrator` that sequences stages
4. Add "Inline Edit + Move Next" as 4th review action
5. Tests: loop with mock agents and mock rubric

### Phase 2: Rubric System (Level 2)
6. Create brief-rubric.ts (5 dimensions)
7. Create audience-rubric.ts (5 dimensions)
8. Create component-rubric.ts (5 dimensions)
9. Create handoff-rubric.ts (5 dimensions)
10. Make rubric-grader.ts generic (grade any artifact against any rubric)

### Phase 3: Wire Ideation Pipeline (Level 2)
11. Configure 5 stages as `ELEARN_IDEATION_PIPELINE`
12. Refactor API routes to use pipeline orchestrator
13. Update conversation manager for per-stage conversations
14. Update UI to show per-stage progress and review gates

### Phase 4: Prepare for Production Pipeline
15. Verify the same engine can drive Phases 1-5
16. Create a production stage config for one pipeline (e.g., Document Pipeline)
17. Prove: same `runLoop()` works for both ideation and production

---

## Build & Test Commands

```bash
npm run dev              # Dev server → http://localhost:3000
npm run build            # Production build
npm run test             # 385 tests
npm run typecheck        # TypeScript strict
npx prisma studio        # Visual database browser
npm run test:e2e         # Full E2E test (~$0.40)
```

---

## Branch Strategy

- `main` — stable v1.0.0-project-component (don't break this)
- `feature/ux-v2-conversational` — UI/UX redesign (separate conversation)
- `feature/loop-engine-v2` — NEW branch for this work (create from main)

---

## How to Start the New Conversation

Upload these to the project knowledge:
1. This handoff document
2. `CLAUDE.md` (architectural contract)
3. `recursive-loop.md` (current loop spec)
4. `elearn-pipeline.md` (pipeline spec)
5. `structure-rubric-schema.json` + `production-rubric-schema.json`
6. The user's architecture diagram (the one with 5 loops)

Start with:
"I'm refactoring the VOVAI eLearn AIOS recursive loop engine. Read the 
handoff document for full context. The goal: convert from one conversational 
loop with phases to five independent gated loops, each with its own rubric, 
agents, and human approval gate. I'm on a new branch feature/loop-engine-v2. 
Let's start with Phase 1: Universal Loop Engine interfaces."
