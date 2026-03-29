# eLearn AIOS — Production Pipeline

## Pipeline Architecture

The production pipeline has TWO layers:

1. **Project Pipeline** — runs once per project, produces the structure
2. **Component Pipelines** — run per component, produce the deliverables

The Project Component phase (ideation → structure → configuration) completes
BEFORE any component pipeline begins. It determines what gets built. The
component pipelines then execute what was designed.

```
PROJECT PIPELINE (runs once)
  Phase 0: Project Ideation & Structure
    ↓ produces: approved blueprint with nodes + components
    ↓ hands off: one pipeline job per component

COMPONENT PIPELINES (run per deliverable, in this order)
  1. Document Pipeline ......... 5 stages  (textual foundation for everything)
  2. Assessment Pipeline ....... 6 stages  (aligned to document content)
  3. Video Pipeline ............ 16 stages (references documents + assessments)
  4. Activity Pipeline ......... 5 stages  (builds on all content above)
  5. Capstone Pipeline ......... 4 stages  (synthesizes everything)
```

**Why documents first:** Every project starts with text. Study materials
establish the content foundation — accurate facts, key concepts, vocabulary,
structure. Videos reference this content for scripts and visual markers.
Assessments align to it for question accuracy. Activities build on it.
Producing documents first means every downstream component has a verified
textual source to draw from, reducing errors and rework across the board.

---

## Phase 0 — Project Ideation & Structure (runs once per project)

This phase uses the Strategic + Production loop pattern.

```
Stage 0.1: Project Brief & Archetype Detection
  Agent: Orchestrator
  Input: human brief
  Output: detected archetype, clarifying questions
  Loop: Standard (orchestrator ↔ human conversation)

Stage 0.2: Audience Analysis & Curriculum Design
  Agents: Audience Analyst, Curriculum Strategist
  Input: brief + archetype
  Output: audience profile, proposed hierarchy
  Loop: Standard (propose → evaluate → refine)

Stage 0.3: Outcomes & Component Assignment
  Agents: Outcome Architect, Component Recommender
  Input: structure + audience
  Output: learning outcomes per node, components per node
  Loop: Standard

Stage 0.4: Structure Grading & Optimization
  Agents: Structure Optimizer, Rubric Grader, Devil's Advocate
  Input: full blueprint
  Output: 7-dimension grade, challenges, improvement plan
  Loop: Recursive (auto-refine if score < 75, max 5 loops)

Stage 0.5: Human Structure Review [HUMAN GATE]
  Actions: Approve | Feedback | Restructure
  If feedback → re-enter Stage 0.4 with revision context
  If approve → advance to Stage 0.6

Stage 0.6: Component Configuration (Wizard)
  Human configures: video style, quiz settings, material format, etc.
  Per-archetype defaults pre-filled from registry

Stage 0.7: Production Handoff
  Creates pipeline jobs: one per NodeComponent
  Videos → batched into groups of 10
  Documents, assessments, activities → individual jobs
  Each job links: NodeComponent.pipelineJobId → StageSession.id
```

---

## Phase 1 — Document Pipeline (5 stages)

**Runs FIRST.** Processes study materials, practice worksheets, reading guides,
reference sheets, flashcards, glossaries, resource libraries, mentor checklists.
Produces the textual foundation that all other pipelines reference.

```
Stage D1: Content Research & Outline
  Loop: Standard
  Agent generates outline from node learning outcomes + topic context
  References curriculum source material (uploaded docs, RAG context)

Stage D2: Content Generation
  Loop: Standard
  Full content with sections, key terms, diagrams (described), examples
  Respects reading level from audience profile
  Embeds cross-references to related topics in the project tree

Stage D3: Formatting & Visual Design
  Loop: Standard
  Applies template, generates PDF/HTML, adds diagrams and illustrations

Stage D4: Quality Validation
  Loop: Standard
  Checks: accuracy against source material, readability score,
  completeness against learning outcomes, formatting

Stage D5: Review & Delivery [HUMAN GATE]
  Actions: Approve | Feedback | Reject
  Output: PDF + HTML + key terms JSON
```

### Document Pipeline Variants

| Component Type | Stages Used | Notes |
|---|---|---|
| study_material | D1–D5 (all) | Full pipeline, comprehensive output |
| practice_worksheet | D1–D5 (all) | Focuses on problems + answer key |
| flashcards | D1, D2, D5 | Simplified: generate cards + review |
| glossary | D2, D5 | Auto-extract terms from study materials |
| resource_library | D2, D5 | Curated external links + descriptions |
| mentor_checklist | D1, D2, D5 | Observation criteria + conversation starters |
| discussion_prompt | D1, D2, D5 | Prompts + facilitator guide |

