# VOVAI eLearn AIOS — System Overview

## What is it?

Agentic AI-powered end-to-end eLearning & Training Operating System. From a
single project brief to a fully structured, multi-component learning experience.
Autonomous agent teams ideate, structure, design, produce, polish, and deliver
complete eLearning projects — from multi-module courses with study materials,
videos, assessments, activities, simulations, and capstone projects to single
explainer videos. Supports K-12 curriculum courses, professional training
programs, and ongoing content channels. Humans guide, review, and approve
at every critical gate.

## Input → Output

**Input:** A project brief describing what needs to be taught, to whom, and how.

**Examples:**
- "Create 220 CBSE science and social studies videos for grades 6-10"
- "Build a 40-hour teacher retooling program on instructional design
   with study materials, assessments, activities, and a capstone project"
- "Set up an ongoing education YouTube channel across science, math,
   and social studies with weekly video production"

**Output:** Complete, structured eLearning project with any combination of:
- Educational videos (scripted, narrated, animated, assembled)
- Study materials (PDFs, reading guides, reference sheets)
- Assessments (quizzes, pre/post assessments, question banks)
- Activities (guided practice, case studies, scenarios, simulations)
- Capstone projects (briefs, rubrics, exemplars)
- Meta deliverables (glossaries, certificates, resource libraries)
- Packaging (SCORM, transcripts, subtitle files)

## The Two Phases

### Phase 1 — Project Component (ideation → structure → configuration)

Agents brainstorm with the human to design the project structure before
any production begins. This phase determines WHAT gets built.
```
Brief → Archetype detection → Agent brainstorming (8 agents) →
Hierarchical structure (Course → Module → Topic → Subtopic) →
Component assignment (which deliverables at each node) →
Rubric grading (7 dimensions, score ≥ 75 to pass) →
Human approval → Configuration wizard →
Production handoff (creates pipeline jobs)
```

### Phase 2 — Production Pipeline (produce → evaluate → deliver)

The existing recursive loop engine processes each component through
its pipeline. This phase builds what was designed.
```
Per component: Agent produces artifact → Judge evaluates →
Recursive loop refines (min 2 iterations) → Human reviews →
Approved artifacts flow to next stage → Final assembly → Delivery
```

## The Six Internal Layers

1. **Presentation:** Next.js frontend — dashboards, ideation chat, structure
   canvas, configuration wizard, review interfaces
2. **Project Component:** Archetype registry, component registry, hierarchical
   tree engine, ideation agents, rubric grading, blueprint versioning
3. **Orchestration:** Pipeline orchestrator, stage state machine, task queue,
   event bus, batch parallelization
4. **Agentic AI Engine:** Recursive loop (4 patterns: standard, strategic +
   production, tournament, nested), judge, validators, cost tracking
5. **Intelligence:** Registries (agents, rubrics, prompts, archetypes,
   components, compatibility matrix, domain packs)
6. **Foundation:** PostgreSQL + Prisma, Redis, S3/R2, FFmpeg, Auth, Billing

## Core Flow
```
Human provides project brief →
  Project Component Layer:
    Agents detect archetype → brainstorm structure → propose hierarchy →
    assign components → grade against rubric → refine recursively →
    human approves structure → configure component settings →
    generate production jobs →
  Production Pipeline:
    Per component type (video/document/assessment/activity):
      Agent produces → judge evaluates → loop refines →
      human reviews at gates → approved artifacts assembled →
  Delivery:
    Packaged project with all components organized by structure
```

## Three Supported Project Archetypes

| Archetype | Structure | Components | Production Mode |
|-----------|-----------|------------|-----------------|
| K-12 Curriculum | Subject → Grade → Chapter → Topic | Videos, quizzes, worksheets | Batch (groups of 10) |
| Professional Training | Course → Module → Topic → Subtopic | Videos, study materials, quizzes, activities, capstone | Module-sequential |
| Content Channel | Channel → Subject → Season → Episode | Videos, shorts | Rolling (ongoing) |