# CreatorOS Decisions Log

> Append-only. Every architectural or scope decision made during
> CreatorOS planning and build goes here. One bullet per decision.
> Date stamps required.

## Seed entries (from initial alignment, May 2026)

These were resolved during the §6/§7 alignment conversation between
Srinivas and Claude before any code was written. They are the
authoritative answers — they supersede any conflicting language in
the original master context.

### Architecture

- **2026-05 — Six Core systems, not five.** Master Context v1.1
  introduced Context Engineering as System 6. The "five" phrasing
  elsewhere is stale. Authoritative count: Loop Engine, Agentic,
  Review, MMS, Context (System 6, V1 thin-seam), Domain Workflow.
- **2026-05 — Loop Engine is the only system structurally changing.**
  Cross-critique pattern added to pattern catalog. All other systems
  are reused as-is (MMS adds Gemini provider entries, not new code
  shapes).
- **2026-05 — V1 review actions: 4 surfaced in UI, 6 retained in
  engine.** Surfaced: `approve`, `feedback`, `reject`, `inline_edit`.
  Engine retains `use_segments` and `mix_produce` (designed,
  unsurfaced in V1 UI). Every V1 UI review component includes a
  `TODO(V2): surface use_segments + mix_produce` comment.
- **2026-05 — Cross-critique parallelism composes, doesn't
  reimplement.** Reuses `gateway.requestMultiple()` for producers
  and critics. Adds new sequential integrator-step primitive only.

### Scope

- **2026-05 — V1 scope is exactly §8.1 of master context.** Nothing
  more, nothing less. No scope additions inside a CR-step.
- **2026-05 — Stage 5 modeled as sibling StageSessions, not nested.**
  Each artifact type in Repurpose is its own StageSession. Independent
  rubric, budget, gate decision. Pipeline Orchestrator data model
  stays uniform.
- **2026-05 — Persona Setup Assistant agent deferred.** V1 ships with
  CRUD form for persona creation. Conversational setup agent is V2+.

### Operational

- **2026-05 — Repo strategy: new repo `vovai-creator-aios`, forked
  from eLearn at tag `pre-creator-fork`.** Clean git history,
  independent Vercel project, independent CI. Cross-critique
  back-port to eLearn happens via a separate PR on the eLearn repo.
- **2026-05 — Auth: hardcoded local user in V1, schema designed
  multi-role from day 1.** `userId`, `workspaceId`, `role` enum
  (`admin | writer | editor | reviewer`) present in schema. V1
  records all have `role='admin'` for the hardcoded user. Clerk
  wires in cleanly in V2.
- **2026-05 — Web search provider: Anthropic web_search via Claude
  SDK.** No Tavily, Brave, or Exa in V1. Zero extra vendor; cost
  bundled into Claude API call; no new provider client needed in MMS.
- **2026-05 — PDF parsing: Anthropic SDK native `document` block.**
  No `pdf-parse` dependency. Max 32MB per upload. Larger uploads
  return an error and ask the user to split.
- **2026-05 — Frontend scope V1: API + 3-screen Next.js minimum.**
  Workspace dashboard, Gate A (source traceability), Gate B (inline
  editor). shadcn/ui + Tailwind. No design system invention.

### Cost and quality

- **2026-05 — Cross-critique budget cap: `maxBudgetUSD = 2.00` per
  stage, default.** Optional `maxBudgetUSD` field on `LoopStage`.
  Termination when threshold met OR budget exhausted OR max
  iterations — whichever fires first. Escalation surfaces best
  version with `terminationReason: 'budget_exhausted'` flag if that
  was the trigger.
- **2026-05 — Acceptance test "substantively different across
  iterations" check: cosine similarity ≤ 0.92 via
  `text-embedding-3-large`.** CI assertion only, not a runtime gate.
  Higher similarity = warning, not failure.
- **2026-05 — V1 acceptance bar: < 30 minutes wallclock, < $5.00 USD
  total cost.** Project-level. Stays even when individual stage caps
  add up close to the limit; if real-world runs exceed it, tune
  prompts/iteration limits — don't relax the bar.

### Data model

- **2026-05 — Inline-edit + Regenerate resolves as FORK, not discard
  or merge.** Preserves Immutable History (principle 3). Schema:
  `Artifact.parentArtifactIds: string[]`, `Artifact.derivedVia:
  'cross_critique' | 'inline_edit' | 'regenerate' | 'merge'`
  (underscores — see 2026-05-31 reconciliation below).
- **2026-05 — Long-Form Master is STRUCTURED, not a text blob.**
  `LongFormMaster.sections[]`, `LongFormSection.sourceRefs[]`,
  `SourceRef.researchSourceId + relevanceSnippet`. Without this
  shape, Gate A's source traceability panel is unbuildable.
- **2026-05 — Idea promotion UX: default to active Workspace.** "Move
  to different workspace" exists as a menu override. Default flow:
  one-click promote stays in current Workspace.

### Build process

- **2026-05 — Step 0 renamed to "Fork bootstrap".** Purge eLearn
  Domain, scaffold CreatorOS skeleton, archive eLearn tests behind
  `tests/_eLearn_archive/`. Folder structure already correct from
  the eLearn repo.
