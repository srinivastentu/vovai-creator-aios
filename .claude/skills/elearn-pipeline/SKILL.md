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
