<!-- ─────────────────────────────────────────────────────────────────────
PROVENANCE
This document originated in VOVAI eLearn AIOS. It is ported to CreatorOS
because the patterns it describes are Core machinery — universal across
AIOSes (eLearn, Creator, future Film/Book/Agri). The import rule still
holds: src/lib/core/ never imports from src/lib/domain/.

Adaptation note: CreatorOS adds 'cross-critique' as Pattern 5. The Pattern 5 section is appended at the end of this file. The 4 original patterns are unchanged.
───────────────────────────────────────────────────────────────────── -->

# The Recursive Loop Engine

## Core Principle

The recursive loop is the universal execution pattern for everything the
platform produces. Whether an agent is writing a script, grading a project
structure, generating quiz questions, or designing a capstone project — the
same engine runs. The loop doesn't know or care what kind of artifact it's
producing. It only knows: produce, evaluate, decide, repeat or present.

```
produce() → evaluate() → runLoop() → processReview()
```

## Four Loop Patterns

The same `runLoop()` function supports all four patterns through configuration.
The pattern is set per stage in the pipeline config, not hardcoded.

### Pattern 1: Standard Loop

```
Produce → Evaluate → Score ≥ threshold? →
  YES → Present to human
  NO  → Revise with evaluation feedback → Produce again (max N iterations)
```

One agent iterates toward quality. Used for: scripts, voice-over, captions,
study materials, assessment questions, activity guides, assembly.

### Pattern 2: Strategic + Production Loop

```
[Strategic Phase]
  Research → Analyze → Plan → Human confirms goal
    ↓
[Production Phase]
  Standard loop runs against the confirmed goal
```

Multiple sub-agents analyze the problem BEFORE production begins. The
strategic phase is OPTIONAL — human can bypass it. Used for: project
ideation (Phase 0), discovery (Stage V1), activity design (Stage T1),
capstone design (Stage C1).

### Pattern 3: Tournament Loop

```
Produce ×N (parallel models) → Evaluate ALL → Rank →
  Winner ≥ threshold? →
    YES → Present to human
    NO  → Round 2: top models retry with revised prompts →
          Evaluate ALL rounds combined → Present best to human
```

Multiple AI models compete in parallel. Judge evaluates all entries
across all rounds. Used for: image generation (Stage V5), video
generation (Stage V9), music & SFX (Stage V10) — where variety
matters more than iteration.

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
Used for: complex multi-step agents that need internal reasoning
(prompt engineering, storyboard assembly).

---

## State Machine

```
IDLE
  ↓ start()
GENERATING
  ↓ artifact produced
EVALUATING
  ↓ grade computed
  ├─ [score < threshold AND iterations < max] → REVISING → GENERATING
  ├─ [score < threshold AND iterations = max] → PRESENTING (escalation)
  └─ [score ≥ threshold] → PRESENTING
PRESENTING
  ↓ shown to human
AWAITING_REVIEW
  ├─ [approve]       → APPROVED (artifact locked, stage complete)
  ├─ [feedback]      → GENERATING (with feedback as priority revision)
  ├─ [reject]        → GENERATING (fresh start, no previous context)
  ├─ [use_segments]  → GENERATING (approved parts locked, rejected parts re-enter)
  └─ [mix_produce]   → GENERATING (combine elements from multiple versions)
APPROVED
  ↓ (terminal — artifact flows to next stage)
```

### State Machine for Project Ideation (Phase 0)

Phase 0 uses the same state machine with a different interpretation:

```
IDLE
  ↓ human provides brief
BRAINSTORM (= GENERATING)
  ↓ agents propose structure
STRUCTURE (= EVALUATING)
  ↓ rubric grades the structure (7 dimensions)
  ├─ [score < 75 AND loops < 5] → REFINEMENT → BRAINSTORM
  └─ [score ≥ 75 OR loops = 5] → REVIEW
REVIEW (= AWAITING_REVIEW)
  ├─ [approve]       → APPROVED (blueprint locked, enter configuration wizard)
  ├─ [feedback]      → REFINEMENT → BRAINSTORM (with feedback context)
  └─ [restructure]   → BRAINSTORM (fresh approach, audience profile retained)
APPROVED
  ↓ configuration wizard → production handoff
```

---

