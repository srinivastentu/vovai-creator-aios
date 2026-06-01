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

### CR-2 follow-ups (pre-CR-3, from the sign-off review)

- **2026-05-31 — Per-dimension `passThreshold` is ADVISORY in V1; the
  loop terminates on the composite `threshold` + min/max iterations.**
  The Core `runLoop` presents/revises on `grade.overallScore >=
  stage.threshold` (+ min/max), and escalates to the human at
  maxIterations. It does NOT auto-block on `grade.passesThreshold`
  (which also factors per-dimension bars). The judge still computes and
  surfaces per-dimension scores + `passesThreshold`; those inform the
  PRESERVE/IMPROVE feedback and the human review gate (Gate A/B), which
  is the real enforcement point in V1. This is intentional and applies
  to all stages including Stage 3 (Gate A). Changing the Core engine to
  hard-gate on every dimension is a V2 consideration, not a CR-2/CR-3
  change. Resolves sign-off follow-up #1.
- **2026-05-31 — `ResearchSource` gets `@@unique([longFormMasterId,
  url])`** (migration `cr_2_research_source_unique_url`). The curator
  already dedupes by normalized URL, so the constraint rejects no valid
  data; it lets CR-3 resolve a `SourceRef` → `ResearchSource`
  unambiguously by URL within a master, and enforces dedupe at the DB
  level. Applied via hand-authored migration + `migrate deploy` because
  `migrate dev` is non-interactive-blocked in this environment; client
  regenerated (per the CR-1 `prisma generate` lesson). Resolves sign-off
  follow-up #2.
- **2026-05-31 — `bibliography/` is git-ignored** (personal reference
  scratch, not a project deliverable) so it can't be accidentally
  committed. Resolves sign-off follow-up #6.
