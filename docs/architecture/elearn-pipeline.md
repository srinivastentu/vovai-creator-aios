# eLearn AIOS — Domain Workflow & Production Pipeline

## System Identity

This document describes System 4: the eLearning Domain Workflow.
It lives in `src/lib/domain/workflows/`. It is DOMAIN — eLearning-specific
configuration, business rules, and pipeline orchestration.

This system IMPORTS from:
- `src/lib/core/engine/` (Loop Engine — runs individual stage loops)
- `src/lib/core/agentic/` (Agentic System — executes agents)
- `src/lib/core/review/` (Human Review System — enforces gates)

This system is the ONLY code that changes when building a different AIOS.

---

## Architecture Overview

The eLearning Domain Workflow has two layers:

1. **Ideation Pipeline (Phase 0)** — runs once per project, produces the structure
2. **Production Sub-Systems (Phases 1-5)** — run per component, produce deliverables

```
IDEATION PIPELINE (Phase 0 — runs once per project)
  5 independent gated loops, each using the Loop Engine:
    Brief → Audience → Structure → Components → Handoff
    ↓ produces: approved blueprint with nodes + components
    ↓ config wizard → production handoff creates pipeline jobs

PRODUCTION SUB-SYSTEMS (Phases 1-5 — run per component)
  Each sub-system is independently enableable per project:
    1. Document Pipeline ......... 5 stages  (textual foundation)
    2. Assessment Pipeline ....... 6 stages  (aligned to documents)
    3. Video Pipeline ............ 16 stages (references docs + assessments)
    4. Activity Pipeline ......... 5 stages  (builds on all content)
    5. Capstone Pipeline ......... 4 stages  (synthesizes everything)
```

**Why documents first:** Study materials establish the content foundation.
Videos reference this for scripts. Assessments align for question accuracy.
Activities build on it. Documents first means every downstream sub-system
has a verified textual source.

---

## Phase 0 — Ideation Pipeline (5 Independent Gated Loops)

Phase 0 is five independent stages. Each stage runs the Loop Engine
(System 1) independently — its own rubric, its own agents, its own
refinement cycle, its own human approval gate. The Domain Workflow
sequences the stages: approval on one unlocks the next.

This sequencing logic lives in `domain/workflows/pipeline-orchestrator.ts`,
NOT in the Loop Engine.

### Stage 1: Brief

```
Domain Workflow calls Loop Engine with:
  LoopStage config:
    id: 'brief'
    agents: [Orchestrator]
    rubric: BRIEF_RUBRIC (5 dimensions)
      - clarity (weight .25, pass 70)
      - specificity (weight .20, pass 65)
      - scope (weight .20, pass 65)
      - constraints (weight .15, pass 60)
      - objectives (weight .20, pass 70)
    threshold: 75
    maxIterations: 3
    minIterations: 2
    loopPattern: 'standard'

  What happens:
    1. User provides project brief (free text)
    2. Orchestrator agent parses intent, detects archetype, asks clarifying Qs
    3. Produces structured ProjectBrief artifact
    4. Judge grades against 5-dimension BRIEF_RUBRIC
    5. Loop until score >= 75 or max 3 iterations
    6. Present to human → Approve / Reject / Feedback
    7. On approve: Domain Workflow advances to Stage 2

  Artifact type: ProjectBrief (goals, constraints, audience hint, archetype)
```

### Stage 2: Audience

```
  id: 'audience'
  agents: [Audience Analyst]
  rubric: AUDIENCE_RUBRIC (5 dimensions)
    - specificity (weight .25, pass 70)
    - actionability (weight .20, pass 65)
    - prerequisites (weight .15, pass 60)
    - motivation (weight .20, pass 65)
    - context (weight .20, pass 65)
  threshold: 75
  maxIterations: 3
  minIterations: 2
  loopPattern: 'standard'

  Context: Approved brief from Stage 1
  Artifact type: AudienceProfile (experience, modality prefs, risk factors)
```

