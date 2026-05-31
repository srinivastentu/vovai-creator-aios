---
name: cr-step-protocol
description: The CreatorOS CR-step session protocol. Activates automatically at the start of any Claude Code session in a CreatorOS repo (detected by presence of docs/04-plans/v1-action-plan.md). Walks Claude through the steps every CR session must follow: read CLAUDE.md, read routing-table targets, identify the current step, run gates, commit + tag, then a senior-staff-engineer sign-off review before moving forward. Without this skill, sessions miss verification gates and accumulate state inconsistencies.
auto_load: true
---

# CR-Step Protocol

You are starting a CreatorOS CR-step session. This skill encodes the
protocol every CR step must follow. Do not skip steps. Order matters.

## Step 1 — Read context (always, no exceptions)

In this exact order:

1. **`CLAUDE.md`** at the repo root. This is the architectural contract.
2. The **routing table** at the bottom of CLAUDE.md tells you which
   doc to read next based on what the user wants.
3. **`docs/04-plans/v1-action-plan.md`** for the action plan and per-step
   prompts.
4. **`docs/03-decisions/creator-decisions-log.md`** for the most recent
   decisions that may affect this step.

If the user's prompt names a specific CR step (e.g. "CR-3"), jump to
its section in the action plan and read its "Read first" list.

## Step 2 — Identify the current step

Determine which CR step this session is. Sources:

- The user's prompt usually says ("This is CreatorOS CR-N.")
- If unclear, list git tags and find the most recent CR-N tag; the
  current step is the next one.

Once identified:

- Read the "You will see" line. This is the user's success criterion.
- Read the "Verification" section. These are the gates.
- Read the cost ceiling. Don't exceed it.

## Step 3 — Verify prerequisites

Before doing any work:

- Git working tree should be clean (run `git status`). If not, ask
  the user before proceeding.
- The expected prior tag should exist (e.g. CR-2 expects CR-1-schema).
  If missing, stop and tell the user.
- Run `npm run typecheck` and `npm run test`. Baseline must be green
  before changes start.

If any prereq fails, **STOP** and report to the user. Do not proceed.

## Step 4 — Plan the work

Before editing any file, draft a plan:

- What files will be created/modified?
- Which subagents will be invoked (architect-reviewer, rubric-author,
  prompt-tuner, test-writer)?
- Which existing patterns will you copy from?

For ultracode + Auto Mode sessions, this plan is shown to the user
ONCE at the start. After approval (implicit if Auto Mode is on),
proceed without further interruption.

## Step 5 — Execute

Use Dynamic Workflows when parallel work helps:

- Multiple agent files to author from the same template
- Multiple test files to scaffold
- Multiple existing modules to investigate in parallel

Use direct edits when work is inherently sequential:

- Schema migrations
- A single file's logic
- A test that depends on another test passing first

Either way, after each significant batch of edits:

- Save state (git add the changes; do NOT commit yet)
- Run incremental verification (typecheck on the touched files)
- Continue

## Step 6 — Run verification gates

The action plan's "Verification" section is authoritative. Generally
includes:

```bash
npm run typecheck                                    # exit 0
npm run test                                         # all green
grep -rE "from ['\"][^'\"]*domain/" src/lib/core/    # empty
```