## Loop Rules (ALL patterns, ALL phases)

1. **Minimum 2 iterations enforced** — even if v1 scores above threshold.
   First-draft bias is real. The second pass always finds something.

2. **Track BEST version, not just current** — escalation presents the best
   artifact across all iterations, not the last one produced.

3. **Checkpoint after every iteration** — every artifact version is immutable.
   No work is ever lost. StageSession tracks currentArtifact and bestArtifact.

4. **Dimension-aware revision** — when score < threshold, the revision prompt
   PRESERVES dimensions scoring ≥ 8 and IMPROVES dimensions scoring < 8.
   Don't let the agent regress on what's already working.

5. **Human feedback applied once then cleared** — feedback is injected as
   highest-priority revision context for one iteration, then removed. Prevents
   over-optimization loops where the agent fixates on one comment.

6. **Deterministic validators run BEFORE LLM Judge** — cheap programmatic
   checks (word count, format, schema validation, readability score) run
   first. Only artifacts passing deterministic checks get sent to the
   expensive LLM judge. This saves cost and catches obvious failures fast.

7. **Cross-model judging** — producer and judge MUST use different models.
   An agent cannot evaluate its own output. Default: Claude produces,
   GPT-4o judges (or vice versa).

8. **Cost tracking on every iteration** — model, tokens in, tokens out,
   cost in USD. Tracked on IterationRecord. Aggregated on StageSession
   and Project. No hidden API costs.

9. **Graceful degradation** — on failure (API timeout, model unavailable,
   parsing error), preserve all state and resume from last stable artifact.
   Never lose work. Never leave a session in a broken state.

---

## Five Human Review Actions

| Action | Behavior | State After |
|---|---|---|
| **Approve** | Lock artifact. Stage complete. Pipeline advances. | APPROVED |
| **Feedback** | Re-enter loop with feedback as highest-priority revision. Up to 3 more iterations after feedback. | GENERATING |
| **Reject** | Fresh start. No previous context carried forward. Forces fundamentally different approach. | GENERATING (clean) |
| **Use Segments** | Approve parts of the artifact, reject others. Approved parts locked, rejected parts re-enter the loop independently. | GENERATING (partial) |
| **Mix & Produce** | Combine elements from different versions or tournament entries into a new artifact. Human specifies which parts from which version. | GENERATING (composite) |

### Review Actions in Phase 0 (Project Ideation)

| Action | Behavior | State After |
|---|---|---|
| **Approve** | Lock blueprint structure. Enter configuration wizard. | APPROVED |
| **Feedback** | Specific instructions fed back to agents. Structure refined, re-graded. | REFINEMENT |
| **Restructure** | Agents propose entirely new structure. Audience profile and brief retained, but hierarchy rebuilt from scratch. | BRAINSTORM |

Use Segments and Mix & Produce are not applicable in Phase 0 — they apply
to artifact-level production in Phases 1–5.

---

## Key Data Structures

### Artifact (immutable — new version = new row, never update content)

```typescript
{
  id: string                    // UUID
  stageSessionId: string        // parent session
  version: number               // 1, 2, 3... increments per iteration
  content: string               // script text, image URL, file path, JSON, etc.
  stage: string                 // which pipeline stage produced this
  sceneIndex: number | null     // for per-scene stages (null for full-artifact stages)
  metadata: Record<string, unknown>  // flexible per-stage data
  createdAt: Date
}
```

### Grade (evaluation result — stored as JSON on IterationRecord)

```typescript
{
  dimensions: {
    name: string                // e.g., "accuracy", "engagement", "readability"
    score: number               // 0-10
    weight: number              // 0.0-1.0 (sum to 1.0)
    feedback: string            // specific improvement guidance
  }[]
  compositeScore: number        // weighted average (0-100)
  overallAssessment: string     // judge's summary
  improvementPriorities: string[] // ordered list of what to fix
  passesThreshold: boolean
}
```

### Grade for Phase 0 (Structure Rubric — stored on StructureGrade)

```typescript
{
  dimensions: {
    id: string                  // "coverage", "depth", "progression", etc.
    name: string
    score: number               // 0-100
    weight: number              // sum to 1.0
    passThreshold: number       // per-dimension minimum
  }[]
  overallScore: number          // weighted average (0-100)
  passesThreshold: boolean      // overall ≥ 75 AND no dimension below its threshold
  recommendation: 'approve' | 'revise' | 'restructure' | 'reject'
  feedback: string | null
}
```

