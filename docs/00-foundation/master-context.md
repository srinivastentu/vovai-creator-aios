# CreatorOS — Master Context Document
## VOVAI Platform · CreatorOS AIOS v1.1

**Status:** Architectural specification, MVP-scoped, ready for implementation
**Forked from:** VOVAI eLearn AIOS (Core retained, Domain rewritten + extended)
**Author:** Srinivas + Claude (March 2026, revised May 2026)
**Changes in v1.1:** Added §4.0 (three engineering layers mental model), §4.5 (Context Engineering System), §6.4 (Memory architecture), §12.3 (agent composition patterns), §16 (Anthropic primitives relationship).

---

## 1. IDENTITY

CreatorOS is an **agentic AI-powered content production OS for creators**. It takes one idea and turns it into multiple publishable artifacts across multiple platforms — text posts, carousels, blog articles, newsletters, image posts, eventually short-form and long-form video — all aligned to a creator's personal voice, niche, and audience.

It is **not** a one-shot generator. It is a pipeline: one human selects (or proposes) an idea, agents research, agents synthesize a living knowledge base, and that knowledge base is converted into platform-specific shapes — each shape going through a recursive quality loop with multi-model cross-critique before reaching the human for approval.

CreatorOS is the second AIOS built on the VOVAI Core Platform. The first was eLearn AIOS. The Core remained the same. Only the Domain layer was rewritten.

### 1.1 Phased rollout (the strict order)

| Phase | Artifact types | Notes |
|---|---|---|
| **V1 (MVP)** | LinkedIn post + long-form article | One end-to-end loop. Done excellently. |
| **V2** | Add blog post, newsletter, X thread, image post for LinkedIn/Facebook/X | Text + image content. No video. |
| **V3** | Add scheduling. Add Long-Form Master versioning. Multi-pattern cross-critique testbed. |  |
| **V4** | Add short-form video (Reels/Shorts), long-form video, podcast |  |
| **V5+** | Publishing API integrations, performance feedback loop, trend intelligence |  |

The architecture supports all of the above from day 1. Only V1 components are built.

---

## 2. RELATIONSHIP TO eLEARN AIOS

CreatorOS is a **clean fork** of eLearn AIOS:

- **Core (`src/lib/core/`)** is preserved verbatim. Loop Engine, Agentic System, Human Review System, Model Management System (MMS) — all reused with zero changes. One additive change: a 5th loop pattern (`cross-critique`) is added to the catalog. This is an additive Core enhancement, not a rewrite. eLearn AIOS inherits it too.
- **Domain (`src/lib/domain/workflows/`)** is deleted and rewritten. eLearn-specific concepts (Course, Module, Topic, Bloom, ADDIE, video pipeline, document pipeline) are gone. Replaced with creator-specific concepts (Persona, Niche, Idea, Long-Form Master, Repurpose, platform-aware artifact configs).
- **Database schema** is mostly new on the Domain side, but the same patterns (immutable artifacts, iteration records, stage sessions, cost ledger) are reused.

The architectural contract from eLearn AIOS holds: **`domain/` may import from `core/`. Never the reverse.** Enforced by `grep -r "from.*domain/" src/lib/core/` returning nothing.

---

## 3. ARCHITECTURAL CONTRACT (CARRIED FROM eLEARN AIOS)

### 3.1 The two categories

| Category | Path | Description |
|---|---|---|
| **Core** | `src/lib/core/` | Machinery. Domain-agnostic. Portable to any AIOS. Zero domain words anywhere. |
| **Domain** | `src/lib/domain/` | Configuration. CreatorOS-specific. Contains all creator concepts, business rules, agent prompts, rubric definitions, pipeline configs. |

### 3.2 The three-question test

For any new code, ask:

1. Would this change if we were building Film AIOS or Book AIOS instead? (Core = No, Domain = Yes)
2. Does it contain creator-specific words (persona, niche, repurpose, hook, etc.)? (Core = No, Domain = Yes)
3. Could another AIOS use it as-is? (Core = Yes, Domain = No)

Answers: No / No / Yes → Core. Any flip → Domain. When in doubt, it's Domain.

### 3.3 The eight principles (carried over)

1. **Event-Driven** — Every state change emits an event.
2. **Artifact-Centric** — Every output is an immutable, versioned artifact.
3. **Immutable History** — Past artifacts/iterations are never edited, only superseded.
4. **Agent Composability** — Agents are small, named, reusable. They use skills.
5. **Human Sovereignty** — Humans approve at every critical gate. AI suggests, human decides.
6. **Cost Transparency** — Every iteration tracks USD cost. Aggregates up the hierarchy.
7. **Graceful Degradation** — On failure, preserve state, resume from last stable point.
8. **User Sovereignty Over Defaults** — System suggests, never enforces. No compulsory artifact types.

---

## 4. THE SIX CORE SYSTEMS

Five reused from eLearn AIOS. One (Context) promoted from "future" to V1 minimum-viable. One (Loop Engine) gets the cross-critique pattern added.

```
src/lib/core/
├── engine/        ← System 1: Loop Engine  (gets cross-critique pattern added)
├── agentic/       ← System 2: Agentic System  (unchanged)
├── review/        ← System 3: Human Review System  (unchanged)
├── models/        ← System 5: Model Management System (MMS)  (unchanged)
├── context/       ← System 6: Context Engineering  (NEW for V1, thin-but-present)
└── (future)       ← tools/, prompts/, marketplace/
```

