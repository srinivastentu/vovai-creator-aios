# The Recursive Loop Engine

## System Identity

The Loop Engine is System 1 of the VOVAI platform. It lives in `src/lib/core/engine/`.
It is CORE — pure machinery, zero domain knowledge, portable to any AIOS.

The engine runs ONE stage. It does not know what a "pipeline" is, what comes
before or after a stage, or what "eLearning" means. It receives a stage config,
executes a loop, and returns an updated state. The Domain Workflow (System 4)
decides what to do with the result.

```
src/lib/core/engine/
├── types.ts        ← LoopStage<T>, LoopState<T>, GradeReport, RubricDefinition, etc.
├── loop-engine.ts  ← produce(), evaluate(), runLoop(), processReview()
└── index.ts        ← Re-exports
```

Import rule: this code has ZERO imports from `domain/`. It uses injected
dependencies (AgentExecutor, JudgeFunction) to call agents and judges
without knowing what they are.

---

## Core Principle

The loop engine is the universal execution pattern for everything the platform
produces. Whether an agent is writing a script, grading a project structure,
generating quiz questions, or designing a capstone project — the same engine
runs. The loop doesn't know or care what kind of artifact it's producing.
It only knows: produce, evaluate, decide, repeat or present.

```
produce() → evaluate() → runLoop() → processReview()
```

---

## Core Types

```typescript
interface LoopStage<T> {
  id: string
  agents: AgentConfig[]
  rubric: RubricDefinition
  threshold: number
  maxIterations: number
  minIterations: number               // default 2 — enforced even if score passes
  loopPattern: 'standard' | 'strategic' | 'tournament' | 'nested'
  validator?: (artifact: T) => ValidationResult
}

interface LoopState<T> {
  stageId: string
  status: LoopStatus
  currentArtifact: T | null
  bestArtifact: T | null              // highest score across ALL iterations
  bestGrade: GradeReport | null
  iterations: IterationRecord[]
  loopCount: number
  humanFeedback: string[]
  costUSD: number
}

type LoopStatus =
  | 'idle'
  | 'generating'
  | 'validating'
  | 'evaluating'
  | 'revising'
  | 'presenting'
  | 'awaiting_review'
  | 'approved'
```

### Injected Dependencies

The engine NEVER imports agent or judge implementations. Instead, it receives
them as function parameters:

```typescript
type AgentExecutor = (
  agents: AgentConfig[],
  context: unknown,
  state: LoopState<unknown>
) => Promise<unknown>

type JudgeFunction = (
  artifact: unknown,
  rubric: RubricDefinition
) => Promise<GradeReport>
```

The Domain Workflow creates these functions by wiring domain-specific agents
to the core executor (System 2: Agentic System). The engine doesn't care
which agents or models are behind these functions.

---

## Four Core Functions

### produce(stage, state, context, agentExecutor)

Calls the injected agentExecutor with the stage's agent configs and context.
Returns a new artifact. If human feedback exists in state, it's included in
context for this iteration only (then cleared — rule 5).

### evaluate(artifact, rubric, judge)

Calls the injected judge function with the artifact and rubric definition.
Returns a GradeReport with per-dimension scores, overall weighted score,
pass/fail determination, and improvement priorities.

### runLoop(stage, state, context, agentExecutor, judge)

Runs ONE iteration of the loop cycle. The caller (Domain Workflow) loops
externally — the engine does not loop internally. This keeps the Domain
Workflow in control of when to loop, when to pause, and when to persist state.

One iteration:
1. If validator exists on stage, run it first (cheap deterministic check)
2. If validator fails, set status to 'revising' (skip expensive LLM judge)
3. If validator passes (or no validator), call produce()
4. Call evaluate() with the produced artifact
5. Create IterationRecord with grade + cost
6. Update bestArtifact if this iteration scored higher than previous best
7. Decide next status:
   - score < threshold AND loopCount < maxIterations → 'revising'
   - score >= threshold AND loopCount >= minIterations → 'presenting'
   - loopCount = maxIterations → 'presenting' (escalation to human)
   - loopCount < minIterations → 'revising' (force more loops even if passing)
8. Return updated LoopState

### processReview(state, action)

Handles a human review action. Returns updated LoopState.

| Action | Behavior | New Status |
|--------|----------|------------|
| approve | Lock bestArtifact. Stage complete. | approved |
| reject | Clear all context and iterations. Fresh start. | generating |
| feedback | Add message to humanFeedback array. | generating |
| use_segments | Lock approved segments, rejected segments re-enter. | generating |
| mix_produce | Combine elements from specified versions. | generating |

If editedArtifact is present on any action, it replaces the current
artifact before the action is processed. Inline editing is a UI
behavior — the engine just sees an optional modified artifact
attached to any review action.

Note: the engine sets the status. The Domain Workflow decides what happens
AFTER (advance pipeline, create next stage, etc.).

---

## Four Loop Patterns

The same `runLoop()` function supports all four patterns through the
`loopPattern` field on LoopStage. The pattern is configured per stage
by the Domain Workflow, not hardcoded.

### Pattern 1: Standard Loop

```
Produce → Evaluate → Score >= threshold? →
  YES → Present to human
  NO  → Revise with evaluation feedback → Produce again (max N iterations)
```

One agent iterates toward quality. Used for: brief, audience, components,
handoff, study materials, assessment questions, voice-over, assembly.

### Pattern 2: Strategic + Production Loop

