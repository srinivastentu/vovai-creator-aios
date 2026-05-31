# CreatorOS Documentation — INDEX

> Map of everything in `docs/`. Read in the order shown if onboarding;
> jump to a specific section if you already know what you need.

## Onboarding read order

1. `00-foundation/identity-and-scope.md` — what CreatorOS is and what
   V1 ships (one page)
2. `00-foundation/master-context.md` — full V1 specification
3. `01-architecture/core-vs-domain.md` — the architectural contract
4. `01-architecture/loop-engine.md` — the universal loop machinery
5. `01-architecture/cross-critique-pattern.md` — the CreatorOS
   differentiator
6. `02-domain/pipeline-v1.md` — what V1 actually does, stage by stage
7. `04-plans/v1-action-plan.md` — how V1 gets built, 12 CR sessions
8. `05-claude-code/workflows.md` — how to drive Claude Code through
   those sessions

That's the path from "what is this" → "let's build it." 15-30 minutes.

## By directory

### `00-foundation/`

The "what and why."

- `identity-and-scope.md` — One-page summary. V1 scope + acceptance test.
- `master-context.md` — Full V1 specification (the foundational doc).
  Authoritative when anything else contradicts it.

### `01-architecture/`

The "how" at the platform level. Every file here is Core machinery
ported from the VOVAI eLearn AIOS work, with provenance headers, plus
the CreatorOS additions. None of these would change for a future Film
AIOS or Agri AIOS.

- `core-vs-domain.md` — The architectural contract. The one import
  rule. Universal patterns.
- `loop-engine.md` — Loop Engine spec. Universal machinery.
- `loop-patterns.md` — Five patterns: Standard, Strategic, Tournament,
  Nested, Cross-Critique. Pattern 5 (Cross-Critique) is the CreatorOS
  addition.
- `cross-critique-pattern.md` — Pattern 5 standalone spec.
- `mms-architecture.md` — Model Management System (MMS) architecture.
- `context-system.md` — System 6. V1 thin-seam spec.
- `review-system-v1.md` — 4 surfaced vs 6 engine actions policy.
- `memory-architecture.md` — Four memory types + V2 plan.
- `loop-engine-implementation.md` — Implementation notes from eLearn's
  Loop Engine handoff. Domain examples (video pipeline) are eLearn —
  read past them; the machinery is universal.

### `02-domain/`

The "how" at the CreatorOS level. CreatorOS-specific, not portable.

- `entities.md` — Entity hierarchy + TypeScript shapes.
- `pipeline-v1.md` — Stage map + gates + loop patterns per stage.
- `agents-and-personas.md` — Agent map + Forge persona document template.
- `rubrics.md` — V1 rubric inventory + 5 authoring rules.

### `03-decisions/`

What's decided, what's open, what was inherited.

- `inherited-platform-decisions.md` — eLearn decisions that apply
  unchanged to CreatorOS, with rationale.
- `forge-adoption-patterns.md` — The 9 Forge ADOPT patterns
  (cross-AIOS), with provenance header. Universal.
- `creator-decisions-log.md` — CreatorOS-specific decisions
  (append-only). Seeded with §6/§7 resolutions.

### `04-plans/`

Build plans, session prompts.

- `v1-action-plan.md` — 12-step MVP-first plan. Each step has a full
  session prompt ready to paste into Claude Code.
- `CR-0_session_prompt.md` — Standalone CR-0 prompt (also referenced
  by the action plan).

### `05-claude-code/`

How to drive Claude Code through these plans.

- `workflows.md` — Effort modes, Auto Mode, Dynamic Workflows,
  subagents, skills, the convention "one CR step = one session."

### `sign-off-review/`

The senior-staff-engineer sign-off gate that runs after every CR step
is implemented and before the next one begins.

- `README.md` — The pipeline: when it runs, the five audit lenses,
  verdict semantics, the `cr-signoff-audit` workflow + `args` contract.
- `_TEMPLATE.md` — The per-step report template.
- `CR-<N>-sign-off.md` — One committed review report per CR step
  (e.g. `CR-1-sign-off.md`).

## Cross-references

If you need to know... | Read...
---|---
What V1 ships | `00-foundation/identity-and-scope.md`
The acceptance test | `00-foundation/identity-and-scope.md` + `03-decisions/creator-decisions-log.md`
Cross-critique pattern spec | `01-architecture/cross-critique-pattern.md`
How to add a new loop stage | `.claude/skills/loop-stage-creation/SKILL.md` + `02-domain/pipeline-v1.md`
How to sign off a completed CR step | `sign-off-review/README.md` + `.claude/workflows/cr-signoff-audit.js`
How to write an agent persona doc | `.claude/skills/agent-persona-creation/SKILL.md` + `02-domain/agents-and-personas.md`
Rubric authoring rules | `02-domain/rubrics.md`
What was decided about X | `03-decisions/creator-decisions-log.md` (search by date)
The import discipline check | `.claude/skills/grep-check/SKILL.md`
Why we forked rather than added a domain | `03-decisions/inherited-platform-decisions.md` (entry 1)

## Documents NOT in this bundle (intentional)

The following lived in the source-of-truth Claude.ai project but
were **not** carried into the CreatorOS repo, because they are
eLearn-specific domain content:

- VOVAI eLearn AIOS Complete Architecture v2
- VOVAI eLearn 50-agent map
- VOVAI eLearn 106-skill library
- eLearn Pipeline doc
- eLearn pipeline API deployment notes
- eLearn agent architecture, skills, models, tournament docs
- eLearn-specific Key Decisions Log (the platform-level entries
  were extracted into `03-decisions/inherited-platform-decisions.md`)
- VOVAI Loop Engine Action Plan (eLearn step-by-step build plan,
  superseded by the CreatorOS action plan)
- VOVAI Progress Map (eLearn-specific)

Those documents remain available in the original Claude.ai project
for reference, but they do not enter this repo. If you need to look
something up, go back to the project knowledge.

## Living documents

These get appended to as the project moves:

- `03-decisions/creator-decisions-log.md`
- Any new doc under `03-decisions/open-questions.md` (created when
  first needed)

These are stable specifications:

- `00-foundation/*` (changes only when scope changes)
- `01-architecture/*` (changes are versioned events)
- `02-domain/*` (changes through PRs with architect-reviewer approval)
- `04-plans/v1-action-plan.md` (changes through explicit re-planning,
  not mid-step)