### 4.0 The three engineering layers (mental model)

The Core systems map onto a well-known mental model for AI engineering. We adopt this as the framing language for the project.

```
┌─────────────────────────────────────────────────────────────────────┐
│ HARNESS ENGINEERING — the machine                                    │
│ (System 1: Loop Engine. The Gather → Act → Verify cycle.)           │
│                                                                      │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │ CONTEXT ENGINEERING — the memory                            │    │
│   │ (System 6: Context. Curate what stays in the window.)       │    │
│   │                                                              │    │
│   │   ┌──────────────────────────────────────────────────┐      │    │
│   │   │ PROMPT ENGINEERING — the message                  │      │    │
│   │   │ (System 2: Agentic + future System 7: Prompts.    │      │    │
│   │   │  Role, instructions, examples, format.)            │      │    │
│   │   └──────────────────────────────────────────────────┘      │    │
│   └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Mapping:**
- **Prompt engineering** lives inside the Agentic System. Each agent persona doc is the message. Unit of work: one input.
- **Context engineering** is System 6. The Curator decides what to keep in the LLM's context window across iterations and across stages. Unit of work: what stays in the window.
- **Harness engineering** is the Loop Engine + Human Review System working together. The Gather (curate context) → Act (`produce()`) → Verify (`evaluate()`) → Retry (`runLoop()`) → Present (`processReview()`) cycle. Unit of work: the machine.

Prompt and Context engineering both live *inside* the Gather phase of the Harness. Zoom out and you see the machine. Zoom in and you're back at the prompt.

### 4.1 Loop Engine (System 1)

Universal loop runner: `produce → evaluate → runLoop → processReview`. Receives a stage config, executes the loop, returns updated state. Knows nothing about CreatorOS. Agents and judges are injected dependencies.

**Loop patterns supported:**

| Pattern | Used by | Description |
|---|---|---|
| `standard` | Research, Long-Form Master | One agent iterates against a rubric until threshold passes. |
| `strategic` | (not used in V1) | Research → plan → confirm goal → production loop. |
| `tournament` | (not used in V1) | N producers in parallel, judge picks winner. |
| `nested` | (not used in V1) | Agent runs an inner plan-execute-replan cycle. |
| **`cross-critique`** | **All repurposed artifacts (LinkedIn, article)** | **NEW. Two producers + mutual critique + integration + third-model judge. See §5.** |

**Loop rules (universal):**

1. Minimum 2 iterations enforced even if v1 scores above threshold.
2. Track `bestArtifact` and `bestGrade` across iterations. Present best on escalation, not last.
3. Checkpoint after every iteration. Immutable IterationRecord.
4. Dimension-aware revision: preserve dimensions scoring ≥8, improve those <8.
5. Human feedback applied once, then cleared.
6. Deterministic validators (word count, format) run BEFORE expensive LLM judge.
7. Cross-model judging: producer ≠ judge.
8. Cost tracking on every iteration.
9. Graceful degradation: on failure, preserve state.

### 4.2 Agentic System (System 2)

Pure execution machinery for agents. Knows how to call an LLM with an agent config, track cost, handle retries, parse output. Doesn't know what agent it's running. Reused as-is.

### 4.3 Human Review System (System 3)

Universal gate enforcement. Five review actions:

| Action | Behavior |
|---|---|
| `approve` | Lock best artifact. Stage complete. |
| `reject` | Clear context. Fresh start. |
| `feedback` | Inject feedback into next iteration's context. |
| `inline_edit` | Human edits artifact directly. Implicit approval. |
| `use_segments` | Lock approved segments, regenerate rejected segments. |

CreatorOS V1 uses: approve, feedback, reject, inline_edit. (`use_segments` deferred to V2.)

### 4.4 Model Management System (System 5)

Single gateway for all AI calls across all providers. Manages cost ledger, routing, rate limiting, health monitoring. Reused as-is. CreatorOS adds provider entries for its models:

- **Producer text:** Claude Sonnet (Anthropic)
- **Producer text (parallel):** GPT-4o (OpenAI)
- **Critic / Judge:** Gemini (Google)
- **Image generation (V2):** FLUX via fal.ai, NanoBanana via Freepik
- **Embedding (V2 search):** OpenAI text-embedding-3-large
- **TTS / Voice (V4+):** ElevenLabs
- **Video (V4+):** Runway, Kling

### 4.5 Context Engineering System (System 6) — NEW for V1

**Purpose.** When multi-stage pipelines pass artifacts between stages, the LLM context window fills with stale tool outputs, prior-turn debris, and bulky reference material. Without curation, the model's attention degrades on the things that actually matter. Important details get buried.

The Context System gives the platform a structured way to *select what stays, compress what is useful but bulky, and drop the rest* before each LLM call. It is machinery (Core), not configuration (Domain).

**V1 scope (deliberately thin).** Just the seam. One interface, one default implementation, zero curation logic. The point is to have the architectural boundary in place so future curation can slot in without rework.

```typescript
// core/context/types.ts

interface ContextSource {
  id: string                  // 'user_query' | 'system_prompt' | 'retrieved_docs' | 'tool_outputs' | 'memory' | 'prior_turns'
  content: unknown
  priority: number            // hint for the curator
  byteSize: number            // for budget tracking
}

