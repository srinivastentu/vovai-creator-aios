# VOVAI eLearning AIOS — Master Action Plan
## From Zero to MVP: Complete Phased Development Guide

**Version:** 1.0 | **Date:** April 12, 2026
**Duration estimate:** 12-16 weeks (full-time with Claude Code)
**End goal:** A working MVP that produces a complete eLearning course with multiple modules, hours of video content, study materials, assessments, and activities — all AI-generated with human approval gates.

---

## How This Document Works

This plan has **2 Stages**, **12 Macro Phases**, and **~60 Micro Phases**.

**STAGE 1** builds the universal core engine and proves it can produce quality standalone artifacts — articles, images, audio, video. You will NOT touch anything eLearning-specific until Stage 1 is complete and you're satisfied with the quality.

**STAGE 2** takes that proven engine and wraps eLearning domain intelligence around it — curriculum structure, lesson scripts, educational videos, assessments, activities, and the full production pipeline.

**Rules:**
- Complete each Micro Phase before starting the next
- Every Macro Phase has an EXIT GATE — a test you must pass before moving on
- If a phase fails its exit gate, fix it before proceeding
- Never skip ahead — each phase depends on the one before it

---

## The Big Picture (Read This First)

```
STAGE 1: UNIVERSAL CORE ENGINE + FUNDAMENTAL ARTIFACTS
│
├── PHASE 1:  Project setup (folders, database, config)
├── PHASE 2:  Core loop engine (the heart of everything)
├── PHASE 3:  Text generation (articles — prove the loop works)
├── PHASE 4:  Image generation (visuals — prove tournament works)
├── PHASE 5:  Audio generation (voice + music)
├── PHASE 6:  Video generation (clips from images)
├── PHASE 7:  Human review system (approval workflow)
├── PHASE 8:  Pipeline mode (chain multiple artifact types together)
│
│   ✅ STAGE 1 COMPLETE — you now have a universal engine that produces
│      quality text, images, audio, and video through recursive loops
│      with human approval. Nothing eLearning-specific exists yet.
│
STAGE 2: eLEARNING AIOS DOMAIN SYSTEM
│
├── PHASE 9:  eLearning domain setup (curriculum, archetypes, components)
├── PHASE 10: Project ideation pipeline (Phase 0 — structure a course)
├── PHASE 11: Content production pipeline (Phases 1-5 — produce everything)
├── PHASE 12: MVP launch readiness (dashboard, review portal, polish)
│
│   🚀 MVP COMPLETE — you can produce a full eLearning course
```

---
---

# ════════════════════════════════════════════════════════
# STAGE 1: UNIVERSAL CORE ENGINE + FUNDAMENTAL ARTIFACTS
# ════════════════════════════════════════════════════════

**Purpose:** Build a universal quality engine that can take ANY type of content (text, images, audio, video), run it through a recursive improvement loop, and present the best version for human approval. Prove it works on each artifact type independently before combining them.

**When you're done with Stage 1, you'll have:**
- A working app where you type a topic and get a quality-improved article
- A working flow where you describe an image and get tournament-selected best image
- Voice-over generation from text with quality evaluation
- Video clip generation from images with quality evaluation
- A human review UI where you approve, give feedback, or reject any artifact
- A pipeline that chains: text → images → audio → video → assembled clip

---

## MACRO PHASE 1: PROJECT FOUNDATION
**Goal:** Set up the project so everything has a place to live
**Duration:** 1-2 days
**What you'll have after:** An empty but well-organized project that runs

---

### Micro Phase 1.1: Create the project

**Action items:**
- [ ] Create a new Next.js 14+ project with TypeScript and App Router
- [ ] Install core dependencies: Tailwind CSS, shadcn/ui, Prisma ORM
- [ ] Install AI dependencies: @anthropic-ai/sdk, openai SDK
- [ ] Install infrastructure: BullMQ (job queues), ioredis
- [ ] Set up environment variables file (.env.local) with placeholders for API keys
- [ ] Verify: `npm run dev` shows the default Next.js page at localhost:3000
- [ ] Verify: `npm run typecheck` passes with zero errors

---

### Micro Phase 1.2: Create the folder structure

**Action items:**
- [ ] Create the two-category folder structure:
  - `src/lib/core/` — universal machinery (engine, agentic, review)
  - `src/lib/domain/` — domain-specific configuration (empty for now)
- [ ] Create sub-folders inside core:
  - `src/lib/core/engine/` — the loop engine (System 1)
  - `src/lib/core/agentic/` — agent framework (System 2)
  - `src/lib/core/review/` — human review system (System 3)
- [ ] Create a `docs/` folder for architecture documentation
- [ ] Create a `tasks/` folder with `todo.md` and `lessons.md`
- [ ] Write CLAUDE.md at the project root with the architectural contract:
  - The core/domain separation rule
  - The one import rule (domain imports core, never reverse)
  - The three-question test
  - Coding standards and testing rules

**The golden rule to remember:** No file inside `core/` should ever import from `domain/`. This is what makes the engine universal. You can verify this anytime by running: `grep -r "from.*domain/" src/lib/core/` — it must return nothing.

---

### Micro Phase 1.3: Set up the database

**Action items:**
- [ ] Initialize Prisma: `npx prisma init`
- [ ] Create the core database tables (these are universal, not eLearning-specific):
  - `projects` — a project is any goal (an article, a course, a film)
  - `stage_sessions` — one run of the loop for one stage
  - `artifacts` — any produced output (text, image path, audio path, video path)
  - `grades` — evaluation results with dimension scores
  - `iteration_records` — history of every loop iteration
  - `conversations` — message threads per stage
  - `messages` — individual messages in conversations
- [ ] Run the first migration: `npx prisma migrate dev --name init`
- [ ] Verify: `npx prisma studio` opens and shows empty tables

---

### Micro Phase 1.4: Set up testing

**Action items:**
- [ ] Install testing framework (Vitest or Jest)
- [ ] Create test folder structure mirroring src/
- [ ] Write one sample test that passes
- [ ] Verify: `npm run test` passes

---

### 📋 PHASE 1 EXIT GATE
```
✅ Project runs: npm run dev shows a page
✅ TypeScript passes: npm run typecheck — zero errors
✅ Database exists: npx prisma studio opens
✅ Tests work: npm run test passes
✅ Folder structure follows core/domain separation
✅ CLAUDE.md exists with architectural contract
```

