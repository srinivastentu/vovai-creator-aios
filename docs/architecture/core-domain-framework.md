# VOVAI Platform — Core vs Domain Separation Framework
## The decision process for every new system, every new file, every new function

---

## The rule in one sentence

**Core is the verb. Domain is the noun.**

Core knows HOW to do things. Domain knows WHAT to do.
Core is the printer. Domain is the document.
Core is the kitchen equipment. Domain is the recipe.

---

## The three-question test

For any piece of code, ask these three questions:

| # | Question | Core answer | Domain answer |
|---|----------|-------------|---------------|
| 1 | Would this change if you switched from eLearning to Film AIOS? | No | Yes |
| 2 | Does this code contain any domain word? (curriculum, quiz, module, audience, video script, ADDIE, Bloom, SCORM, etc.) | No | Yes |
| 3 | Could another AIOS use this code as-is, zero edits? | Yes | No |

If answers are NO, NO, YES → core.
If ANY answer flips → domain.

If you're unsure, it's probably domain. Core should be obviously generic.

---

## The anatomy of every system

Every system — existing or future — splits the same way:

```
┌─────────────────────────────────────────────────────┐
│                    ANY SYSTEM                        │
│                                                     │
│   ┌──────────────────┐  ┌────────────────────────┐  │
│   │    MACHINERY      │  │    CONFIGURATION       │  │
│   │    (goes in core) │  │    (goes in domain)    │  │
│   │                   │  │                        │  │
│   │  • Interfaces     │  │  • Actual instances    │  │
│   │  • Executor       │  │  • Prompts / content   │  │
│   │  • Registry       │  │  • Domain-specific     │  │
│   │  • Framework      │  │    rules & policies    │  │
│   │  • Base classes   │  │  • Configurations      │  │
│   │  • Validators     │  │  • Wiring & mapping    │  │
│   │  • Utilities      │  │                        │  │
│   │                   │  │                        │  │
│   │  Zero domain      │  │  Full of domain        │  │
│   │  words anywhere   │  │  words everywhere      │  │
│   └──────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## System-by-system breakdown

### System: Loop Engine

| Component | Three-question test | Location |
|-----------|-------------------|----------|
| LoopStage<T> interface | No change for Film, no domain words, reusable as-is | core/engine/types.ts |
| LoopState<T> interface | No change for Film, no domain words, reusable as-is | core/engine/types.ts |
| runLoop() function | No change for Film, no domain words, reusable as-is | core/engine/loop-engine.ts |
| processReview() function | No change for Film, no domain words, reusable as-is | core/engine/loop-engine.ts |
| State machine transitions | No change for Film, no domain words, reusable as-is | core/engine/loop-engine.ts |
| 9 loop rules enforcement | No change for Film, no domain words, reusable as-is | core/engine/loop-engine.ts |
| ELEARN_IDEATION_STAGES config | Changes for Film, says "brief/audience/structure", Film can't use it | domain/workflows/ideation/pipeline-config.ts |
| Structure rubric (7 dims) | Changes for Film, says "curriculum coherence", Film can't use it | domain/workflows/rubrics/structure-rubric.ts |
| "threshold: 75, maxIterations: 5" for structure stage | eLearning-specific tuning | domain/workflows/ideation/pipeline-config.ts |

### System: Agentic System

| Component | Three-question test | Location |
|-----------|-------------------|----------|
| AgentConfig interface | No change for Film, no domain words, reusable as-is | core/agentic/types.ts |
| executeAgent() with retries + cost | No change for Film, no domain words, reusable as-is | core/agentic/executor.ts |
| Agent registry (register/get/list) | No change for Film, no domain words, reusable as-is | core/agentic/registry.ts |
| Model router (prefs > defaults) | No change for Film, no domain words, reusable as-is | core/agentic/model-router.ts |
| Cost tracker (tokens, USD) | No change for Film, no domain words, reusable as-is | core/agentic/cost-tracker.ts |
| Audience Analyst system prompt | 100% eLearning-specific, says "learner profiles" | domain/workflows/agents/audience-analyst.ts |
| Curriculum Strategist persona | 100% eLearning-specific, says "modules, topics, ADDIE" | domain/workflows/agents/curriculum-strategist.ts |
| Agent-to-stage mapping (which agent runs at which stage) | eLearning pipeline-specific | domain/workflows/ideation/pipeline-config.ts |

### System: Human Review System

| Component | Three-question test | Location |
|-----------|-------------------|----------|
| 5 ReviewAction types | No change for Film, no domain words, reusable as-is | core/review/types.ts |
| Gate enforcement (no approval without human) | No change for Film, no domain words, reusable as-is | core/review/gate.ts |
| Action validation (can't approve if not awaiting) | No change for Film, no domain words, reusable as-is | core/review/actions.ts |
| "SME reviews at D5, QA reviews at V16" | 100% eLearning-specific roles and stages | domain/workflows/ideation/pipeline-config.ts |
| "Instructional Designer reviews structure" | eLearning-specific reviewer assignment | domain/workflows/review-config.ts |

### System: Domain Workflow

| Component | Three-question test | Location |
|-----------|-------------------|----------|
| Everything | All eLearning-specific | domain/workflows/ |
| Pipeline orchestrator | Sequences eLearning-specific stages | domain/workflows/pipeline-orchestrator.ts |
| Archetype registry (k12, professional, channel) | eLearning-specific project types | domain/workflows/archetypes.ts |
| Component registry (video, quiz, study_material) | eLearning-specific deliverables | domain/workflows/component-registry.ts |
| Batch manager (videos in groups of 10) | eLearning-specific production rule | domain/workflows/production/batch-manager.ts |
| Certification logic (quiz + capstone + exam = cert) | eLearning-specific business rule | domain/workflows/certification.ts |
| Tree engine (course → module → topic → subtopic) | eLearning-specific hierarchy | domain/workflows/tree/ |

---

## Process for adding a new system

When you want to add a new system (Tools, Prompts, Context, Marketplace, etc.),
follow these 5 steps:

### Step 1: Name the system and write its one-sentence purpose

Example: "Tool System — manages external tool integrations
(FFmpeg, Pandoc, ElevenLabs API, browser automation)."

### Step 2: List every component of the system

Write down every file, function, interface, and config you think
this system needs. Don't filter yet — just list everything.

Example for Tool System:
- ToolDefinition interface
- ToolRegistry (register, get, list)
- ToolExecutor (run tool, handle errors, track time/cost)
- ToolResult interface
- FFmpeg video rendering tool
- Pandoc document conversion tool
- ElevenLabs voice synthesis tool
- fal.ai image generation tool
- Browser automation for SCORM testing
- Tool timeout and retry logic
- Tool health check / availability check
- Tool version management
- Per-project tool configuration (which voice, which image model)

### Step 3: Apply the three-question test to each component

Go through your list and ask the three questions for each item:

| Component | Changes for Film? | Domain words? | Reusable as-is? | Verdict |
|-----------|------------------|---------------|-----------------|---------|
| ToolDefinition interface | No | No | Yes | CORE |
| ToolRegistry | No | No | Yes | CORE |
| ToolExecutor | No | No | Yes | CORE |
| ToolResult interface | No | No | Yes | CORE |
| FFmpeg rendering | No | No | Yes | CORE |
| Pandoc conversion | No | No | Yes | CORE |
| ElevenLabs synthesis | No | No | Yes | CORE |
| fal.ai generation | No | No | Yes | CORE |
| Browser SCORM testing | Yes (Film doesn't use SCORM) | Yes ("SCORM") | No | DOMAIN |
| Timeout/retry logic | No | No | Yes | CORE |
| Health check | No | No | Yes | CORE |
| Version management | No | No | Yes | CORE |
| Per-project tool config | Yes (Film has different tools) | Possibly | No | DOMAIN |

### Step 4: Create the file structure

Place each component in the correct location:

```
src/lib/core/tools/                     ← Machinery
├── types.ts                            ← ToolDefinition, ToolResult
├── registry.ts                         ← register, get, list
├── executor.ts                         ← run, retry, timeout, cost
├── health.ts                           ← availability checks
└── integrations/                       ← Actual tool adapters (generic)
    ├── ffmpeg.ts                       ← Video processing (any domain)
    ├── pandoc.ts                       ← Document conversion (any domain)
    ├── elevenlabs.ts                   ← Voice synthesis (any domain)
    └── fal-ai.ts                       ← Image generation (any domain)