- **2026-05-31 — BuildOS persona APPROVED as the V1 voice baseline,
  with a voice-refinement window closing at CR-4.** Srinivas approved
  the seeded persona (`docs/02-domain/buildos-persona.md`, banner +
  checklist updated) as the baseline; `voiceTone.signaturePhrases` and
  `voiceTone.doNotSay` remain tunable but MUST be final before CR-4
  (first stage where producers write in the voice and the acceptance
  test's voice-fidelity criterion applies). Any change re-runs
  `npm run db:seed` (idempotent). Resolves the sign-off "human input
  needed" item on persona approval.

---

## CR-3 decisions (2026-05-31)

Pinned while implementing Stage 3 (Long-Form Master synthesis).

### Scope

- **2026-05-31 — Stage 3 ships a Long-Form Master Judge (GPT-4o) the
  action-plan build list omitted.** The CR-3 prompt named only the
  `long-form-synthesizer`, but the Standard loop (Pattern 1) needs a
  cross-model judge to grade against `LONG_FORM_MASTER_RUBRIC` and
  drive PRESERVE/IMPROVE iteration. Added
  `agents/long-form-master-judge.ts` (GPT-4o — cross-model vs the
  Claude synthesizer, loop rule 7 / Pattern-5 rule 10). Directly
  parallels the CR-2 decision that added the Research Judge. CR-5's
  Stage-5 Gemini judges are separate and still come later.

### Architecture

- **2026-05-31 — Context curation is domain-local in CR-3; the Core
  PassthroughCurator (`src/lib/core/context`) is deferred to CR-8.**
  The CR-3 prompt says "use PassthroughCurator with priorities
  persona=10, idea=10, researchSources=8, uploadedDocs=6," but CR-8
  owns building the Context Engineering System (System 6). To avoid
  pulling Core machinery forward (no scope additions inside a CR step),
  CR-3 implements the priority-ordered context assembly inline in the
  synthesizer prompt builder, exported as `MASTER_CONTEXT_PRIORITIES`
  with a `TODO(CR-8)` to lift it into the Core curator. The V1
  passthrough behavior (include all blocks, highest priority first) is
  identical; only the home address changes in CR-8.
- **2026-05-31 — `MasterArtifact` carries its source-pool snapshot so
  the validator + judge stay pure `(artifact) => …` functions.** The
  deterministic validator must check every `SourceRef.researchSourceId`
  resolves to a dossier source, and the judge must verify accuracy
  against the cited sources — both need the source pool. Rather than
  widen the Core `LoopStage.validator` / `JudgeFunction` signatures,
  the artifact embeds `sources: MasterSourceInput[]` (loop-internal;
  only `title` + `sections` persist). This mirrors how a
  `ResearchDossier` carries its own sources.
- **2026-05-31 — The synthesizer cites sources by short stable handles
  (S1, S2, …), mapped to `researchSourceId` in code.** ResearchSource
  ids are opaque cuids an LLM cannot echo reliably; the prompt lists
  sources as `S1..Sn` and the agent maps handles back to real ids,
  dropping any unknown handle. The persisted `MasterArtifact` carries
  real ids the validator and persistence layer use.

### Cost and quality

- **2026-05-31 — Live CR-3 run: 6 sections, 1213 words, 9 SourceRefs,
  best score 89/100, $0.10, 2 iterations** against the seeded BuildOS
  idea — well under the $1.50 session ceiling. The judge's composite
  uses the same 0–100 model as CR-2 (rubrics.md Rule 4): 1–10 per
  dimension, `Σ(score · weight · 10)`, threshold 80 (the Gate A bar).
  The fallback `syntheticFailingGrade` path was aligned to the same
  rounding as the happy path (architect-review follow-up, fixed in
  this commit) — `snapQuarter` stays only on individual LLM-returned
  dimension scores, never on the already-deterministic composite.

---

## CR-4 decisions (2026-05-31)

Pinned while implementing Stage 5 (Repurpose) single-model producers —
the first stage that emits a publishable Artifact.

### Architecture

- **2026-05-31 — CR-4 injects a deterministic structural pass-judge +
  a placeholder structural rubric to satisfy the engine contract; the
  deterministic validator is CR-4's ONLY real quality gate.** Core
  `runLoop` requires a `JudgeFunction` and every `LoopStage` requires a
  `rubric`, but CR-4 ships no LLM quality judge (that is CR-5). Because
  `runLoop` skips `evaluate()` on validator failure, the judge only
  ever sees a structurally-valid artifact — so the structural judge
  (`createStructuralPassJudge`, zero-cost, no API call) returns a fixed
  passing grade (composite 80 ≥ threshold 70), and
  `SINGLE_PRODUCER_STRUCTURAL_RUBRIC` is a one-dimension `completeness`
  placeholder (weight 1.0; satisfies Forge ADOPT 6 and the weight-sum
  rule). CR-5 replaces both with `LINKEDIN_POST_RUBRIC` /
  `LONG_FORM_ARTICLE_RUBRIC` + the cross-model Gemini judge. Directly
  parallels the CR-2/CR-3 decisions that added a judge the action-plan
  build list omitted — here the necessity is the engine contract, not a
  cross-model grade.
- **2026-05-31 — The CR-4 executor is produce-only (no `revise`).**
  With no quality judge there is no PRESERVE/IMPROVE signal to revise
  against, so the executor always calls `producer.produce()`. A
  validator failure re-produces a fresh draft (the engine skips the
  judge and loops). The Cross-Critique revise/integrate path lands in
  CR-7; the producer files are written as "Producer A" for that
  adaptation.

### Cost and quality

- **2026-05-31 — Stage 5 single-producer stages run `minIterations=1`
  (deliberate; per action-plan CR-4 `min=1`).** Supersedes the Loop
  Engine norm of `minIterations=2` (used by Stages 2 & 3) *for CR-4
  only*. Rationale: the structural pass-judge gives every valid draft
  the same score (80), and the producer is produce-only, so a forced
  second iteration would re-produce an equal-quality draft at double
  the spend with no improvement signal — wasted money against the
  acceptance test's <$5 / <30 min budget. CR-5 restores
  `minIterations=2` (and raises the threshold to 80) once the real
  Gemini judge provides an improvement signal that makes a second
  iteration worthwhile. Resolves the CR-4 architect-review warning.
- **2026-05-31 — Live CR-4 run: LinkedIn post 1559 chars ($0.0131) +
  long-form article 1235 words ($0.0367), 1 iteration each, total
  ~$0.05** against the seeded BuildOS master — far under the $1.00
  session ceiling. Both pass their deterministic validators on the
  first draft and read in the BuildOS voice (signature phrases present,
  do-not-say list respected). Quality is human-judged; the LLM rubric
  judge that mechanizes it arrives in CR-5.

### Data model

- **2026-05-31 — CR-4 persists Artifact rows with
  `derivedVia='cross_critique'` (forward-compat), `status='awaiting_
  review'`, `parentArtifactIds=[]`, `bestScore=null`.** `derivedVia`
  uses the underscored Prisma enum (entities.md reconciliation) and is
  marked `cross_critique` now so CR-7 needs no backfill — it becomes
  literally true once cross-critique is wired. `bestScore` is null
  because CR-4 has no LLM quality grade (the structural pass is loop
  plumbing, not a quality signal); CR-5 fills it from the Gemini
  judge's composite. `status='awaiting_review'` mirrors Stage 3's
  `gate_a_pending` — the artifact is presented, pending Gate B (CR-11).
- **2026-05-31 — CR-4 does NOT mutate `LongFormMaster.status`.** The
  master stays `gate_a_pending`; flipping it to `in_repurpose` is a
  Gate-A-approval consequence, and Gate A has no UI until CR-10. The
  CLI consumes whatever master exists (dev convenience) without
  implying an approval that did not happen.

---

## CR-5 decisions (2026-05-31)

Pinned while implementing Stage 5 judging — the Gemini text judge,
the per-type rubrics, and the producer revise path.

### Architecture

- **2026-05-31 — The Stage-5 judge routes through the MMS gateway
  (`capability: 'text-scoring'`), not a direct SDK call.** Per
  action-plan CR-5 step 1 and the MMS "single gateway" principle
  (mms-architecture.md §12.7), the Gemini judge is modeled on the
  existing gateway-routed `core/agentic/judges/image-judge.ts`:
  `createGeminiTextJudge` calls `gateway.request(...)`, reads
  `response.result.content`, parses, and computes the composite by
  code. The CR-2/CR-3 OpenAI judges (`research-judge.ts`,
  `long-form-master-judge.ts`) remain direct-SDK; migrating them to
  the gateway is the deferred Phase-3-adapter migration
  (mms-architecture.md §11.3), explicitly out of CR-5 scope. This is
  the first CreatorOS judge that uses the gateway and the first text
  capability wired through it.
- **2026-05-31 — Gemini text capability is Core; the two judges are
  Domain.** `core/models/providers/google-gemini.ts` gains a generic
  `callGeminiText` path (text-generation + text-scoring; dispatch on
  capability first, since text models share the `gemini-` prefix with
  the native image models). The CreatorOS LinkedIn/article judges
  (`agents/linkedin/judge.ts`, `agents/article/judge.ts`) are thin
  wrappers over a shared domain factory `agents/gemini-text-judge.ts`
  that inject a type-specific serializer + caller tag. Passes the
  three-question test: the provider path is zero-domain-words machinery.
- **2026-05-31 — Cross-model enforcement (loop rule 7 / Pattern-5 rule
  10) is a domain-level guard in CR-5.** `assertCrossModel` in
  `single-producer-stage.ts` throws at stage-build time if the producer
  (Claude) and judge (Gemini) share a model family. `TODO(CR-6)`: the
  Core engine centralizes this at cross-critique iteration start; the
  domain guard covers the CR-5 Standard loop until then (no Core scope
  pulled forward). Satisfies the CR-5 step-5 "Producer ≠ Judge throws on
  overlap" requirement.
- **2026-05-31 — CR-5 adds the producer `revise()` path CR-4 deferred.**
  CR-4 was produce-only (no quality judge → no PRESERVE/IMPROVE signal).
  With the real Gemini judge, both producers gain `revise()` (mirroring
  the CR-3 synthesizer): on a sub-threshold grade the executor calls
  `revise({ context, previous, grade })` with PRESERVE/IMPROVE feedback
  derived from the grade (loop rule 4), never the rubric (rubrics.md Rule
  5). `Producer<T>.revise` is optional so mock producers without it still
  drive the loop (the executor falls back to produce).

### Cost and quality

- **2026-05-31 — The action-plan models `gemini-1.5-pro-latest` /
  `gemini-1.5-flash` are retired; CR-5 registers `gemini-2.5-pro`
  (premium) + `gemini-2.5-flash` (standard).** A live `ListModels`
  probe against the configured key confirmed the 1.5 family no longer
  supports `generateContent`; the current GA equivalents are the 2.5
  family. The judge defaults to `gemini-2.5-pro`. Mirrors prior
  model-availability decisions (nanobanan-2 disabled, Imagen omitted,
  eleven-v3 disabled). Supersedes the `gemini-1.5-*` names in
  v1-action-plan.md CR-5.
- **2026-05-31 — MMS bills a single unit per (model, capability); the
  Gemini text models bill input tokens (`1k-tokens-in`).** The gateway's
  `calculateFinalCost` applies one unit per capability; judge calls are
  input-dominated, so input-token billing (matching the `gpt-4o-vision`
  image-scoring precedent) is the chosen approximation. Output tokens are
  not separately billed in V1. The judge emits the gateway-reported cost
  into the stage total (single source of truth — the gateway already
  recorded it in the ledger).
- **2026-05-31 — Stage 5 single-producer tuning restored to threshold
  75 / min 2 / max 3.** Supersedes the CR-4 `70 / min 1 / max 2` (which
  was deliberate while the structural pass-judge gave every draft the
  same score). With a real improvement signal, a second pass is worth the
  spend; the threshold ramps to 80 in CR-7 with cross-critique. The
  `LINKEDIN_POST_RUBRIC` / `LONG_FORM_ARTICLE_RUBRIC` files set
  `passThreshold: 80` per rubrics.md (the advisory dimension/composite bar
  for `passesThreshold`); the loop terminates on the stage `threshold`
  (75) per the CR-2 follow-up decision.
- **2026-05-31 — Live CR-5 runs (BuildOS master, 6 sections): LinkedIn
  91.3→92.6 over 2 graded iterations (revise path exercised), $0.0339;
  article validation-fail→94.6, $0.0799. Total ~$0.11, far under the
  $2.00 ceiling.** The Gemini judge scored high (9+ across dimensions) on
  genuinely strong Claude output. The judge under-uses the lower bands; a
  calibration tightening pass (cf. the CR-4.5 image-judge calibration) is
  a CR-7 follow-up, not a CR-5 blocker — CR-5's contract is a working
  cross-model quality signal, which is met.

### Data model

- **2026-05-31 — CR-5 persists a real `bestScore` (the Gemini judge's
  best composite).** Supersedes CR-4's `bestScore=null`. `derivedVia`
  stays `cross_critique` (forward-compat; literally true after CR-7) and
  `status='awaiting_review'` (Gate B pending, UI in CR-11). The
  structural pass-judge + `SINGLE_PRODUCER_STRUCTURAL_RUBRIC` remain
  exported as a zero-cost test double; they are no longer the stage
  default.

### CR-5 sign-off follow-ups (2026-05-31)

The CR-5 sign-off audit returned **SIGN-OFF WITH FOLLOW-UPS** (high
confidence, zero blockers — `docs/sign-off-review/CR-5-sign-off.md`).
The scope-affecting follow-ups, recorded here so future CR steps plan
for them:

- **2026-05-31 — [MAJOR, due before CR-12] Producer + CR-2/CR-3 OpenAI
  judge spend bypasses the Core CostLedger.** Producers call the
  Anthropic SDK directly and account cost via `calculateCost → onCost`
  (an accurate stage-local accumulator); only the new gateway-routed
  Gemini judge lands in `CostLedger`. The CR-12 acceptance criterion
  reads `CostLedger.getTotal < $5.00`, which would undercount the
  dominant producer spend. Before CR-12: either route producers (and
  ideally the OpenAI judges) through the MMS gateway
  (`capability: 'text-generation'`), OR change the CR-12 budget helper
  to aggregate the stage-level `getTotalCostUSD()` totals. Pin the
  chosen approach when CR-12 is implemented. CR-5 itself is unaffected
  (its $2.00 ceiling uses the accurate stage total).
- **2026-05-31 — [due before CR-7] Bound the Gemini judge output
  budget.** gemini-2.5-pro thinks by default; a `finishReason='MAX_
  TOKENS'` empty-text response is currently mapped to a synthetic 40.
  Set an explicit `maxOutputTokens` on the judge call and/or surface
  `MAX_TOKENS` distinctly in the provider. Fold into the planned CR-7
  judge-calibration pass (the judge also under-uses the lower scoring
  bands on strong artifacts).
- **2026-05-31 — [due before CR-7] When ramping the stage termination
  bar to 80, change `SINGLE_PRODUCER_THRESHOLD` (not the rubric
  `passThreshold`, which stays 80 as the advisory bar).** The two
  values then converge; the CR-11 Gate-B UI should read
  `terminationReason`/`bestScore` vs the stage threshold, not
  `grade.passesThreshold`.
- **2026-05-31 — [due before CR-6] Centralize the producer≠judge
  model-family guard in Core** (per cross-critique-pattern.md Rule 10,
  at cross-critique iteration start) and have the Domain stage call the
  Core primitive; back family classification with the MMS catalog
  `providerId` rather than substring matching. Removes the
  domain-local `assertCrossModel`/`modelFamily` duplication
  (`TODO(CR-6)`).
- **2026-05-31 — [minor] Action-plan literal drift + test gap.**
  v1-action-plan.md CR-5 still names `gemini-1.5-*` (superseded here;
  harmless, optionally align). Add an `mms-integration.test.ts`
  assertion that a `text-scoring` request with a `gemini-2.5-*`
  modelId resolves to provider `google-gemini` (closes the
  "confirm gateway routes correctly" verification action). The judge's
  `personaContext` block is an in-spirit extension of the
  "rubric + artifact only" rule (cross-context isolation intact).

---

## CR-6 decisions (2026-05-31)

Pinned while implementing the Cross-Critique pattern (Pattern 5) in the
Core Loop Engine — TYPES + RUNTIME only, no domain wiring (CR-7).

### Architecture

- **2026-05-31 — `runCrossCritiqueIteration` lives in its own
  `src/lib/core/engine/cross-critique.ts`, dispatched from `runLoop`.**
  Mirrors the existing `tournament.ts` precedent (a sibling engine file
  that imports the Core `ModelGateway` type — a Core→Core import the
  grep-check allows). Keeps `loop-engine.ts` lean and preserves
  `types.ts`'s zero-import self-containment (the gateway-coupled adapter
  types stay out of the shared type module). The CR-6 prompt's "extend
  loop-engine.ts: runCrossCritiqueIteration" is satisfied in spirit —
  `runLoop` does the dispatch (on `stage.loopPattern === 'cross-critique'`
  via an optional, backward-compatible 6th `CrossCritiqueDeps` param);
  the heavy runner is a sibling.
