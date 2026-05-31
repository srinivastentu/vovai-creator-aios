# Rubrics — V1 Inventory and Authoring Rules

> Every loop stage in CreatorOS has a rubric. The judge evaluates the
> artifact against the rubric. Rubrics are domain configuration —
> they live in `src/lib/domain/workflows/creator/rubrics/` and use
> the generic `RubricDefinition` type from Core.

## V1 rubric list

| Rubric | Used by stage | Dimensions | Threshold |
|---|---|---|---|
| `RESEARCH_RUBRIC` | Stage 2 — Research | 5 dims | 75 |
| `LONG_FORM_MASTER_RUBRIC` | Stage 3 — Master synthesis | 5 dims | 80 |
| `LINKEDIN_POST_RUBRIC` | Stage 5a — LinkedIn | 6 dims | 80 |
| `LONG_FORM_ARTICLE_RUBRIC` | Stage 5b — Article | 6 dims | 80 |

Scale: **1–10 per dimension, weighted into a 0–100 composite score.**
(Standardized to 1-10 dimension scores per Forge analysis ADOPT 7 —
LLMs calibrate better on 1-10 than on 0-100.)

## Authoring rules (applied to every rubric)

These are non-negotiable. Enforced by the rubric-author subagent
(`.claude/agents/rubric-author.md`) and by tests.

### Rule 1 — Weights sum to 1.0

```typescript
const weightSum = dimensions.reduce((s, d) => s + d.weight, 0)
assert(Math.abs(weightSum - 1.0) < 0.001, 'Rubric weights must sum to 1.0')
```

Caught by `tests/unit/domain/rubrics.test.ts`.

### Rule 2 — Completeness dimension ≥ 20% weight (Forge ADOPT 6)

Every rubric includes a `completeness` dimension weighted at ≥ 0.20.
The judge checks completeness FIRST. Incomplete artifacts score ≤4
on completeness regardless of other quality.

Reason: articles cut off mid-sentence get scored 6-7 on overall
quality because the existing parts are decent. Completeness as a
high-weight dimension forces the judge to surface incompleteness
explicitly.

### Rule 3 — Reasoning before scoring (Forge ADOPT 5)

The judge prompt enforces:

