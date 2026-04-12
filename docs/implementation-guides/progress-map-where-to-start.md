# Where You Are — Master Action Plan Progress Map

**Current state:** 641 tests, 14 steps shipped, feature/loop-engine-v2 ready to merge

---

## What's DONE (skip these phases)

| Master Plan Phase | Status | Evidence |
|---|---|---|
| Phase 1: Project foundation | ✅ DONE | LE-0: folders, Prisma, core/domain split |
| Phase 2: Core loop engine | ✅ DONE | LE-1 + LE-2 + LE-3: all 4 functions, types, rubric grader, validators |
| Phase 7.1: Human review core | ✅ DONE | LE-5: 5 actions, gate enforcement, sovereignty checks |
| Phase 8.1: Pipeline orchestrator core | ✅ DONE | LE-6: 8 functions, stage sequencing |
| Phase 9: eLearning domain setup | ✅ MOSTLY DONE | LE-4 + LE-7 + LE-10: archetypes, components, 4 rubrics, real agents |
| Phase 10.1: Ideation pipeline config | ✅ DONE | LE-7: 5 ideation stages wired |

---

## What's NOT DONE (your work starts here)

| Master Plan Phase | Status | What's Missing |
|---|---|---|
| **Phase 3: Text generation** | 🟡 PARTIAL | Engine works with mocks + CLI. Missing: real iterative quality testing on 10+ topics, text generation UI at /generate/text, PRESERVE/IMPROVE quality verification |
| **Phase 4: Image generation** | 🔴 NOT STARTED | No image producer adapters (Flux/DALL-E), no tournament implementation, no image judge with vision, no image UI |
| **Phase 5: Audio generation** | 🔴 NOT STARTED | No TTS adapter (ElevenLabs), no music adapter (Suno), no audio evaluation |
| **Phase 6: Video generation** | 🔴 NOT STARTED | No video adapter (Runway/Kling), no FFmpeg assembly, no video evaluation |
| **Phase 7.2: Review UI** | 🔴 NOT STARTED | Core review logic exists but no unified review UI for text/image/audio/video |
| **Phase 8.2-8.4: Demo pipelines** | 🔴 NOT STARTED | Orchestrator exists but no multi-artifact pipeline demo (text→image→voice→video→assembly), no style anchor |
| **Phase 10.2-10.5: Ideation UI** | 🟡 V1 EXISTS | Chat UI, Canvas, Wizard exist from v1.0 but need UX v2 refresh |
| **Phase 11.2-11.7: Production** | 🔴 NOT STARTED | Only document pipeline proof exists. Video (16 stages), assessment, activity, capstone pipelines not built |
| **Phase 12: MVP launch** | 🔴 NOT STARTED | Dashboard, client review portal, batch processing, polish |

---

## YOUR STARTING SEQUENCE

### Step 0: Merge (do this NOW)
```
git checkout main
git merge feature/loop-engine-v2
git tag v2.0.0-loop-engine
git push origin main --tags
```

### Then follow this exact order:

```
┌─────────────────────────────────────────────────────────┐
│  STAGE 1: PROVE THE ENGINE ON STANDALONE ARTIFACTS      │
│                                                         │
│  You START HERE                                         │
│  ↓                                                      │
│  Phase 3: TEXT GENERATION                               │
│  ├── 3.1 Text producer adapter (connect real Claude)    │
│  ├── 3.2 Text judge (connect real GPT-4o as judge)      │
│  ├── 3.3 Text rubric + validators                       │
│  ├── 3.4 First real loop — run 10 topics, verify        │
│  │        quality improves from ~6/10 to ~8/10          │
│  └── 3.5 Text generation UI at /generate/text           │
│       ⏸️  STOP: Are articles genuinely good?             │
│  ↓                                                      │
│  Phase 4: IMAGE GENERATION                              │
│  ├── 4.1 Image adapters (Flux + DALL-E)                 │
│  ├── 4.2 Image judge (vision model)                     │
│  ├── 4.3 Image validators (file exists, dimensions)     │
│  ├── 4.4 Tournament loop (parallel models → rank)       │
│  └── 4.5 Image generation UI at /generate/image         │
│       ⏸️  STOP: Does tournament pick good images?        │
│  ↓                                                      │
│  Phase 5: AUDIO GENERATION                              │
│  ├── 5.1 Voice adapter (ElevenLabs) + voice rubric      │
│  └── 5.2 Music adapter (Suno) + music rubric            │
│       ⏸️  STOP: Voice clear? Music fits mood?            │
│  ↓                                                      │
│  Phase 6: VIDEO GENERATION                              │
│  ├── 6.1 Video adapter (Runway/Kling) + video rubric    │
│  └── 6.2 FFmpeg assembly (video + voice + music)        │
│       ⏸️  STOP: Scene plays correctly?                   │
│  ↓                                                      │
│  Phase 7.2: UNIFIED REVIEW UI                           │
│  └── Review page for all artifact types                 │
│  ↓                                                      │
│  Phase 8.2-8.4: DEMO PIPELINES                          │
│  ├── 8.2 Article + hero image (2-stage)                 │
│  ├── 8.3 Full scene (script→image→voice→video→assembly) │
│  └── 8.4 Style anchor (3-scene consistency)             │
│       ⏸️  STOP: Multi-artifact pipeline works?           │
│                                                         │
│  ✅ STAGE 1 COMPLETE                                    │
├─────────────────────────────────────────────────────────┤
│  STAGE 2: eLEARNING AIOS                                │
│                                                         │
│  Phase 9: Already mostly done — fill gaps               │
│  ↓                                                      │
│  Phase 10: IDEATION UI                                  │
│  ├── 10.2 Chat ideation UI (refresh from v1)            │
│  ├── 10.3 Canvas structure editor (refresh from v1)     │
│  ├── 10.4 Configuration wizard                          │
│  └── 10.5 End-to-end ideation test                      │
│  ↓                                                      │
│  Phase 11: CONTENT PRODUCTION                           │
│  ├── 11.1 Document pipeline (proof exists, expand)      │
│  ├── 11.2 Assessment pipeline (6 stages)                │
│  ├── 11.3 Video pipeline (16 stages — THE BIG ONE)      │
│  ├── 11.4 Activity pipeline (5 stages)                  │
│  ├── 11.5 Capstone pipeline (4 stages)                  │
│  ├── 11.6 Full production orchestrator                  │
│  └── 11.7 Full course production test                   │
│  ↓                                                      │
│  Phase 12: MVP LAUNCH                                   │
│  ├── 12.1 Production dashboard                          │
│  ├── 12.2 Client review portal                          │
│  ├── 12.3 Batch processing (10 videos)                  │
│  ├── 12.4 Error recovery + resilience                   │
│  └── 12.5 Final polish + user guide                     │
│                                                         │
│  🚀 MVP COMPLETE                                        │
└─────────────────────────────────────────────────────────┘
```

---

## First Action Item Right Now

```
1. Merge feature/loop-engine-v2 → main
2. Open Claude Code
3. Start Phase 3, Micro Phase 3.1: Text producer adapter
   (Connect real Claude API to your existing engine)
```

Your engine WORKS with mocks. Phase 3 is about connecting real AI and proving the quality loop genuinely improves output. This is the moment of truth — if articles get better across iterations, everything else will too.