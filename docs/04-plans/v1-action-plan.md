# CreatorOS V1 — Action Plan (MVP-First)

> 12 ultracode sessions. First real LinkedIn post by session 4.
> Cross-critique differentiator by session 7. Full V1 by session 12.

## How to run a CR step

Every CR step is **one Claude Code session** with:

- `/effort ultracode` set (Max plan defaults this on; Pro toggles via
  `/config`)
- Auto Mode enabled (reduces approval friction)
- The `cr-step-protocol` skill auto-loaded (sits in `.claude/skills/`)
- The session prompt below pasted as first message

The protocol skill tells Claude Code to:

1. Read `CLAUDE.md` first
2. Read the route-target docs from CLAUDE.md's routing table
3. Read `docs/04-plans/v1-action-plan.md` for the current step
4. Run the step end-to-end (use Dynamic Workflows / subagents as
   appropriate)
5. Run all verification gates
6. Commit + tag
7. Report final state

After each step, you'll get a one-message report. No babysitting
between steps.

## Milestones

```
MILESTONE 0 — Knowledge + Fork (2 prep sessions)
  CR-0.5   Knowledge bootstrap (THIS BUNDLE)
  CR-0     Fork bootstrap (purge eLearn Domain)

MILESTONE 1 — First real post (3 ultracode sessions)
  CR-1     Minimal schema + BuildOS persona seeded
  CR-2     Research stage end-to-end (CLI run → real dossier on disk)
  CR-3     Long-Form Master synthesizer (structured sections persisted)
  CR-4     Single-model producers — LinkedIn + Article (CLI run)
           🎉 YOU SEE: a real LinkedIn post + article for BuildOS persona

MILESTONE 2 — Cross-critique quality (3 ultracode sessions)
  CR-5     MMS Gemini + judge wiring + rubrics for both artifacts
  CR-6     Cross-critique types + runtime (Core extension)
  CR-7     Wire LinkedIn + Article to cross-critique mode
           🎉 YOU SEE: visibly better posts; iteration history

MILESTONE 3 — UI + polish (3 ultracode sessions)
  CR-8     Context system + Workspace/role schema
  CR-9     CRUD UIs (Persona + Workspace + Idea log + Idea Coach)
  CR-10    Gate A UI (source traceability panel)
  CR-11    Gate B UI (inline editor + regenerate + diff)

MILESTONE 4 — V1 acceptance (1 session)
  CR-12    V1 acceptance test + decisions log + tag v1.0
```

---

## CR-0.5 — Knowledge bootstrap

**You will see:** `docs/` populated, `.claude/` configured, CLAUDE.md
addendum applied. All existing tests still pass.

**Session prompt:**

```
Read CLAUDE.md. This is CreatorOS CR-0.5: Knowledge bootstrap.

The bundle at /mnt/user-data/uploads/CreatorOS_CR-0.5_bundle.tar.gz
contains all documentation and Claude Code configuration for
CreatorOS. Your job: extract it, place every file at its correct
location in the repo, append the CLAUDE.md addendum, run
verification gates, commit + tag.

NO source code changes in this step. Docs and config only.

Steps:

1. Verify prerequisites:
     pwd                                    (should end in vovai-creator-aios)
     git remote -v                          (should be vovai-creator-aios.git)
     git tag | grep CR-pre-bootstrap-clean  (must exist)

2. Extract the bundle:
     tar -xzf /mnt/user-data/uploads/CreatorOS_CR-0.5_bundle.tar.gz \
         -C /tmp/
     ls /tmp/CreatorOS_CR-0.5_bundle/

3. Place files at their target locations in the repo:
   - Copy /tmp/CreatorOS_CR-0.5_bundle/docs/ to ./docs/ (verbatim)
   - Copy /tmp/CreatorOS_CR-0.5_bundle/.claude/ to ./.claude/ (verbatim)
   - Confirm /tmp/CreatorOS_CR-0.5_bundle/CLAUDE.md.addendum.md exists.

4. Append the CLAUDE.md addendum:
   - Read /tmp/CreatorOS_CR-0.5_bundle/CLAUDE.md.addendum.md
   - Append its full content to the existing ./CLAUDE.md (preserve
     existing content; add the addendum at the end)
   - Verify the routing table is now visible at the end of CLAUDE.md

5. Place the CR-0 session prompt for later use:
   - Copy /tmp/CreatorOS_CR-0.5_bundle/CR-0_session_prompt.md to
     ./docs/04-plans/CR-0_session_prompt.md

6. Verification gates (all must pass):
     npm run typecheck         → exit 0
     npm run test              → all green; same count as CR-pre-bootstrap-clean
     ls docs/                  → 6 subdirectories present
     ls .claude/agents/        → 4 agent files
     ls .claude/skills/        → 4 skill folders
     tail -5 CLAUDE.md         → shows routing table or @imports
     grep -rE "from ['\"][^'\"]*domain/" src/lib/core/   → nothing

7. Commit + tag:
     git add -A
     git commit -m "CR-0.5: knowledge bootstrap — docs/, .claude/, CLAUDE.md addendum"
     git tag CR-0.5-knowledge-bootstrap
     git push origin main
     git push origin CR-0.5-knowledge-bootstrap

Final report:
- Output of: ls docs/00-foundation/ docs/01-architecture/ docs/02-domain/
             docs/03-decisions/ docs/04-plans/ docs/05-claude-code/
- Output of: ls .claude/agents/ .claude/skills/
- Last 30 lines of CLAUDE.md (to confirm addendum applied)
- Test count
- Tag pushed: CR-0.5-knowledge-bootstrap
```

