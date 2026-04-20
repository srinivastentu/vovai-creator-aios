# Where You Are — Master Action Plan Progress Map

**Current state (2026-04-20):** 988 tests (979 + 9 gated-live), Phase 4.5 shipped, on `main`.
**Last update:** Post-Phase-4.5 sync (tournament + image UI complete; 5 models live, 2 disabled).

---

## What's DONE (skip these phases)

| Master Plan Phase | Status | Evidence |
|---|---|---|
| Phase 1: Project foundation | ✅ DONE | LE-0: folders, Prisma, core/domain split |
| Phase 2: Core loop engine | ✅ DONE | LE-1 + LE-2 + LE-3: all 4 functions, types, rubric grader, validators |
| Phase 3: Text generation | ✅ DONE | 3.1–3.5: adapter, judge, validators, loop proof, `/generate/text` UI. Retrospective: `docs/decisions/001-project-learnings-phase-3.md` |
| Phase 4: Image generation | ✅ DONE | 4.0–4.5: MMS (4 providers, 5 live models), image judge, validators, tournament engine, `/generate/image` UI with SSE. Retrospective: `docs/decisions/002-image-pipeline-learnings.md` · Pattern spec: `docs/architecture/tournament-pattern.md` |
| Phase 7.1: Human review core | ✅ DONE | LE-5: 5 actions, gate enforcement, sovereignty checks |
| Phase 8.1: Pipeline orchestrator core | ✅ DONE | LE-6: 8 functions, stage sequencing |
| Phase 9: eLearning domain setup | ✅ MOSTLY DONE | LE-4 + LE-7 + LE-10: archetypes, components, 4 rubrics, real agents |
| Phase 10.1: Ideation pipeline config | ✅ DONE | LE-7: 5 ideation stages wired |

---

## What's NOT DONE (your work starts here)

| Master Plan Phase | Status | What's Missing |
|---|---|---|
| **Phase 5: Audio generation** | 🔴 NOT STARTED | No TTS adapter (ElevenLabs), no music adapter (Suno), no audio judge/rubric/validators, no `/generate/audio` UI. See `tasks/todo.md` for the breakdown. |
| **Phase 6: Video generation** | 🔴 NOT STARTED | No video adapter (Runway/Kling), no FFmpeg assembly, no video evaluation |
| **Phase 7.2: Review UI** | 🔴 NOT STARTED | Core review logic exists but no unified review UI for text/image/audio/video |
| **Phase 8.2-8.4: Demo pipelines** | 🔴 NOT STARTED | Orchestrator exists but no multi-artifact pipeline demo (text→image→voice→video→assembly), no style anchor |
| **Phase 10.2-10.5: Ideation UI** | 🟡 V1 EXISTS | Chat UI, Canvas, Wizard exist from v1.0 but need UX v2 refresh |
| **Phase 11.2-11.7: Production** | 🔴 NOT STARTED | Only document pipeline proof exists. Video (16 stages), assessment, activity, capstone pipelines not built |
| **Phase 12: MVP launch** | 🔴 NOT STARTED | Dashboard, client review portal, batch processing, polish |

### Pre-flight hardening that blocks further media work

- 🟡 **Pre-call budget check** in `gateway.request()` — open tension from Phase 4 (`002` §3.2). Mandatory before Phase 6 video; recommended before Phase 5 audio.
- 🟡 **Tier-3 media auditor pattern** — text has a fact-auditor; images/audio/video do not. Design before building Phase 5.
- 🟡 **Structured provider error codes** — replace heuristic string-matching in `humanizeError()` with `{ code, category, retryable, userMessage }` on `ProviderResult`.

---

## Your starting sequence

```
┌─────────────────────────────────────────────────────────┐
│  STAGE 1: PROVE THE ENGINE ON STANDALONE ARTIFACTS      │
│                                                         │
│  ✅ Phase 3: TEXT GENERATION                            │
│  ✅ Phase 4: IMAGE GENERATION                           │
│  ↓                                                      │
│  Phase 5: AUDIO GENERATION  ← YOU ARE HERE              │
│  ├── 5.0 Pre-flight: pre-call budget check, structured  │
│  │        provider errors, Tier-3 auditor design        │
│  ├── 5.1 Voice: ElevenLabs adapter + rubric + judge     │
│  │        + validators                                  │
│  ├── 5.2 Music: Suno adapter + rubric + judge +         │
│  │        validators                                    │
│  ├── 5.3 Generalise tournament runner for audio         │
│  │        (parameterise Artifact type)                  │
│  ├── 5.4 UI: /generate/audio page + useAudioTournament  │
│  │        hook (mirror the image pattern)               │
│  └── 5.5 Retrospective: docs/decisions/003-*.md         │
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

## First action item right now

```
1. Verify Phase 4 on representative prompts and capture findings as an
   appendix to docs/decisions/002-image-pipeline-learnings.md
2. Read docs/decisions/001-*.md AND 002-*.md + tasks/lessons.md before
   starting Phase 5 (every new stage inherits these rules)
3. Start Phase 5, Micro 5.0: pre-flight hardening (pre-call budget check,
   Tier-3 audio auditor design). Then 5.1A: ElevenLabs voice adapter.
```

The engine works with mocks, text (Phase 3), and images (Phase 4). Phase 5 is the third proof that the tournament pattern and MMS gateway carry cleanly across artifact types. If voice + music land as cleanly as images did, we're on trajectory for Phase 6 (video) and the full multi-artifact scene pipeline.
