# Pipeline V1 — Stages and Gates

> The V1 production flow. Strictly linear. Two human gates.
> Idea → Research → Long-Form Master → Repurpose → Artifacts.

## Stage map

```
STAGE 0 — Persona Setup (one-time per persona, reused across ideas)
  Inputs:  User describes their persona (form CRUD)
  Loop:    None in V1 (V2 may add Persona Setup Assistant agent)
  Output:  CreatorPersona row in DB
  Gate:    None — implicit save on form submit

STAGE 1 — Idea Capture / Selection
  Inputs:  User types into IdeaLog OR picks existing idea
           OR uses Idea Coach to propose topics under an umbrella
  Loop:    None — direct CRUD
  Output:  Selected Idea promoted to Workspace pipeline
  Gate:    None

STAGE 2 — Research
  Inputs:  Selected Idea + CreatorPersona + (optional) uploaded docs
  Loop:    Standard loop (Pattern 1).
           Agents: ResearchAgent (Anthropic web_search) +
                   SourceCurator (dedupe, rank, filter)
           Rubric: relevance, coverage, sourceQuality, factualGrounding,
                   completeness (≥20% per Forge ADOPT 6)
           Threshold: 75. Min 2 / Max 3 iterations.
  Output:  ResearchDossier — list of ResearchSource records
           with extracts + summaries. Every source traced.
  Gate:    None (passes silently into Stage 3)

STAGE 3 — Long-Form Master Build
  Inputs:  ResearchDossier + Persona + Idea + uploaded docs
  Loop:    Standard loop (Pattern 1).
           Agent: LongFormSynthesizer
           Validator (cheap, before LLM judge):
             - ≥3 sections
             - every section has heading + contentMarkdown
             - every section has ≥1 SourceRef
             - every SourceRef → existing ResearchSource
             - total word count ≥ 800
           Rubric: comprehensiveness, accuracy, personaAlignment,
                   traceabilityCompleteness, completeness (≥20%)
           Threshold: 80 (Gate A bar is high). Min 2 / Max 4 iterations.
  Output:  LongFormMaster with structured sections + SourceRefs
  Gate:    GATE A — Human reviews Long-Form Master
           Required UI: source traceability panel (every section
                        clickable → linked ResearchSources with snippets)
           Actions surfaced: approve | feedback | reject | inline_edit
           On approve / inline_edit → unlock Stage 4

STAGE 4 — Repurpose Target Selection
  Inputs:  Approved LongFormMaster
  Loop:    None — direct UI selection
  Output:  List of artifact types to generate
           (V1: linkedin_post, long_form_article, or both)
  Gate:    None (user selection IS the gate)

STAGE 5 — Artifact Generation (one StageSession per type)
  Inputs:  LongFormMaster + Persona + Artifact-type config
  Loop:    CROSS-CRITIQUE loop (Pattern 5).
           Producers: Claude + GPT-4o
           Critics: Claude-on-GPT, GPT-on-Claude
           Integrator: Claude
           Judge: Gemini (different model from all producers + integrator)
           Rubric: persona-fit, audience-fit, platform-fit,
                   hook/intro strength, structuralQuality,
                   completeness (≥20%)
           Threshold: 80. Min 2 / Max 4 iterations. maxBudgetUSD: 2.00
  Output:  Best artifact + full iteration history
  Gate:    GATE B — per artifact. Human reviews.
           Actions surfaced: approve | feedback | reject | inline_edit
           Regenerate button forks (per inline-edit + regenerate decision)
           On approve → artifact locked. On inline_edit → saved as final.
           When BOTH artifacts approved → Idea status: 'completed'.

STAGE 6 — Save & Done
  Inputs:  Approved artifacts
  Loop:    None
  Output:  Artifacts in workspace, downloadable, Idea marked complete
  Gate:    None
```

## Stage gate summary

| Gate | After | What's approved | Required UI |
|---|---|---|---|
| **Gate A** | Stage 3 (Long-Form Master) | Knowledge base quality | Source traceability panel (non-negotiable) |
| **Gate B** | Stage 5 (each artifact) | Publishable output | Inline editor + Regenerate + iteration history |

## Stage 5 modeling — sibling StageSessions, not nested

Each artifact type in Repurpose runs as its own `StageSession`,
siblings under one logical "Stage 5":

```
master.id = "lfm-123"
  ├── StageSession id="stage5-linkedin"      artifactType="linkedin_post"
  └── StageSession id="stage5-article"        artifactType="long_form_article"
```

Reasons:

- Each has independent rubric (LinkedIn vs article).
- Each has independent budget cap (2.00 USD each).
- Each gets its own Gate B decision.
- Sibling shape keeps the Pipeline Orchestrator data model uniform.
- Parallelization is trivial later (run both StageSessions concurrently).

## Loop patterns used per stage

| Stage | Loop pattern | Reason |
|---|---|---|
| 2 — Research | Standard (Pattern 1) | One agent iterates; cheap; quality from rubric refinement |
| 3 — Long-Form Master | Standard (Pattern 1) | Synthesis is single-author work; cross-critique would over-engineer |
| 5 — LinkedIn post | Cross-Critique (Pattern 5) | High-stakes text artifact; two-model dialectic genuinely helps |
| 5 — Long-form article | Cross-Critique (Pattern 5) | Same — voice + structure both critical |

## What runs in parallel vs sequence in V1

- **Within one cross-critique iteration:** producers parallel,
  critics parallel, integrator sequential, judge sequential
  (via `gateway.requestMultiple()`).
- **Between LinkedIn and article stages:** V1 runs them sequentially
  (user clicks "run" on each). Parallel execution designed-in
  (sibling StageSessions independent) but not wired in V1 — saves
  UI complexity. V2 may add parallel execution.

## Context curation per stage (System 6)

V1 uses `PassthroughCurator` everywhere. Priority hints:

| Stage | Source priorities |
|---|---|
| Stage 3 (Master synth) | Persona=10, Idea=10, ResearchSources=8, UploadedDocs=6 |
| Stage 5 (Repurpose) | Persona=10, ArtifactConfig=10, LongFormMaster=8, IterationHistory=5 |

V2 swaps in real curators (SemanticRetriever, LLMSummarizer) without
touching stage configs.

## Error handling and resume

Per loop rule 9 (graceful degradation): on failure, preserve state,
resume from last stable artifact.

Every iteration writes to DB before continuing. If a stage crashes
mid-iteration (model API timeout, network failure), the StageSession
status reverts to the last completed iteration. User can resume from
the workspace dashboard.

V1 does not auto-retry on failure. User clicks "Resume" or "Run next
iteration" manually. V2+ adds auto-retry with backoff.