**Verification:**

```bash
git tag | grep CR-0.5
ls docs/
ls .claude/
```

---

## CR-0 — Fork bootstrap (purge eLearn Domain)

**You will see:** eLearn Domain content archived. CreatorOS skeleton
scaffolded under `src/lib/domain/workflows/creator/`. All Core tests
still pass. Empty `src/app/api/` ready for CR-2 onwards.

**Session prompt:** See `docs/04-plans/CR-0_session_prompt.md`
(written to the repo during CR-0.5).

**Verification:**

```bash
git tag | grep CR-0-fork-bootstrap
grep -rE "from ['\"][^'\"]*domain/" src/lib/core/   # nothing
ls src/lib/domain/workflows/creator/                # skeleton present
ls src/app/api/                                     # essentially empty
```

---

## CR-1 — Minimal schema + BuildOS persona seeded

**You will see:** A Prisma migration creating the minimal CreatorOS
data model. A seed script creating one BuildOS persona and one
test idea. The DB inspected via Prisma Studio shows real rows.

**Session prompt:**

```
Read CLAUDE.md. This is CreatorOS CR-1.

Prior step CR-0 done: eLearn Domain purged, skeleton scaffolded.

Goal: create the minimal CreatorOS schema in prisma/schema.prisma,
generate + apply a migration, seed one BuildOS persona with one
idea. NO UI in this step. NO API routes. Schema and seed only.

Read first:
  - docs/02-domain/entities.md       (the entity shape)
  - docs/03-decisions/creator-decisions-log.md (the seed entries)

Schema scope (V1 minimum):

  User
    - id, email, name, createdAt, updatedAt

  CreatorPersona
    - id, userId, name
    - niches String[]
    - voiceTone Json    (formality, vocabulary, signaturePhrases[], doNotSay[])
    - audienceProfile Json
    - creatorProfile Json
    - defaultRubricRefs Json
    - createdAt, updatedAt

  Workspace
    - id, userId, personaId, name, description
    - role enum WorkspaceRole { admin, writer, editor, reviewer }
      (V1: every row has role='admin')
    - createdAt, updatedAt

  Idea
    - id, workspaceId, title, description
    - niches String[]
    - sourceUrl String?
    - status enum IdeaStatus { captured, in_progress, completed, archived }
    - promotedAt DateTime?
    - createdAt, updatedAt

  LongFormMaster
    - id, workspaceId, ideaId, title
    - status enum MasterStatus { draft, gate_a_pending, approved, in_repurpose }
    - createdAt, updatedAt

  LongFormSection
    - id, longFormMasterId, order Int
    - heading, contentMarkdown

  ResearchSource
    - id, longFormMasterId
    - url, type enum SourceType { web, upload }
    - title, snippet, fetchedAt

  SourceRef
    - id, sectionId, researchSourceId, relevanceSnippet

  Artifact
    - id, workspaceId, longFormMasterId
    - artifactType enum ArtifactType { linkedin_post, long_form_article }
    - content Json
    - parentArtifactIds String[]
    - derivedVia enum DerivedVia { cross_critique, inline_edit, regenerate, merge }
    - bestScore Float?
    - status enum ArtifactStatus { draft, awaiting_review, approved, rejected }
    - costUSD Float
    - createdAt, updatedAt

Seed script at prisma/seed.ts:
  - Create User: id='local-user', email='local@creator.os'
  - Create CreatorPersona "BuildOS Creator" with rich voice/audience/creator
    fields — read docs/00-foundation/identity-and-scope.md and the
    persona section in docs/02-domain/agents-and-personas.md to write
    a persona Srinivas would actually use for AI content
  - Create one Workspace pointing at that persona
  - Create one Idea: title "Why sequential cross-critique beats
    tournament for content generation", status='captured', tagged
    niches=['agentic AI', 'AI engineering']
  - Add npm script: "db:seed": "tsx prisma/seed.ts"

Verification:
  npx prisma migrate dev --name cr_1_creator_schema
  npm run db:seed
  npx prisma studio        (manually verify rows visible)
  npm run typecheck
  npm run test             (still green; we haven't broken anything)
  grep -rE "from ['\"][^'\"]*domain/" src/lib/core/   → nothing

Commit + tag:
  git add -A
  git commit -m "CR-1: minimal CreatorOS schema + BuildOS persona seeded"
  git tag CR-1-schema
  git push origin main
  git push origin CR-1-schema

Final report:
- Output of: npx prisma studio (skip; just confirm rows count)
- Output of: select count(*) on each table via a small inspect script
- Test count
- Tag pushed
```

