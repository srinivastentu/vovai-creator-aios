# Cross-Critique Loop Pattern (Pattern 5)

> The single Core enhancement CreatorOS introduces to the VOVAI platform.
> Added to the Loop Engine's pattern catalog. Available to every AIOS
> from the moment it ships — eLearn AIOS inherits it without code
> changes on its side.

## The shape

Two producers generate in parallel. They critique each other's output.
An integrator synthesizes both versions plus both critiques into a
single Version_Synth. A judge (different model from producers and
integrator) grades it against the rubric. The cycle repeats until
threshold, max iterations, or budget — whichever fires first.

```
Iteration N:
  Producer A (Claude Sonnet)  ──┐
                                ├─→  Version_A
                                │
  Producer B (GPT-4o)         ──┤    Version_B
                                │       │
                                │       ▼
  Critic on B (Claude)         ─┼─→  Critique_B  (what's missing in B)
  Critic on A (GPT-4o)         ─┼─→  Critique_A  (what's missing in A)
                                │
                                ▼
  Integrator (Claude)  ──→  Version_Synth  (best of both + fixes)
                                │
                                ▼
  Judge (Gemini)        ──→  GradeReport
```

Producers and critics run in parallel via `gateway.requestMultiple()`.
Integrator and judge run sequentially. Cost per iteration: producers
× 2 + critics × 2 + integrator × 1 + judge × 1 = **6 LLM calls**.

## Why this beats Tournament for text

Tournament picks one winner from N parallel producers. The strengths
of the losers are discarded. Cross-Critique uses an integrator to
**synthesize** strengths across producers.

For text artifacts where "good idea in A + good structure in B" can
merge into a better single output, synthesis beats selection. For
images/video where outputs are atomic (you can't merge two images),
Tournament remains correct. CreatorOS V1 text artifacts use
Cross-Critique. V2 image artifacts will use Tournament.

## Why this beats a single producer + judge

Single-producer loops have a self-similar failure mode: the producer
keeps making the same kind of mistake because it's the same model.
The judge catches some of it but not all — judges anchor to plausible
output. Adding a second producer from a different model family
exposes those blind spots to a model that doesn't share them.

The integrator step is what makes this work at scale. Without it,
you have N drafts and no way to pick. With it, you have one synthesis
that strictly dominates any single draft if the integrator is doing
its job.

## Why a third model judges

**Self-preference bias.** When Claude grades Claude's output, the
score is systematically inflated — the model recognizes its own
style and assigns it higher quality than warranted. Same with GPT.
The judge must be a third model that has no reason to prefer either
producer's voice.

Gemini in V1. Future flexibility: any cross-model judge works.

## V1 configuration

```typescript
interface CrossCritiqueConfig {
  producers: AgentConfig[]                    // V1: 2 producers (Claude + GPT-4o)
  criticAssignments: Record<string, string>   // criticAgentId → targetProducerAgentId
                                              // V1: { "claude-on-gpt": "gpt-producer",
                                              //       "gpt-on-claude": "claude-producer" }
  integratorAgent: AgentConfig                // V1: Claude — sequential, single call
  judgeAgent: AgentConfig                     // V1: Gemini — different model required
}

interface LoopStage<T> {
  // ...existing fields...
  loopPattern: 'standard' | 'strategic' | 'tournament' | 'nested' | 'cross-critique'
  crossCritique?: CrossCritiqueConfig
  maxBudgetUSD?: number                       // V1 default: 2.00 per stage
}
```

### Required iteration record fields

```typescript
interface CrossCritiqueIterationRecord extends IterationRecord {
  producerArtifacts: Record<string, unknown>  // producerAgentId → artifact
  critiques: Record<string, string>           // criticAgentId → critique text
  integratedArtifact: unknown                  // the integrator's output
  judgeGrade: GradeReport
  iterationCostUSD: number                    // sum across all 6 sub-calls
}
```

### Termination logic

In addition to the 9 universal loop rules, Pattern 5 obeys:

```
For each iteration:
  produce A, B in parallel
  critique A, B in parallel
  integrate
  judge → GradeReport
  cumulativeCostUSD += iterationCostUSD
  update bestArtifact if GradeReport.score > bestGrade.score

  IF GradeReport.score >= threshold AND loopCount >= minIterations:
    terminationReason = 'threshold_met'
    return 'presenting'

  IF cumulativeCostUSD >= maxBudgetUSD:
    terminationReason = 'budget_exhausted'
    return 'presenting'

  IF loopCount >= maxIterations:
    terminationReason = 'max_iterations'
    return 'presenting'

  return 'revising'
```

The escalation surfaces `bestArtifact` (not the last iteration's
output) with `terminationReason` so the UI can show why the loop
stopped.

## Pattern 5-specific rules

In addition to the universal 9 loop rules:

- **Rule 10: Producer ≠ Integrator ≠ Judge at the model level.** The
  judge runs in a fresh context window with only the rubric and the
  artifact. Throws at iteration start if any model overlap detected.
- **Rule 11: Producers never see the rubric.** They get
  PRESERVE/IMPROVE feedback (Forge ADOPT 1), not rubric text.
- **Rule 12: Budget cap is hard.** When `cumulativeCostUSD >=
  maxBudgetUSD`, terminate immediately even if min iterations not met.
  Better to surface a budget-exhausted best-version than burn more
  money.

## What the V1 acceptance test verifies about this pattern

Criterion 4 from §9 of master context:

> The cross-critique loop produced **substantively different** versions
> across iterations (not just superficial edits).

Mechanized check: cosine similarity between consecutive
`integratedArtifact` embeddings (via `text-embedding-3-large`) must
be ≤ 0.92. Higher similarity means the producers are stuck — likely
prompt issue or feedback ignored. Flagged as warning; doesn't block
the pipeline, but indicates a tuning opportunity.

## V2+ variants designed but not built

Listed in §5.4 of master context. All compose with the same Loop
Engine machinery; only `CrossCritiqueConfig` shape differs:

- **Sequential relay** — A → critique by B → A integrates → critique
  by C → A integrates → judge. Single producer; multiple critics in
  sequence.
- **Triadic mutual** — Three producers all critique all others; all
  integrate; judge picks. More expensive, potentially higher quality.
- **Adversarial debate** — Two producers argue against each other's
  version; moderator synthesizes; judge grades. Useful for
  controversial/opinion content.
- **Critique-only loop** — One producer, multiple cross-model critics,
  single integrator. Cheaper than full cross-critique; preserves the
  cross-model perspective discipline.

V2 builds 3-4 of these behind feature flags, A/B tests on real
artifacts, picks winner(s) for production.

## Implementation references

- `src/lib/core/engine/types.ts` — `CrossCritiqueConfig`,
  `CrossCritiqueIterationRecord`, `LoopStage.maxBudgetUSD`
- `src/lib/core/engine/loop-engine.ts` — `runCrossCritiqueIteration()`
  internal function, dispatched from `runLoop()` when
  `stage.loopPattern === 'cross-critique'`
- `src/lib/domain/workflows/creator/agents/linkedin/` — V1 LinkedIn
  agent set (producer-claude, producer-gpt, critic-on-gpt,
  critic-on-claude, integrator, judge)
- `src/lib/domain/workflows/creator/agents/article/` — V1 article
  agent set (same shape, article-specific prompts)
- `src/lib/domain/workflows/creator/rubrics/linkedin-post-rubric.ts`
- `src/lib/domain/workflows/creator/rubrics/article-rubric.ts`
