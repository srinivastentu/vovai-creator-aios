export const meta = {
  name: 'cr-signoff-audit',
  description: 'Senior-staff-engineer sign-off audit for a completed CreatorOS CR step (5 independent lenses + synthesis verdict + rendered report)',
  whenToUse: 'Run after a CR step is implemented and its deterministic gates pass, BEFORE moving to the next CR step. Invoked by the cr-step-protocol skill Step 8.5. Pass args = { step, stepTitle, scope, readFirst[], groundTruth{}, changedFiles[], commit, tag, dateISO }.',
  phases: [
    { title: 'Audit', detail: '5 independent lenses re-verify the step from different angles' },
    { title: 'Synthesize', detail: 'dedupe, assign severity, produce verdict + rendered report' },
  ],
}

// ── Inputs (all optional; agents fall back to reading the repo) ──────────
const A = args || {}
const STEP = A.step || '(unknown CR step — infer from the latest CR-* git tag and the action plan)'
const STEP_TITLE = A.stepTitle || '(read the step title from docs/04-plans/v1-action-plan.md)'
const SCOPE = A.scope || '(read the step scope — "You will see" + "Build" — from docs/04-plans/v1-action-plan.md)'
const READ_FIRST = Array.isArray(A.readFirst) && A.readFirst.length
  ? A.readFirst.map((d) => `  - ${d}`).join('\n')
  : '  - (derive from the step\'s "Read first" list in docs/04-plans/v1-action-plan.md and the CLAUDE.md routing table)'
const GROUND_TRUTH = A.groundTruth
  ? JSON.stringify(A.groundTruth, null, 2)
  : '(none supplied — re-derive read-only: prisma validate, prisma migrate status, the import-discipline grep, and trust the orchestrator-run typecheck/test/build results from the session)'
const CHANGED_FILES = Array.isArray(A.changedFiles) && A.changedFiles.length
  ? A.changedFiles.map((f) => `  - ${f}`).join('\n')
  : '  - (derive from: git show --stat <the CR step commit>)'
const COMMIT = A.commit || '(latest CR step commit — git log)'
const TAG = A.tag || '(latest CR-* tag — git tag)'

const REPO = '/Users/srinivastentu/Projects/vovai-creator-aios'