interface ContextCurator {
  curate(
    sources: ContextSource[],
    budget: { maxTokens: number; maxBytes?: number }
  ): Promise<CuratedContext>
}

interface CuratedContext {
  kept: ContextSource[]       // included verbatim
  compressed: ContextSource[] // summarized
  dropped: ContextSource[]    // removed entirely
  metadata: {
    originalTokens: number
    finalTokens: number
    decisions: Array<{ sourceId: string; action: 'kept' | 'compressed' | 'dropped'; reason: string }>
  }
}
```

**V1 default implementation: `PassthroughCurator`.** Trusts the agent prompt to handle context. Concatenates all sources up to budget; if over budget, drops lowest-priority sources first. No compression. No LLM-based summarization. Zero added latency.

**V2+ extensions (planned).**
- `LLMSummarizationCurator` — uses a cheap model to summarize bulky sources (e.g., a 50-page uploaded PDF) into key facts before feeding into the producer's window.
- `RelevanceRankingCurator` — uses embeddings to rank retrieved sources by relevance to the current task, keeping top-N.
- `IterationAwareCurator` — knows which sources have been seen by prior iterations; drops repeats, keeps novel info.

**Where it lives in the pipeline.**

```
Stage 3: Long-Form Master Build
  ├─ inputs:  ResearchDossier (10-30 sources) + Persona + Idea + uploaded docs
  ├─ Context Curator:  decide which sources go into Long-Form Synthesizer's prompt
  └─ Loop Engine produce(): synthesizer agent runs with curated context

Stage 5: LinkedIn Post Generation
  ├─ inputs:  LongFormMaster (potentially huge) + Persona + LinkedIn config
  ├─ Context Curator:  select sections of Long-Form Master relevant to short-form
  └─ Cross-Critique loop: producers run with curated subset, not full Master
```

**The import rule still holds.** `core/context/` has zero imports from `domain/`. Domain decides *which* curator to use per stage; Core knows nothing about LinkedIn or Long-Form Masters.

---

## 5. THE NEW LOOP PATTERN: CROSS-CRITIQUE

This is the single Core enhancement CreatorOS introduces. It is added to the Loop Engine's pattern catalog and immediately usable by every AIOS.

### 5.1 The V1 pattern

```
Iteration N=1:
  • Producer A (Claude Sonnet) → generates Version_A
  • Producer B (GPT-4o)        → generates Version_B  (parallel)
  • Critic on B (Claude)        → reads Version_B, outputs Critique_B
                                  (what's aligned, what's not, what to fix)
  • Critic on A (GPT-4o)        → reads Version_A, outputs Critique_A
  • Integrator (Claude)         → reads Version_A, Version_B, Critique_A, Critique_B
                                → synthesizes Version_Synth (best of both + corrections)
  • Judge (Gemini)              → grades Version_Synth against rubric
                                → returns GradeReport with per-dimension scores

Iteration N=2..MaxIter:
  IF Judge score ≥ threshold AND iterations ≥ minIter → present to human
  ELSE
    • Producer A re-generates with critique + previous best as context
    • Producer B re-generates with critique + previous best as context
    • Critique → Integrate → Judge cycle repeats

Termination:
  • Threshold passed AND min iterations met → present best
  • Max iterations reached → escalate best to human with rationale
```

### 5.2 Configuration fields (added to LoopStage)

```typescript
interface CrossCritiqueConfig {
  producers: AgentConfig[]      // Usually 2 (Claude + GPT-4o)
  criticAssignments: {           // Who critiques whom
    [criticAgentId: string]: string  // critic → target producer
  }
  integratorAgent: AgentConfig   // Synthesizes versions + critiques
  judgeAgent: AgentConfig        // Final rubric grader (different model)
  rubric: RubricDefinition
  threshold: number
  maxIterations: number
  minIterations: number          // default 2
}
```

### 5.3 Why this pattern

- **Synthesis beats selection.** A judge picking between A and B loses the strengths of the loser. The integrator combines strengths.
- **Cross-model perspective catches model-specific blind spots.** Claude and GPT have different failure modes. Their critiques surface what each missed.
- **Third-model judging eliminates self-preference bias.** Gemini grading what Claude and GPT made keeps the loop honest.

### 5.4 V2+ exploration

The user wants 3-4 cross-critique patterns explored after V1 ships. Candidates:

- **Sequential relay:** A → critique by B → A integrates → critique by C → A integrates → judge.
- **Triadic mutual:** Three producers all critique all others, all integrate, judge picks.
- **Adversarial debate:** Two producers argue against each other's version. Moderator synthesizes.
- **Critique-only loop:** One producer, multiple cross-model critics, single integrator.

These are designed in V1, stub-implemented behind feature flags, A/B tested in V2.

---

## 6. DOMAIN MODEL (CreatorOS-SPECIFIC)

### 6.1 Entity hierarchy

```
User (one human)
  └── CreatorPersona [1..N]  — "BuildOS persona", "AgriOS persona", "MediOS persona"
       │
       └── Workspace [1..N]   — a project container (e.g., "Agentic AI LinkedIn series")
            │
            ├── Niche tags (e.g., "AI in agriculture", "AI in education")
            │     (used as tags on ideas; not a strict hierarchy)
            │
            ├── IdeaLog
            │    └── Idea [1..N]  — captured idea entries with niche tags + status
            │
            ├── LongFormMaster [1..N]  — one per idea taken to production
            │    └── ResearchSources [1..N]  — traceability: URLs, uploaded docs, queries used
            │
            └── Artifact [1..N]  — repurposed deliverables
                 ├── linkedin_post
                 ├── long_form_article
                 └── (V2+: blog_post, newsletter, x_post, x_thread, image_post, carousel, ...)
