# VOVAI eLearn AIOS — Task Tracker

## Current Phase: Ring 0 — Project Setup (Mac)

### Day 0: Setup
- [x] Run setup script — project structure created
- [x] Open in VS Code: `code vovai-elearn-aios`
- [x] Open Claude Code in VS Code (Cmd+Shift+P → "Claude Code: Open")
- [x] Tell Claude: "Read CLAUDE.md and tasks/todo.md. Confirm you understand."

### Day 1: Install Dependencies
- [x] Tell Claude: install Next.js 14, TypeScript, Tailwind, shadcn/ui
- [x] Tell Claude: install Prisma, set up PostgreSQL connection
- [x] Tell Claude: install Vitest for testing
- [x] Verify: `npm run dev` works, see page at http://localhost:3000

### Day 2: Database
- [ ] Install PostgreSQL via Homebrew (if not installed)
- [ ] Create database: vovai_elearn_dev
- [ ] Tell Claude: create Prisma schema (projects, artifacts, grades, stages)
- [ ] Run first migration: npx prisma migrate dev
- [ ] Verify: npx prisma studio shows tables

---

## Ring 1: Script Pipeline (Weeks 1-4)

### Week 1: UI Shell (Visual-First)
- [ ] Dashboard page — project list with status
- [ ] New project form — topic, audience, duration
- [ ] Project detail page — pipeline stages with status
- [ ] Review interface skeleton — script, scorecard, 3 buttons

### Week 2: Engine Core
- [ ] Implement core types (from src/lib/types.ts)
- [ ] Implement produce() — Claude API integration
- [ ] Implement evaluate() — GPT-4o cross-model judging
- [ ] Implement runLoop() — async generator with SSE
- [ ] Connect SSE to UI — real-time streaming

### Week 3: Review System + Script Agent
- [ ] Implement processReview() — approve/feedback/reject
- [ ] Connect review buttons to API
- [ ] Load Script Writer agent from config YAML
- [ ] Load script rubric from config JSON
- [ ] Integration test: topic → script → review → approve

### Week 4: Polish + Test
- [ ] End-to-end: create project, generate script, review, approve
- [ ] Cost tracking on every LLM call
- [ ] Iteration history display in UI
- [ ] Fix all bugs found during testing
- [ ] 🎯 MILESTONE: "The loop genuinely improves eLearning scripts"

---

## Ring 2: Visual Pipeline (Weeks 5-7)
- [ ] Image Prompt Engineer agent + rubric
- [ ] fal.ai integration (FLUX model)
- [ ] Tournament engine (multiple models, parallel)
- [ ] Image Judge (GPT-4o Vision)
- [ ] Style anchor pattern (Scene 1 = reference)
- [ ] Storyboard assembly view
- [ ] Storyboard review screen
- [ ] 🎯 MILESTONE: "Topic → Script → Images → Storyboard"

## Ring 3: Audio + Assembly (Weeks 8-10)
- [ ] ElevenLabs voice-over integration
- [ ] Runway/Kling video generation
- [ ] Music/SFX generation
- [ ] FFmpeg per-scene assembly
- [ ] Full assembly + transitions
- [ ] 🎯 MILESTONE: "Topic → complete eLearning video"

## Ring 4: Production UI (Weeks 11-14)
- [ ] Full production portal
- [ ] Workshop (prompt/rubric editors)
- [ ] Analytics dashboard
- [ ] 🎯 MILESTONE: "Complete, usable production system"

## Ring 5: Platform (Weeks 15-20)
- [ ] Multi-tenant + auth + billing
- [ ] Deployment
- [ ] First client project
- [ ] 🎯 MILESTONE: "Commercial platform, first paying client"
