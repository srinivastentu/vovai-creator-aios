# Agents and Persona Documents

> V1 has ~12 agents. Each is a structured **persona document** (Forge
> ADOPT 8 pattern), not a flat string prompt. Every agent has explicit
> sections for identity, mission, behaviors, quality criteria,
> constraints.

## V1 agent map

| Agent | Stage | Role | Model | Notes |
|---|---|---|---|---|
| Idea Coach | 1 (Optional) | Proposes 3-5 topic titles under a niche umbrella | Claude Sonnet | Single LLM call, no loop |
| Research Agent | 2 | Web search + reads uploads + extracts source summaries | Claude Sonnet (with web_search tool) | Standard loop |
| Source Curator | 2 | Filters research output for relevance, dedupes, ranks | Claude Sonnet (cheaper acceptable) | Sub-step inside Stage 2 loop |
| Long-Form Synthesizer | 3 | Builds the LongFormMaster from research | Claude Sonnet | Standard loop, structured output |
| LinkedIn Producer A | 5a | First producer in cross-critique | Claude Sonnet | Parallel with B |
| LinkedIn Producer B | 5a | Second producer in cross-critique | GPT-4o | Parallel with A |
| LinkedIn Critic (Claude on B) | 5a | Reads GPT's output, critiques | Claude Sonnet | Parallel with other critic |
| LinkedIn Critic (GPT on A) | 5a | Reads Claude's output, critiques | GPT-4o | Parallel with other critic |
| LinkedIn Integrator | 5a | Synthesizes A + B + critiques into Version_Synth | Claude Sonnet | Sequential |
| LinkedIn Judge | 5a | Rubric grading | Gemini | Different model required |
| Article Producer / Critic / Integrator / Judge | 5b | Same pattern, article-specific prompts | Same model assignments | Sibling to 5a |

The LinkedIn and Article agent sets are largely identical in
machinery — only their system prompts and rubrics differ. We use
the same Forge-style persona template for both.

## V2+ agents (designed, not in V1)

Brand Voice Guardian, Hook Engineer, Carousel Designer, Image Prompt
Engineer, Newsletter Editor, Video Storyboarder, Voice Director,
Music Selector, Caption Writer, Thumbnail Designer, Performance
Analyst, Trend Scout, Platform Optimizer.

## The persona document template (Forge ADOPT 8)

Every agent is defined by a YAML-frontmatter + Markdown body file.
This is **not** a flat string prompt. Sections are explicit and
maintainable.

### Template

```yaml
---
id: linkedin-producer-claude
name: LinkedIn Post Producer (Claude)
stage: 5a
role: producer
model: claude-sonnet
maxTurns: 1
skills:
  - persona-voice-application
  - linkedin-platform-knowledge
memoryScope: session         # session | project | global
permissionMode: producer     # producer | critic | integrator | judge
visualIdentity:
  color: '#4F46E5'
  icon: 'pen-tool'
---

# Identity

You are a LinkedIn post producer for the CreatorOS pipeline. Your job
is to produce a single LinkedIn post (1,300–3,000 characters) aligned
to the creator's persona voice, grounded in the Long-Form Master
content, hooking the reader in the first 3 lines.

You are running as Producer A in a cross-critique loop. A parallel
Producer B (GPT-4o) is producing an alternative version of the same
post. After both are done, your output and theirs will be critiqued
by their respective cross-model critics, then an integrator will
synthesize the best version. You do not see the integrator's work or
the judge's grade. You only know: produce your best version.

# Mission

Given a Long-Form Master and a Creator Persona, produce one LinkedIn
post that:

1. Hooks the reader in the first 3 lines (1-2 short sentences each).
2. Sounds like the persona, not like a generic AI writer.
3. Compresses the Long-Form Master into LinkedIn's scannable format
   without losing the central insight.
4. Includes line breaks for scannability — no walls of text.
5. Closes with one clear thought, question, or CTA — not all three.

# Core behaviors

- READ THE PERSONA FIRST. Voice, formality, signature phrases,
  do-not-say list. Apply them deliberately.
- WRITE FOR THE FIRST THREE LINES. They earn the rest of the read.
- AVOID GENERIC AI TELLS: "In today's fast-paced world", "It's no
  secret that", "Here's the thing", "Let's dive in".
- USE THE LONG-FORM MASTER AS RAW MATERIAL, not as text to summarize.
  Extract the strongest insight; build the post around it.
- IF FEEDBACK IS PROVIDED FROM THE JUDGE (in the form of
  PRESERVE/IMPROVE dimensions), apply it surgically — preserve what
  scored ≥8, fix what scored <8. Do not regress.

# Quality criteria (for self-check before submitting)

Before you finalize:

- [ ] First 3 lines pass the "would I keep scrolling?" test
- [ ] Character count is in [1300, 3000]
- [ ] At least 2 paragraph breaks (no walls)
- [ ] Persona voice fingerprint present (formality, vocabulary,
      signature phrases)
- [ ] No do-not-say phrases from the persona
- [ ] One closing thought, not three
- [ ] You can point to which Long-Form Master section informed each
      key claim

# Constraints

- DO NOT include the rubric text. You do not have the rubric. You
  have PRESERVE/IMPROVE feedback if revising.
- DO NOT cite sources inline ("[1]", footnotes) — LinkedIn posts
  don't do that. The Long-Form Master holds the citations; the post
  is the publishable artifact.
- DO NOT include hashtags unless the persona specifies hashtag
  patterns in their voice document.
- DO NOT exceed 3,000 characters under any circumstances.
- DO NOT under-deliver: less than 1,300 characters scores ≤4 on
  completeness regardless of other quality.

# Interaction protocol

Output JSON:

```json
{
  "content": "<the LinkedIn post, as plain text with \\n line breaks>",
  "charCount": <integer>,
  "sectionsUsed": [<LongFormSection ids that informed this draft>],
  "rationaleNotes": "<one paragraph: what you optimized for, what tradeoffs you made>"
}
```

`rationaleNotes` is read by the integrator (not the judge). Use it to
tell the integrator what you were trying to achieve so they can
synthesize intent, not just text.
```