- **2026-05-31 — The engine owns orchestration; prompts + parsing are
  injected via `CrossCritiqueAdapter<T>`.** Six generic, zero-domain-word
  methods (producer/critic/integrator request builders + artifact/critique
  parsers + `feedbackFromGrade`). The judge stays an injected
  `JudgeFunction` (consistent with the tournament + the rest of the
  engine). The engine never knows what a "LinkedIn post" is — CR-7 supplies
  the BuildOS prompts via the adapter. Passes the three-question test.
- **2026-05-31 — `CrossCritiqueConfig` gains an explicit
  `critics: AgentConfig[]` the doc sketch omitted.** `criticAssignments`
  maps critic→target only; the engine needs each critic's own
  `model.primary` to make the gateway call, so the critic AgentConfigs are
  explicit. Doc-alignment follow-up below.

### Cross-model rule 10 (interpretation)

- **2026-05-31 — Rule 10 is enforced as "the judge's model family must be
  disjoint from EVERY producer AND the integrator"; producers and the
  integrator MAY share a family.** cross-critique-pattern.md's literal
  "Producer ≠ Integrator ≠ Judge" is read as a chain meaning neither
  producer nor integrator may share the JUDGE's family (the documented
  self-preference-bias guard) — NOT strict pairwise distinctness. This is
  the only interpretation consistent with V1's own canonical config, which
  reuses **Claude as both Producer A and the Integrator** (Gemini judges).
  Enforced by `assertCrossCritiqueModels` at iteration start, before any
  spend; tested (`producer == judge → throws`; `producer == integrator →
  allowed`). The architect-reviewer + all five sign-off lenses concurred.

