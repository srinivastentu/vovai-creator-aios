# Tournament Pattern

- **Status:** As-built (shipped in Phase 4.4, refined in Phase 4.5)
- **Companion to:** [recursive-loop-engine.md](./recursive-loop-engine.md)
- **Reference implementation:** [src/lib/core/engine/tournament.ts](../../src/lib/core/engine/tournament.ts)

The Loop Engine supports two production patterns. **Iterative-revise** runs a single candidate through rounds of critique and revision — the right pattern for text. **Tournament** runs N candidates in parallel, ranks them with an injected judge, and regenerates the top few in the next round — the right pattern for media (image, audio, video).

This doc specifies the tournament pattern as built.

---

## 1. When to use tournament vs. iterative-revise

| Artifact | Pattern | Why |
|---|---|---|
| Text (article, script, outline) | Iterative-revise | LLMs can sharpen one dimension of a draft without rewriting the others. |
| Image | Tournament | Image models cannot "revise." A new generation is a new seed; the previous image is lost. |
| Audio (voice, music) | Tournament | Same — TTS and music models regenerate, they do not revise. |
| Video | Tournament (likely nested) | Same — plus the per-scene cost makes parallel-plus-rank more economical than sequential retries. |
| Structured artifacts (JSON blueprints, rubrics) | Iterative-revise | Discrete revisions make sense; LLM can target fields. |

Rule of thumb: if `revise()` for this artifact means "call the model again with a tweaked prompt," you need a tournament, not a revise loop.

---

## 2. Core types

All types are defined in [src/lib/core/engine/tournament-types.ts](../../src/lib/core/engine/tournament-types.ts). Key shapes:

```ts
interface TournamentConfig {
  modelIds: string[]         // models to race in round 1
  maxRounds: number          // escalation budget
  threshold: number          // overall score that ends the tournament early
  topN: number               // survivors advanced to next round
  timeoutPerModelMs: number  // per-model generation budget
  width?: number             // optional: image/video dimensions
  height?: number
}

interface TournamentEntry {
  modelId: string
  round: number
  artifact: ImageArtifact            // or AudioArtifact / VideoArtifact in Phase 5/6
  gatewayResponse: GatewayResponse   // raw provider result (cost, duration, error)
  validatorResult: ValidatorOutcome | null
  grade: GradeReport | null          // null if validation failed
}

interface TournamentResult {
  winner: TournamentEntry | null
  allEntries: TournamentEntry[]
  rounds: TournamentRound[]
  bestEntry: TournamentEntry | null  // best seen even if below threshold
  totalCostUsd: number
  method: 'threshold_met' | 'escalation' | 'all_failed'
}

type TournamentRunner = (
  prompt: string,
  config: TournamentConfig,
  context?: Partial<GatewayContext>
) => AsyncGenerator<TournamentEvent, TournamentResult, void>
```

The runner is an **async generator**: it yields `TournamentEvent`s as work progresses and returns a `TournamentResult` at the end. Callers stream the events to the UI and keep the final result.

---

## 3. Execution flow