---

## CR-2 — Research stage end-to-end (FIRST VISIBLE OUTPUT)

**You will see:** A CLI script that runs the Research agent against
the seeded BuildOS idea. Real ResearchDossier saved to disk. Real
ResearchSource rows in the DB. **You can read the dossier.**

**Session prompt:**

```
Read CLAUDE.md. This is CreatorOS CR-2.

Prior step CR-1 done: schema + seed. Now we produce real content.

Goal: implement Stage 2 (Research) end-to-end. CLI-driven. No UI.
At the end of this session you should be able to run:

  npm run pipeline:research -- --ideaId=<seeded-idea-id>

and see a real ResearchDossier saved at
tmp/runs/<idea-id>/research-dossier.json with 8-15 ResearchSource
rows persisted in the DB linked to a draft LongFormMaster row.

Read first:
  - docs/02-domain/pipeline-v1.md (Stage 2 section)
  - docs/02-domain/agents-and-personas.md (Research Agent, Source Curator)
  - docs/02-domain/rubrics.md (RESEARCH_RUBRIC)
  - docs/01-architecture/loop-engine.md (Standard loop pattern)

Use subagents for parallel work:
  - Use a subagent to investigate how the existing Anthropic SDK
    integration in src/lib/core/agentic/ exposes web_search to
    producer agents.
  - Use a subagent to write tests for RESEARCH_RUBRIC weights and
    validator while you build the agent.

Build:

1. Agents at src/lib/domain/workflows/creator/agents/:
   - research-agent.ts (Claude Sonnet with web_search tool)
   - source-curator.ts (Claude Sonnet, dedupe + rank)

2. Rubric at src/lib/domain/workflows/creator/rubrics/research-rubric.ts
   (5 dims per docs/02-domain/rubrics.md, weights sum to 1.0,
   threshold 75)

3. Validator: dossier.sources.length >= 3, all URLs valid format.

4. Stage config at src/lib/domain/workflows/creator/pipeline-config.ts:
   add RESEARCH_STAGE: LoopStage<ResearchDossier>

5. Persistence: at end of approved/passing iteration, create:
   - LongFormMaster row (status='draft')
   - ResearchSource rows linked to it
   (SourceRefs come in CR-3 when sections exist.)

6. CLI script scripts/pipeline-research.ts:
   - Read --ideaId arg
   - Load Idea + Workspace + CreatorPersona
   - Run RESEARCH_STAGE loop to completion (auto-approve since this
     is dev — gate UI comes in CR-10)
   - Save dossier JSON to tmp/runs/<idea-id>/research-dossier.json
   - Print: "Done. 12 sources. Cost: $0.34. Dossier at <path>."

7. Tests at tests/unit/domain/research-stage.test.ts:
   - Validator rejects <3 sources
   - Rubric weights sum to 1.0
   - One iteration produces a dossier (mocked gateway)
   - Cost tracked per iteration

Verification:
  npm run typecheck && npm run test
  grep -rE "from ['\"][^'\"]*domain/" src/lib/core/   → nothing
  npm run pipeline:research -- --ideaId=<seeded-id>   → real dossier
  cat tmp/runs/<idea-id>/research-dossier.json         → 8-15 sources

Commit + tag:
  git tag CR-2-research-stage

Cost ceiling for this session: $1.00 (research is cheap).

Final report:
- ResearchSource count in DB
- Sample of source titles + URLs
- Total cost reported
- Tag pushed
```