### Scope / re-deferrals (discharges the CR-5 "[due before CR-6]" item)

- **2026-05-31 — The CR-5 follow-up "[due before CR-6] centralize the
  producer≠judge guard in Core" had three clauses; clause 1 landed in
  CR-6, clauses 2–3 are re-deferred to CR-7.** Supersedes the
  "[due before CR-6]" tag on that item.
  - Clause 1 (DONE, CR-6): the guard is centralized in Core as
    `assertCrossCritiqueModels` + `classifyModelFamily` (lifted from the
    domain-local `modelFamily`), at cross-critique iteration start.
  - Clause 2 (→ CR-7): back family classification with the MMS catalog
    `providerId` instead of substring matching. CR-6 ships the structural
    `classifyModelFamily` as the default plus an injectable
    `CrossCritiqueRunnerOptions.classifyFamily` seam; the catalog-backed
    resolver wires in CR-7. **Rationale for re-deferral:** the action plan
    scopes CR-6 as "ZERO domain imports / No Domain wiring yet," so the
    catalog-backed resolver (and the domain caller it serves) cannot land
    in CR-6. V1 correctness is unaffected — the substring classifier
    classifies all V1 models (claude / gpt-4o / gemini) identically to a
    providerId-backed resolver.
  - Clause 3 (→ CR-7): remove the domain-local
    `assertCrossModel`/`modelFamily` duplication in
    `single-producer-stage.ts` and have the domain call the Core primitive;
    retarget the stale `TODO(CR-6)` to done. CR-7 owns the Stage-5
    cross-critique wiring, so the de-dup rides along naturally.