---
---

## MACRO PHASE 2: CORE LOOP ENGINE
**Goal:** Build the four core functions that power everything
**Duration:** 3-5 days
**What you'll have after:** The recursive loop engine that can take any agent+judge pair and run a quality improvement cycle

This is the HEART of the entire system. Everything else builds on this.

---

### Micro Phase 2.1: Define all types

**What:** Create every data type the engine needs.

**Action items:**
- [ ] Create `src/lib/core/engine/types.ts` with:
  - `LoopStatus` — the states: idle, generating, validating, evaluating, presenting, awaiting_review, approved, escalated
  - `Artifact` — any produced output: id, version, content (string), type (text/image/audio/video), metadata, timestamp
  - `DimensionScore` — one dimension: name, score (1-10), weight (0 to 1), reasoning (mandatory text explaining the score)
  - `Grade` — full evaluation: all dimension scores, composite score, overall assessment, improvement priorities (max 5)
  - `IterationRecord` — one loop cycle: iteration number, artifact, grade, outcome, cost tracking
  - `LoopEvent` — real-time update sent to UI: type, status, message, score, artifact, grade
  - `ReviewAction` — the 6 human actions: approve, feedback, reject, inline_edit, use_segments, mix_produce
  - `RubricDimension` — what to evaluate: name, weight, description
  - `Validator` — deterministic check: name, validate function that returns pass/fail
  - `StageConfig` — everything needed for one stage: rubric, validators, threshold, max/min iterations, loop pattern
  - `StageSession` — runtime state: current artifact, best artifact, grade, history, iteration count
  - `AgentExecutor` — function signature for producing artifacts (injected, never imported)
  - `JudgeFunction` — function signature for evaluating artifacts (injected, never imported)
- [ ] Write tests that verify: weights sum to 1.0, status transitions are valid
- [ ] Verify: `npm run typecheck` passes

**Why each type matters (for a grade 7 student):**
- Think of `Artifact` as the homework a student turns in
- Think of `Grade` as the teacher's grading sheet with comments
- Think of `IterationRecord` as a record of every draft the student wrote
- Think of `StageConfig` as the assignment instructions + grading rubric
- Think of `AgentExecutor` as the student doing the work
- Think of `JudgeFunction` as the teacher grading the work

---

### Micro Phase 2.2: Build the produce() function

**What:** The function that creates or revises an artifact.

**Action items:**
- [ ] Create `src/lib/core/engine/produce.ts`
- [ ] Implement two modes:
  - **First draft mode:** No previous artifact → call the agent with just the goal
  - **Revision mode:** Previous artifact + grade available → build the PRESERVE/IMPROVE prompt
- [ ] The revision prompt must include:
  - Previous version (full content)
  - PRESERVE section: dimensions scoring 8 or above ("don't change these, they're good")
  - IMPROVE section: dimensions scoring below 8 ("focus your fixes here")
  - Improvement priorities in order
  - Human feedback if present (highest priority)
  - The instruction: "Surgical revision, not demolition"
- [ ] After using human feedback once, clear it (set to null)
- [ ] Write tests with a mock agent
- [ ] Verify: tests pass

**Why the PRESERVE/IMPROVE split matters:** Imagine a student writes an essay. The teacher says "your introduction is great (9/10) but your conclusion is weak (5/10)." Without PRESERVE/IMPROVE, the student rewrites the WHOLE essay and the introduction gets worse. With PRESERVE/IMPROVE, the student only fixes the conclusion. Testing showed this reduced quality regression from 60% to under 20%.

---

### Micro Phase 2.3: Build the evaluate() function

**What:** The function that grades an artifact against a rubric.

**Action items:**
- [ ] Create `src/lib/core/engine/evaluate.ts`
- [ ] Build the judge prompt with these proven rules:
  - Judge must write reasoning BEFORE giving a score (reasoning-first)
  - Judge checks completeness FIRST (incomplete = score 4 or below)
  - Judge uses 1-10 scale with clear calibration (7=competent, 8=professional, 9+=exceptional)
  - Judge returns structured JSON
- [ ] After getting the judge's response:
  - Strip markdown code fences (```json...```) if present
  - Parse the JSON
  - RECALCULATE the composite score from dimensions (never trust AI math)
  - If JSON parsing fails, return a synthetic failing grade (score 4.0) — never crash
- [ ] Write tests: valid grades, malformed JSON handling, composite recalculation
- [ ] Verify: tests pass

---

### Micro Phase 2.4: Build the runLoop() function

**What:** The state machine that orchestrates produce → validate → evaluate → decide → repeat.

**Action items:**
- [ ] Create `src/lib/core/engine/run-loop.ts`
- [ ] Implement as an async generator that yields LoopEvent objects
- [ ] Build the complete state machine with these rules:
  1. **Minimum 2 iterations** — even if v1 scores above threshold, always produce v2 for comparison
  2. **Best-version tracking** — track the highest-scoring version throughout; present THAT one, not the latest
  3. **Deterministic validators first** — run validators BEFORE the expensive judge; if validators fail, skip judge and revise directly
  4. **Checkpoint after every iteration** — emit full state after every evaluation, before the threshold decision
  5. **Dimension-aware revision** — when score is below threshold, pass the PRESERVE/IMPROVE feedback to produce()
  6. **Human feedback applied once** — after produce() uses feedback, clear it to null
  7. **Diminishing returns** — if last 3 iterations each improved by less than 0.2 points, auto-escalate
  8. **Cost tracking** — record tokens and cost for every LLM call
  9. **Graceful errors** — on any failure, preserve state and yield an error event; never crash
- [ ] The three possible outcomes:
  - Score >= threshold AND iterations >= minimum → PRESENT best version to human
  - Score < threshold AND iterations < maximum → AUTO-REVISE (human never sees)
  - Max iterations reached → ESCALATE with best version (not last)
- [ ] Write comprehensive tests with mock agent and mock judge
- [ ] Verify: tests pass

---

### Micro Phase 2.5: Build the processReview() function

**What:** Handles what happens after a human reviews an artifact.