### IterationRecord (one row per loop iteration — tracks cost)

```typescript
{
  id: string
  stageSessionId: string
  artifactId: string            // which artifact was evaluated
  iteration: number             // 1, 2, 3...
  grade: Grade                  // stored as JSON
  outcome: 'revised' | 'presented' | 'escalated' | 'approved'
  costModel: string             // "claude-sonnet-4", "gpt-4o", etc.
  costInputTokens: number
  costOutputTokens: number
  costUSD: number
  createdAt: Date
}
```

### StageSession (one per component per pipeline stage)

```typescript
{
  id: string
  projectId: string
  stageId: number               // which stage in the pipeline
  status: SessionStatus         // idle | generating | evaluating | presenting | awaiting_review | approved
  currentArtifactId: string | null
  bestArtifactId: string | null // best across ALL iterations, not just current
  bestGrade: Grade | null       // grade of the best artifact
  artifacts: Artifact[]         // all versions produced
  iterations: IterationRecord[] // all evaluation records
  createdAt: Date
  updatedAt: Date
}
```

### IdeationLoopState (Phase 0 — project ideation session)

```typescript
{
  blueprintId: string
  currentPhase: IdeationPhase   // brainstorm | structure | refinement | review | approved
  loopCount: number             // how many refinement cycles so far
  maxLoops: 5                   // force human review after 5

  // Accumulated context (built up across phases)
  brief: string
  archetype: ProjectArchetype
  audienceProfile: AudienceProfile | null
  proposedStructure: ProposedStructure | null
  outcomesMap: OutcomesMap | null
  componentPlan: ComponentPlan | null
  gradeReport: GradeReport | null
  challenges: Challenge[] | null

  // History
  conversationHistory: IdeationMessage[]
  humanFeedback: { action: string, message: string }[]
  versions: BlueprintVersion[]
}
```

---

## Engine Functions

### produce(session, context, feedback?)

Calls the production agent for the current stage. Passes:
- Stage configuration (which agent, which model, which rubric)
- Project context (audience, outcomes, style config)
- Previous artifact (if revising)
- Human feedback (if provided, applied once)
- Cross-phase references (e.g., study material content for video scripts)

Returns: new Artifact (immutable, versioned)

### evaluate(artifact, rubric, context)

Calls the judge model (different from producer). Passes:
- The artifact to evaluate
- The rubric for this stage (dimensions, weights, thresholds)
- Source material for accuracy checking

Returns: Grade with per-dimension scores and improvement priorities

### runLoop(session, config)

Orchestrates the full cycle:
1. Call produce()
2. Run deterministic validators (cheap checks first)
3. If validators pass, call evaluate()
4. Track as IterationRecord with cost
5. Update bestArtifact if this version scores higher
6. If score < threshold AND iterations < max → loop back to produce()
7. If score ≥ threshold OR iterations = max → present to human
8. Enforce minimum 2 iterations regardless of score

### processReview(session, action, feedback?)

Handles the 5 human review actions:
- approve: lock artifact, emit stage.completed event, advance pipeline
- feedback: inject feedback into context, re-enter loop (max 3 more)
- reject: clear all context, re-enter loop with fresh start
- use_segments: split artifact, lock approved parts, re-enter for rejected
- mix_produce: composite artifact from specified versions, re-enter for polish

---

## Cost Model

Every LLM call is metered. Cost flows upward:

```
LLM Call → IterationRecord.costUSD
  → StageSession (sum of iterations)
    → NodeComponent (sum of sessions)
      → ProjectNode (sum of components)
        → ProjectBlueprint (sum of nodes)
          → Project.totalCostUSD (sum of everything)
```

Default pricing (configurable per model):
- Claude Sonnet input: $3/MTok, output: $15/MTok
- Claude Opus input: $15/MTok, output: $75/MTok
- GPT-4o input: $2.50/MTok, output: $10/MTok
- Image generation: $0.04/image (fal.ai FLUX)
- Voice synthesis: $0.50/minute (ElevenLabs)