const SHARED_CONTEXT = `
You are auditing whether CreatorOS step ${STEP} was completed PROPERLY, signing off like a senior staff
engineer at a global software company. Be exhaustive, evidence-based, and adversarial — but never invent issues.

Repo root: ${REPO}
Step: ${STEP} — ${STEP_TITLE}
Step scope (authoritative): ${SCOPE}

Read-first docs for this step:
${READ_FIRST}

Authoritative sources (doc precedence: decisions log > master-context > other docs > CLAUDE.md eLearn-legacy body):
- CLAUDE.md (architectural contract + routing table)
- docs/04-plans/v1-action-plan.md (the step's "You will see" / "Build" / "Verification" spec)
- docs/02-domain/entities.md, docs/02-domain/pipeline-v1.md, docs/02-domain/rubrics.md
- docs/03-decisions/creator-decisions-log.md (the binding decisions)
- docs/01-architecture/*.md (core-vs-domain, loop-engine, cross-critique-pattern, etc.)
- tasks/lessons.md (standing rules carried forward)

Changed files in this step:
${CHANGED_FILES}

Commit: ${COMMIT}   Tag: ${TAG}

Deterministic gate ground truth (already run by the orchestrator; trust unless your lens needs to re-derive read-only):
${GROUND_TRUTH}

RULES:
- READ-ONLY. Do NOT run any mutating command (no prisma migrate/db push/reset, no seed, no git write, no npm install).
  Reading files, grep, git log/show/diff, and read-only checks (prisma validate, prisma migrate status) are fine.
- Ground every finding in concrete evidence: a file path + line, an enum member, a doc quote, a command output.
- Severity scale:
    blocker  — the step is NOT truly done, or it breaks the next CR step, or violates a binding decision/architecture rule.
    major    — a real defect that should be fixed soon (but does not invalidate the step).
    minor    — a small correctness/robustness gap; track as a follow-up.
    nit      — style/hygiene.
    positive — notably well done (record these too; a sign-off names strengths, not only gaps).
- If something is correct, say so explicitly. Do not pad the report with manufactured concerns.
`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lens', 'verdict', 'findings', 'summary'],
  properties: {
    lens: { type: 'string' },
    verdict: { type: 'string', enum: ['pass', 'pass-with-nits', 'fail'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'area', 'claim', 'evidence', 'recommendation'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit', 'positive'] },
          area: { type: 'string' },
          claim: { type: 'string' },
          evidence: { type: 'string', description: 'file path + line / enum member / doc quote / command output' },
          recommendation: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
}

phase('Audit')

const LENSES = [
  {
    key: 'spec-compliance',
    prompt: `${SHARED_CONTEXT}

YOUR LENS: SPEC COMPLIANCE.
Cross-check the implementation against the ${STEP} spec in docs/04-plans/v1-action-plan.md (the "You will see",
"Build", and "Verification" blocks) AND the routed read-first docs. Verify, item by item, that every deliverable
the step promised actually exists and behaves as specified:
- For SCHEMA steps: every model/field/enum/relation/default/nullability, and schema <-> migration consistency.
- For CODE steps: every agent/rubric/validator/stage-config/CLI-script/route/test the "Build" list enumerates,
  with the specified thresholds, iteration bounds, and output shapes.
Report anything missing, extra, mis-typed, mis-named, or diverging from spec. Explicitly confirm the matches you checked.`,
  },
  {
    key: 'decisions-compliance',
    prompt: `${SHARED_CONTEXT}

YOUR LENS: DECISIONS-LOG & DOC-PRECEDENCE COMPLIANCE.
Go through docs/03-decisions/creator-decisions-log.md and tasks/lessons.md. For every binding decision or standing
rule that touches ${STEP}, verify it is honored in the code/config/docs. Quote the decision text and the
corresponding line(s). Confirm the precedence rule is applied correctly where the action plan and a higher-precedence
doc (decisions log / master-context / entities addendum) disagree. Flag any decision that was silently ignored,
any "RECOMMENDED default flagged for veto" that landed without resolution, and any traceability gap (e.g. a doc still
marked DRAFT whose content was shipped).`,
  },
  {
    key: 'correctness-risk',
    prompt: `${SHARED_CONTEXT}

YOUR LENS: CORRECTNESS & DESIGN-RISK (most adversarial).
Assume you must live with this code/schema for the rest of V1. Actively hunt for what is wrong or fragile:
- Logic errors, off-by-one, wrong async ordering, unhandled error/empty/timeout paths, race conditions.
- For schema: missing uniqueness/composite constraints, soft references that bypass FK enforcement, cascade/restrict
  correctness under real delete flows, index coverage for queries the next steps will run, nullability traps,
  money-as-float, unvalidated JSON columns.
- Cost discipline: is every LLM call tracked in the cost ledger? Are budget caps enforced before the spend, not after?
- Boundary conditions that the tests do NOT cover.
Rate each risk's REAL impact on V1 and on the next CR step. Distinguish "must fix now (blocker/major)" from
"fine for V1, note for later (minor/nit)".`,
  },
  {
    key: 'architecture-discipline',
    prompt: `${SHARED_CONTEXT}

YOUR LENS: ARCHITECTURE & IMPORT DISCIPLINE.
Verify the change respects the platform's load-bearing architectural rules:
- Core/Domain separation: run \`grep -rE "from ['\\"][^'\\"]*domain/" src/lib/core/\` — MUST be empty. Apply the
  three-question test to any new file under src/lib/core/.
- Loop Engine discipline: Core runs ONE stage; Domain sequences stages. Engine takes injected deps (AgentExecutor,
  JudgeFunction) and never imports agents. Pipeline orchestration lives in Domain.
- Cross-Critique (Pattern 5) rules where relevant: producer != integrator != judge at the model level (Rule 10);
  producers never see the rubric (Rule 11); budget cap is hard (Rule 12).
- Coding standards: TypeScript strict, no \`any\`, no \`| string\` union-widening, ES modules, no semicolons, 2-space indent.
- Naming: machinery vs configuration placed correctly (no domain words in core; no engine logic in domain).
Report any violation with the offending path + line. Confirm the disciplines you verified clean.`,
  },
  {
    key: 'process-tests-forward',
    prompt: `${SHARED_CONTEXT}

YOUR LENS: PROCESS, TESTS & FORWARD-READINESS.
- Git hygiene: exactly one well-formed implementation commit per cr-step-protocol Step 8 (title + 2-4 line body +
  "Refs: docs/04-plans/v1-action-plan.md (${STEP})" + Co-Authored-By trailer)? Is the CR-* tag on the right commit?
- Gate evidence: are the action-plan "Verification" gates all satisfiable and satisfied? Did the protocol's
  architect-reviewer (Step 7) run for a code-bearing step?
- Test adequacy: do the tests actually PROVE the spec's stated behaviors and the test cases the "Build" list named?
  Are there assertions that would catch a regression, or are they shallow? Any spec-mandated test missing?
- Forward-readiness: trace the writes/reads the NEXT CR step needs against what this step produced. Confirm the next
  step is unblocked, or name precisely what is missing.
- Hygiene: working tree clean (aside from known scratch)? Lesson captured if a correction occurred?
Confirm what is correct; flag any protocol step skipped that should not have been.`,
  },
]

const lensResults = (await parallel(
  LENSES.map((l) => () =>
    agent(l.prompt, { label: `audit:${l.key}`, phase: 'Audit', schema: FINDINGS_SCHEMA })
  )
)).filter(Boolean)

phase('Synthesize')

const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overallVerdict', 'confidence', 'blockers', 'majors', 'minors', 'nits', 'strengths', 'humanInputNeeded', 'recommendedFollowUps', 'rationale', 'reportMarkdown'],
  properties: {
    overallVerdict: { type: 'string', enum: ['SIGN-OFF', 'SIGN-OFF WITH FOLLOW-UPS', 'DO NOT SIGN OFF'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    blockers: { type: 'array', items: { type: 'string' } },
    majors: { type: 'array', items: { type: 'string' } },
    minors: { type: 'array', items: { type: 'string' } },
    nits: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
    humanInputNeeded: { type: 'array', items: { type: 'string' } },
    recommendedFollowUps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'dueBefore', 'location'],
        properties: {
          item: { type: 'string' },
          dueBefore: { type: 'string', description: 'the CR step this must be done before, e.g. "CR-3"' },
          location: { type: 'string', description: 'file:line where the work lands' },
        },
      },
    },
    rationale: { type: 'string' },
    reportMarkdown: { type: 'string', description: 'the full sign-off report, rendered per docs/sign-off-review/_TEMPLATE.md, ready to write verbatim to docs/sign-off-review/' + STEP + '-sign-off.md' },
  },
}