**Action items:**
- [ ] Create `src/lib/core/engine/process-review.ts`
- [ ] Implement all 6 review actions:
  1. **Approve** — lock the artifact, mark stage complete
  2. **Feedback** — re-enter the loop with human's feedback, max 3 more iterations
  3. **Reject** — start completely fresh, no previous context
  4. **Inline Edit** — human edited the text directly, lock that version
  5. **Use Segments** — approve parts, reject others (stub for now — fall back to Feedback)
  6. **Mix & Produce** — combine parts from different versions (stub for now — fall back to Feedback)
- [ ] Write tests for all 6 actions
- [ ] Verify: tests pass

---

### Micro Phase 2.6: Build the rubric grader utility

**What:** Helper that builds judge prompts from any rubric definition.

**Action items:**
- [ ] Create `src/lib/core/engine/rubric-grader.ts`
- [ ] Functions:
  - Build the judge system prompt from any RubricDimension array
  - Build the judge user prompt with artifact + goal + rubric
  - Parse judge response safely (strip fences, recalculate score, handle errors)
  - Validate rubric at configuration time (weights sum to 1.0, completeness dimension present with weight >= 20%)
- [ ] Write tests
- [ ] Verify: tests pass

---

### Micro Phase 2.7: Build deterministic validators

**What:** Code-based checks that run before the expensive AI judge.

**Action items:**
- [ ] Create `src/lib/core/engine/validators/` with:
  - `validator-runner.ts` — runs all validators against an artifact, collects failures
  - Common validators: not-empty, word-count (min/max), JSON-valid, file-exists
- [ ] Write tests
- [ ] Verify: tests pass

**Why validators matter:** About 25% of artifacts fail basic checks (content cut off, wrong format, empty). Running a $0.01 AI judge on an empty artifact wastes money. A validator catches it instantly for free.

---

### 📋 PHASE 2 EXIT GATE
```
✅ All 4 core functions exist: produce, evaluate, runLoop, processReview
✅ Rubric grader builds prompts from any rubric
✅ Validators catch obvious failures before the judge
✅ All tests pass: npm run test
✅ TypeScript passes: npm run typecheck
✅ No domain imports in core: grep returns nothing
✅ The loop can run with mock agents (no real AI calls yet)
```

---
---

## MACRO PHASE 3: TEXT GENERATION — PROVE THE LOOP WORKS
**Goal:** Connect real AI (Claude) to the engine and produce a quality article
**Duration:** 3-4 days
**What you'll have after:** Type a topic → get a genuinely improved article through recursive loops → approve it

This is where you PROVE the engine works. If the article quality genuinely improves across iterations (from ~6/10 to ~8/10), the engine is working. If not, fix the engine before moving to images.

---

### Micro Phase 3.1: Create the text producer adapter

**Action items:**
- [ ] Create `src/lib/core/agentic/adapters/text-adapter.ts`
- [ ] Implement the ProducerAdapter interface:
  - `produce(goal, systemPrompt)` → calls Claude API → returns text Artifact
  - `revise(goal, systemPrompt, previousArtifact, grade, feedback)` → calls Claude with PRESERVE/IMPROVE prompt → returns revised Artifact
- [ ] Connect to real Anthropic API using the SDK
- [ ] Add cost tracking: record tokens_in, tokens_out, model name, cost_usd per call
- [ ] Test with a simple prompt: "Write a 500-word article about machine learning"
- [ ] Verify: returns a real article as an Artifact

---

### Micro Phase 3.2: Create the text judge

**Action items:**
- [ ] Create a JudgeFunction implementation for text artifacts
- [ ] Use a DIFFERENT model from the producer (if producer = Claude Sonnet, judge = GPT-4o, or vice versa)
- [ ] The judge evaluates against a text rubric with 5 dimensions:
  - Clarity & Readability (20%)
  - Depth & Substance (20%)
  - Engagement & Voice (20%)
  - Accuracy & Credibility (15%)
  - Structure & Completeness (25% — must be >= 20%)
- [ ] Test: give the judge an article, get back a valid Grade with all dimensions
- [ ] Verify: scores are reasonable (not all 9s, not all 3s)

---

### Micro Phase 3.3: Create the text rubric and validators

**Action items:**
- [ ] Create text rubric definition with 5 dimensions and their weights
- [ ] Create text validators:
  - word-count validator (minimum 200 words, maximum 10000)
  - not-empty validator
  - completeness check (does it end properly, not cut off mid-sentence?)
- [ ] Verify: validators catch truncated/empty content

---

### Micro Phase 3.4: Wire it all together — first real loop

**Action items:**
- [ ] Create a StageConfig for "Article Generation" with:
  - Text producer adapter
  - Text rubric (5 dimensions)
  - Text validators
  - Threshold: 7.5 (on 1-10 scale)
  - Max iterations: 5
  - Min iterations: 2
- [ ] Run the loop with a real topic: "Write a comprehensive article about how solar panels work"
- [ ] Watch the output:
  - Does v1 get a score? (expect around 6-7)
  - Does v2 improve? (expect around 7-8)
  - Does the PRESERVE/IMPROVE feedback work? (check that strong dimensions stay strong)
  - Does best-version tracking work? (the best version should be presented, not the last)
- [ ] Print the full iteration history to console
- [ ] Verify: quality genuinely improves across iterations (this is the whole point)

**🎯 THIS IS THE FIRST MAJOR MILESTONE. If article quality improves from ~6/10 to ~8/10 across iterations, the core engine works.**

---

### Micro Phase 3.5: Build the basic UI for text generation

**Action items:**
- [ ] Create a simple page at `/generate/text`:
  - Text input for the topic/goal
  - "Generate" button
  - Real-time progress display (showing which iteration is running, current score)
  - Artifact viewer (shows the article text)
  - Grade display (shows all 5 dimension scores with reasoning)
  - Iteration history panel (collapsible, shows all versions and their scores)
  - Review buttons: Approve, Give Feedback (text input), Reject
- [ ] Connect to the engine via API routes
- [ ] Stream events using SSE for real-time progress
- [ ] Test the full flow in the browser:
  - Enter topic → watch iterations → see scores improve → review → approve

---

### 📋 PHASE 3 EXIT GATE
```
✅ Real articles are generated through the recursive loop
✅ Quality genuinely improves across iterations (v1 ~6-7, v3 ~8+)
✅ PRESERVE/IMPROVE prevents regression (strong dimensions stay strong)
✅ Best-version is tracked and presented
✅ Validators catch truncated/empty articles
✅ Cross-model judging works (different model for judge)
✅ Cost per article is tracked and displayed
✅ UI shows the full flow: generate → progress → review → approve
✅ You (the human) can approve, give feedback, or reject
✅ After feedback, the loop improves on your specific instruction
```