---

## CR-3 — Long-Form Master synthesizer

**You will see:** A CLI script that takes the approved dossier and
builds a structured LongFormMaster with sections and SourceRefs.
**You can read the Master.**

**Session prompt:**

```
Read CLAUDE.md. This is CreatorOS CR-3.

Prior step CR-2 done: research dossier produced + persisted.

Goal: Stage 3 (Long-Form Master synthesizer). CLI-driven. End of
session you can run:

  npm run pipeline:master -- --longFormMasterId=<draft-id>

and see a structured master at tmp/runs/<idea-id>/long-form-master.md
with sections + SourceRefs persisted in the DB.

Read first:
  - docs/02-domain/pipeline-v1.md (Stage 3 section)
  - docs/02-domain/entities.md (LongFormMaster + sections shape)
  - docs/02-domain/rubrics.md (LONG_FORM_MASTER_RUBRIC)

Build:

1. Agent: long-form-synthesizer.ts (Claude Sonnet, structured output)
   Output schema (enforced via prompt):
     { title, sections: [{ order, heading, contentMarkdown,
                            sourceRefs: [{ researchSourceId,
                                           relevanceSnippet }] }] }

2. Validator (deterministic):
   - sections.length >= 3
   - every section has heading + contentMarkdown
   - every section has sourceRefs.length >= 1
   - every sourceRef.researchSourceId exists in the dossier
   - total word count >= 800

3. Rubric: LONG_FORM_MASTER_RUBRIC per docs/02-domain/rubrics.md,
   threshold 80.

4. Stage config: LONG_FORM_MASTER_STAGE: LoopStage<LongFormMaster>

5. Persistence on iteration approval:
   - Update LongFormMaster row (title, status='gate_a_pending')
   - Create LongFormSection rows (in order)
   - Create SourceRef rows linking sections to existing
     ResearchSource rows

6. Context curation: use PassthroughCurator with priorities:
   persona=10, idea=10, researchSources=8, uploadedDocs=6

7. CLI script scripts/pipeline-master.ts:
   - Auto-approve (Gate A UI comes in CR-10)
   - Render the saved master as markdown to
     tmp/runs/<idea-id>/long-form-master.md
   - Print summary: section count, word count, cost

8. Tests at tests/unit/domain/long-form-master.test.ts:
   - Validator rejects sectionless output
   - Validator rejects sections without sourceRefs
   - Persistence wires SourceRef correctly
   - Rubric weights sum to 1.0

Cost ceiling: $1.50.

Commit + tag CR-3-long-form-master.

Final report: section count, sample headings, total word count, cost.
```

---

## CR-4 — Single-model producers (🎉 FIRST POSTS)

**You will see:** A CLI script that runs single-model producers
(Claude only, no cross-critique yet, no judge) for both
`linkedin_post` and `long_form_article`. Real LinkedIn post + real
article on disk. **This is the MVP moment.**

**Session prompt:**

```
Read CLAUDE.md. This is CreatorOS CR-4. THE MVP MOMENT.

Prior step CR-3 done: Long-Form Master persisted.

Goal: produce real artifacts (LinkedIn post + article) using
single-model producers. NO cross-critique yet (CR-6/CR-7). NO judge
(CR-5). Just one Claude producer per artifact type, with the
deterministic validator, persisted as Artifact rows, written to disk.

End of session you can run:

  npm run pipeline:produce -- --longFormMasterId=<id> --type=linkedin_post
  npm run pipeline:produce -- --longFormMasterId=<id> --type=long_form_article

and read the output. THIS is the first time real CreatorOS content
exists.

Read first:
  - docs/02-domain/agents-and-personas.md (producer persona template)
  - docs/02-domain/entities.md (Artifact shape)
  - docs/02-domain/rubrics.md (LinkedIn + article rubrics — for
    reference only; producers don't see the rubric)

Build:

1. Agents (single producer per type, no cross-critique yet):
   - src/lib/domain/workflows/creator/agents/linkedin/producer-claude.ts
   - src/lib/domain/workflows/creator/agents/article/producer-claude.ts
   Both follow the Forge persona document template from
   docs/02-domain/agents-and-personas.md.

2. Validators:
   - LinkedIn: charCount in [1300, 3000]; >=2 paragraph breaks
   - Article: wordCount in [1200, 3000]; >=2 H2 sections; explicit
     intro + conclusion

3. Stage config: SINGLE_PRODUCER_LINKEDIN_STAGE,
   SINGLE_PRODUCER_ARTICLE_STAGE. Both use loopPattern='standard'
   for now (CR-7 swaps to 'cross-critique').
   min=1, max=2, threshold=70 (lower bar; CR-5+CR-7 raise it).

4. Persistence: Artifact rows with:
   - artifactType
   - content (the post/article)
   - derivedVia='cross-critique' (will be true after CR-7; for CR-4
     mark as 'cross-critique' for forward compat)
   - parentArtifactIds=[] (no fork yet)
   - costUSD

5. CLI script scripts/pipeline-produce.ts:
   - Take --longFormMasterId and --type args
   - Run the right stage
   - Write to tmp/runs/<idea-id>/<type>.md (markdown for article,
     text for linkedin)
   - Print: "Generated <type> at <path>. <wordcount/charcount>. Cost: $X"

6. Tests at tests/unit/domain/single-producers.test.ts:
   - Validators reject out-of-range outputs
   - Successful iteration creates Artifact row

Cost ceiling: $1.00.

Commit + tag CR-4-single-producers.

Final report: paths to the two output files, char/word counts,
total cost. ALSO: paste the first 200 chars of the LinkedIn post
and the first 100 words of the article INTO the report so I can see
the first real CreatorOS output.
```