### Stage 3: Structure

```
  id: 'structure'
  agents: [Curriculum Strategist, Outcome Architect]
  rubric: STRUCTURE_RUBRIC (7 dimensions)
    - coverage (weight .18, pass 70)
    - depth (weight .15, pass 65)
    - progression (weight .18, pass 75)
    - balance (weight .12, pass 65)
    - engagement (weight .15, pass 70)
    - feasibility (weight .10, pass 60)
    - coherence (weight .12, pass 70)
  threshold: 75
  maxIterations: 5
  minIterations: 2
  loopPattern: 'strategic'

  Context: Approved brief + audience profile
  Strategic phase: Curriculum Strategist proposes 3 structure options
  Production phase: Selected option refined with Outcome Architect
  Artifact type: ProjectStructure (tree with modules, topics, outcomes)
```

### Stage 4: Components

```
  id: 'components'
  agents: [Component Recommender, Structure Optimizer]
  rubric: COMPONENT_RUBRIC (5 dimensions)
    - coverage (weight .25, pass 70)
    - appropriateness (weight .20, pass 65)
    - dependencies (weight .15, pass 60)
    - cost_feasibility (weight .20, pass 65)
    - alignment (weight .20, pass 70)
  threshold: 75
  maxIterations: 3
  minIterations: 2
  loopPattern: 'standard'

  Context: Approved brief + audience + structure
  Artifact type: ComponentPlan (which components at which nodes)
```

### Stage 5: Handoff

```
  id: 'handoff'
  agents: [Handoff Checker]
  rubric: HANDOFF_RUBRIC (5 dimensions)
    - config_completeness (weight .25, pass 75)
    - cost_validation (weight .20, pass 70)
    - timeline (weight .15, pass 65)
    - missing_items (weight .20, pass 70)
    - quality (weight .20, pass 70)
  threshold: 80
  maxIterations: 2
  minIterations: 1
  loopPattern: 'standard'

  Context: Everything from stages 1-4
  Artifact type: HandoffReadiness (all checks, cost estimate, timeline)
```

### Post-Ideation

```
Stage 0.6: Configuration Wizard
  Human configures: video style, quiz settings, material format, etc.
  Per-archetype defaults pre-filled from component registry
  NOT a loop stage — pure UI configuration

Stage 0.7: Production Handoff
  Domain Workflow creates pipeline jobs: one per NodeComponent
  Videos batched in groups of 10
  Documents, assessments, activities → individual jobs
  Each job links: NodeComponent.pipelineJobId → StageSession.id
```

### 8 Ideation Agents

All agent prompts and personas live in `domain/workflows/agents/`.
The Agentic System (System 2) in `core/agentic/` handles execution machinery.

| Agent | Stage | Role |
|-------|-------|------|
| Orchestrator | Brief | Parse intent, detect archetype, manage conversation |
| Audience Analyst | Audience | Profile target learners, recommend modalities |
| Curriculum Strategist | Structure | Propose hierarchy, sequencing, frameworks |
| Outcome Architect | Structure | Map learning outcomes to nodes |
| Component Recommender | Components | Assign components to nodes based on audience/outcomes |
| Structure Optimizer | Components | Check balance, dependencies, feasibility |
| Rubric Grader | All (evaluation) | Generic grading (core machinery in core/agentic/) |
| Devil's Advocate | Structure | Challenge assumptions, find weaknesses |

---

## Phase 1 — Document Pipeline (5 stages)

**Runs FIRST.** Textual foundation for everything else.
Each stage runs the Loop Engine with production rubric (5 dims, 1-10 scale, pass: 7).