- **2026-05-31 — `LoopState` gained `terminationReason` and
  `CrossCritiqueIterationRecord.judgeGrade`/`integratedArtifact` are
  nullable — deliberate, beyond the literal prompt/doc.**
  `terminationReason` surfaces WHY the loop stopped (the doc's escalation
  presents `bestArtifact` + the reason). `judgeGrade: GradeReport | null`
  (and a nullable `integratedArtifact`) is the graceful-degradation path
  (rule 9) and the validator-rejection path (rule 6) — the judge is skipped
  when there's nothing valid to grade, mirroring `IterationRecord.grade`.

### CR-6 sign-off follow-ups (2026-05-31)

The CR-6 sign-off audit returned **SIGN-OFF WITH FOLLOW-UPS** (high
confidence, zero blockers — `docs/sign-off-review/CR-6-sign-off.md`).
Scope-affecting follow-ups, recorded so future steps plan for them:

- **2026-05-31 — [due before CR-7] Wire `options.getJudgeCostUsd` from the
  gateway-routed Gemini judge** so the hard budget cap (rule 12) counts
  judge spend, and add a test that non-zero judge cost is included in
  `cumulativeCostUSD` before the budget check. (CR-6's runner accounts
  judge cost via the `getJudgeCostUsd` seam; nothing supplies it yet.)