---

## CR-5 — MMS Gemini + judge + rubrics

**You will see:** Existing producers now have rubric-based grading
via Gemini judge. Loop is real: producer → validator → judge →
score → revise or present.

**Session prompt:**

```
Read CLAUDE.md. This is CreatorOS CR-5.

Prior step CR-4 done: single-model producers output content.

Goal: add Gemini provider to MMS, wire the judge to existing
LinkedIn + article stages, attach rubrics. Now the loop has real
quality discipline — producers iterate to threshold.

Read first:
  - docs/01-architecture/mms-architecture.md (provider client shape)
  - docs/02-domain/rubrics.md (LinkedIn + article rubrics)
  - docs/01-architecture/loop-engine.md (judge function)

Use a subagent to investigate the existing MMS provider clients
(google-gemini may or may not already be registered; the eLearn
MMS catalog had it for image generation) and report what already
exists. Build only what's missing.

Build:

1. MMS Gemini text capability:
   - Verify src/lib/core/models/providers/google-gemini.ts supports
     text-generation and text-scoring capabilities
   - Add gemini-1.5-pro-latest (premium) and gemini-1.5-flash
     (standard) entries in model-inventory.ts if missing
   - Run existing Core tests to confirm gateway routes correctly

2. Rubrics:
   - src/lib/domain/workflows/creator/rubrics/linkedin-post-rubric.ts
   - src/lib/domain/workflows/creator/rubrics/article-rubric.ts
   - Per docs/02-domain/rubrics.md

3. Judge agents (Gemini, fresh-context, never sees critiques):
   - src/lib/domain/workflows/creator/agents/linkedin/judge.ts
   - src/lib/domain/workflows/creator/agents/article/judge.ts
   - Implement reasoning-before-scoring (Forge ADOPT 5)
   - Composite score calculated by code, not by LLM

4. Wire judge into existing single-producer stages:
   - threshold: 75 (raised from CR-4's 70; ramp to 80 in CR-7)
   - min 2 / max 3 iterations
   - PRESERVE/IMPROVE feedback to producers between iterations

5. Tests at tests/unit/domain/judge-grading.test.ts:
   - Rubric weights sum to 1.0
   - Reasoning-required validation on judge prompts
   - Composite score = sum(dim.score × dim.weight × 10)
   - Producer ≠ Judge enforcement throws on overlap

Cost ceiling: $2.00 (judge calls add up).

Commit + tag CR-5-mms-judge.

Final report: provider catalog state, rubric files created, sample
of a judge's reasoning output, total cost.
```

---

## CR-6 — Cross-critique types + runtime

**You will see:** Core engine extended with `'cross-critique'` loop
pattern. `runCrossCritiqueIteration()` works end-to-end with mocked
agents.

**Session prompt:**