**⏸️ STOP HERE AND EVALUATE:** Are you happy with the text generation quality? Run 5-10 different topics. Check that:
- Articles are genuinely good (not generic AI slop)
- The loop actually improves them (not just rewriting without improvement)
- Your feedback is actually incorporated
- The iteration history shows meaningful progression

If YES → proceed to Phase 4. If NO → fix the engine, rubric, or prompts until you're satisfied.

---
---

## MACRO PHASE 4: IMAGE GENERATION — PROVE TOURNAMENT WORKS
**Goal:** Generate quality images using the tournament pattern (multiple models compete)
**Duration:** 3-4 days
**What you'll have after:** Describe an image → multiple AI models generate variants → AI judge picks the best → you approve

---

### Micro Phase 4.1: Create image producer adapters

**Action items:**
- [ ] Create adapters for 2-3 image generation APIs:
  - Adapter for Flux (via fal.ai) — fast, good quality
  - Adapter for DALL-E 3 (via OpenAI) — creative, different style
  - (Optional) Adapter for Stable Diffusion XL
- [ ] Each adapter: takes a text prompt → calls the API → saves image to disk → returns Artifact with file path
- [ ] Test each adapter independently: generate one image, verify it exists on disk

---

### Micro Phase 4.2: Create the image judge

**Action items:**
- [ ] Create a JudgeFunction for images that uses a VISION-capable model
- [ ] The judge receives the image (as base64 or URL) and evaluates against the image rubric:
  - Prompt Alignment (30%) — does the image match what was requested?
  - Visual Clarity (25%) — is it clear, well-composed, easy to understand?
  - Style Quality (20%) — is the style appropriate and consistent?
  - Technical Quality (15%) — resolution, artifacts, distortion?
  - Completeness (10%) — all requested elements present?
- [ ] Test: give the judge an image and a prompt, get back a valid Grade
- [ ] Verify: scores differentiate good images from bad ones

---

### Micro Phase 4.3: Create image validators

**Action items:**
- [ ] File-exists validator (does the image file exist on disk?)
- [ ] Image-dimensions validator (minimum 1024x1024 or 1280x720)
- [ ] File-size validator (not zero bytes, not corrupted)
- [ ] Test: validators catch missing/corrupt files

---

### Micro Phase 4.4: Implement the tournament loop pattern

**Action items:**
- [ ] Create `src/lib/core/engine/tournament.ts`
- [ ] Tournament flow:
  1. Call ALL registered producer adapters in parallel (e.g., Flux + DALL-E + SDXL)
  2. Each produces one image for the same prompt
  3. Judge evaluates ALL images independently
  4. Rank by score → select the winner
  5. If winner score >= threshold → present to human
  6. If no winner passes → Round 2: top 2 models retry with refined prompts → judge all entries from all rounds → present best
- [ ] Test with a real prompt: "A futuristic city skyline at sunset, digital art style"
- [ ] Print results: which model won, all scores, which round
- [ ] Verify: tournament produces better results than single-model generation

---

### Micro Phase 4.5: Build the image generation UI

**Action items:**
- [ ] Create a page at `/generate/image`:
  - Text input for the image description
  - "Generate" button
  - Tournament progress (showing each model generating)
  - Image gallery (all variants side by side with scores)
  - Winner highlighted
  - Review buttons: Approve, Regenerate (with feedback), Reject
- [ ] Test the full flow in the browser

---

### 📋 PHASE 4 EXIT GATE
```
✅ Multiple image models generate variants in parallel
✅ AI judge evaluates and ranks images using vision
✅ Tournament consistently selects reasonable winners
✅ Image validators catch missing/corrupt files
✅ UI shows all variants with scores
✅ Human can approve, request regeneration, or reject
✅ Cost per image tournament is tracked
```

---
---

## MACRO PHASE 5: AUDIO GENERATION
**Goal:** Generate voice-overs from text and background music
**Duration:** 2-3 days

---

### Micro Phase 5.1: Voice-over generation

**Action items:**
- [ ] Create adapter for TTS API (ElevenLabs or Azure TTS)
- [ ] Adapter takes: narration text + voice settings → calls API → saves audio file → returns Artifact with file path
- [ ] Create voice-over rubric:
  - Clarity & Pronunciation (25%)
  - Pacing & Rhythm (25%)
  - Tone & Engagement (20%)
  - Script Faithfulness (20%)
  - Audio Quality (10%)
- [ ] Create audio validators: file-exists, duration-check (within 10% of expected)
- [ ] The loop for voice: generate → validate → evaluate (judge listens using audio analysis or transcript comparison) → revise settings if needed
- [ ] Test: convert a paragraph to speech, evaluate quality
- [ ] Build UI at `/generate/voice`

---

### Micro Phase 5.2: Music generation

**Action items:**
- [ ] Create adapter for music API (Suno or Udio)
- [ ] Adapter takes: mood + duration + style → calls API → saves audio file → returns Artifact
- [ ] Create music rubric: Mood Match, Duration Match, Audio Quality, Loop/Fade Quality
- [ ] Tournament: generate 2-3 music variants for same mood → judge picks best
- [ ] Test: generate 30-second background music with "calm, educational, ambient" mood
- [ ] Build UI at `/generate/music`

---

### 📋 PHASE 5 EXIT GATE
```
✅ Voice-over from any text with configurable voice
✅ Music generation for any mood/duration
✅ Quality evaluation for both audio types
✅ Audio files play correctly in browser
✅ Cost tracked per generation
```

---
---

## MACRO PHASE 6: VIDEO GENERATION
**Goal:** Generate video clips from images with motion
**Duration:** 2-3 days

---

### Micro Phase 6.1: Video clip generation

**Action items:**
- [ ] Create adapter for video generation API (Runway, Kling, or Vidu)
- [ ] Adapter takes: source image + motion prompt + duration → calls API → saves video file → returns Artifact
- [ ] Create video rubric:
  - Motion Quality (25%) — smooth, purposeful movement
  - Source Fidelity (25%) — video looks like the source image
  - Pacing (20%) — appropriate speed
  - Visual Coherence (20%) — no glitches or distortion
  - Technical Quality (10%) — resolution, frame rate