- **2026-05-31 — [due before CR-7] Doc-vs-code alignment in
  cross-critique-pattern.md** (+ loop-patterns.md §Pattern 5): add
  `critics: AgentConfig[]` to the `CrossCritiqueConfig` snippet and change
  `CrossCritiqueIterationRecord.judgeGrade` to `GradeReport | null` (note
  `integratedArtifact` may be null on degradation), so the authoritative
  doc matches the shipped contract.
- **2026-05-31 — [due before CR-11] The Gate-B review UI must handle a null
  `bestArtifact` + `terminationReason`** gracefully (show the failure
  reason, not an empty artifact).
- **2026-05-31 — [minor] Commit-trailer convention.** The CR-6 code commit
  omitted the `Co-Authored-By` trailer (matching CR-1..CR-5, which also
  omit it). Re-include it on subsequent commits per the harness convention;
  noted in `tasks/lessons.md`.

---

## CR-7 decisions (2026-06-01)

Pinned while wiring Stage 5 (Repurpose) LinkedIn + article stages to the
Cross-Critique pattern (Pattern 5) — the differentiator. (These were recorded
in the CR-7 sign-off follow-up commit, not the CR-7 code commit `5447eff` — the
sign-off audit flagged the gap; the cadence is restored here.)

### Architecture

- **2026-06-01 — CR-7 enables an MMS text-generation path; this is required
  scope, not creep.** The CR-6 cross-critique runner routes producers, critics,
  and the integrator through `gateway.requestMultiple`/`request` with
  `capability: 'text-generation'`, but the MMS had no Claude/GPT text path (only
  Gemini text, from CR-5). CR-7 adds the **Anthropic provider + client**
  (`core/models/providers/anthropic.ts`, text-generation via the Messages API),
  an **OpenAI text-generation handler** (`providers/openai.ts`), and catalog
  entries `claude-sonnet-4-20250514` / `claude-haiku-4-5-20251001` (anthropic) +
  `gpt-4o` (openai, distinct id from `gpt-4o-vision` which stays image-scoring,
  sharing apiModelId `gpt-4o`). All zero-domain-word Core machinery. Directly
  parallels the CR-2..CR-6 pattern of adding what the engine contract requires
  beyond the action-plan build list. The runner cannot make a single call
  without it.