---

## Phase 2 — Assessment Pipeline (6 stages)

Processes quizzes, pre-assessments, post-assessments, question banks.
References completed documents for content accuracy.
Produces JSON (for LMS), PDF, and optionally SCORM packages.

```
Stage A1: Outcome-to-Question Mapping
  Loop: Standard
  Maps each learning outcome to question types and Bloom levels
  Ensures coverage: every outcome has at least one question
  References: study material content from Phase 1 for factual grounding

Stage A2: Question Generation
  Loop: Standard
  Generates questions with distractors, correct answers, explanations
  Supports: MCQ, true/false, fill-blank, matching, ordering,
  short answer, scenario-based, image-based

Stage A3: Answer Validation
  Loop: Standard (cross-model)
  Second model verifies correct answers are actually correct
  Checks distractors are plausible but clearly wrong
  Cross-checks against study material for factual accuracy

Stage A4: Difficulty Calibration
  Loop: Standard
  Validates Bloom distribution matches target
  Ensures progressive difficulty within the assessment
  Balances question types

Stage A5: Quality Review [HUMAN GATE]
  SME validates accuracy, appropriateness, fairness
  Actions: Approve | Feedback per question | Reject

Stage A6: Packaging
  Output: quiz JSON + answer key JSON + PDF version
  Optional: SCORM package for LMS integration
```

---

## Phase 3 — Video Pipeline (16 stages)

Processes one video at a time. Batched in groups of 10 for review efficiency.
Inherits context from the ProjectNode: title, description, learning outcomes,
audience profile, difficulty level, Bloom classification.
References completed study materials for script accuracy.

```
PHASE 3A — SCRIPT
  Stage V1: Discovery & Research
    Loop: Strategic + Standard
    Agent researches topic using node context + curriculum source material
    References: study material from Phase 1 for content accuracy

  Stage V2: Script Writing (per-scene)
    Loop: Standard
    Structured as: Hook → Concept → Explanation → Reinforcement → Example → Recap
    Visual marker tags embedded: [DIAGRAM: ...], [ANIMATION: ...]
    Cross-references: key terms from study material, assessment focus areas

  Stage V3: Script Review [HUMAN GATE]

PHASE 3B — VISUAL
  Stage V4: Image Prompt Engineering (per-scene)
    Loop: Standard

  Stage V5: Image Generation (per-scene)
    Loop: Tournament
    Models: fal.ai FLUX, Stable Diffusion, others
    Judge: GPT-4o Vision
    Style Anchor: Scene 1 winner sets visual style for all scenes

  Stage V6: AV Storyboard Assembly
    Loop: Standard

  Stage V7: Storyboard Review [HUMAN GATE]

PHASE 3C — AUDIO + VIDEO
  Stage V8: Voice-Over Generation (per-scene)
    Loop: Standard
    Provider: ElevenLabs (primary), OpenAI TTS (fallback)

  Stage V9: Video Generation from images (per-scene)
    Loop: Tournament
    Models: Runway, Kling, others

  Stage V10: Music & SFX
    Loop: Tournament
    Provider: Suno (primary)

  Stage V11: Per-Scene Assembly
    Loop: Standard
    Tool: FFmpeg

  Stage V12: Full Video Assembly
    Loop: Standard
    Tool: FFmpeg — combines all scenes + transitions + music

PHASE 3D — FINISH
  Stage V13: Captions & Subtitles
    Loop: Standard
    Output: SRT files, multi-language support

  Stage V14: Final Render
    Loop: Standard
    Specs: 1920x1080, 30fps, MP4 H.264

  Stage V15: Quality Assurance
    Loop: Standard
    Checks: subtitle sync, audio levels, frame rate, duration, style consistency

  Stage V16: Packaging & Delivery [HUMAN GATE]
    Output: MP4 + SRT + thumbnail + metadata JSON
```

### Per-Scene Processing

Stages V2, V4–V11 operate per-scene. A 10-minute video with 15 scenes means
each stage runs 15 times (once per scene). The loop engine handles this
via the sceneIndex parameter on the Artifact model.

### Tournament Pattern (Stages V5, V9, V10)

Multiple AI models generate outputs for the same prompt in parallel.
Each entry is judged independently. Winner must score above threshold.
If no winner after 2 rounds, escalate to human with all entries ranked.
Style Anchor: Scene 1's image winner sets the visual reference for all
subsequent scenes in that video.

---

## Phase 4 — Activity Pipeline (5 stages)

Processes learning activities, scenario exercises, discussion prompts,
reflection journals. References documents, assessments, and videos for
alignment. Produces PDF guides and/or interactive HTML.

