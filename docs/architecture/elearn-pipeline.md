# eLearn AIOS — 16-Stage Production Pipeline

## Stage Map
```
RING 1 — SCRIPT
  Stage 1: Discovery (research)
  Stage 2: Script Writing
  Stage 3: Script Review [HUMAN GATE]

RING 2 — VISUAL
  Stage 4: Image Prompt Engineering
  Stage 5: Image Generation (Tournament)
  Stage 6: AV Storyboard Assembly
  Stage 7: Storyboard Review [HUMAN GATE]

RING 3 — AUDIO + VIDEO
  Stage 8: Voice-Over Generation
  Stage 9: Video Generation (from images)
  Stage 10: Music & SFX
  Stage 11: Per-Scene Assembly
  Stage 12: Full Assembly

RING 4 — FINISH
  Stage 13: Captions & Subtitles
  Stage 14: Final Render
  Stage 15: Quality Assurance
  Stage 16: Packaging & Delivery [HUMAN GATE]
```

## Per-Scene Processing
Stages 2, 4-11 operate per-scene. A 10-minute video with 15 scenes means
each stage runs 15 times (once per scene). The loop engine handles this
via the sceneIndex parameter.

## Tournament Pattern (Stage 5)
Multiple AI models generate images for the same scene prompt:
- fal.ai FLUX
- fal.ai Stable Diffusion
- Midjourney (if API available)
Each entry is judged by GPT-4o Vision. Human picks the winner.
Style Anchor: Scene 1's winner sets the visual style for all subsequent scenes.