- **2026-05 — Bare-skeleton purge in CR-0 (eLearn-flavored API and
  UI archived too).** Keep only Core, `src/components/ui`,
  `src/lib/grading`, `src/lib/media`, layout, minimal home. Archive
  everything else. CreatorOS rebuilds pipeline-shaped routes fresh.
- **2026-05 — Action plan reshaped MVP-first.** 12 sessions instead
  of 17. First real content output at session 4 (single-model
  producer). Cross-critique differentiator at session 7. UI work in
  Milestone 3 (last). Acceptance test is Milestone 4.
- **2026-05 — Claude Code workflows: ultracode + Auto Mode + Dynamic
  Workflows.** User is on Max plan (Dynamic Workflows on by default).
  Auto Mode enabled. Per-file approval gates off; subagents inside
  workflows run in `acceptEdits` mode.
- **2026-05-31 — Empty top-level src/lib/grading and src/lib/media
  directories are not material.** They contain no files and are
  untracked by git. The reusable rubric grading and media
  machinery CreatorOS will use lives at `src/lib/core/grading`
  and `src/lib/core/models`. References elsewhere to "grading
  lib" or "media lib" should be read as "Core's grading/media
  machinery." Top-level empty dirs left in place; harmless.
- **2026-05-31 — Core tests that hold registries of Domain paths
  require synchronized updates on Domain archival.** During CR-0,
  two Core-fenced tests (`hardcoded-paths.test.ts`,
  `grader.test.ts`) held lists or assertions referencing specific
  Domain artifacts; those needed patches when the artifacts were
  archived. The test-writer subagent should watch for this
  pattern when a CR step archives or moves Domain content.
- **2026-05-31 — Pre-push freshness check added to
  cr-step-protocol after the CR-0 cascade-cancellation
  incident.** See `tasks/lessons.md` for the full lesson. The
  protocol skill now requires sequential separate tool calls
  for typecheck, test, build immediately before push.

### Documentation

- **2026-05 — Tier 3 eLearn-specific docs do NOT enter the
  CreatorOS repo.** They remain reference-only in the Claude.ai
  project. The CreatorOS repo `docs/` contains zero eLearn-specific
  domain content. Universal Core docs are ported with provenance
  headers.
- **2026-05 — CLAUDE.md style: existing content preserved, addendum
  appended.** Routing table + @imports + Claude Code workflow
  guidance appended at the end. Existing eLearn references in the
  body of CLAUDE.md are noted as deprecated, pointing to the new
  identity-and-scope doc.
- **2026-05 — Renaming: creator-neutral filenames with provenance
  headers.** Every ported doc gets a "this document originated in
  eLearn AIOS" header. Inline content keeps its examples (the
  patterns are the same).
- **2026-05 — Discussion captures: brief bullets only.** No full
  transcripts. Decisions logs (this file) carry the resolved
  outcomes. The reasoning lives in the underlying architecture docs
  if it's worth preserving long-form.

---

## How to append to this log

When a real decision gets made (in chat or in a Claude Code session):

1. Add a bullet under the appropriate category (Architecture, Scope,
   Operational, Cost and quality, Data model, Build process,
   Documentation, or a new category).
2. Format: `**YYYY-MM — One-line statement.** One-sentence rationale.`
3. If the decision overrides an earlier one, link to the earlier one
   and write "Supersedes [date]: ..."
4. Commit in the same commit that implements the decision.

If a session can't reach a decision, don't add anything — add it to
`docs/03-decisions/open-questions.md` instead (file may not exist
yet; create when first needed).

---

## Pre-CR-1 reconciliation (2026-05-31)

Decisions pinned during the pre-CR-1 documentation audit. Each
resolves a discrepancy that would otherwise force ad-hoc choices when
the schema is written.

### Data model

- **2026-05-31 — `Artifact.derivedVia` enum uses underscores:
  `cross_critique | inline_edit | regenerate | merge`.** Prisma enum
  members cannot contain hyphens; the generated TS type is the
  underscore form. Supersedes the hyphenated spelling in
  entities.md, this log (2026-05 Data-model entry), review-system-v1.md,
  pipeline-v1.md, and the CR-4/CR-11 literals in the action plan —
  those prose mentions are stale and any code must use underscores.
- **2026-05-31 — `Artifact.longFormMasterId` is REQUIRED in V1.**
  The conceptual shape (entities.md) marks it optional for V2
  non-master-derived artifacts; V1 narrows it to a non-nullable FK
  because every V1 artifact derives from a LongFormMaster.
- **2026-05-31 — Explicit FK relations + delete policy for all
  foreign keys.** Owned structural parts (sections, sourceRefs,
  researchSources, iteration records) cascade; everything
  representing independent history restricts (delete 400s). Full
  table in entities.md "V1 reconciliation addendum".
- **2026-05-31 — `StageSession` + `IterationRecord` are V1 Prisma
  tables, created in CR-1.** Resolves the gap where
  memory-architecture.md mandates them as V1 episodic memory but the
  CR-1 schema block omitted them. They home the Gate B iteration
  history panel (CR-11) and `terminationReason`. (RECOMMENDED default
  — flagged for Srinivas to veto in favor of JSON-on-Artifact; if
  vetoed, update memory-architecture.md to match.)
