---
name: elearn-pipeline
description: >
  The eLearning video production pipeline. Use when working on
  eLearn-specific stages, agents, rubrics, or media processing.
---
# eLearn AIOS Pipeline

## Pipeline Stages (Built in Rings)

### Ring 1 — Script Pipeline (Weeks 1-4)
1. Discovery — Research topic, audience, learning objectives
2. Script Writing — Generate narration script per scene
3. Script Review (Human Gate)

### Ring 2 — Visual Pipeline (Weeks 5-7)
4. Image Prompt Engineering — Create prompts per scene
5. Image Generation — Tournament: multiple AI models compete
6. Storyboard Assembly — Images + narration text
7. Storyboard Review (Human Gate)

### Ring 3 — Audio + Assembly (Weeks 8-10)
8. Voice-Over Generation — ElevenLabs per scene
9. Video Generation — Runway/Kling from approved images
10. Music & SFX — Background audio generation
11. Per-Scene Assembly — FFmpeg combines media per scene
12. Full Assembly — Concatenate scenes with transitions

### Ring 4 — Polish (Weeks 11-14)
13. Captions & Subtitles — SRT generation
14. Final Render — Complete video with OST
15. Quality Assurance — Automated checks
16. Packaging & Delivery — SCORM, MP4, transcript

## Tournament Pattern (Images)
Multiple AI models generate images for each scene in parallel.
The Image Judge (GPT-4o Vision) evaluates and ranks them.
Human picks the winner or requests regeneration.
Style anchor: Scene 1's approved image becomes the style reference for all subsequent scenes.

## Key Rubrics
- Script: Pedagogical Clarity, Engagement, Accuracy, Pacing, Visual Cues
- Image: Script Alignment, Visual Clarity, Style Consistency, Educational Value, Technical Quality
- Voice: Clarity, Pacing, Tone, Script Accuracy, Audio Quality
- Assembly: Sync Accuracy, Pacing, Audio Balance, Visual Flow, Completeness

## Before Starting a New Production Stage

Before writing code for a new stage (image, audio, video, code, design, or any other
generator), read `docs/decisions/001-project-learnings-phase-3.md` — especially §2
(what's working), §3 (tensions to watch), and §5 (operating principles). Also skim
`tasks/lessons.md` for accumulated rules.

Confirm the stage design has all of the following before writing code:

1. **Three-tier quality model designed:** Tier-1 deterministic validator, Tier-2
   LLM judge (rubric-based), Tier-3 domain auditor (stage-specific truth checks).
2. **Cross-family producer / judge:** producer and judge from different model
   families — never same-family (same-family judges rubber-stamp producer errors).
3. **PRESERVE ≥ 8 / IMPROVE < 8 revise prompt:** dimension-targeted revision is the
   mechanism behind zero regressions. Generic revise prompts are forbidden.
4. **Best-version tracking, not latest-version:** present the best artifact seen to
   humans, not the most recent iteration.
5. **Cost aggregation wired per-stage:** roll per-call cost up to the stage total in
   the same PR as the stage.
6. **Rubric `validate*Rubric()` at import time:** add the validator alongside the
   rubric — no silent weight typos.
7. **Declarative component constraints:** `dependsOn` and `attachableAt` in
   `component-registry.ts`. Never an imperative order check.
8. **Plan for what "revise" means in this stage:** for non-text artifacts
   (image/audio/video/design), tournament-of-N usually replaces iterative revision.
   Don't retrofit text-style revise onto media.
9. **Pre-call cost enforcement for expensive stages:** image/video/audio calls are
   10–100× more expensive than text. Replace the "accept one overrun" text-stage
   behaviour with a blocking pre-call budget check.
10. **New-stage architectural gate:** `grep -r "from.*domain/" src/lib/core/` still
    returns nothing after your changes.

If any of these is missing, stop and design it before writing the stage.