```
Stage D1: Content Research & Outline
  Loop: Standard
  Agent generates outline from node learning outcomes + topic context

Stage D2: Content Generation
  Loop: Standard
  Full content with sections, key terms, diagrams (described), examples
  Respects reading level from audience profile

Stage D3: Formatting & Visual Design
  Loop: Standard
  Applies template, generates PDF/HTML, adds diagrams

Stage D4: Quality Validation
  Loop: Standard
  Checks: accuracy, readability, completeness, formatting

Stage D5: Review & Delivery [HUMAN GATE]
  Human Review System (System 3) presents artifacts
  Actions: Approve | Feedback | Reject
  Output: PDF + HTML + key terms JSON
```

Components: study_material, practice_worksheet, flashcards, glossary,
resource_library, mentor_checklist, discussion_prompt

| Component Type | Stages Used | Notes |
|---|---|---|
| study_material | D1-D5 (all) | Full pipeline |
| practice_worksheet | D1-D5 (all) | Problems + answer key |
| flashcards | D1, D2, D5 | Simplified |
| glossary | D2, D5 | Auto-extract terms |
| resource_library | D2, D5 | Curated links |
| mentor_checklist | D1, D2, D5 | Observation criteria |
| discussion_prompt | D1, D2, D5 | Prompts + facilitator guide |

---

## Phase 2 — Assessment Pipeline (6 stages)

References completed documents for content accuracy.

```
Stage A1: Outcome-to-Question Mapping
  Loop: Standard
  Maps each outcome to question types and Bloom levels

Stage A2: Question Generation
  Loop: Standard
  MCQ, true/false, fill-blank, matching, short answer, scenario-based

Stage A3: Answer Validation
  Loop: Standard (cross-model — Claude generates, GPT-4o verifies)

Stage A4: Difficulty Calibration
  Loop: Standard
  Validates Bloom distribution, progressive difficulty

Stage A5: Quality Review [HUMAN GATE]
  Actions: Approve | Feedback per question | Reject

Stage A6: Packaging
  Output: quiz JSON + answer key JSON + PDF + optional SCORM
```

Components: quiz, pre_assessment, post_assessment

---

## Phase 3 — Video Pipeline (16 stages)

Batched in groups of 10. Per-scene processing for V2, V4-V11.
References completed study materials for script accuracy.

```
SCRIPT (3A):
  V1 Discovery & Research — Loop: Strategic
  V2 Script Writing (per-scene) — Loop: Standard
  V3 Script Review [HUMAN GATE]

VISUAL (3B):
  V4 Image Prompt Engineering (per-scene) — Loop: Standard
  V5 Image Generation (per-scene) — Loop: Tournament (3+ models compete)
  V6 AV Storyboard Assembly — Loop: Standard
  V7 Storyboard Review [HUMAN GATE]

AUDIO + VIDEO (3C):
  V8 Voice-Over (per-scene) — Loop: Standard (ElevenLabs)
  V9 Video Generation (per-scene) — Loop: Tournament (Runway, Kling)
  V10 Music & SFX — Loop: Tournament (Suno)
  V11 Per-Scene Assembly — Loop: Standard (FFmpeg)
  V12 Full Video Assembly — Loop: Standard (FFmpeg)

FINISH (3D):
  V13 Captions & Subtitles — Loop: Standard
  V14 Final Render (1920x1080, 30fps, MP4 H.264) — Loop: Standard
  V15 Quality Assurance — Loop: Standard
  V16 Packaging & Delivery [HUMAN GATE]

Style Anchor: Scene 1's image winner (V5) sets visual reference for all scenes.
3 human gates: V3 (script), V7 (storyboard), V16 (final delivery).
Output per video: MP4 + SRT + thumbnail + metadata JSON
```

Components: video, video_short

---

## Phase 4 — Activity Pipeline (5 stages)

References documents, assessments, and videos for alignment.

```
Stage T1: Activity Design — Loop: Strategic + Standard
Stage T2: Material Generation — Loop: Standard
Stage T3: Exemplar Creation (if configured) — Loop: Standard
Stage T4: Quality Validation — Loop: Standard
Stage T5: Review & Delivery [HUMAN GATE]

Output: activity guide PDF + rubric JSON + exemplar PDF
```

Components: activity, scenario_exercise

---