```

### 6.2 Entity definitions

**User** — the human. Has account credentials. Owns Personas.

**CreatorPersona** — an authoring identity. The user picks which persona to use when producing content. The persona drives:
- Voice & tone document (free-text + structured fields: formality, vocabulary, signature phrases, do-not-say)
- Audience profile (who this persona writes for: role, level, interests, pain points)
- Creator profile (who this persona is: bio, expertise areas, POV, hooks)
- Default rubrics (what "good" looks like for this persona)

A user typically has one persona per niche (BuildOS persona for AI-OS content, MediOS for medical AI, etc.), but architecturally personas and niches are decoupled. A persona could span multiple niches; a niche could be served by multiple personas.

**Workspace** — a project container. Picks one CreatorPersona on creation. Holds an IdeaLog, LongFormMasters, and Artifacts for that persona's work.

**Niche** — a tag. Free-text or selected from a tenant-level list. Used on Ideas for organization (so the user can browse "AI in agriculture" ideas vs "AI in medicine" ideas). Not a hierarchy parent. Multi-tag is allowed.

**IdeaLog** — the queue. Minimal CRUD: title, description, niche tag(s), source URL (optional), status (`captured` | `in_progress` | `completed` | `archived`), timestamps. Edit, delete, mark complete. Sort by date / niche / status.

**Idea** — one entry in the log. Can be promoted to a Workspace pipeline (becomes the seed for Research → Long-Form Master → Artifacts).

**LongFormMaster** — the living raw-material asset for one idea:
- Multi-modal content: text sections, embedded image references, transcript excerpts, source quotes, data tables.
- Built from research sources. Every source is traced (URL, type, fetched-at, summary).
- Inline-editable like a Word document.
- V1: no versioning, single saved state.
- V2+: versioned, diff-tracked, change-detection-triggered regeneration of downstream artifacts.

**Artifact** — a publishable deliverable. Platform-aware. Each artifact type has its own config (character limits, format rules, style, structure). All artifacts are inline-editable. All can be regenerated.

### 6.3 V1 artifact types

| Type | Platform | Length | Constraints |
|---|---|---|---|
| `linkedin_post` | LinkedIn | 1,300-3,000 chars (long-form) | Hook in first 3 lines; line breaks for scannability; closing CTA optional |
| `long_form_article` | Blog / LinkedIn Article / Substack | 1,200-3,000 words | Heading hierarchy, intro/body/conclusion, scannable |

V2+ artifact types are designed but not implemented in V1.

### 6.4 Memory architecture (four types)

Every agentic system has four kinds of memory. CreatorOS handles all four, but the mechanisms and storage backends differ. This section names them explicitly so the architecture is self-documenting.

| Memory type | Lifespan | Where it lives in CreatorOS | V1 status |
|---|---|---|---|
| **Short-term** (the LLM's working context) | Within one LLM call | Inside the producer / critic / judge prompts during one Loop Engine iteration | ✅ Implicit |
| **Episodic** (the session history) | Within one Workspace's pipeline run | `IterationRecord[]` on `StageSession` + `humanFeedback[]` + reviewer comments. Survives crashes, can be resumed. | ✅ V1 |
| **Knowledge Base** (curated, persistent reference) | Persistent across pipeline runs | `CreatorPersona` (voice DNA, audience, brand rules), `LongFormMaster` (per-topic raw material), Skills library (procedure knowledge), uploaded reference documents | ✅ V1 |
| **Long-term semantic** (retrievable by similarity) | Persistent + searchable | **Not in V1.** V2 adds PostgreSQL `pgvector` + embedding index over Long-Form Masters, past Ideas, past Artifacts. Enables: "show me related past content," "find similar voice samples." | ❌ V2 |

**Why we call this out.**

Most failures in long-running agent systems trace back to one of these memory types being either absent or misnamed. By naming them explicitly:

- We see that V1's gap is *long-term semantic memory* (no Vector DB). For one workspace with one Long-Form Master and one LinkedIn post, this is fine. It becomes a problem the moment the creator has 20 past posts and wants the system to *learn from their archive* during new production.
- We see that *Knowledge Base* memory is already well-distributed across CreatorPersona, LongFormMaster, and Skills. We don't need a new system — we need to make sure the Context Curator (System 6) knows how to pull from each.
- We see that *Episodic* memory in the Loop Engine is already best-in-class because of `IterationRecord` immutability and best-version tracking.

**V2 plan for long-term semantic memory.**

Add `pgvector` extension to the PostgreSQL DB. Embed:
- Every saved Long-Form Master section (chunked, 512-token chunks)
- Every approved Artifact (linkedin_post, long_form_article, ...) with persona + niche metadata
- Every Idea description in the Idea Log

Provide a `SemanticRetrieverCurator` (one of the Context Engineering System's curator implementations) that, given a new Idea, retrieves top-K most similar past work for grounding context. This becomes how the producer "knows what Srinivas sounds like" automatically — no manual style-guide updates needed.

---

## 7. V1 PIPELINE (LINEAR, ONE LOOP)

The V1 production flow. Strictly linear, gated by two human reviews.

```
STAGE 0 — Persona Setup (one-time per persona, reused)
  Inputs: User describes their persona (free-text + structured fields)
  Loop:   Standard loop. Agent helps user articulate voice/audience.
  Output: CreatorPersona object (saved to user account)
  Gate:   No human gate — implicit save when user confirms