Each round executes six numbered steps. The runner lives at [tournament.ts:105](../../src/lib/core/engine/tournament.ts#L105):

```
Round N (N = 1 … maxRounds):

  1. yield 'round-start' with modelsForRound
  2. gateway.requestMultiple(params, modelsForRound)
        — parallel generation across all models for this round
        — each provider call threads AbortSignal + timeout
        — per-call cost recorded to ledger
  3. yield 'generation-complete' (and 'generation-failed' for any that 4xx'd)
  4. Validators run per entry (synchronous, cheap)
        — fileExists, fileSize, imageDimensions (or audio equivalents)
        — entries failing validation are skipped in step 5
     yield 'validation-complete'
  5. Judge runs per validated entry (sequential — vision API is expensive)
        — yield 'entry-judged' with score + full grade per entry
     yield 'round-complete'
  6. Rank across ALL entries from ALL rounds
        — if top ≥ threshold: yield 'winner-selected', return
        — if final round: yield 'escalation' (best-effort) or 'all-failed'
        — otherwise: refine prompt via buildRefinedPrompt (PRESERVE/IMPROVE),
                     advance topN models to round N+1
```

The runner finalises when any of:
- A grade meets or exceeds `config.threshold` → `method: 'threshold_met'`
- `maxRounds` is exhausted with at least one graded entry → `method: 'escalation'` (best-seen returned as `bestEntry`, no `winner`)
- All entries failed generation or validation → `method: 'all_failed'`

### 3.1 Prompt refinement between rounds

After round N fails to meet threshold, `buildRefinedPrompt(initialPrompt, bestGrade, rubric)` constructs the round N+1 prompt. The helper is at [tournament.ts:37](../../src/lib/core/engine/tournament.ts#L37). It reuses the **PRESERVE / IMPROVE** rule from the text stage:

- Dimensions scoring ≥ 8: append "PRESERVE (these aspects were strong): …"
- Dimensions scoring < 8: append "IMPROVE (focus on these): … — {feedback}"

The next round's models regenerate against this augmented prompt. The PRESERVE/IMPROVE instruction is what prevents the loop from oscillating (cf. Phase 3.4 learnings in [001-project-learnings-phase-3.md](../decisions/001-project-learnings-phase-3.md) §2.3).

---

## 4. Event taxonomy

Nine event types, defined at [tournament-types.ts:56](../../src/lib/core/engine/tournament-types.ts#L56):

| Event | When | Key data |
|---|---|---|
| `tournament:round-start` | Start of each round | `totalEntries`, `refinedPrompt` (round ≥ 2) |
| `tournament:generation-complete` | After all parallel generations return | `totalEntries`, `failedGeneration`, `costSoFar` |
| `tournament:generation-failed` | Per-model 4xx / 5xx / timeout | `modelId`, `costSoFar` |
| `tournament:validation-complete` | After validators run | `passedValidation` |
| `tournament:entry-judged` | Per entry scored by the judge | `modelId`, `score`, `grade`, `entry` |
| `tournament:round-complete` | After judging finishes for this round | — |
| `tournament:winner-selected` | Threshold met | `modelId`, `score`, `entry` |
| `tournament:escalation` | Max rounds reached with a best-seen | `modelId`, `score`, `entry` |
| `tournament:all-failed` | No usable entries anywhere | `totalEntries`, `failedGeneration` |

Adding a new event is a four-step change: add to the union, emit from the runner, handle in the hook, render in the UI.

---

## 5. Integration points

### Inputs (injected)

| Injected | Source | Purpose |
|---|---|---|
| `gateway: ModelGateway` | `core/models/gateway.ts` | Provider dispatch, cost ledger, rate limiting, health |
| `judge: JudgeFunction` | Caller assembles (e.g. `createImageJudge()` at `core/agentic/judges/image-judge.ts`) | Scores each entry against the rubric |
| `validators: TournamentValidator[]` | Caller assembles (e.g. `core/agentic/validators/image-validators.ts`) | Tier-1 deterministic gates, pre-judge |
| `rubric: RubricDefinition` | Caller passes (e.g. `imageRubric` from `core/agentic/judges/image-rubric.ts`) | Drives judge scoring and PRESERVE/IMPROVE refinement |

### Outputs

- Stream of `TournamentEvent`s via async generator
- Final `TournamentResult` including `winner`, `bestEntry`, full `allEntries`, `totalCostUsd`

### Contract with Core vs. Domain

The runner file `tournament.ts` imports **only** from:
- `core/models/gateway` and `core/models/types`
- `core/engine/types` and `core/engine/tournament-types`

It imports nothing from `core/agentic/`, nothing from `core/review/`, nothing from `domain/`. This is verifiable:

```bash
grep -r "from.*domain/" src/lib/core/engine/tournament.ts
# (empty)
grep -r "from.*agentic/" src/lib/core/engine/tournament.ts
# (empty)
```

The caller (a domain pipeline stage or an API route) is responsible for assembling the dependencies and passing them in.

---

## 6. Cost implications

A tournament with `modelIds.length = N`, `maxRounds = R`, and `topN = K` costs at most:

```
total_cost ≤ N × round1_per_model_cost
           + (R - 1) × K × roundN_per_model_cost
           + total_entries_graded × judge_per_call_cost
```

Concretely, for the current image lineup (5 models in round 1, `maxRounds = 3`, `topN = 2`):
- Round 1: 5 × (0.025 – 0.134 USD) = ~0.12 – 0.67 USD
- Rounds 2-3: 2 × 2 × per-model ≈ 0.1 – 0.27 USD
- Judge (GPT-4o vision): ~9 entries × ~0.005 USD ≈ 0.045 USD
- **Total per tournament: ~0.3 – 1.0 USD**

This is why **pre-call budget enforcement** is flagged as an open tension in [002-image-pipeline-learnings.md §3.2](../decisions/002-image-pipeline-learnings.md). Video will be 10–100× these numbers.

---

## 7. Threshold + topN tuning

- **Threshold** is the rubric overall score that ends the tournament. Set conservatively — if threshold = 7.0 and round 1 produces a 7.1, the tournament finalises without trying round 2. Phase 4 image threshold defaults to 7.0 and worked well in testing.
- **topN** is how many models advance. `topN = 1` is greedy and can miss a model that just needed a refined prompt; `topN = 3+` multiplies cost. `topN = 2` is the current sweet spot.
- **maxRounds** gives the PRESERVE/IMPROVE feedback a chance to take effect. `maxRounds = 1` is effectively a drag race; `maxRounds = 3` is typical; more than 3 rarely converges further.

---

## 8. UI consumption pattern (SSE)

The reference implementation is [src/hooks/useImageTournament.ts](../../src/hooks/useImageTournament.ts) feeding [src/app/generate/image/page.tsx](../../src/app/generate/image/page.tsx). The pattern:

1. Client sends `POST /api/generate/image` with `{ prompt, modelIds, config }`
2. API route writes a `ReadableStream` of SSE frames — one frame per `TournamentEvent` plus a final `tournament:result` frame with the full `TournamentResult`
3. Hook consumes the stream, dispatches on event type, merges into React state
4. UI renders two columns: **current round** (left) and **best-so-far** (right) — keeps the user anchored on the best version even when a round regresses
5. On `tournament:winner-selected` or `tournament:escalation` or `tournament:all-failed`, the stream closes and the hook finalises state

Regenerate + feedback logic also lives in the hook (commit `3e41b50`). The component renders; the hook coordinates.

---

## 9. Extending to new media types

To add a new artifact type (e.g. voice, music, video):

1. Define the artifact shape (e.g. `AudioArtifact { audioPath: string; prompt: string; durationMs: number }`)
2. Add it as a union member in `tournament-types.ts` OR keep the engine generic by parameterising (current code uses `ImageArtifact` directly — see §10 below)
3. Write Tier-1 validators (deterministic, cheap) under `core/agentic/validators/`
4. Write the rubric + judge under `core/agentic/judges/` — follow the `imageRubric` / `createImageJudge` pattern
5. Add provider client(s) under `core/models/providers/` — use `shared.ts` helpers
6. Register models in `model-inventory.ts` (sandbox-verify IDs first — see §4.7 of 002)
7. Write the API route with SSE streaming (copy from `api/generate/image/route.ts`)
8. Write the UI hook + page (copy from `useImageTournament.ts` + `generate/image/page.tsx`)

Nothing in `core/engine/tournament.ts` needs to change for voice, music, or video — assuming §10 is handled.

---

## 10. Known generalisation work

The current runner hardcodes `ImageArtifact` in a handful of places (e.g. `buildEntry` at [tournament.ts:74](../../src/lib/core/engine/tournament.ts#L74)). For Phase 5 (audio) we should either:

- (a) Widen `ImageArtifact` to a discriminated union of media artifacts, or
- (b) Parameterise the runner: `TournamentRunner<T extends MediaArtifact>`

Option (b) is the cleaner path and matches the existing `TournamentValidator<T>` generic signature at [tournament-types.ts:93](../../src/lib/core/engine/tournament-types.ts#L93). Defer the decision until Phase 5 starts — premature generalisation on one concrete data point is a smell.

---

## 11. Related docs

- [recursive-loop-engine.md](./recursive-loop-engine.md) — the parent engine spec
- [002-image-pipeline-learnings.md](../decisions/002-image-pipeline-learnings.md) — the Phase 4 retrospective, including the decisions that led to this pattern
- [VOVAI_MMS_Architecture_v1.md](./VOVAI_MMS_Architecture_v1.md) — the gateway the runner dispatches through
- [core-domain-framework.md](./core-domain-framework.md) — the boundary this pattern respects