## Phase 5 — Capstone Pipeline (4 stages)

Runs LAST. Synthesizes all content from Phases 1-4.

```
Stage C1: Capstone Design — Loop: Strategic + Standard
Stage C2: Brief & Rubric Generation — Loop: Standard
Stage C3: Support Material Generation — Loop: Standard
Stage C4: Review & Delivery [HUMAN GATE]

Output: project brief PDF + rubric JSON + checkpoint schedule + exemplar
```

Components: capstone_project

---

## Cross-Sub-System Dependencies

Each sub-system can reference outputs from earlier sub-systems:

```
Documents  → (standalone, no upstream dependency)
Assessments → references: document key terms, concept explanations
Videos     → references: document content for script accuracy,
              assessment focus areas for visual emphasis
Activities → references: document concepts, video scenarios,
              assessment outcomes for practice alignment
Capstone   → references: ALL of the above
```

This dependency order is managed by the Domain Workflow's pipeline orchestrator.

---

## Production Order

```
Documents → Assessments → Videos → Activities → Capstone → Meta

Within each sub-system: Module 1 topics → Module 2 → Module 3 → ...
Videos batched in groups of 10.
All other components processed individually.
```

---

## Human Gate Summary (8 total)

| Gate | Location | Reviewer | Phase Actions |
|------|----------|----------|---------------|
| Ideation | Stage 0.5 | Project Owner | Approve, Reject, Feedback |
| Documents | D5 | SME | Approve, Reject, Feedback |
| Assessments | A5 | SME | Approve, Feedback, Use Segments |
| Video Script | V3 | ID / Creative | Approve, Feedback, Reject |
| Video Storyboard | V7 | Creative | Approve, Feedback, Mix & Produce |
| Video Final | V16 | QA / Client | Approve, Feedback, Reject |
| Activities | T5 | ID | Approve, Reject, Feedback |
| Capstone | C4 | ID / SME | Approve, Reject, Feedback |

All artifacts are editable during review. Edits are captured via
the editedArtifact field on ReviewAction before the chosen action
executes.

Reviewer role assignments are eLearning-specific configuration in
`domain/workflows/review-config.ts`. The Human Review System (System 3)
in `core/review/` handles the gate machinery universally.

---

## Component-to-Pipeline Mapping

| Component | Pipeline | Stages | Loop Patterns |
|---|---|---|---|
| study_material | Document | D1-D5 | Standard |
| practice_worksheet | Document | D1-D5 | Standard |
| flashcards | Document | D1,D2,D5 | Standard |
| glossary | Document | D2,D5 | Standard |
| quiz | Assessment | A1-A6 | Standard |
| pre_assessment | Assessment | A1-A6 | Standard |
| post_assessment | Assessment | A1-A6 | Standard |
| video | Video | V1-V16 | Standard, Tournament, Strategic |
| video_short | Video (short) | 12 stages | Standard, Tournament |
| activity | Activity | T1-T5 | Strategic + Standard |
| scenario_exercise | Activity | T1-T5 | Strategic + Standard |
| capstone_project | Capstone | C1-C4 | Strategic + Standard |
| certificate | Design | 2 stages | Standard |

---

## Cost Model

Cost tracking is per-iteration (tracked by Loop Engine), aggregated by
Domain Workflow up through the hierarchy:

```
LLM Call → IterationRecord.costUSD
  → StageSession (sum of iterations)
    → NodeComponent (sum of sessions)
      → ProjectNode (sum of components)
        → ProjectBlueprint (sum of nodes)
          → Project.totalCostUSD
```

Default pricing:
- Claude Sonnet: $3/MTok input, $15/MTok output
- Claude Opus: $15/MTok input, $75/MTok output
- GPT-4o: $2.50/MTok input, $10/MTok output
- Image generation: $0.04/image (fal.ai FLUX)
- Voice synthesis: $0.50/minute (ElevenLabs)
- Phase 0 ideation: ~$0.50-$2.00 per project