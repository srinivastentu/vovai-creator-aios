---
name: agent-persona-creation
description: Walks Claude Code through authoring a new agent file using the Forge-style persona document template. Loads when the task involves creating or modifying any file under src/lib/domain/workflows/creator/agents/. Enforces structure (Identity, Mission, Behaviors, Quality criteria, Constraints, Protocol) and Pattern-5 rules (producers never see rubric; reasoning-first for judges).
---

# Agent Persona Document Creation

You are authoring a new agent file. Use the Forge-style persona
document template. Structured Markdown body inside a TypeScript
module; YAML frontmatter expressed as TypeScript fields.

## File location

```
src/lib/domain/workflows/creator/agents/<stage>/<role>.ts
```

Examples:
- `src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts`
- `src/lib/domain/workflows/creator/agents/article/judge.ts`

(The Idea Coach is NOT a loop/persona-document agent — it is a flat single-LLM-call
helper at `src/lib/domain/agents/idea-coach.ts`; this template does not apply to it.
See `docs/02-domain/agents-and-personas.md`.)

## File template

```typescript
import type { AgentConfig } from '@/lib/core/agentic/types'

export const linkedinProducerClaude: AgentConfig = {
  id: 'linkedin-producer-claude',
  name: 'LinkedIn Post Producer (Claude)',
  stage: '5a',
  role: 'producer',
  model: 'claude-sonnet',
  maxTurns: 1,
  skills: [
    'persona-voice-application',
    'linkedin-platform-knowledge'
  ],
  memoryScope: 'session',
  permissionMode: 'producer',
  systemPrompt: `
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
- IF FEEDBACK IS PROVIDED FROM THE JUDGE (PRESERVE/IMPROVE), apply
  it surgically — preserve what scored >=8, fix what scored <8.

# Quality criteria (self-check before submitting)

- [ ] First 3 lines pass "would I keep scrolling?"
- [ ] Character count in [1300, 3000]
- [ ] >=2 paragraph breaks
- [ ] Persona voice fingerprint present
- [ ] No do-not-say phrases from persona
- [ ] One closing thought, not three
- [ ] Can point to which Long-Form Master section informed each claim

# Constraints

- DO NOT include the rubric text. (You do not have it.)
- DO NOT cite sources inline. The Long-Form Master holds citations.
- DO NOT include hashtags unless the persona specifies them.
- DO NOT exceed 3,000 characters.
- DO NOT under-deliver: < 1,300 chars scores <=4 on completeness.

# Interaction protocol

Output JSON:

{
  "content": "<post text with \\n line breaks>",
  "charCount": <integer>,
  "sectionsUsed": [<LongFormSection ids>],
  "rationaleNotes": "<one paragraph: what you optimized for>"
}

rationaleNotes is read by the integrator (not the judge). Use it
to tell the integrator your intent.
  `.trim()
}
```

## Section discipline

Every agent persona doc has these sections in this order:

1. **Identity** — who you are, what role, what loop pattern context
2. **Mission** — what you produce, numbered list of requirements
3. **Core behaviors** — behavior guidelines, what to do
4. **Quality criteria** — self-check list before submitting
5. **Constraints** — hard NOTs
6. **Interaction protocol** — exact output shape (JSON schema for
   producers; reasoning-first for judges)

If you find yourself adding a section, ask whether it belongs in one
of the existing six. Usually yes. Section sprawl makes prompts hard
to maintain.

## Role-specific rules

### Producers

- Do NOT include rubric text. Producers get PRESERVE/IMPROVE
  feedback, not the rubric.
- Pre-load skills via the `skills` field (loaded at startup).
- Output is a JSON object with `content` + metadata fields.
- For cross-critique producers, include a `rationaleNotes` field —
  the integrator reads this to understand intent.

### Critics

- Do NOT score numerically (that's the judge). Critics produce text.
- Output format: PRESERVE / IMPROVE structure.
  - Things the target version got right (preserve).
  - Things missing or weak (improve, with specifics).
- 200-400 word target length. Brevity matters.

### Integrators

- Synthesize, don't concatenate. Identify strongest elements from
  each producer; write one new version using only those.
- Read the critiques; your output should be missing nothing the
  critiques flagged.
- Don't preserve weaknesses just because both versions share them.

### Judges

- **REQUIRED: reasoning before scoring.** Each dimension: paragraph
  of reasoning citing specific evidence, then the numeric score.
- Composite score is calculated by code, NOT by the judge. The judge
  returns per-dimension scores only.
- Different model from producers + integrator (enforced at runtime).
- Judges run in fresh context — they see the rubric + the artifact,
  not the critiques or producer rationale notes.

## The `skills` field

V1 implements skills as text snippets in
`src/lib/domain/workflows/creator/skills/`. The framework
auto-concatenates each named skill's content into the system prompt
at startup.

If a behavior is reused across 3+ agents, factor it into a skill
rather than duplicating prose across multiple agent files.

V1 V2 promotion path: when V2 lands, the skills/ folder becomes a
`.claude/skills/<name>/SKILL.md` directory structure with YAML
frontmatter for auto-load. Same content; different mechanism.

## Tests for new agent files

Route to `@test-writer` to scaffold:

```
tests/unit/domain/agents/<stage>/<role>.test.ts
```

Required tests:

- Agent config has all required fields
- systemPrompt does NOT contain rubric text (producers only)
- systemPrompt contains reasoning-first instruction (judges only)
- Model assignment is correct
- maxTurns is appropriate
- For cross-critique participants: Producer ≠ Integrator ≠ Judge

## Quality bar

A good agent persona doc passes this test: a developer who has never
worked on CreatorOS, reading the doc, can:

- Tell you what the agent produces
- Tell you what it must NOT do
- Tell you what the output JSON looks like
- Tell you what happens if the agent fails its self-check

If any of those are unclear, the doc isn't ready.