- [ ] Create video validators: file-exists, duration-check, resolution-check
- [ ] Tournament: 2-3 video models generate from same image → judge picks best
- [ ] Test: take an image from Phase 4, animate it as a 5-second clip
- [ ] Build UI at `/generate/video`

---

### Micro Phase 6.2: Scene assembly (video + voice + music)

**Action items:**
- [ ] Create an assembly utility using FFmpeg:
  - Takes: video clip + voice-over audio + background music
  - Normalizes audio levels (voice at -16 LUFS, music at -24 LUFS)
  - Mixes audio tracks
  - Combines video with mixed audio
  - Exports as MP4
- [ ] Create assembly validators: all-assets-exist, duration-match, audio-sync
- [ ] Test: combine a video clip, a voice-over, and a music track into one scene
- [ ] Build UI at `/generate/assembly`

---

### 📋 PHASE 6 EXIT GATE
```
✅ Video clips generated from images with motion
✅ Multiple video models compete via tournament
✅ Video + voice + music assembled into complete scenes
✅ FFmpeg assembly works correctly
✅ All validators catch missing/bad files
✅ Cost tracked per video generation
```

---
---

## MACRO PHASE 7: HUMAN REVIEW SYSTEM
**Goal:** Build the complete approval workflow with all 6 review actions
**Duration:** 2-3 days

---

### Micro Phase 7.1: Review system core

**Action items:**
- [ ] Create `src/lib/core/review/` with:
  - Review manager: creates review requests, processes responses
  - Review gate logic: which stages require mandatory human review
  - Configurable review points: user can choose which stages to review
- [ ] Implement all 6 review actions end-to-end
- [ ] Write tests for each action

---

### Micro Phase 7.2: Unified review UI

**Action items:**
- [ ] Create a review page that works for ANY artifact type:
  - For text: shows the article with diff highlighting between versions
  - For images: shows image gallery with zoom
  - For audio: embedded audio player with waveform
  - For video: embedded video player
  - For assembly: video player with timeline markers
- [ ] Review action buttons: Approve, Feedback (with text input), Reject, Edit
- [ ] Iteration history panel: click any version to view it
- [ ] Grade display: all dimensions with scores and reasoning
- [ ] Test: review and approve one artifact of each type (text, image, audio, video)

---

### 📋 PHASE 7 EXIT GATE
```
✅ Review UI works for all artifact types
✅ All 6 review actions function correctly
✅ Iteration history shows all versions
✅ Approve locks the artifact
✅ Feedback triggers revision with clear improvement
✅ Reject starts fresh
```

---
---

## MACRO PHASE 8: PIPELINE MODE — CHAIN ARTIFACTS TOGETHER
**Goal:** Prove the engine can chain multiple stages (text → images → video → assembly)
**Duration:** 3-4 days

---

### Micro Phase 8.1: Pipeline orchestrator (core)

**Action items:**
- [ ] Create `src/lib/core/engine/pipeline-runner.ts`:
  - Takes an array of StageConfigs with dependency declarations
  - Runs stages in order, passing approved artifacts downstream
  - Supports parallel execution where dependencies allow
  - Tracks overall pipeline state
  - Handles pipeline resume from any stage checkpoint
- [ ] Write tests with mock stages

---

### Micro Phase 8.2: Demo pipeline — article with hero image

**Action items:**
- [ ] Create a 2-stage pipeline:
  - Stage 1: Generate an article (text) about a topic
  - Stage 2: Generate a hero image (image) based on the article's first paragraph
- [ ] Run end-to-end: topic → article approved → image generated from article → image approved
- [ ] Build UI showing pipeline progress with both stages

---

### Micro Phase 8.3: Demo pipeline — complete video scene

**Action items:**
- [ ] Create a 5-stage pipeline:
  - Stage 1: Write a short narration script (text)
  - Stage 2: Generate illustration (image) from the script's visual description
  - Stage 3: Generate voice-over (audio) from the script's narration text
  - Stage 4: Generate video clip (video) from the image
  - Stage 5: Assemble everything (assembly) — video + voice + music
- [ ] Human reviews at Stage 1 (script) and Stage 5 (final)
- [ ] Stages 2, 3, 4 run in parallel after script approval
- [ ] Test end-to-end: topic → script approved → parallel generation → assembly → final approved
- [ ] Build UI showing the full pipeline with stage progress

---

### Micro Phase 8.4: Style anchor system

**Action items:**
- [ ] Implement the style anchor pattern:
  - Scene 1's approved image sets the visual style for all subsequent scenes
  - The judge for scene 2+ receives scene 1's image as style reference
  - Style consistency becomes a rubric dimension (20% weight)
- [ ] Test with a 3-scene pipeline: verify visual consistency across scenes

---

### 📋 PHASE 8 EXIT GATE
```
✅ Pipeline chains stages in dependency order
✅ Parallel stages run simultaneously
✅ Approved artifacts flow downstream as inputs
✅ Pipeline resumes from any stage checkpoint
✅ 2-stage demo works (article + hero image)
✅ 5-stage demo works (script → image + voice + music → video → assembly)
✅ Style anchor maintains consistency across scenes
✅ Human review gates pause the pipeline correctly
✅ Full cost tracked across all pipeline stages
```

**🎯 THIS IS THE STAGE 1 COMPLETION MILESTONE.**

---

### ⭐ STAGE 1 FINAL EVALUATION

Before moving to Stage 2, verify ALL of the following:

```
QUALITY CHECKS:
✅ Text articles: run 10 topics, average final score >= 7.5
✅ Images: tournament consistently picks good images
✅ Voice-over: clear, natural-sounding, correct pacing
✅ Video: smooth motion, matches source image
✅ Assembly: audio synced, no glitches

ENGINE CHECKS:
✅ Recursive loop improves quality measurably
✅ PRESERVE/IMPROVE prevents regression
✅ Best-version tracking presents peak, not last
✅ Validators catch obvious failures before judge
✅ Cross-model judging works
✅ Checkpointing saves progress after every iteration
✅ Pipeline mode chains stages correctly

INFRASTRUCTURE CHECKS:
✅ Database stores all artifacts, grades, history
✅ Cost tracked per call, per iteration, per stage, per pipeline
✅ Review system handles all 6 actions
✅ No core/ imports from domain/

CONFIDENCE CHECK:
✅ You are personally satisfied with the quality of generated content
✅ The recursive loop genuinely adds value (not just rewriting)
✅ You would show this to a client
```