- **2026-05-31 — CreatorPersona JSON sub-schemas are defined in
  `docs/02-domain/buildos-persona.md`.** `voiceTone`,
  `audienceProfile`, `creatorProfile`, `defaultRubricRefs` now have a
  contract; `defaultRubricRefs` references rubric ids from rubrics.md.

### Process / content

- **2026-05-31 — BuildOS seed persona is authored, not improvised.**
  Claude drafted concrete persona content in buildos-persona.md;
  Srinivas reviews/edits before CR-1 seeds it. The acceptance test's
  voice-fidelity criterion must be graded against a specified persona.
- **2026-05-31 — Inserted a pre-CR-1 reconciliation step.** Doc
  fixes + tooling (`tsx`, `db:seed`) landed before CR-1 so the
  schema session is deterministic.

### Documentation precedence (clarified)

- **2026-05-31 — Precedence is: decisions log > master-context >
  other docs > CLAUDE.md eLearn-legacy body.** The first ~100 lines
  of CLAUDE.md describe eLearn (incl. "Four Systems" and "OpenAI
  judges") and are superseded by the addendum + identity-and-scope.md
  (authoritative: six Core systems; Gemini is the V1 judge). A banner
  at the top of CLAUDE.md is recommended but was DEFERRED this session
  (the file's size triggered read glitches; a safe automated edit was
  now done). A banner was added at the top of CLAUDE.md pointing here;
  the "CreatorOS Identity Note" addendum at the END also mitigates this.
- **2026-05-31 — rubrics.md is authoritative for rubric dimensions.**
  master-context.md §13 (5 dims, completeness folded) is superseded
  by rubrics.md (6 dims, explicit `completeness` ≥ 0.20 per Forge
  ADOPT 6). pipeline-v1.md's mixed-case dimension list defers to
  rubrics.md camelCase ids.

### Audit findings corrected (not bugs)

- **2026-05-31 — Several audit claims about master-context.md were
  inaccurate** (hallucinated line refs): it is internally consistent
  on the six-systems count (five reused + one new) and already lists
  6 review actions with `mix_produce`. The only real master-context
  drift is §9 acceptance criterion 4 (lacked the cosine ≤ 0.92
  mechanization; now aligned).
- **2026-05-31 — Environment is ready (audit false alarm).**
  `.env.example`, `.env.local` (real DATABASE_URL), `prisma.config.ts`,
  and the generated client all exist. Only `tsx` + the `db:seed`
  script were missing.

---

## CR-2 decisions (2026-05-31)

Pinned while implementing Stage 2 (Research).

### Architecture

- **2026-05-31 — Web-search machinery is Core; the research agent is
  Domain.** `src/lib/core/agentic/adapters/web-search-adapter.ts` holds
  the generic "call Claude with the `web_search_20250305` tool, parse
  the result blocks + citations into normalized sources, track cost"
  machinery (zero domain words → passes the three-question test). The
  CreatorOS Research Agent (`domain/workflows/creator/agents/research-agent.ts`)
  injects it and decides WHAT to research. Reaffirms the 2026-05 decision
  "web_search via Claude SDK, no new MMS provider client."
- **2026-05-31 — CreatorOS rubric composite follows rubrics.md Rule 4:
  1–10 per dimension, composite `= Σ(score · weight · 10)` → 0–100.**
  This is the ONLY model under which RESEARCH_RUBRIC's `passThreshold: 75`
  (composite) and per-dimension `passThreshold: 7` (1–10) are both
  correct. The Research Judge reuses Core `calculateWeightedScore`
  (1–10) and multiplies by 10; pass/fail uses Core `checkThresholds`
  (composite ≥ 75 AND every dimension ≥ its 1–10 bar). The eLearn-legacy
  `createOpenAITextJudge` runs a 1–10 composite and hard-requires a
  `structure_completeness` dimension, so it is NOT reused for CreatorOS
  rubrics. CR-3/CR-5 judges must use the same 0–100 model.

### Operational

- **2026-05-31 — Local CLI scripts load `.env.local` then `.env`.**
  `dotenv/config` reads only `.env` (which holds just `DATABASE_URL`);
  the API keys live in `.env.local`. `scripts/pipeline-research.ts`
  uses `loadEnv({ path: ['.env.local', '.env'] })` (earlier file wins,
  Next.js precedence). Future pipeline scripts follow this. `seed.ts`
  and `inspect-db.ts` are unchanged — they only need `DATABASE_URL`.

### Scope

- **2026-05-31 — Stage 2 ships a third agent the action-plan list
  omitted: the Research Judge.** The plan's CR-2 agent list named only
  `research-agent` + `source-curator`, but the Standard loop needs a
  cross-model judge to grade against RESEARCH_RUBRIC. Added
  `agents/research-judge.ts` (GPT-4o — cross-model vs the Claude
  producer, loop rule 7). CR-5's "judge" work remains the Gemini
  production judges for Stage 5; this is the Stage-2 judge only.
