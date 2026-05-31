# CR-Step Sign-off Review Pipeline

> A senior-staff-engineer sign-off gate that runs **after every CR step is
> implemented and its deterministic gates pass, and before the next CR step
> begins.** Produces a durable, committed review report per step.

This is the heavier, multi-angle counterpart to the per-commit
`architect-reviewer` check. Where `architect-reviewer` guards a single diff
for Core/Domain boundary violations, the sign-off review audits the *whole
completed step* from five independent lenses and renders a verdict that
gates progression.

---

## Why this exists

CR steps build on each other. A schema gap in CR-1 silently breaks CR-3; a
missed decision in CR-6 corrupts CR-11. Catching those at the moment a step
finishes — with an independent, adversarial pass and a written record — is far
cheaper than discovering them three steps later. The report is also the
project's audit trail: anyone can open `CR-<N>-sign-off.md` and see exactly
what was verified, what was deferred, and why the step was allowed to proceed.

## When it runs

Inside one CR-step session, in this order:

```
… implement … → gates (typecheck/test/build) → architect-reviewer → commit + tag + push
                                                                          │
                                                                          ▼
                                                  ┌──────────────────────────────────────┐
                                                  │  CR-step sign-off review (THIS gate)   │
                                                  │  cr-step-protocol Step 8.5             │
                                                  └──────────────────────────────────────┘
                                                                          │
                                       verdict = DO NOT SIGN OFF ◀────────┼────────▶ verdict = SIGN-OFF[ WITH FOLLOW-UPS]
                                       fix → re-commit → re-audit          │          write report → commit report → proceed to CR-(N+1)
```

The gate is enforced by the **`cr-step-protocol`** skill (Step 8.5). It is not
optional: a step is not "done" until its sign-off report exists in this folder
with no unresolved blocker.

## How it runs

The work splits between the **orchestrator** (the main Claude Code session) and
the **`cr-signoff-audit` workflow** (`.claude/workflows/cr-signoff-audit.js`):

1. **Orchestrator runs the deterministic gates** — `npm run typecheck`,
   `npm run test`, `npm run build`, the import-discipline grep, `prisma
   validate` / `migrate status` — as **separate, sequential** tool calls (per
   the 2026-05-31 cascade-cancellation lesson in `tasks/lessons.md`). It also
   collects the changed-file list and the commit/tag. These become the
   workflow's `groundTruth`.
2. **Orchestrator invokes the workflow**, passing the step context as `args`
   (see below). The workflow runs five independent audit lenses in parallel,
   then a synthesis agent that dedupes, assigns severity, decides the verdict,
   and renders the full report.
3. **Orchestrator writes the report** returned in `synthesis.reportMarkdown`
   verbatim to `docs/sign-off-review/CR-<N>-sign-off.md`, then commits it as a
   small docs follow-up (the same pattern as a captured-lesson commit).
4. **Gate decision:**
   - `DO NOT SIGN OFF` (≥1 blocker) → do **not** start the next CR step. Fix,
     re-commit, re-run the audit. The blocker report is still written (it is
     the record of what was wrong).
   - `SIGN-OFF WITH FOLLOW-UPS` / `SIGN-OFF` → proceed. Every follow-up is
     recorded in the report with the CR step it is due before.

### Invoking the workflow

By name (preferred):

```
Workflow({ name: "cr-signoff-audit", args: { …see below… } })
```

Or by path, if name resolution is unavailable:

```
Workflow({ scriptPath: ".claude/workflows/cr-signoff-audit.js", args: { …below… } })
```

### `args` contract

All fields optional — the lenses fall back to reading the repo — but supplying
them makes the audit sharper and cheaper:

```jsonc
{
  "step":        "CR-2",                       // e.g. "CR-2"
  "stepTitle":   "Research stage end-to-end",
  "scope":       "one-paragraph 'You will see' + 'Build' summary from the action plan",
  "readFirst":   ["docs/02-domain/pipeline-v1.md", "docs/02-domain/rubrics.md"],
  "groundTruth": {                              // results the orchestrator already ran
    "typecheck": "exit 0",
    "test":      "exit 0 — 460 passed, 3 skipped",
    "build":     "exit 0",
    "grepCore":  "empty (PASS)",
    "prisma":    "valid; migrate status up to date, no drift"
  },
  "changedFiles": ["src/lib/domain/workflows/creator/agents/research-agent.ts", "…"],
  "commit":       "<sha>",
  "tag":          "CR-2-research-stage",
  "dateISO":      "2026-06-01"
}
```

## The five lenses

| # | Lens | What it audits |
|---|------|----------------|
| 1 | **Spec compliance** | Every deliverable in the step's "You will see" / "Build" / "Verification" blocks exists and behaves as specified. |
| 2 | **Decisions-log & doc-precedence** | Every binding decision and standing lesson touching the step is honored; precedence applied correctly; no DRAFT content shipped without sign-off. |
| 3 | **Correctness & design-risk** (adversarial) | Logic errors, edge/empty/timeout paths, races, schema-integrity risks, missing constraints, cost-ledger discipline, uncovered boundaries. |
| 4 | **Architecture & import discipline** | Core/Domain boundary (`grep` must be empty), three-question test, injected-deps rule, Pattern-5 rules, coding standards (no `any`, no `\| string` widening). |
| 5 | **Process, tests & forward-readiness** | Git hygiene, gate evidence, test *adequacy* (do tests prove behavior?), and whether the next CR step is unblocked. |

A synthesis agent reconciles the five, adjudicates disagreements (a lens may
over/under-state), and produces the verdict + report.

## Verdict semantics (the gate rule)

| Verdict | Meaning | Proceed to next CR step? |
|---|---|---|
| **SIGN-OFF** | No blockers, no majors. Nits/minors only. | Yes. |
| **SIGN-OFF WITH FOLLOW-UPS** | No blockers. Majors/minors that must be *tracked* (each tied to a due-by CR step). | Yes — follow-ups recorded in the report. |
| **DO NOT SIGN OFF** | ≥1 blocker: the step is not truly complete or breaks the next step. | **No.** Fix, re-commit, re-audit. |

"Blocker" = the step did not actually meet its spec, violated a binding
decision or architecture rule, or would break the next CR step.

## Report naming & location

- One file per step: `docs/sign-off-review/CR-<N>-sign-off.md`.
- Template: [`_TEMPLATE.md`](_TEMPLATE.md).
- Reports are committed. They are the durable record; follow-ups live in the
  report's "Recommended follow-ups" section (and, when they change scope, are
  also appended to `docs/03-decisions/creator-decisions-log.md`).

## Index of sign-off reports

| Step | Verdict | Report |
|---|---|---|
| CR-1 — minimal schema + BuildOS persona | SIGN-OFF WITH FOLLOW-UPS | [CR-1-sign-off.md](CR-1-sign-off.md) |
| CR-2 — Research stage end-to-end | SIGN-OFF WITH FOLLOW-UPS | [CR-2-sign-off.md](CR-2-sign-off.md) |
| CR-3 — Long-Form Master synthesizer | SIGN-OFF WITH FOLLOW-UPS | [CR-3-sign-off.md](CR-3-sign-off.md) |

_(Append a row per step as reviews complete.)_

## Design notes

- **Why the orchestrator runs the gates, not the workflow.** Deterministic
  gates must yield trustworthy exit codes; the cascade-cancellation lesson
  (`tasks/lessons.md`, 2026-05-31) requires running them as separate sequential
  calls. The workflow focuses on the analytical, parallelizable audit.
- **Why five independent lenses + synthesis.** Independent adversarial passes
  catch blind spots a single reviewer anchors past; the synthesis prevents a
  single over-eager lens from inflating a nit into a blocker.
- **Why post-commit.** The audit reviews the committed state (real SHA + tag),
  and the report is itself committed — so the trail is complete and the verdict
  references an immutable artifact. A blocker simply means the *next* step
  doesn't start until a follow-up commit clears it.