```
Read CLAUDE.md. This is CreatorOS CR-6.

Prior step CR-5 done: judge wired, rubrics in place.

Goal: extend the Core Loop Engine with the cross-critique pattern.
TYPES + RUNTIME. No Domain wiring yet (that's CR-7).

ZERO domain imports allowed. This is pure Core machinery extension.

Read first:
  - docs/01-architecture/cross-critique-pattern.md
  - docs/01-architecture/loop-engine.md
  - docs/01-architecture/loop-patterns.md (Pattern 5)
  - docs/03-decisions/creator-decisions-log.md (the 6 Pattern-5 rules)

Build:

1. Extend src/lib/core/engine/types.ts:
   - LoopPattern union now includes 'cross-critique'
   - LoopStage<T> gains:
       maxBudgetUSD?: number
       crossCritique?: CrossCritiqueConfig
   - New interfaces:
       CrossCritiqueConfig
       CrossCritiqueIterationRecord (extends IterationRecord)
   - LoopState<T> gains: cumulativeCostUSD: number

2. Extend src/lib/core/engine/loop-engine.ts:
   - Internal function runCrossCritiqueIteration<T>
     Steps: parallel produce → parallel critique → sequential
            integrate → sequential judge → record → decide next
   - Use gateway.requestMultiple() for parallel calls
   - runLoop() dispatches on stage.loopPattern; cross-critique routes
     to runCrossCritiqueIteration
   - Producer ≠ Integrator ≠ Judge enforcement at iteration start
     (throws if model overlap detected)
   - Budget exhaustion termination with terminationReason marker

3. Tests at tests/unit/core/cross-critique.test.ts:
   - 6-call iteration with mocked gateway returns full record
   - Cost summed across all sub-calls
   - Budget exhaustion → 'presenting' + reason='budget_exhausted'
   - Threshold met → 'presenting' + reason='threshold_met'
   - Max iter → 'presenting' + reason='max_iterations'
   - Producer == Judge model → throws at iteration start
   - minIterations enforced
   - bestArtifact tracking across iterations

Verification:
  grep -rE "from ['\"][^'\"]*domain/" src/lib/core/   → nothing
  npm run test -- tests/unit/core/   → all green incl. new tests

Commit + tag CR-6-cross-critique-runtime.

This is a Core enhancement. Note in commit message: "eLearn AIOS
inherits this pattern; back-port via separate PR on eLearn repo."

Final report: test count delta, sample iteration record shape,
confirmation of model-overlap throw.
```

---

## CR-7 — Wire LinkedIn + article to cross-critique (🎉 DIFFERENTIATOR)

**You will see:** The two production stages now use cross-critique
mode. Each iteration produces visibly different versions; the
integrator synthesizes. Iteration history tracks all of it.
**This is where CreatorOS becomes CreatorOS, not "AI writes a post."**

**Session prompt:**

```
Read CLAUDE.md. This is CreatorOS CR-7. DIFFERENTIATOR MOMENT.

Prior step CR-6 done: cross-critique runtime in Core.

Goal: wire LinkedIn and article stages to cross-critique mode. Two
producers (Claude + GPT-4o), mutual critique, Claude integrator,
Gemini judge. maxBudgetUSD=2.00 each. End of session, re-run the
pipeline; visibly better outputs with full iteration history.

Read first:
  - docs/01-architecture/cross-critique-pattern.md
  - docs/02-domain/agents-and-personas.md (full agent set per stage)

Use Dynamic Workflows for parallel agent-prompt authoring:
"workflow: author 6 producer/critic/integrator/judge agent files
for the linkedin stage and 6 for the article stage, following the
Forge persona document template in
docs/02-domain/agents-and-personas.md."

Build:

1. LinkedIn agent set at src/lib/domain/workflows/creator/agents/linkedin/:
   - producer-claude.ts        (already exists from CR-4 — adapt)
   - producer-gpt.ts            (new — GPT-4o)
   - critic-claude-on-gpt.ts    (Claude reading GPT's output)
   - critic-gpt-on-claude.ts    (GPT reading Claude's output)
   - integrator.ts              (Claude — synthesizes both + critiques)
   - judge.ts                   (already exists from CR-5 — keep as-is)

2. Article agent set at src/lib/domain/workflows/creator/agents/article/:
   Same six. Different prompts, different platform constraints.

3. Update stage configs to use loopPattern='cross-critique':
   - LINKEDIN_POST_STAGE
   - LONG_FORM_ARTICLE_STAGE
   With crossCritique: { producers, criticAssignments,
                         integratorAgent, judgeAgent }
   maxBudgetUSD: 2.00 on both.
   threshold: 80, min 2, max 4.

4. Producers MUST NOT include rubric text. Only PRESERVE/IMPROVE
   feedback from judge between iterations.

5. Update scripts/pipeline-produce.ts to call cross-critique stages.
   Print iteration history at the end: per iteration show producer
   A scores, producer B scores, integrator output snippet, judge
   grade per dimension, iteration cost.

6. Tests at tests/unit/domain/linkedin-cross-critique.test.ts and
   article-cross-critique.test.ts:
   - Producer prompt assertions: no rubric text
   - Budget cap triggers termination
   - Each iteration produces 6 LLM calls
   - bestArtifact tracking works across iterations

Run the real pipeline at the end (one LinkedIn + one article).
Cost ceiling: $4.00 total this session.

Commit + tag CR-7-cross-critique-production.

Final report:
- Paths to the two final artifacts
- Per-stage iteration count (typically 2-3)
- Per-stage cumulative cost
- For LinkedIn: first iteration's two producer outputs side-by-side
  (first 200 chars each) and the integrator's final (first 200 chars)
  so I can see the synthesis in action
- Cosine similarity between consecutive integrated artifacts
  (assert ≤ 0.92; see docs/03-decisions/creator-decisions-log.md
  acceptance test mechanization)
```