If all checks pass → proceed to Stage 2. If any fail → fix before proceeding.

---
---
---

# ════════════════════════════════════════════════════════
# STAGE 2: eLEARNING AIOS DOMAIN SYSTEM
# ════════════════════════════════════════════════════════

**Purpose:** Take the proven universal engine from Stage 1 and wrap eLearning domain intelligence around it. The engine doesn't change — you're only adding eLearning-specific configuration, agents, rubrics, and pipeline sequencing.

**When you're done with Stage 2, you'll have:**
- A system where you input a course topic and audience
- AI agents brainstorm and structure the entire course (modules, topics, subtopics)
- After human approval of the structure:
  - Study materials are generated for every topic
  - Assessments (quizzes) are generated
  - Video scripts are written, reviewed, and approved
  - Images, voice-overs, music, and video are generated per scene
  - Everything is assembled into complete educational videos
  - Activities and capstone projects round out the course

---
---

## MACRO PHASE 9: eLEARNING DOMAIN SETUP
**Goal:** Create the eLearning-specific configuration layer
**Duration:** 3-4 days

---

### Micro Phase 9.1: Course structure data model

**Action items:**
- [ ] Create eLearning-specific database tables (these ARE domain-specific):
  - `project_blueprints` — extends projects with eLearning fields (archetype, audience, curriculum source)
  - `project_nodes` — hierarchical tree: Course → Module → Topic → Subtopic
  - `node_components` — what each node produces: video, study_material, quiz, activity, etc.
  - `structure_grades` — rubric scores for the project structure
- [ ] Run migration
- [ ] Create tree utilities: add/remove/reorder nodes, get ancestors, get descendants

---

### Micro Phase 9.2: Archetype and component registries

**Action items:**
- [ ] Create `src/lib/domain/workflows/archetypes.ts`:
  - Define course archetypes: Academic Course, Professional Training, Workshop, Tutorial Series, etc.
  - Each archetype has default settings: typical duration, component mix, review points
- [ ] Create `src/lib/domain/workflows/component-registry.ts`:
  - Register all component types: video, study_material, practice_worksheet, flashcards, glossary, quiz, pre_assessment, post_assessment, activity, scenario_exercise, capstone_project, certificate
  - Each component has: which pipeline processes it, what loop pattern it uses, what rubric applies
- [ ] Create component compatibility matrix: which components work at which tree levels

---

### Micro Phase 9.3: eLearning rubrics

**Action items:**
- [ ] Create rubrics in `src/lib/domain/workflows/rubrics/`:
  - Brief rubric (Phase 0: is the project brief clear and complete?)
  - Audience rubric (Phase 0: is the audience analysis thorough?)
  - Structure rubric (Phase 0: is the course structure logical and complete?)
  - Component rubric (Phase 0: are the right components selected?)
  - Handoff rubric (Phase 0: is everything ready for production?)
  - Script rubric (Phase 3: educational quality, visual direction, engagement)
  - Each rubric: 5 dimensions, weights summing to 1.0, completeness >= 20%, 1-10 scale
- [ ] Verify all rubrics pass the rubric-grader validation

---

### Micro Phase 9.4: eLearning agent personas

**Action items:**
- [ ] Create agent persona documents in `src/lib/domain/workflows/agents/`:
  - Orchestrator agent — coordinates the ideation conversation
  - Audience analyst — analyzes target learners
  - Curriculum strategist — designs learning pathways
  - Outcome architect — maps learning objectives
  - Component recommender — selects best component mix
  - Structure optimizer — improves course hierarchy
  - Rubric grader — evaluates structure quality
  - Devil's advocate — challenges assumptions and finds weaknesses
- [ ] Each persona document includes: identity, mission, core behaviors, quality criteria, constraints
- [ ] Register all agents in an agent registry

---

### 📋 PHASE 9 EXIT GATE
```
✅ eLearning database tables created and migrated
✅ Tree utilities work (add, remove, reorder nodes)
✅ Archetype registry has 5+ archetypes
✅ Component registry has 12+ component types
✅ All rubrics pass validation
✅ All 8 agent personas created
✅ Everything is in domain/ — nothing eLearning-specific in core/
```

---
---

## MACRO PHASE 10: PROJECT IDEATION PIPELINE (Phase 0)
**Goal:** Build the brainstorming system that structures an entire course from a topic
**Duration:** 5-7 days

---

### Micro Phase 10.1: Ideation pipeline configuration

**Action items:**
- [ ] Create `src/lib/domain/workflows/ideation/pipeline-config.ts`
- [ ] Wire the 5 ideation stages:
  1. Brief → orchestrator agent + brief rubric + threshold 7.5
  2. Audience → audience analyst + audience rubric + threshold 7.5
  3. Structure → curriculum strategist + outcome architect + structure rubric + threshold 7.5
  4. Components → component recommender + optimizer + component rubric + threshold 7.5
  5. Handoff → handoff check + handoff rubric + threshold 8.0
- [ ] Each stage uses the Standard loop pattern from Stage 1
- [ ] All stages require human review (mandatory gates)

---

### Micro Phase 10.2: Chat ideation UI

**Action items:**
- [ ] Create a chat interface at `/projects/[id]/ideate`:
  - Message input with send button
  - Agent messages with visual indicators (which agent is speaking)
  - Phase indicator showing which ideation stage is active
  - Structured proposal cards (when agents propose structure/components)
  - Review buttons at each stage gate
- [ ] Connect to the pipeline via API routes
- [ ] Real-time streaming of agent responses

---

### Micro Phase 10.3: Canvas structure editor

**Action items:**
- [ ] Create a visual tree editor at `/projects/[id]/structure`:
  - Collapsible tree showing: Course → Modules → Topics → Subtopics
  - Click a node to see details (title, description, learning outcomes)
  - Drag to reorder nodes
  - Component palette: drag component types onto nodes
  - Rubric score bar showing overall structure quality
- [ ] Two-way sync: changes in canvas trigger re-grading by the rubric agent

---

### Micro Phase 10.4: Configuration wizard

**Action items:**
- [ ] Create a wizard at `/projects/[id]/configure`:
  - Step 1: Global settings (video duration, voice, visual style)
  - Step 2: Per-component configuration (which components at which levels)
  - Step 3: Review points (which stages require human approval)
  - Step 4: Production readiness checklist