- **2026-06-01 — Cross-critique role files: both producers share ONE persona.**
  `agents/{linkedin,article}/producer-gpt.ts` houses the shared producer system
  prompt + user builder + artifact parser AND both producer AgentConfigs
  (`*_PRODUCER_CLAUDE` + `*_PRODUCER_GPT`), because the two producers receive
  identical task params via `requestMultiple` and differ only by model. The CR-4
  `producer-claude.ts` is left intact as the Standard-loop single-producer (test
  double + off-CLI path). The two critics share one critic persona
  (`critic-claude-on-gpt.ts`; `critic-gpt-on-claude.ts` re-exports it + its own
  config). Sign-off noted the `*_PRODUCER_CLAUDE` config living in
  `producer-gpt.ts` is mildly surprising; the file header documents it. Rename
  to `producer-shared.ts` is an optional discoverability follow-up (no functional
  impact).
- **2026-06-01 — The engine owns orchestration; the Domain supplies a
  `CrossCritiqueAdapter` (prompts + parsers) + `CrossCritiqueConfig` (models).**
  `cross-critique-stage.ts` composes them into `LINKEDIN_POST_STAGE` /
  `LONG_FORM_ARTICLE_STAGE` (`loopPattern='cross-critique'`) + a
  `runCrossCritiqueLoop` driver (mirrors `runProducerLoop`). The driver passes a
  throwing `NOOP_EXECUTOR` for the unused `AgentExecutor` arg (the runner
  dispatches cross-critique before the executor is reached).

### Cost and quality

- **2026-06-01 — MMS token billing extended to input + output (additive,
  backward-compatible).** `PricingEntry` gains an optional `costPerUnitOut`;
  `gateway.calculateFinalCost`'s `'1k-tokens-in'` branch now adds
  `output × costPerUnitOut` when present. Generation models (claude / gpt-4o
  text-generation) set it (output-dominated → accurate ledger); the Gemini
  judges (`text-scoring`) omit it, preserving the CR-5 input-only judge
  convention. Every existing single-unit entry is unchanged. Rates match the
  authoritative direct-SDK `core/agentic/pricing.ts` (Sonnet $3/$15, Haiku
  $1/$5, GPT-4o $2.50/$10 per MTok).