---

## CR-8 — Context system + Workspace/role schema extension

**You will see:** `src/lib/core/context/` exists with PassthroughCurator.
Workspace + role schema fields wired in. Context curation applied at
Stage 3 and Stage 5.

**Session prompt:** (compact — full prompt assembled by Claude Code
from the routing table and the per-stage docs)

```
Read CLAUDE.md. CreatorOS CR-8.

Build the Context Engineering System (Core, thin seam) and finish
the workspace/role schema if anything was deferred from CR-1.

Read first:
  - docs/01-architecture/context-system.md
  - docs/02-domain/pipeline-v1.md (context curation per stage)

Build:
1. src/lib/core/context/types.ts + passthrough-curator.ts +
   tests. ZERO domain imports.
2. Wire PassthroughCurator at Stage 3 (LFM synth) and Stage 5
   (both cross-critique stages) per the priority tables in
   docs/01-architecture/context-system.md.
3. Verify Workspace.role enum is used correctly (V1: all 'admin').
   If anything was missing in CR-1, fix now.

Commit + tag CR-8-context-system.
```

---

## CR-9 — CRUD UIs (Persona + Workspace + IdeaLog + Idea Coach)

**You will see:** Real web UI at `/personas`, `/workspaces`,
`/workspaces/[id]/ideas`. "Coach my ideas" button works.

**Session prompt:** (compact)

```
Read CLAUDE.md. CreatorOS CR-9. UI sprint.

Build CRUD UIs for Persona, Workspace, IdeaLog, plus the
Idea Coach agent integration. shadcn/ui + Tailwind. No design
system invention.

Use Dynamic Workflows for parallel page authoring:
"workflow: author Next.js pages for /personas (list, new, edit),
/workspaces (list, new), /workspaces/[id] (dashboard), and
/workspaces/[id]/ideas (table with filters)."

Read first:
  - docs/02-domain/entities.md
  - docs/02-domain/agents-and-personas.md (Idea Coach section)
  - docs/03-decisions/creator-decisions-log.md (UI scope and auth)

Hardcoded user "local-user" — no Clerk. // TODO(V2): wire Clerk

Build the Idea Coach agent + POST /api/workspaces/[id]/ideas/coach.
"Coach my ideas" modal on /workspaces/[id]/ideas with umbrella +
niche fields. Returns 3-5 proposals as cards; each has "Add to log."

Tests:
- CRUD round-trips on each entity
- Idea Coach returns 3-5 topics
- Niche filter and status filter work

Commit + tag CR-9-crud-ui.
```

---

## CR-10 — Gate A UI (source traceability panel)

**You will see:** Workspace dashboard shows pipeline runs. Click a
draft Long-Form Master → Gate A review page. Sections rendered.
Click any section → side panel with linked ResearchSources +
snippets. Approve / Feedback / Reject / Inline-edit actions wired.

**Session prompt:** (compact)

```
Read CLAUDE.md. CreatorOS CR-10.

Build Gate A — the non-negotiable source traceability gate.

Read first:
  - docs/01-architecture/review-system-v1.md
  - docs/02-domain/pipeline-v1.md (Gate A requirements)
  - docs/02-domain/entities.md (LongFormSection, SourceRef shape)

Page: /workspaces/[id]/master/[masterId]/review

Layout per docs/02-domain/pipeline-v1.md:
- Left: section list (collapsible cards)
- Center: selected section's full markdown
- Right: source panel with linked ResearchSource records + snippets
- Bottom: Approve | Request changes | Reject | Inline edit

V1 surfaces 4 actions; engine retains 6. Include TODO(V2) comment.

Tests for action transitions per docs/01-architecture/review-system-v1.md.

Commit + tag CR-10-gate-a.
```