- [ ] After wizard completion, generate all pipeline jobs for production
- [ ] Display estimated cost and time

---

### Micro Phase 10.5: End-to-end ideation test

**Action items:**
- [ ] Test the full flow:
  1. Create new project: "Teacher training course on instructional design"
  2. Chat with agents: provide audience details, discuss structure
  3. Agents propose a 5-module course structure
  4. Review and approve the structure in canvas
  5. Configure components and settings in wizard
  6. Production pipeline jobs are created
- [ ] Verify: the output is a complete, sensible course structure with all modules, topics, and components identified

---

### 📋 PHASE 10 EXIT GATE
```
✅ Full ideation flow: topic → chat → structure → configure → ready for production
✅ 8 agents collaborate to propose course structure
✅ Rubric grading ensures quality at each stage
✅ Canvas shows visual tree that humans can edit
✅ Wizard configures all production settings
✅ Pipeline jobs are generated and ready to run
```

---
---

## MACRO PHASE 11: CONTENT PRODUCTION PIPELINE (Phases 1-5)
**Goal:** Build all 5 production pipelines that generate the actual course content
**Duration:** 10-14 days (the largest phase)

---

### Micro Phase 11.1: Document pipeline (Phase 1 — study materials)

**Action items:**
- [ ] Configure the document production pipeline with 5 stages:
  - D1: Content Research & Outline (standard loop)
  - D2: Content Generation (standard loop)
  - D3: Formatting & Visual Design (standard loop)
  - D4: Quality Validation (validators + judge)
  - D5: Human Review Gate
- [ ] Create document-specific agents: researcher, writer, formatter
- [ ] Create document rubric: accuracy, readability, completeness, structure, engagement
- [ ] Test: generate study material for one topic from the ideation output
- [ ] Verify: produces a complete, well-formatted study document
- [ ] Supported components: study_material, practice_worksheet, flashcards, glossary

---

### Micro Phase 11.2: Assessment pipeline (Phase 2 — quizzes)

**Action items:**
- [ ] Configure the assessment pipeline with 6 stages:
  - A1: Outcome-to-question mapping
  - A2: Question generation (standard loop)
  - A3: Answer validation (cross-model — one model generates, another validates)
  - A4: Difficulty calibration
  - A5: Quality review gate
  - A6: Packaging (JSON + PDF)
- [ ] Create assessment agents: question designer, answer validator
- [ ] Create assessment rubric: alignment to outcomes, difficulty spread, clarity, answer accuracy
- [ ] Test: generate a quiz for one topic
- [ ] Verify: questions are relevant, answers are correct, difficulty is appropriate
- [ ] Supported components: quiz, pre_assessment, post_assessment

---

### Micro Phase 11.3: Video pipeline (Phase 3 — the big one, 16 stages)

This is the most complex pipeline. It produces complete educational videos by chaining all the artifact types from Stage 1.

**Action items:**
- [ ] Configure the 16-stage video pipeline:

  **Script sub-pipeline:**
  - V1: Discovery (strategic + standard — agents research the topic)
  - V2: Script writing (standard loop — per scene)
  - V3: Script review (HUMAN GATE — mandatory)

  **Visual sub-pipeline (after script approval):**
  - V4: Image prompt engineering (standard — generate prompts per scene)
  - V5: Image generation (TOURNAMENT — multiple models per scene)
  - V6: Storyboard assembly (standard — arrange images into visual narrative)
  - V7: Storyboard review (HUMAN GATE — mandatory)

  **Audio + Generation sub-pipeline (parallel after storyboard):**
  - V8: Voice-over generation (standard — per scene)
  - V9: Video clip generation (TOURNAMENT — animate images)
  - V10: Music & SFX generation (TOURNAMENT — per scene mood)

  **Assembly sub-pipeline:**
  - V11: Per-scene assembly (standard — video + voice + music)
  - V12: Full video assembly (concatenate all scenes)

  **Finishing sub-pipeline:**
  - V13: Caption generation
  - V14: Final render
  - V15: QA automation check
  - V16: Final delivery (HUMAN GATE — mandatory)

- [ ] Implement parallelization: V5, V8, V9, V10 can run simultaneously after V3 approval
- [ ] Implement per-scene looping: V2, V4-V11 run independently per scene
- [ ] Implement style anchor: scene 1's approved image sets the visual reference
- [ ] Test with a short 3-scene video:
  1. Write script about "How photosynthesis works" (3 scenes)
  2. Generate images for each scene (tournament)
  3. Generate voice-over per scene
  4. Generate video clips per scene (tournament)
  5. Generate background music per scene
  6. Assemble each scene
  7. Concatenate into final video
  8. Add captions
  9. Final QA and human review
- [ ] 🎯 **THE KEY MILESTONE: Press play on a video that was 100% AI-generated (except human approvals). Watch it. Is it a real educational video?**

---

### Micro Phase 11.4: Activity pipeline (Phase 4)

**Action items:**
- [ ] Configure the activity pipeline with 5 stages:
  - T1: Activity design (strategic + standard)
  - T2: Material generation (standard)
  - T3: Exemplar creation (standard, optional)
  - T4: Quality validation
  - T5: Human review gate
- [ ] Create activity agents and rubric
- [ ] Test: generate an activity for one topic
- [ ] Supported components: activity, scenario_exercise

---

### Micro Phase 11.5: Capstone pipeline (Phase 5)

**Action items:**
- [ ] Configure the capstone pipeline with 4 stages:
  - C1: Capstone design (strategic + standard)
  - C2: Brief & rubric generation (standard)
  - C3: Support material generation (standard)
  - C4: Human review gate
- [ ] The capstone pipeline runs LAST because it references all previous content
- [ ] Test: generate a capstone project that synthesizes a module's learning
- [ ] Supported component: capstone_project

---

### Micro Phase 11.6: Full production orchestration

**Action items:**
- [ ] Create the production orchestrator that sequences all 5 pipelines:
  ```
  Documents (Phase 1) — runs FIRST, creates the content foundation
      ↓
  Assessments (Phase 2) — references document content
      ↓
  Videos (Phase 3) — references documents + assessments
      ↓
  Activities (Phase 4) — references all above
      ↓
  Capstone (Phase 5) — synthesizes everything
  ```