```
Stage T1: Activity Design
  Loop: Strategic + Standard
  Agent designs activity aligned to learning outcomes
  Determines: type (guided practice, case study, simulation, etc.),
  duration, group size, materials needed, scaffolding level
  References: study material content, assessment focus areas,
  video scripts for continuity

Stage T2: Material Generation
  Loop: Standard
  Generates: activity guide, instructions, worksheets,
  facilitator notes, rubric (if applicable)

Stage T3: Exemplar Creation (if configured)
  Loop: Standard
  Creates a sample completed activity showing expected quality

Stage T4: Quality Validation
  Loop: Standard
  Checks: feasibility for target audience, time estimate accuracy,
  outcome alignment, clarity of instructions

Stage T5: Review & Delivery [HUMAN GATE]
  Output: activity guide PDF + rubric JSON + exemplar PDF
```

---

## Phase 5 — Capstone Pipeline (4 stages)

Processes capstone projects at module or course level. Runs LAST because
it synthesizes all content from earlier phases. Produces project briefs,
rubrics, checkpoint schedules, and exemplar materials.

```
Stage C1: Capstone Design
  Loop: Strategic + Standard
  Designs culminating project that synthesizes module/course learning
  Determines: project type, duration, deliverables, evaluation criteria
  References: all study materials, assessment outcomes, activity types
  from the parent module/course — the capstone must tie them together

Stage C2: Brief & Rubric Generation
  Loop: Standard
  Generates: detailed project brief, grading rubric with dimensions,
  checkpoint schedule (milestones), submission requirements

Stage C3: Support Material Generation
  Loop: Standard
  Generates: exemplar (if configured), resource list,
  mentor/facilitator checklist, peer review template (if configured)

Stage C4: Review & Delivery [HUMAN GATE]
  Output: project brief PDF + rubric JSON + checkpoint schedule +
  exemplar PDF + mentor checklist
```

---

## Pipeline-to-Component Mapping

| Component Type | Pipeline | Stages | Loop Patterns Used |
|---|---|---|---|
| study_material | Phase 1: Document | 5 (D1–D5) | Standard |
| practice_worksheet | Phase 1: Document | 5 (D1–D5) | Standard |
| flashcards | Phase 1: Document | 3 (D1,D2,D5) | Standard |
| glossary | Phase 1: Document | 2 (D2,D5) | Standard |
| resource_library | Phase 1: Document | 2 (D2,D5) | Standard |
| mentor_checklist | Phase 1: Document | 3 (D1,D2,D5) | Standard |
| discussion_prompt | Phase 1: Document | 3 (D1,D2,D5) | Standard |
| quiz | Phase 2: Assessment | 6 (A1–A6) | Standard |
| pre_assessment | Phase 2: Assessment | 6 (A1–A6) | Standard |
| post_assessment | Phase 2: Assessment | 6 (A1–A6) | Standard |
| video | Phase 3: Video | 16 (V1–V16) | Standard, Tournament, Strategic |
| video_short | Phase 3: Video (short) | 12 | Standard, Tournament |
| activity | Phase 4: Activity | 5 (T1–T5) | Strategic + Standard |
| scenario_exercise | Phase 4: Activity | 5 (T1–T5) | Strategic + Standard |
| capstone_project | Phase 5: Capstone | 4 (C1–C4) | Strategic + Standard |
| certificate | Design (standalone) | 2 | Standard |

---

## Production Order Within a Project

Components are produced in dependency order. Each phase builds on the
verified output of the phase before it.

```
Phase 1: Documents     ← textual foundation, content source of truth
Phase 2: Assessments   ← aligned to document content, validates learning
Phase 3: Videos        ← scripts reference documents, visuals support assessment topics
Phase 4: Activities    ← build on content from documents + videos + assessments
Phase 5: Capstone      ← synthesizes everything from all phases above
  Last: Meta           ← glossary, certificates generated from all completed content
```

Within each phase, production follows the tree hierarchy:
Module 1 topics → Module 2 topics → Module 3 topics → ...

Videos are batched in groups of 10 for review efficiency.
All other components are processed individually.

---

## Cross-Phase Content References

Each phase can reference outputs from earlier phases. This is how the
platform ensures consistency across all deliverables in a project.

```
Documents  → (standalone, no upstream dependency)
Assessments → references: document key terms, concept explanations
Videos     → references: document content for script accuracy,
              assessment focus areas for visual emphasis
Activities → references: document concepts, video scenarios,
              assessment outcomes for practice alignment
Capstone   → references: ALL of the above — must synthesize the
              complete learning journey
```

This dependency chain is why production order matters.
Skipping or reordering phases breaks content consistency.