src/lib/domain/workflows/tools/         ← Configuration
├── tool-config.ts                      ← Which tools enabled per project type
├── scorm-browser-test.ts              ← eLearning-specific SCORM testing
└── voice-presets.ts                    ← eLearning-specific voice settings
```

### Step 5: Verify the import rule

Run this check BEFORE committing:

```bash
# No file in core/ imports from domain/
grep -r "from.*domain/" src/lib/core/
# Must return NOTHING

# domain/ can import from core/ — that's fine
grep -r "from.*core/" src/lib/domain/
# This is expected and allowed
```

---

## The same process applied to future systems

### Prompt System

| Core (machinery) | Domain (configuration) |
|-----------------|----------------------|
| PromptTemplate interface | "You are an expert instructional designer..." |
| PromptBuilder (assembles prompt from template + variables) | Audience Analyst prompt template |
| PromptRegistry (register, get, version) | Curriculum Strategist prompt template |
| PromptVersioning (A/B test, track which version) | Variable mappings (archetype → prompt section) |
| PromptAnalytics (which prompts produce best scores) | eLearning-specific prompt library |
| **Location:** src/lib/core/prompts/ | **Location:** src/lib/domain/workflows/prompts/ |

### Context System

| Core (machinery) | Domain (configuration) |
|-----------------|----------------------|
| ContextAssembler interface | "Brief + Audience + Structure = structure stage context" |
| ContextWindowManager (what fits in LLM call) | Cross-stage reference rules (docs before videos) |
| RAGRetriever interface | Which uploaded materials to retrieve per stage |
| ContextPrioritizer (rank context by relevance) | eLearning-specific context priority rules |
| **Location:** src/lib/core/context/ | **Location:** src/lib/domain/workflows/context/ |

### Marketplace System

| Core (machinery) | Domain (configuration) |
|-----------------|----------------------|
| PackDefinition interface | "ADDIE Framework Domain Pack" |
| PackRegistry (publish, discover, install) | eLearning prompt library packs |
| PackVersioning | eLearning rubric template packs |
| PackAnalytics (usage, ratings) | eLearning visual style token packs |
| **Location:** src/lib/core/marketplace/ | **Location:** src/lib/domain/workflows/marketplace/ |

---

## Common mistakes and how to catch them

### Mistake 1: Putting domain config in core because "it feels generic"

BAD: Putting `BRIEF_RUBRIC = { dimensions: [clarity, specificity, scope...] }` in core/engine/
because "rubrics are an engine concept."

The rubric INTERFACE (RubricDefinition) is core. The actual RUBRIC (Brief has 5 specific dimensions
with eLearning-specific criteria) is domain. The test: would Film AIOS use this exact rubric with
these exact dimensions? No. Domain.

### Mistake 2: Putting machinery in domain because "only eLearning uses it right now"

BAD: Putting the agent executor (retry logic, cost tracking) in domain/workflows/agents/
because "we only have eLearning agents right now."

The executor is pure machinery. It doesn't know what agent it's running. The test: would Film AIOS
need the same retry logic and cost tracking? Yes, exactly the same. Core.

### Mistake 3: Creating a domain-specific adapter and putting it in core

BAD: `core/agentic/elearn-agent-bridge.ts` — a file in core that maps eLearning agent IDs
to their implementations.

The bridge/adapter that connects core machinery to domain agents belongs in domain. The test:
does the filename contain a domain word ("elearn")? Yes. Domain.

CORRECT: `domain/workflows/agents/agent-bridge.ts`

### Mistake 4: Mixing machinery and config in the same file

BAD: A single file that defines both the ToolExecutor class AND the FFmpeg configuration
for eLearning video specs (1080p, 30fps, H.264).

Split it: executor in core/tools/executor.ts, video render config in domain/workflows/production/render-config.ts.

---

## Claude Code workflow for building a new system

When starting a Claude Code session to build a new system, use this prompt template:

```
Read CLAUDE.md. I'm adding a new system: [SYSTEM NAME].

Purpose: [one sentence]

Here are the components I've identified and their core/domain split:

CORE (src/lib/core/[system]/):
- [list machinery components]

DOMAIN (src/lib/domain/workflows/[system]/):
- [list configuration components]

I verified with the three-question test:
1. Would this change for Film AIOS? (Core = No, Domain = Yes)
2. Does it contain domain words? (Core = No, Domain = Yes)
3. Could another AIOS use it as-is? (Core = Yes, Domain = No)

Start with the core machinery. Create types first, then implementations.
Write tests. Verify: grep -r "from.*domain/" src/lib/core/ returns nothing.
```

---

## Summary

The framework is three things:

1. **The three-question test** — apply to every component to decide core vs domain
2. **The one import rule** — domain imports from core, never the reverse
3. **The five-step process** — name it, list components, test each, place correctly, verify imports

If you follow this for every system you add, the platform stays clean regardless
of how many systems you add. The pattern scales to enterprise level because
it's the same pattern at every layer — just "machinery vs configuration"
applied recursively.