```
[Strategic Phase]
  Research → Analyze → Plan → Human confirms goal
    ↓
[Production Phase]
  Standard loop runs against the confirmed goal
```

Multiple sub-agents analyze the problem BEFORE production begins. The
strategic phase is OPTIONAL — human can bypass it. Used for: structure
stage (ideation), discovery (V1), activity design (T1), capstone design (C1).

### Pattern 3: Tournament Loop

```
Produce xN (parallel models) → Evaluate ALL → Rank →
  Winner >= threshold? →
    YES → Present to human
    NO  → Round 2: top models retry → Evaluate all rounds → Present best
```

Multiple AI models compete in parallel. Judge evaluates all entries
across all rounds. Used for: image generation (V5), video generation (V9),
music and SFX (V10).

### Pattern 4: Nested Inner Loop (agent-level)

```
Agent internally:
  Plan sub-steps → Execute each → Self-evaluate → Replan if needed →
  Output final artifact
    ↓
Outer loop: Standard evaluate → threshold cycle
```

The agent runs its own plan-execute-replan cycle BEFORE outputting.
Implemented via agent prompt instructions, not engine code changes.
Used for: complex multi-step agents that need internal reasoning.

---

## State Machine

```
IDLE
  ↓ start()
GENERATING
  ↓ artifact produced
VALIDATING
  ↓ deterministic checks (schema, format, word count)
  ├─ [fail] → REVISING (skip expensive LLM judge)
  └─ [pass] ↓
EVALUATING
  ↓ LLM judge grades against rubric (cross-model: producer != judge)
  ├─ [score < threshold AND iterations < max] → REVISING → GENERATING
  ├─ [score < threshold AND iterations = max] → PRESENTING (escalation)
  ├─ [score >= threshold AND iterations < min] → REVISING (force more loops)
  └─ [score >= threshold AND iterations >= min] → PRESENTING
PRESENTING
  ↓ shown to human via Human Review System (System 3)
AWAITING_REVIEW
  ├─ [approve]       → APPROVED
  ├─ [reject]        → GENERATING (clean — no previous context)
  ├─ [feedback]      → GENERATING (with feedback as priority context)
  ├─ [use_segments]  → GENERATING (partial — approved parts locked)
  └─ [mix_produce]   → GENERATING (composite from specified versions)
APPROVED
  ↓ (terminal — Domain Workflow decides what happens next)
```

---

## Nine Loop Rules

These rules are enforced by the engine. They apply to ALL patterns, ALL stages,
regardless of which Domain Workflow is calling the engine.

1. **Minimum 2 iterations enforced** — even if v1 scores above threshold.
   First-draft bias is real. The second pass always finds something.

2. **Track BEST version, not just current** — escalation presents the best
   artifact across all iterations, not the last one produced.

3. **Checkpoint after every iteration** — every artifact version is immutable.
   No work is ever lost. IterationRecord tracks every version.

4. **Dimension-aware revision** — when score < threshold, the revision context
   PRESERVES dimensions scoring >= 8 and IMPROVES dimensions scoring < 8.
   Don't let the agent regress on what's already working.

5. **Human feedback applied once then cleared** — feedback is injected as
   highest-priority revision context for one iteration, then removed.

6. **Deterministic validators run BEFORE LLM Judge** — cheap programmatic
   checks (word count, format, schema validation, readability score) run
   first. Only artifacts passing validators get sent to the expensive judge.

7. **Cross-model judging** — producer and judge MUST use different models.
   An agent cannot evaluate its own output. Default: Claude produces,
   GPT-4o judges (or vice versa).

8. **Cost tracking on every iteration** — model, tokens in, tokens out,
   cost in USD. Tracked on IterationRecord. The Domain Workflow aggregates
   costs up to the project level.

9. **Graceful degradation** — on failure (API timeout, model unavailable,
   parsing error), preserve all state and resume from last stable artifact.
   Never lose work. Never leave a state in a broken condition.

---

## Key Data Structures

### Artifact (immutable — new version = new row)

```typescript
{
  id: string
  stageSessionId: string
  version: number               // 1, 2, 3... increments per iteration
  content: string               // script text, image URL, file path, JSON
  contentType: string           // text, json, url, file_path
  metadata: Record<string, unknown>
  costInputTokens: number
  costOutputTokens: number
  costUSD: number
  createdAt: Date
}
```

### IterationRecord (one per loop iteration)

```typescript
{
  artifactId: string
  version: number
  grade: GradeReport | null
  modelUsed: string
  tokensIn: number
  tokensOut: number
  costUSD: number
  createdAt: Date
}
```

### GradeReport

```typescript
{
  overallScore: number
  passesThreshold: boolean
  dimensionScores: DimensionScore[]
  recommendation: string
  improvementPriorities: string[]
}
```

---

## What the Engine Does NOT Own

These are Domain Workflow (System 4) responsibilities:

- Pipeline definitions (which stages, what order)
- Stage sequencing (brief before audience before structure)
- Cross-stage dependencies (documents before videos)
- Batch management (videos in groups of 10)
- Business rules (certification requires quiz + capstone + exam)
- Entity types (ProjectBlueprint, ProjectNode, NodeComponent)
- Reviewer role assignments (SMEs at D5, QA at V16)
- Production job creation
- Cost aggregation (iteration → session → component → node → project)

The engine just runs one loop. The workflow orchestrates everything around it.