STAGE 1 — Idea Capture / Selection
  Inputs: User types ideas into IdeaLog OR picks an existing idea
  Loop:   None — direct CRUD operation
  Output: Selected Idea promoted to Workspace pipeline
  Gate:   No gate

STAGE 2 — Research
  Inputs: Selected Idea + CreatorPersona context + (optional) user-uploaded docs
  Loop:   Standard loop. Agent researches via web search + reads uploaded docs.
          Rubric: relevance, coverage, source quality, factual grounding.
  Output: ResearchDossier — list of sources with extracts + summaries
          Every source traced (URL, type, snippet, why_relevant)
  Gate:   No gate (passes silently into Stage 3)

STAGE 3 — Long-Form Master Build
  Inputs: ResearchDossier + Persona + Idea
  Loop:   Standard loop. Agent synthesizes research into the multi-modal raw-material asset.
          Rubric: comprehensiveness, accuracy, alignment to persona, traceability completeness.
  Output: LongFormMaster (text-primary, references to source materials)
  Gate:   GATE A — Human reviews the Long-Form Master.
          Required UI: source traceability panel (every claim/section linked to its source).
          Actions: approve | feedback | reject | inline_edit
          On approve → unlock Stage 4.

STAGE 4 — Repurpose Target Selection
  Inputs: Approved LongFormMaster
  Loop:   None — direct UI selection
  Output: List of artifact types to generate (V1: linkedin_post, long_form_article, or both)
  Gate:   No gate (user-driven selection IS the gate)

STAGE 5 — Artifact Generation (per type)
  Inputs: LongFormMaster + Persona + Artifact-type config (LinkedIn rules / article rules)
  Loop:   CROSS-CRITIQUE loop.
          Producer A: Claude. Producer B: GPT-4o. Integrator: Claude. Judge: Gemini.
          Rubric: persona-fit, audience-fit, platform-fit, hook strength, structural quality, completeness.
          Min 2 iterations, threshold 80, max 4 iterations.
  Output: Best artifact + iteration history
  Gate:   GATE B — Per artifact. Human reviews.
          Actions: approve | feedback | reject | inline_edit
          On approve → artifact locked. On inline_edit → save as final.

STAGE 6 — Save & Done
  Inputs: Approved artifacts
  Loop:   None
  Output: Artifacts in workspace, downloadable, marked Idea complete
  Gate:   None