---

## CR-11 — Gate B UI (inline editor + regenerate + diff)

**You will see:** Per-artifact review page. Tiptap editor for inline
edit. Regenerate button forks (new artifact branch). Iteration
history panel shows producer A/B + integrator + judge grades per
iteration. Diff view between any two versions.

**Session prompt:** (compact)

```
Read CLAUDE.md. CreatorOS CR-11.

Build Gate B — per-artifact review with inline editing and
fork-on-regenerate.

Read first:
  - docs/01-architecture/review-system-v1.md
  - docs/03-decisions/creator-decisions-log.md (fork-on-regenerate
    decision)
  - docs/01-architecture/cross-critique-pattern.md (iteration record
    shape for history panel)

Page: /workspaces/[id]/artifacts/[id]/review

Layout per docs/02-domain/pipeline-v1.md:
- Top: artifact type badge, status, cost, iteration count,
  terminationReason if not 'threshold_met'
- Center: Tiptap editor preloaded with bestArtifact
- Right: iteration history panel (per iteration: producer A,
  producer B, integrator, judge grade, cost)
- Bottom: Approve | Request changes | Reject | Regenerate

Regenerate semantics (fork, not replace):
- Take current editor content
- Create Artifact A_edited with derivedVia='inline-edit',
  parentArtifactIds=[bestArtifactId]
- Kick off new cross-critique iteration using A_edited as priority
  context
- New artifact A_regen has derivedVia='regenerate',
  parentArtifactIds=[A_edited.id]
- UI shows both branches side-by-side; user can flip

When BOTH artifacts in repurpose are approved → Idea.status='completed'.

Tests per docs/03-decisions/creator-decisions-log.md fork-on-regenerate
decision.

Commit + tag CR-11-gate-b.
```

---

## CR-12 — V1 acceptance test

**You will see:** A full end-to-end E2E test runs the BuildOS /
Agentic AI scenario with real models. Cosine-similarity check, cost
budget, wallclock budget — all asserted. Decisions log finalized.
Tag v1.0.

**Session prompt:** (compact)

```
Read CLAUDE.md. CreatorOS CR-12. ACCEPTANCE.

Read first:
  - docs/00-foundation/identity-and-scope.md (acceptance test spec)
  - docs/03-decisions/creator-decisions-log.md (mechanization)

Build:

1. tests/e2e/v1-acceptance.test.ts — the BuildOS scenario per
   docs/00-foundation/identity-and-scope.md. Auto-approve at each
   gate (skip UI review for the acceptance test).

2. Embedding-distance helper:
   tests/e2e/helpers/embedding-distance.ts using
   text-embedding-3-large via MMS.

3. Run the test. If it fails, tune prompts/rubric weights iteratively
   in this same session. Stay in CR-12 until pass.

4. Print artifacts to tests/e2e/output/acceptance-run-<timestamp>/
   for manual inspection (criteria 2/3 are human-judged).

5. Pass criteria (must all hold):
   - LFM has >=3 sections, each with >=1 sourceRef
   - For each cross-critique stage: cos sim between consecutive
     integrated artifacts <= 0.92
   - Total cost (CostLedger.getTotal) < $5.00
   - Wallclock < 30 min
   - Manual: posts publishable without rewrite

6. Append final decisions made during tuning to
   docs/03-decisions/creator-decisions-log.md.

7. Tag v1.0:
   git tag v1.0
   git push origin v1.0

Final report: artifact paths, cost summary, wallclock, embedding
distances per stage, any tuning decisions added to the log.
```

---

## Cross-repo back-port (not in this plan)

The Cross-Critique pattern (CR-6) is a Core enhancement. Cherry-pick
back to eLearn AIOS via a separate PR on the eLearn repo. Suggested
branch: `feature/cross-critique-backport`. Tag on merge:
`LE-15-cross-critique`. Out of scope for the CreatorOS plan.

---

## Out of scope (V1, all phases)

Per docs/00-foundation/identity-and-scope.md "What V1 does NOT ship."
Repeating here so it doesn't sneak into any session prompt:

LFM versioning, blog post / newsletter / X thread / image post /
carousel artifact types, multi-pattern cross-critique testbed,
YouTube transcripts, scheduling, publishing APIs, performance
feedback loop, video, audio, voice cloning, multi-tenant SaaS,
billing, Clerk auth, pgvector semantic memory.