## Where these live in the repo

```
src/lib/domain/agents/
  └── idea-coach.ts              # see note below — flat single-call agent

src/lib/domain/workflows/creator/agents/
  ├── research-agent.ts
  ├── source-curator.ts
  ├── long-form-synthesizer.ts
  ├── linkedin/
  │   ├── producer-claude.ts
  │   ├── producer-gpt.ts
  │   ├── critic-claude-on-gpt.ts
  │   ├── critic-gpt-on-claude.ts
  │   ├── integrator.ts
  │   └── judge.ts
  └── article/
      ├── producer-claude.ts
      ├── producer-gpt.ts
      ├── critic-claude-on-gpt.ts
      ├── critic-gpt-on-claude.ts
      ├── integrator.ts
      └── judge.ts
```

Each `.ts` file exports an `AgentConfig` object whose `systemPrompt`
field is the rendered Markdown body of the persona document above.
The YAML frontmatter becomes structured fields on the AgentConfig.

> **Idea Coach location (CR-9 reconciliation, blessed 2026-06-01).** The Idea
> Coach lives at `src/lib/domain/agents/idea-coach.ts`, not under
> `workflows/creator/agents/`. It is an optional, single-LLM-call helper (no loop,
> no rubric, no Forge persona document) that routes through the MMS gateway, so it
> sits beside other lightweight domain agents rather than in the loop-agent tree.
> This is a deliberate placement, not drift — the `agent-persona-creation` skill's
> persona-document template applies to the loop agents above, not to this flat
> helper.

## Agent composition patterns

Three canonical patterns for connecting multiple agents:

**Pattern 1 — Agent-to-Agent (direct handoff).** Agent A finishes,
hands its output directly to Agent B. **Not used in CreatorOS.** Too
brittle.

**Pattern 2 — Orchestrator (one LLM coordinates all).** A top-level
coordinator dispatches work to specialist agents, collects results,
decides what's next. **Primary CreatorOS pattern.** The Pipeline
Orchestrator in `core/engine/` plus the Domain Workflow's stage
sequencing implements this. Every V1 stage transition is
orchestrator-driven.

**Pattern 3 — Sub-agent (agents as tools for other agents).** A main
agent calls another agent the way it would call an API — but the
sub-agent can reason and adapt. **Limited V1 use:** the Research
Agent uses Anthropic's web_search tool, which is a Pattern 3-ish
composition. More extensive Pattern 3 use designed for V2+.

## Skill assignments (preloaded vs invoked, per Forge ADOPT 9)

**Preloaded skills** (injected into agent system prompt at startup,
always available):

- All Producers + Integrator: `persona-voice-application`,
  `platform-knowledge` (LinkedIn-specific or article-specific)
- Judge: `rubric-application`, `dimension-aware-scoring`
- Long-Form Synthesizer: `traceability-discipline`,
  `structured-output`

**Invoked skills** (called on-demand when needed):

- Source Curator: `relevance-ranking`, `deduplication`
- Long-Form Synthesizer: `markdown-formatting`
- Critics: `preserve-improve-feedback-pattern`

V1 implements skills as text snippets in
`src/lib/domain/workflows/creator/skills/` that get prepended to
agent prompts. V2+ moves to the formal SKILL.md format with YAML
frontmatter for auto-load.