Phase 0 (ideation) typically costs $0.50–$2.00 per project.
Phase 1–5 (production) costs depend on component count and complexity.

---

## Pattern 5: Cross-Critique Loop (CreatorOS addition)

CreatorOS adds this 5th pattern. It is a Core enhancement: the same
`runLoop()` function dispatches to cross-critique via the `loopPattern`
field on `LoopStage`. eLearn AIOS inherits this pattern without
modification — it's universal machinery.

```
Iteration N=1:
  • Producer A (Claude Sonnet) → generates Version_A    } parallel
  • Producer B (GPT-4o)        → generates Version_B    } via
                                                         } gateway.requestMultiple()
  • Critic on B (Claude)        → reads Version_B → Critique_B   } parallel
  • Critic on A (GPT-4o)        → reads Version_A → Critique_A   }
  • Integrator (Claude)         → reads {A, B, Critique_A, Critique_B}
                                → synthesizes Version_Synth (best of both + fixes)
  • Judge (Gemini)              → grades Version_Synth against rubric
                                → returns GradeReport

Iteration N=2..maxIter:
  IF score ≥ threshold AND iterations ≥ minIter → present best
  ELSE
    • Producers re-generate with critique + previous best as context
    • Cycle repeats

Termination — whichever fires first:
  • Threshold met AND min iterations satisfied → 'presenting'
  • Max iterations reached → 'presenting' (terminationReason: 'max_iterations')
  • Cumulative cost ≥ maxBudgetUSD → 'presenting' (terminationReason: 'budget_exhausted')
```

### When to use Pattern 5

- High-quality text artifacts where two model perspectives genuinely
  catch different failure modes (Claude tends toward elegance; GPT tends
  toward completeness — together they cover both).
- Artifacts that need both creative voice and structural integrity.
- Production stages in CreatorOS V1 (LinkedIn post, long-form article).

### When NOT to use Pattern 5

- Cheap stages where one model produces good-enough output (research
  curation, source ranking).
- Stages where speed matters more than quality (idea brainstorming).
- Stages where the cost of the integrator + judge step doesn't pay
  for itself.

### Why this beats Tournament (Pattern 3) for text content

Tournament picks one winner from N parallel producers — the strengths
of the losing entries are discarded. Cross-Critique uses an integrator
to **synthesize** strengths across producers. For text where good ideas
in version A and good structure in version B can be merged, synthesis
beats selection. For images/video where outputs are atomic (you can't
"merge" two images), Tournament remains the right pattern.

### Configuration

```typescript
interface CrossCritiqueConfig {
  producers: AgentConfig[]
  critics: AgentConfig[]                      // explicit (CR-6): the engine needs each
                                              // critic's own model for the gateway call
  criticAssignments: Record<string, string>   // criticAgentId → targetProducerAgentId
  integratorAgent: AgentConfig                // sequential, single model
  judgeAgent: AgentConfig                     // different model from producers + integrator
}

interface LoopStage<T> {
  // ...existing fields...
  loopPattern: 'standard' | 'strategic' | 'tournament' | 'nested' | 'cross-critique'
  crossCritique?: CrossCritiqueConfig         // required when loopPattern = 'cross-critique'
  maxBudgetUSD?: number                       // termination on cumulative iteration cost
}
```

### Rules specific to Pattern 5

In addition to the universal 9 loop rules:

10. **Producer ≠ Integrator ≠ Judge** at the model level. Anthropic
    Outcomes' discipline: the judge runs in a fresh context window with
    only the rubric and the artifact. Enforced at iteration start;
    throws if any overlap.

11. **Producers never see the rubric.** They get PRESERVE/IMPROVE
    feedback from the judge (per Forge ADOPT 1), not the rubric text.
    Prevents producers from gaming the rubric instead of solving the
    underlying problem.

12. **Budget cap is hard.** When `cumulativeCostUSD >= maxBudgetUSD`,
    terminate immediately with `terminationReason: 'budget_exhausted'`.
    Surface the best-version-so-far artifact. Do not start another
    iteration even if min iterations not yet met.

See `docs/01-architecture/cross-critique-pattern.md` for the full spec
including iteration-record shape, cost accounting, and V2+ pattern
variants under exploration (sequential relay, triadic mutual,
adversarial debate, critique-only).