const synthesis = await agent(
  `${SHARED_CONTEXT}

YOU ARE THE SENIOR STAFF ENGINEER SIGNING OFF. Five independent audit lenses have reported. Their structured
findings (JSON):

${JSON.stringify(lensResults, null, 2)}

Your job:
1. Dedupe overlapping findings across lenses.
2. Re-assess each finding's severity with judgment — a lens may over- or under-state. Demote anything that is
   genuinely fine-for-V1; promote anything that truly threatens this step's correctness or the next step.
3. Decide the overall verdict using these gate rules:
   - SIGN-OFF: no blockers, no majors; nits/minors only.
   - SIGN-OFF WITH FOLLOW-UPS: no blockers; majors/minors exist that must be TRACKED (each tied to the CR step it is
     due before) but do not invalidate this step.
   - DO NOT SIGN OFF: at least one blocker — the step is not truly complete or would break the next step. Progression
     to the next CR step is BLOCKED until resolved.
4. List confirmed strengths (what was done well).
5. List anything that needs HUMAN input/decision (things you cannot verify from the repo).
6. Give concrete recommended follow-ups, each with the CR step it is due before and the file:line where it lands.
7. Render the FULL report into reportMarkdown, following docs/sign-off-review/_TEMPLATE.md exactly (read that file).
   The report must be self-contained and ready to write verbatim to docs/sign-off-review/${STEP}-sign-off.md.
   Use clickable markdown links of the form [path:line](path#Lline) for file references.

Be decisive and specific. This is a sign-off verdict, not a hedge.`,
  { label: 'synthesis', phase: 'Synthesize', schema: SYNTH_SCHEMA }
)

return { step: STEP, lensResults, synthesis }