> Write your reasoning BEFORE assigning each numeric score. This is
> mandatory. The reasoning must reference specific evidence from the
> artifact. Generic justifications ("the post flows well") are
> rejected; specific evidence ("the second paragraph repeats the
> point made in the hook") is required.

Without reasoning-first, scores are inflated and inconsistent. With
it, the judge anchors to specific observations.

### Rule 4 — Composite score recalculated from dimensions

The judge returns per-dimension scores. The composite score is
**calculated by code**, not by the LLM:

```typescript
function calculateCompositeScore(dimensions: DimensionScore[]): number {
  return dimensions.reduce((sum, d) => sum + (d.score * d.weight * 10), 0)
  // d.score is 1-10; weight sums to 1.0; final score is 0-100
}
```

Never trust the LLM's arithmetic. The number you act on is the
calculated one.

### Rule 5 — Producers never see the rubric (Pattern 5 rule)

When generating, producers receive PRESERVE/IMPROVE feedback (Forge
ADOPT 1) extracted from the judge's grade, NOT the rubric text. This
prevents producers from gaming rubric structure instead of solving
the underlying problem.

## Dimension shape

```typescript
interface RubricDimension {
  id: string                      // 'persona-fit', 'hook-strength', ...
  name: string                    // human label
  weight: number                  // 0..1, sums to 1.0 with siblings
  passThreshold: number           // dimension-level pass bar (1-10 scale)
  description: string             // what this dimension measures
  criteria: string                // detailed criteria for the judge
}
```

The `criteria` field is the judge's source of truth for that
dimension. It should be ~3-5 specific things to look for, NOT
abstract qualities ("good writing"). Example for a hook-strength
dimension:

```
criteria: |
  Score this dimension based on:
  1. Does the first 3 lines make a reader stop and pay attention?
     (Specific claim, surprising statement, named pain point)
  2. Does it avoid generic AI openings ("In today's fast-paced
     world", "It's no secret that", "Let's talk about")?
  3. Does the third line either resolve or escalate the first line's
     promise?
  4. Is the hook proportionate to the post? (Hook length 5-15% of
     total)

  Score 10 = a reader who hates LinkedIn would stop scrolling.
  Score 5  = inoffensive, would not stop a reader, would not bore them.
  Score 1  = generic opening, indistinguishable from any AI post.
```

## V1 rubric specifications

### RESEARCH_RUBRIC (Stage 2)

Threshold 75. Min 2 / Max 3 iterations.

| Dimension | Weight | Pass | What it measures |
|---|---|---|---|
| `relevance` | 0.20 | 7 | Sources are about the idea, not adjacent topics |
| `coverage` | 0.20 | 7 | Multiple facets of the idea represented |
| `sourceQuality` | 0.20 | 7 | Authoritative sources, not random blogs |
| `factualGrounding` | 0.20 | 7 | Claims in snippets verifiable in source |
| `completeness` | 0.20 | 7 | ≥3 sources after curation; URLs valid |

### LONG_FORM_MASTER_RUBRIC (Stage 3)

Threshold 80 (Gate A bar). Min 2 / Max 4 iterations.

| Dimension | Weight | Pass | What it measures |
|---|---|---|---|
| `comprehensiveness` | 0.20 | 8 | The idea is treated thoroughly |
| `accuracy` | 0.20 | 8 | Section claims match cited sources |
| `personaAlignment` | 0.20 | 7 | Voice/tone aligned to CreatorPersona |
| `traceabilityCompleteness` | 0.20 | 8 | Every section has ≥1 SourceRef |
| `completeness` | 0.20 | 7 | ≥3 sections; ≥800 words; nothing truncated |

### LINKEDIN_POST_RUBRIC (Stage 5a)

Threshold 80. Min 2 / Max 4 iterations. maxBudgetUSD 2.00.

| Dimension | Weight | Pass | What it measures |
|---|---|---|---|
| `personaFit` | 0.18 | 7 | Sounds like the persona, not generic AI |
| `audienceFit` | 0.16 | 7 | Speaks to the persona's stated audience |
| `platformFit` | 0.16 | 7 | LinkedIn-shaped (line breaks, no walls) |
| `hookStrength` | 0.15 | 7 | First 3 lines pull readers in |
| `structuralQuality` | 0.15 | 7 | Scannable; one closing thought |
| `completeness` | 0.20 | 7 | 1300-3000 chars; ≥2 paragraph breaks; first 3 lines present |

### LONG_FORM_ARTICLE_RUBRIC (Stage 5b)

Threshold 80. Min 2 / Max 4 iterations. maxBudgetUSD 2.00.

| Dimension | Weight | Pass | What it measures |
|---|---|---|---|
| `personaFit` | 0.18 | 7 | Persona voice consistent across sections |
| `audienceFit` | 0.16 | 7 | Right depth for stated audience |
| `platformFit` | 0.14 | 7 | Blog/Substack-shaped (not LinkedIn) |
| `introStrength` | 0.14 | 7 | First 100-200 words earn the article |
| `structuralQuality` | 0.18 | 7 | Heading hierarchy; intro/body/conclusion |
| `completeness` | 0.20 | 7 | 1200-3000 words; ≥2 H2 sections; no truncation |

## Validators (deterministic, run BEFORE the LLM judge)

Per loop rule 6: cheap programmatic checks run first. Only artifacts
passing validators reach the expensive judge.

| Stage | Validator |
|---|---|
| 2 — Research | `dossier.sources.length >= 3`; all URLs valid format |
| 3 — Master | `sections.length >= 3`; every section has heading + content + ≥1 SourceRef; total words ≥ 800 |
| 5a — LinkedIn | charCount in [1300, 3000]; ≥2 paragraph breaks; first 3 lines exist |
| 5b — Article | wordCount in [1200, 3000]; ≥2 H2 sections; explicit intro + conclusion |

Validator failure → status `revising`. Skip expensive LLM judge.

## V1 prompt anti-patterns to enforce

The rubric-author subagent flags these when reviewing rubric
authoring or judge prompts:

- ❌ Abstract criteria ("the post should be good")
- ❌ More than 8 dimensions in one rubric
- ❌ Weights not summing to 1.0
- ❌ Missing completeness dimension
- ❌ Completeness weight < 0.20
- ❌ Producer prompt that includes rubric text
- ❌ Judge prompt missing "write reasoning before score" instruction
- ❌ Composite score computed in LLM prompt instead of by code