- **2026-06-01 — Stage-5 termination bar ramped to 80 via a NEW
  `CROSS_CRITIQUE_THRESHOLD=80` constant; `SINGLE_PRODUCER_THRESHOLD` stays 75.**
  Supersedes the literal CR-5 follow-up wording ("change `SINGLE_PRODUCER_
  THRESHOLD`"): CR-7 routes the production CLI to the new cross-critique stages,
  so the single-producer stages (75) are now off the production path (test
  doubles / Standard-loop). The cross-critique stages set threshold 80, min 2,
  max 4, `maxBudgetUSD=2.00`. The CR-5 follow-up is **discharged** under this
  reconciliation.
- **2026-06-01 — Live CR-7 run (BuildOS master, 6 sections): LinkedIn 92.8/100
  in 2 iterations ($0.138); article 91.3/100 in 2 iterations ($0.310); total
  ~$0.45** — far under the $4.00 session ceiling and each stage's $2.00 cap. 6
  gateway calls per iteration (2 producers + 2 critics + integrator + judge).
  The integrator visibly synthesized both producers' drafts. Cosine similarity
  between consecutive integrated artifacts: LinkedIn v1→v2 ≈ 0.920, article
  v1→v2 ≈ 0.937 — both marginally over the 0.92 advisory. Per the decisions-log
  mechanization this is a **warning, not a gate**; it signals iteration 2 stayed
  close to iteration 1 (both converged on the same strong framing; best score
  came from iteration 1 in both). Judge-calibration / iteration-divergence tuning
  is a CR-12 follow-up, not a CR-7 blocker.
- **2026-06-01 — Gemini judge output bounded (`maxOutputTokens=4096`, discharges
  the CR-5 "[due before CR-7]" follow-up).** `GeminiTextJudgeDeps.maxOutputTokens`
  is configurable; the judge passes it into the gateway request. A generous-but-
  finite cap; an over-budget (MAX_TOKENS) empty response degrades to a synthetic
  failing grade → the loop revises (rule 9). Judges still bill input-only, so the
  cap is a real-API-spend guard, not a ledger-cost lever.

### Discharged carry-forward follow-ups

- **2026-06-01 — CR-6 "[due before CR-7]" follow-ups DONE.** (1) `options.
  getJudgeCostUsd` is wired from the gateway-routed Gemini judge via a
  delta-accumulator in `cross-critique-stage.ts`, so judge spend folds into
  `cumulativeCostUSD` before the budget check (tested). (2) Doc alignment:
  `cross-critique-pattern.md` + `loop-patterns.md` now show
  `critics: AgentConfig[]` and `judgeGrade: GradeReport | null` (+ nullable
  `integratedArtifact`).
- **2026-06-01 — CR-5 "[due before CR-6] clause 2 + 3" DONE.** Clause 2: the
  rule-10 family guard is backed by the MMS catalog `providerId` via
  `catalogModelFamily` (modelId → catalog providerId, falling back to the Core
  structural classifier), injected as `CrossCritiqueRunnerOptions.classifyFamily`.
  Clause 3: `single-producer-stage.ts` `assertCrossModel` now delegates to the
  Core `classifyModelFamily` (domain-local `modelFamily` deleted; stale
  `TODO(CR-6)` removed).
- **2026-06-01 — CR-5 "[MAJOR, due before CR-12] producer ledger" PARTIALLY
  discharged.** Stage-5 producer/critic/integrator spend now routes through the
  gateway → lands in `CostLedger`. Remaining for CR-12: Stage 2 (source-curator,
  research-judge) and Stage 3 (long-form-synthesizer, long-form-master-judge)
  still call SDKs directly and bypass the ledger; the off-CLI single-producer
  Standard path too. See the CR-7 follow-ups below.

### CR-7 sign-off follow-ups (2026-06-01)

The CR-7 sign-off audit returned **SIGN-OFF WITH FOLLOW-UPS** (high confidence,
zero blockers — `docs/sign-off-review/CR-7-sign-off.md`). Scope-affecting
follow-ups, recorded so future steps plan for them:

- **2026-06-01 — [MAJOR, due before CR-12] Finish cost-ledger completeness.**
  Pin the CR-12 approach: either route the Stage-2/3 producers + OpenAI judges
  (`source-curator`, `research-judge`, `long-form-synthesizer`,
  `long-form-master-judge`) through the MMS gateway (`text-generation`), OR change
  the CR-12 budget assertion to sum the stage-level cost totals rather than read
  `CostLedger.getTotal` alone. Stage-5 cross-critique spend already lands in the
  ledger; the remaining work is narrowed to Stages 2/3.
- **2026-06-01 — [due before CR-12] Unit-test `cosineSimilarity` +
  `consecutiveSimilarities`** (`scripts/lib/embedding-similarity.ts`): the pure
  math is load-bearing for the acceptance cosine ≤ 0.92 check and CR-12 reuses it
  identically (orthogonal→0, identical→1, a known-pair value).
- **2026-06-01 — [due before CR-11] Surface a dialectic-degradation signal on the
  cross-critique iteration record** (e.g. a `producersSucceeded` count) when
  `producerArtifacts` has < 2 entries, so the Gate-B UI shows the loop degraded to
  single-author synthesis rather than a normal iteration; add a zero-producers
  unit test.
- **2026-06-01 — [due before CR-12] Thread role `AgentConfig.timeoutMs` into the
  adapter `CallSpec.timeoutMs`** in `buildAdapter` (or drop the unused 180_000 on
  the article producer config and document the deliberate 120s gateway default),
  so the declared timeout is the effective timeout.
- **2026-06-01 — [minor] Optional rename `producer-gpt.ts` → `producer-shared.ts`**
  for discoverability (it houses both producer configs + the shared persona). No
  functional impact.
- **2026-06-01 — [human input] Manual quality judgment (acceptance criteria 2 &
  3).** Are the live-run LinkedIn post (92.8/100) and article (91.3/100)
  publishable without rewrite? Lenses verified the mechanized loop, not the prose;
  artifacts are at `tmp/runs/<idea-id>/`.