Plus step-specific gates (e.g., "the dossier file at <path> exists
and has >=3 sources").

**Every gate must pass before commit.** No exceptions. If a gate
fails:

1. Diagnose. (Failure output is informative; read it.)
2. Fix.
3. Re-run the gate.
4. Repeat until green.

If a gate cannot be made to pass within reasonable scope (e.g., a
schema decision is wrong), STOP. Don't ship a broken commit. Report
to the user with the failure and proposed paths forward.

## Step 7 — Invoke architect-reviewer

Before commit, explicitly:

```
@architect-reviewer please review the staged diff.
```

Wait for the verdict. If REQUEST_CHANGES, address them.

If APPROVE, proceed.

## Step 7.5 — Pre-push freshness check (cascade-safe)

Before `git push`, do not trust prior session context. Re-run the
three core gates as **separate, sequential** tool calls. Do not
batch them. Wait for each exit code in its own tool result before
starting the next:

1. `npm run typecheck`  → confirm exit 0 from its own tool result
2. `npm run test`       → confirm exit 0 from its own tool result
3. `npm run build`      → confirm exit 0 from its own tool result

If any of the three fails when re-run, STOP. Do not push. Diagnose
and fix; then restart this step.

This prevents cascade-cancellation in a prior batched tool call
from causing the session to misread a failure as a pass. See
`tasks/lessons.md` (2026-05-31 entry) for the precedent that
motivated this check.

## Step 8 — Commit and tag

Single commit per CR step. Message format:

```
CR-N: <step name from action plan>

<2-4 line summary of what's in the commit>

Refs: docs/04-plans/v1-action-plan.md (CR-N)
```

Then tag and push:

```bash
git add -A
git commit -m "CR-N: <name>" -m "<summary>"
git tag CR-N-<short-name>
git push origin main
git push origin CR-N-<short-name>
```

## Step 8.5 — CR-step sign-off review (gate before moving forward)

After the step is committed + tagged, run the **senior-staff-engineer
sign-off review** before declaring the step done or starting the next
one. This is the heavier, multi-angle counterpart to Step 7's
per-diff architect-reviewer. Full spec:
`docs/sign-off-review/README.md`.

1. **Gather ground truth.** You already re-ran typecheck / test /
   build sequentially in Step 7.5. Collect the changed-file list
   (`git show --stat <commit>`), the commit SHA, and the tag.

2. **Run the audit workflow** (`.claude/workflows/cr-signoff-audit.js`),
   passing the step context as `args`:

   ```
   Workflow({ name: "cr-signoff-audit", args: {
     step: "CR-N", stepTitle: "<title>", scope: "<You-will-see + Build summary>",
     readFirst: [ <the step's Read-first docs> ],
     groundTruth: { typecheck: "exit 0", test: "...", build: "exit 0",
                    grepCore: "empty (PASS)", prisma: "valid; no drift" },
     changedFiles: [ <git show --stat> ], commit: "<sha>", tag: "CR-N-<name>",
     dateISO: "<today>"
   }})
   ```
   (If name resolution is unavailable, use
   `{ scriptPath: ".claude/workflows/cr-signoff-audit.js", args: {…} }`.)

3. **Write the report.** Take `synthesis.reportMarkdown` from the
   result and write it **verbatim** to
   `docs/sign-off-review/CR-N-sign-off.md`. Add a row to the index
   table in `docs/sign-off-review/README.md`. Commit both as a small
   docs follow-up:

   ```bash
   git add docs/sign-off-review/
   git commit -m "CR-N: sign-off review report"
   git push origin main
   ```

4. **Enforce the gate** on `synthesis.overallVerdict`:
   - **DO NOT SIGN OFF** (≥1 blocker) → the step is NOT done. STOP.
     Do not start CR-(N+1). Fix the blocker (new commit), then re-run
     this step from sub-step 1. The blocker report is still written —
     it is the record of what was wrong.
   - **SIGN-OFF WITH FOLLOW-UPS** → proceed. Each follow-up is recorded
     in the report with the CR step it is due before. If a follow-up
     changes scope, also append it to
     `docs/03-decisions/creator-decisions-log.md`.
   - **SIGN-OFF** → proceed.

A CR step is not "done" until its sign-off report exists in
`docs/sign-off-review/` with no unresolved blocker.

## Step 9 — Final report

After commit + tag, output a single concise report:

```
=== CR-N COMPLETE ===

WHAT YOU SEE:
  • <verifiable observation 1>
  • <verifiable observation 2>

NUMBERS:
  • Tests: <before> → <after>
  • Cost this session: $<X>
  • Wallclock: <minutes>

GATES PASSED:
  ✓ typecheck
  ✓ test
  ✓ grep-check
  ✓ <step-specific gate 1>
  ✓ <step-specific gate 2>
  ✓ architect-reviewer: APPROVE

GIT STATE:
  Tag pushed: CR-N-<name>
  Commit SHA: <sha>

NEXT STEP:
  CR-(N+1): <name>  (run with: paste prompt from docs/04-plans/v1-action-plan.md)
```

That's the entire report. Don't elaborate beyond it.

## Failure modes the protocol prevents

- **Forgetting to read CLAUDE.md.** Architecture violations slip in.
- **Skipping the prereq check.** You start work on a dirty tree and
  produce a confused diff.
- **Committing without verification.** Tests break days later;
  bisect points here.
- **Skipping architect-reviewer.** Core/Domain violations escape.
- **Multi-step work in one commit.** Reverting becomes painful.
- **Moving to the next CR step without a sign-off review (Step 8.5).**
  Defects compound across steps; the sign-off gate catches them while
  they are still cheap to fix, and leaves a written record per step.

## When to break the protocol

Almost never. The two valid reasons:

1. **The user explicitly says to.** ("Just make a quick fix, skip
   the gates.") In that case, acknowledge what's being skipped and
   proceed. Document in commit message.

2. **A genuine emergency.** (E.g., the seed script is broken and
   blocks all dev; user needs unblock NOW.) Same: acknowledge what's
   skipped, fix the immediate thing, schedule a follow-up CR step
   to do it properly.

Otherwise, the protocol holds.