- [ ] Within each pipeline, process by tree order: Module 1 topics → Module 2 → Module 3
- [ ] Videos are batched in groups of 10 for review efficiency
- [ ] Test: run the full production pipeline for one module (2-3 topics) end-to-end

---

### Micro Phase 11.7: Full course production test

**Action items:**
- [ ] Run the complete production pipeline for a real course:
  - Topic: "Introduction to Python Programming" (or any topic you choose)
  - Structure: 3 modules, 3 topics per module, 2 subtopics per topic
  - Components per topic: study_material + quiz + video (2 min each)
  - Total: ~9 videos × 2 min = ~18 min of video content
- [ ] Track: total time, total cost, total quality scores
- [ ] Review all outputs:
  - Are study materials accurate and well-written?
  - Are quizzes relevant with correct answers?
  - Are videos watchable and educational?
  - Does the course flow logically from module to module?
- [ ] 🎯 **THE MAJOR MILESTONE: You have a complete course that a real student could learn from.**

---

### 📋 PHASE 11 EXIT GATE
```
✅ Document pipeline generates study materials, worksheets, flashcards
✅ Assessment pipeline generates quizzes with correct answers
✅ Video pipeline produces complete educational videos (16 stages)
✅ Activity pipeline generates exercises and scenarios
✅ Capstone pipeline creates synthesis projects
✅ Production orchestrator sequences all 5 pipelines correctly
✅ Per-scene looping works independently per scene
✅ Tournament selects best images/video/music
✅ Style anchor maintains consistency across scenes
✅ Full course produced: multiple modules, hours of content
✅ Human review gates work at all mandatory points
✅ Total cost per course is tracked and reported
```

---
---

## MACRO PHASE 12: MVP LAUNCH READINESS
**Goal:** Polish, test, and prepare for real-world use
**Duration:** 5-7 days

---

### Micro Phase 12.1: Production dashboard

**Action items:**
- [ ] Build the main dashboard showing:
  - All projects with status (ideation, production, completed)
  - Pipeline progress per project (which phase, how many videos done)
  - Items awaiting human review (review queue)
  - Cost tracking per project
  - Quality metrics (average scores, revision counts)
- [ ] Search and filter projects

---

### Micro Phase 12.2: Client review portal

**Action items:**
- [ ] Build a shareable review page (no login required):
  - Share a link → reviewer watches the video → leaves timestamped feedback
  - Feedback is categorized: visual issue, audio issue, content issue, etc.
  - Feedback routed to the correct pipeline stage for revision
- [ ] Test: share a link, leave feedback, verify it reaches the system

---

### Micro Phase 12.3: Batch processing

**Action items:**
- [ ] Implement batch video processing:
  - Process 10 videos through each stage simultaneously
  - Batch approval UI: review 10 scripts at once, approve/reject individually
  - Progress tracking per batch
- [ ] Test with a batch of 10 videos

---

### Micro Phase 12.4: Error recovery and resilience

**Action items:**
- [ ] Test and fix failure scenarios:
  - API timeout mid-generation → resume from last checkpoint
  - Browser closes during review → state preserved in database
  - AI returns garbage → graceful fallback with retry
  - Image generation fails → skip and retry without blocking other scenes
- [ ] Implement retry logic with exponential backoff for all AI API calls
- [ ] Test: simulate failures and verify recovery

---

### Micro Phase 12.5: MVP polish and testing

**Action items:**
- [ ] Run a complete end-to-end test:
  1. Create a new project from scratch
  2. Complete ideation (chat → structure → configure)
  3. Run full production (all 5 pipelines)
  4. Review and approve at all gates
  5. Deliver a complete course package
- [ ] Measure and report:
  - Total time from start to finish
  - Total cost (all AI API calls)
  - Total number of artifacts produced
  - Average quality scores
  - Number of human review interventions
- [ ] Fix any remaining bugs
- [ ] Write a user guide: "How to produce a course from start to finish"

---

### 📋 PHASE 12 EXIT GATE — THE FINAL GATE
```
✅ Dashboard shows all projects with progress
✅ Client review portal works with shared links
✅ Batch processing handles 10 videos simultaneously
✅ Error recovery works for all failure scenarios
✅ Complete course produced end-to-end from scratch
✅ User guide written
✅ Cost and time estimates documented
✅ You would confidently demo this to a client
```

---
---

# ════════════════════════════════════════════════════════
# MVP DEFINITION OF DONE
# ════════════════════════════════════════════════════════

**The MVP is COMPLETE when all of the following are true:**

1. **A real course exists** — multiple modules, multiple topics, hours of video content, study materials, quizzes, activities, and a capstone project. All AI-generated with human approval.

2. **The recursive loop works** — quality measurably improves across iterations for every artifact type.

3. **Human review is seamless** — approve, feedback, reject at every gate. Client review portal works.

4. **Cost is tracked** — you know exactly how much each course costs to produce.

5. **The engine is universal** — core/ has zero eLearning-specific code. `grep -r "from.*domain/" src/lib/core/` returns nothing. A Film AIOS could use the same core.

6. **It's resilient** — crashes don't lose work. Browser refreshes don't break state. API failures retry gracefully.

---

# SUMMARY TABLE

| Stage | Phase | Name | Duration | Key Deliverable |
|-------|-------|------|----------|-----------------|
| 1 | 1 | Project foundation | 1-2 days | Empty project, database, folders |
| 1 | 2 | Core loop engine | 3-5 days | 4 core functions + validators |
| 1 | 3 | Text generation | 3-4 days | Quality articles through recursive loop |
| 1 | 4 | Image generation | 3-4 days | Tournament-selected images |
| 1 | 5 | Audio generation | 2-3 days | Voice-overs + background music |
| 1 | 6 | Video generation | 2-3 days | Video clips + scene assembly |
| 1 | 7 | Human review system | 2-3 days | Full approval workflow UI |
| 1 | 8 | Pipeline mode | 3-4 days | Chained multi-artifact pipelines |
| 2 | 9 | eLearning domain setup | 3-4 days | Archetypes, components, rubrics, agents |
| 2 | 10 | Project ideation | 5-7 days | Chat → structure → configure |
| 2 | 11 | Content production | 10-14 days | All 5 pipelines producing real content |
| 2 | 12 | MVP launch readiness | 5-7 days | Dashboard, review portal, polish |
| **Total** | | | **~12-16 weeks** | **Complete eLearning course MVP** |