```

### 7.1 Stage gate summary

| Gate | Where | What the human approves | Required UI |
|---|---|---|---|
| **Gate A** | After Long-Form Master | Knowledge base quality | **Source traceability panel** (non-negotiable) |
| **Gate B** | After each repurposed artifact | The publishable output | Inline editor, regenerate button |

---

## 8. MVP SCOPE (PRECISE IN / OUT)

### 8.1 In V1

- One human user, multi-creator team support with roles (writer / editor / reviewer / admin) in the workspace
- One workspace = one CreatorPersona = one pipeline at a time
- CreatorPersona CRUD (create, edit, delete, list)
- Niche tags (free-text, list per workspace)
- IdeaLog with minimal CRUD
- Research stage: web search (one API) + user-uploaded docs (text/PDF)
- LongFormMaster: built, saved once, inline-editable
- Source traceability panel
- Repurpose to 2 artifact types: linkedin_post + long_form_article
- Cross-critique loop (one pattern: Claude + GPT producers, mutual critique, Claude integrator, Gemini judge)
- Inline editing on ALL artifacts (Master + LinkedIn post + article)
- Regenerate button on ALL artifacts
- Cost tracking per iteration → workspace total
- 2 human gates (A, B)
- Audit log of every loop iteration

### 8.2 Out of V1 (designed-in, built later)

| Feature | Phase |
|---|---|
| Long-Form Master versioning + diff tracking | V2 |
| Change-detection-triggered artifact regeneration | V2 |
| Additional artifact types: blog post, newsletter, X post, X thread, image post, carousel | V2 |
| Multi-pattern cross-critique testbed (3-4 variants) | V2 |
| Multi-modal research (YouTube transcripts, audio, books, images) | V2 |
| Scheduling UI (calendar, post-at-time) | V3 |
| Platform publishing APIs (LinkedIn, X, Meta, YouTube) | V3 |
| Performance feedback loop (analytics → next ideation) | V3+ |
| Trend intelligence (scrape trending hashtags / formats) | V3+ |
| Short-form video (Reels / Shorts) | V4 |
| Long-form video + podcast | V4 |
| Voice cloning + avatar consistency | V4 |
| Multi-tenant SaaS (org isolation, billing) | V5+ |

---

## 9. THE V1 ACCEPTANCE TEST

The single test that defines "CreatorOS V1 works":

> **Persona:** "BuildOS Creator" — Srinivas's authoring identity for content about building AI operating systems.
>
> **Niche:** AI / Agentic AI / AI Engineering
>
> **Idea:** "Agentic AI development" as a LinkedIn series. Agents propose multiple specific topic titles under this umbrella; user picks one (e.g., "Why sequential cross-critique beats tournament for content generation").
>
> **Pipeline run:** Idea → Research → Long-Form Master → 1 LinkedIn post + 1 long-form article.
>
> **Pass criteria:**
> 1. The Long-Form Master contains traceable sources (every section linked to a URL or uploaded doc).
> 2. The LinkedIn post is one Srinivas would publish without editing.
> 3. The long-form article is one Srinivas would publish without editing.
> 4. The cross-critique loop produced substantively different versions across iterations — mechanized as cosine similarity ≤ 0.92 between consecutive integrated artifacts (via `text-embedding-3-large`).
> 5. The full run completed in under 30 minutes, under $5 cost.
>
> **Fail criteria:** Any output that requires substantial human rewrite means V1 isn't done. We tune until the test passes consistently.

This is THE bar. Not "it works." It's "Srinivas hits publish."

---

## 10. PHASED ROADMAP (BEYOND V1)

### V2 — Expand the surface
- Add: blog post, newsletter, X post, X thread, image post, carousel artifact types
- Add: Long-Form Master versioning + diff UI + change-detection trigger
- Add: Multi-pattern cross-critique testbed (build 3 variants, A/B test, pick winner)
- Add: YouTube transcript ingestion for research

### V3 — Scheduling & publishing
- Add: Calendar UI (drag to schedule, "post at X time")
- Add: Platform publishing APIs starting with LinkedIn, then X, then Meta
- Add: Performance feedback loop V1 (manual labeling — "this performed well/badly" → learns)

### V4 — Video
- Add: Short-form video pipeline (Reels/Shorts: script → image gen → video gen → assembly)
- Add: Long-form video pipeline (YouTube structure)
- Add: Voice cloning (ElevenLabs of creator's actual voice)
- Add: Podcast episode pipeline

### V5+ — Platform
- Add: Multi-tenant SaaS (org isolation, billing per workspace, role-based access)
- Add: Trend intelligence subsystem (Core)
- Add: Marketplace for creator personas, rubric packs, prompt packs

---

## 11. CARRY-OVER FROM eLEARN AIOS

### 11.1 What we lift (Core — verbatim)

| Asset | Path | Why |
|---|---|---|
| Loop Engine | `src/lib/core/engine/` | Universal. Zero changes. |
| Agentic System | `src/lib/core/agentic/` | Universal. Zero changes. |
| Human Review System | `src/lib/core/review/` | Universal. Zero changes. 5 actions. |
| Model Management System | `src/lib/core/models/` | Universal. Add new model entries for Gemini. |
| Cost ledger | (part of MMS) | Append-only, audit trail. |
| Loop rules (all 9) | (part of engine) | Min 2 iter, best-version, dim-aware revision, etc. |
| Producer ≠ Judge discipline | (engine rule) | Universal. |
| Architectural contract | `CLAUDE.md` | Carried as-is. |
| Three-question test | (process) | Carried as-is. |
| Eight principles | (process) | Carried as-is. |

### 11.2 What we extend (Core — additive)

| Asset | Change |
|---|---|
| Loop Engine pattern catalog | Add `cross-critique` as 5th pattern. eLearn AIOS gets it too. |

### 11.3 What we delete and rewrite (Domain)

| eLearn Asset | CreatorOS Replacement |
|---|---|
| `domain/workflows/archetypes.ts` (K-12, Professional, Channel) | New archetypes (BuildOS persona archetype, multi-niche persona archetype) |
| `domain/workflows/component-registry.ts` (study_material, video, quiz, ...) | New artifact registry (linkedin_post, long_form_article, ...) |
| `domain/workflows/rubrics/` (Brief, Audience, Structure, Components) | New rubrics (Persona Voice, Audience Fit, Platform Fit, Hook Strength, Article Structure) |
| `domain/workflows/ideation/` (5-stage Phase 0) | New CreatorOS pipeline (Persona → Idea → Research → Master → Repurpose) |
| `domain/workflows/production/` (Document/Assessment/Video/Activity/Capstone pipelines) | New production: Research stage + LongFormMaster stage + per-artifact stages |
| `domain/workflows/agents/` (Curriculum Strategist, Bloom Classifier, etc.) | New agents (see §12) |

### 11.4 What we DO NOT touch

- The discipline of LE-step-by-step development (one step per session, commit + tag, no scope creep)
- The discipline of 80%+ test coverage on Core
- The discipline of `grep -r "from.*domain/" src/lib/core/` returning nothing

---

## 12. AGENT MAP (V1 — MINIMAL)

The V1 needs roughly 10-12 agents. Each is a structured persona document (YAML or TS) with: identity, mission, skills, model, behaviors, quality criteria.

### 12.1 V1 agents

| Agent | Stage | Role |
|---|---|---|
| **Persona Setup Assistant** | Stage 0 | Helps user articulate their CreatorPersona via guided conversation |
| **Idea Coach** | Stage 1 | (Optional) Proposes topic titles under a niche umbrella |
| **Research Agent** | Stage 2 | Executes web search + reads uploaded docs + extracts source summaries |
| **Source Curator** | Stage 2 | Filters research output for relevance, deduplicates, ranks |
| **Long-Form Synthesizer** | Stage 3 | Builds the LongFormMaster from research |
| **LinkedIn Producer A (Claude)** | Stage 5 | First producer in cross-critique |
| **LinkedIn Producer B (GPT-4o)** | Stage 5 | Second producer in cross-critique |
| **LinkedIn Critic (Claude on B / GPT on A)** | Stage 5 | Mutual critique role (same agent prompt, applied to other's output) |
| **LinkedIn Integrator (Claude)** | Stage 5 | Synthesizes A + B + critiques into final version |
| **LinkedIn Judge (Gemini)** | Stage 5 | Rubric grading |
| **Article Producer / Critic / Integrator / Judge** | Stage 5 | Same pattern, article-specific prompts |

(For V1, the LinkedIn and Article agent sets are largely identical in machinery — only their system prompts and rubrics differ.)

### 12.2 Agents not in V1 (deferred)

Brand Voice Guardian, Hook Engineer, Carousel Designer, Image Prompt Engineer, Newsletter Editor, Video Storyboarder, Voice Director, Music Selector, Caption Writer, Thumbnail Designer, Performance Analyst, Trend Scout, Platform Optimizer.

### 12.3 Agent composition patterns (which we use, which we don't)

There are three canonical patterns for connecting multiple agents. CreatorOS deliberately uses one as primary, leaves room for the others.

**Pattern 1 — Agent-to-Agent (direct handoff).** Agent A finishes, hands its output directly to Agent B. Simple, works for 2-3 agents, breaks down without coordination. **Not used in CreatorOS.** Too brittle for production pipelines.

**Pattern 2 — Orchestrator (one LLM coordinates all).** A top-level coordinator dispatches work to specialist agents, collects results, decides what's next. **Primary CreatorOS pattern.** The Pipeline Orchestrator in `core/engine/` plus the Domain Workflow's stage sequencing implements this. Every V1 stage transition is orchestrator-driven.

**Pattern 3 — Sub-agent (agents as tools for other agents).** A main agent calls another agent the way it would call an API — but the sub-agent can reason and adapt. Best when sub-tasks need judgment, not just execution. **Available but not used in V1.** Reserved for V2+ scenarios:

- A Research Agent that, mid-research, decides "this claim needs a deep fact-check" and invokes a FactCheck sub-agent inline.
- A Long-Form Synthesizer that calls a Diagram Designer sub-agent when it encounters a section that would benefit from a visual.
- An Article Producer that calls a Citation Finder sub-agent when it needs to back up a specific claim.

Sub-agent composition fits naturally when we eventually adopt the Anthropic Agent SDK for the Research stage (see §16) — the SDK's tool-use mechanism makes sub-agents callable as tools.

**Architectural note.** All three patterns sit on top of the Loop Engine. The pattern choice is a Domain decision — Core doesn't know or care. Switching from Orchestrator to Sub-agent for any specific stage requires no Core changes.

---

## 13. RUBRIC LIBRARY (V1)

> **Superseded by `docs/02-domain/rubrics.md`** (authoritative). The summaries below are stale where they differ: the LinkedIn and Article rubrics each have **6** dimensions with an explicit `completeness` ≥ 0.20 (Forge ADOPT 6), and thresholds are expressed on the 0–100 composite scale (75/80), not "8.0".

Each rubric's dimension scores are 1-10, weights sum to 1.0.

### 13.1 Research rubric
- Relevance (0.25)
- Coverage breadth (0.20)
- Source quality (0.20)
- Factual grounding (0.20)
- Traceability completeness (0.15) — every claim has a source link

### 13.2 Long-Form Master rubric
- Comprehensiveness (0.25)
- Accuracy (0.20)
- Persona voice alignment (0.20)
- Structural coherence (0.15)
- Source attribution completeness (0.20)

### 13.3 LinkedIn Post rubric
- Hook strength (first 3 lines) (0.25)
- Persona voice fidelity (0.20)
- Audience fit (0.15)
- Structural scanability (line breaks, length, flow) (0.15)
- Completeness & coherence (0.15)
- Platform-specific compliance (char count, format) (0.10)

### 13.4 Long-Form Article rubric
- Hook & opening (0.15)
- Structural quality (heading hierarchy, flow) (0.20)
- Persona voice fidelity (0.20)
- Depth & substance (0.20)
- Completeness (intro / body / conclusion) (0.15)
- Polish (grammar, scanability) (0.10)

---

## 14. OPEN QUESTIONS FOR BUILD PHASE

These are not blockers — they get resolved during implementation by experimentation.

1. **Cross-critique cost ceiling.** A 3-iteration cross-critique with 5 agents per iteration could hit $1-2 per artifact. What's the per-artifact budget cap? Auto-escalate at what cost?
2. **Persona learning from past posts.** V1 ships persona as user-described. V2 question: ingest past posts and auto-extract voice patterns. How much improvement does this give vs the cost of building it?
3. **The 3-4 cross-critique pattern variants for V2 testing.** Designed in V1 spec, built as feature-flagged stubs in V2.
4. **Niche taxonomy.** V1 is free-text tags. Do we ever introduce a curated niche tree? Probably no — keep it flat.
5. **Idea promotion criteria.** When an Idea moves from log to active pipeline, what UX? Single click? Confirm modal with niche/persona selection? Decide during build.
6. **Inline edit conflict with regenerate.** If user inline-edits an artifact, then clicks regenerate, what happens to their edits? Three options: discard, merge, fork. Decide during build.

---

## 15. THE DOCUMENT STARTING POSITION

This is the single doc to read first when opening the CreatorOS project. It defines the system identity, scope, and architecture. Every other doc carried over from eLearn AIOS is referenced from here.

When starting a Claude Code session in CreatorOS:

1. Read this document first.
2. Read `CLAUDE.md` (architectural contract carried from eLearn AIOS).
3. Read `VOVAI_Core_vs_Domain_Framework.md`.
4. Read `recursive-loop-engine.md`.
5. Then begin work.

The V1 implementation plan will be authored in a separate document (`CreatorOS_V1_Action_Plan.md`) once this context is loaded into the new project and a fresh planning conversation happens there.

---

## 16. RELATIONSHIP TO ANTHROPIC PRIMITIVES

The VOVAI Platform is a *higher-level orchestration layer* built on top of Anthropic's primitives. We use what fits, build what doesn't exist, and stay vendor-independent at the points that matter.

### 16.1 The three things Anthropic ships (and which we use)

| Anthropic primitive | What it is | CreatorOS posture |
|---|---|---|
| **Claude Code** | Developer CLI tool | Used to *build* CreatorOS. Never embedded in CreatorOS as a runtime. |
| **Claude Agent SDK** (Python/TS library) | Embeddable agent loop with tools (bash, files, web, MCP) | Used selectively. The Research stage uses it as the inner agent executor. Other stages use our own producer functions. |
| **Claude Managed Agents + Outcomes** (hosted service) | Hosted sandboxed agent runtime with rubric-grading loop | NOT used as our runtime. Vendor lock + Claude-only + single-stage + per-session pricing don't fit multi-tenant SaaS. We *borrow patterns* from it. |
| **Anthropic Python/TS SDK** | Direct LLM API client | Used everywhere for actual Claude calls. We do not write raw HTTP to Anthropic. |
| **MCP (Model Context Protocol)** | Tool integration standard | Used for production tool integration in V2+. |
| **Agent Skills standard** (agentskills.io) | Open format for skill packs (SKILL.md folders) | Adopted as our skill packaging format when we build Skills system (post-V1). |

### 16.2 Patterns we adopt from Outcomes (without depending on it)

Two specific design patterns from Anthropic Outcomes that we bake into our Loop Engine if not already there:

1. **The judge runs in a completely fresh context window** with only the rubric and the artifact. No conversation history. No producer's reasoning trace. This prevents the judge from being "talked into" passing a borderline artifact. Our existing cross-model judging discipline should be verified to enforce this strictly.

2. **The producer never sees the rubric.** It only sees targeted feedback from the judge ("here's what didn't meet the bar: [list]. Revise."). This prevents the producer from gaming the rubric structure instead of solving the underlying problem. PRESERVE/IMPROVE feedback works inside this rule.

### 16.3 Where we use the Agent SDK

The Research stage is the natural fit. A research agent needs to:
- Web-search autonomously
- Read uploaded PDFs / markdown / text
- Follow links, decide what's relevant
- Loop multiple times based on what it discovers

Building this with raw API calls is weeks of work. The Agent SDK gives us the tool-using loop for free. We wrap it as the `produce()` function inside the Loop Engine's Standard pattern for Stage 2 (Research). Everything outside Stage 2 stays on our own primitives.

### 16.4 Where Anthropic does not have what we need

These are the parts of CreatorOS that Anthropic genuinely does not provide and we must build:

- **Multi-provider model gateway (MMS).** Anthropic's primitives are Claude-only. CreatorOS's cross-critique requires Gemini as judge and parallel GPT-4o producer. We need the gateway.
- **Tournament loop pattern.** N producers in parallel, judge picks winner. Outcomes is single-producer.
- **Cross-Critique loop pattern.** Two producers + mutual critique + integrator + third-model judge. Outcomes cannot model this.
- **Multi-stage production pipelines.** Outcomes is one rubric → one artifact. CreatorOS V1 has 6 stages with cross-stage dependencies and traceability.
- **Multi-tenant SaaS infrastructure.** Workspaces, role-based reviewers, per-workspace billing, team-shared assets. Not Anthropic's problem; ours.
- **Domain-specific orchestration.** The pipeline shape and rubric library for content production. Configuration, not infrastructure.

### 16.5 The strategic argument

The VOVAI Core's value is not that it does the grade-and-revise loop better than Outcomes. Anthropic will catch up at the primitive level over time. The value is that the Core is the *substrate* on which multiple multi-stage, multi-tenant, multi-provider AIOS products can be built (CreatorOS, eLearn AIOS, future Film/Book/Agri AIOS) without locking to any one provider and without rebuilding the orchestration for each new domain.

We adopt Anthropic primitives where they save us weeks. We keep our own infrastructure where it preserves portability, multi-provider freedom, and the orchestration patterns (Tournament, Cross-Critique, multi-stage gates) that don't exist anywhere else.

---

**End of Master Context Document v1.1**
**CreatorOS = VOVAI Core (5 reused + 1 new) + Cross-Critique pattern + creator-specific Domain.**
**One loop, executed excellently, is V1. Everything else is roadmap.**
**Adopted from Anthropic where they save us weeks. Built ourselves where we preserve portability.**
