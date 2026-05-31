# Claude Code — Workflows, Effort, and Subagents

> How to run CreatorOS development in Claude Code. Calibrated for the
> Max plan (Srinivas's current plan as of May 2026) and aligned with
> the MVP-first action plan in `docs/04-plans/v1-action-plan.md`.

## TL;DR

For every CR step session:

1. Open Claude Code in the CreatorOS repo directory.
2. Set effort: `/effort ultracode`
3. Confirm Auto Mode is on (status bar shows "Auto"; toggle if not).
4. Paste the CR-step session prompt from `docs/04-plans/v1-action-plan.md`.
5. Walk away. Come back to the final report.

The skill `cr-step-protocol` (auto-loads from `.claude/skills/`)
orchestrates the rest.

## The three Claude Code features that matter

### 1. `/effort ultracode`

The highest "thinking" budget Claude Code offers. Combines `xhigh`
reasoning with automatic workflow orchestration: Claude can choose,
mid-session, to write a JavaScript orchestration script that fans
work out to multiple subagents running in parallel.

When to use: **every CR step.** CR steps are nontrivial — they
involve schema design, agent prompt authoring, test writing, and
verification across many files. ultracode lets Claude work the
problem at the level of "all of it at once" rather than
file-by-file.

When NOT to use: chat-style debugging on a single file. Use `/effort
medium` or no effort flag for those.

### 2. Auto Mode

Reduces approval friction. Claude Code's two-stage classifier
detects which tool calls are read-only or trivially safe (file
reads, git status, npm test, simple greps) and lets them run
without per-call confirmation. Writes still surface in the diff
view; you can review at any time.

For CR steps: **always on.** Subagents spawned inside Dynamic
Workflows run in `acceptEdits` mode automatically when Auto is on
— without it, each subagent edit would prompt and the workflow
stalls.

To toggle: `/config` → Auto Mode → on. Or click the status bar.

### 3. Dynamic Workflows

A research-preview feature (May 2026) that lets Claude write
JavaScript orchestration scripts on-the-fly. Up to 1,000 subagent
spawns total, 16 concurrent at any moment.

When Claude reaches for Dynamic Workflows:
- "Author 6 producer/critic/integrator/judge agent files in
  parallel for the LinkedIn stage." → 6 subagents fan out, each
  writes one file from the persona template, results checked.
- "Investigate 4 existing modules in parallel to find where X is
  configured." → 4 subagents read different code paths,
  consolidate findings.

You don't tell Claude to use Dynamic Workflows. ultracode mode
decides. You'll see it kick in via the status line ("dispatching to
N subagents") and the diff preview ("6 files created in parallel").

Max plan: on by default. Pro plan: opt-in via `/config`.

## Effort cheatsheet

| Effort flag | When | Cost |
|---|---|---|
| `/effort low` | Quick fixes, one-file edits | ~1 Sonnet call/turn |
| `/effort medium` | Refactor across 2-3 files | 2-5 Sonnet calls/turn |
| `/effort high` | Multi-file refactor, design discussions | 5-15 calls/turn |
| `/effort xhigh` | Heavy reasoning + tool use | 15-50 calls/turn |
| `/effort ultracode` | xhigh + workflow orchestration on tap | 50-500 calls/turn |

CreatorOS CR steps are typically 30-150 ultracode-level turns per
session. Budget mentally: $5-25 per CR step on the Anthropic backend
cost (Max plan covers it; this is informational so you know what's
moving).

## Subagents (custom)

Located in `.claude/agents/<name>.md`. CreatorOS ships 4:

| Agent | Used for | Activated when |
|---|---|---|
| **architect-reviewer** | Catches Core/Domain violations, missing principles, scope drift before commit | Auto-invoked before each commit suggestion |
| **rubric-author** | Builds new rubrics following the 5 authoring rules; verifies weights, completeness dimension, reasoning-required | When a new stage or artifact type needs a rubric |
| **prompt-tuner** | Iterates on agent prompts based on observed failures (judge scores too low, validator misses, voice drift) | When Stage 5 cross-critique outputs underperform |
| **test-writer** | Writes test scaffolds for new stages, validators, loop config | When a new stage/loop is added |

Claude Code invokes these automatically based on their `description`
front-matter. You don't have to ask. If you want to invoke
explicitly: `@architect-reviewer please review the diff`.

## Skills (auto-loading)

Located in `.claude/skills/<name>/SKILL.md`. CreatorOS ships 4:

| Skill | What it does |
|---|---|
| **cr-step-protocol** | The CR session opening protocol: read CLAUDE.md → read routing table targets → read action plan → check tags → run gates. Auto-loads at session start when current dir is a CreatorOS repo. |
| **loop-stage-creation** | Walk-through for adding a new `LoopStage<T>`: name, rubric, validator, persistence, tests. Auto-loads when CR step involves new stage. |
| **agent-persona-creation** | The Forge-style persona document template + writing rules. Auto-loads when authoring a new agent file. |
| **grep-check** | The corrected import-discipline grep command (comment-safe). Auto-loads before any commit that touches `src/lib/core/`. |

Skills load themselves based on their YAML frontmatter
`description` field. The protocol skill is what makes "paste the
session prompt and walk away" work reliably.

## CLAUDE.md routing

`CLAUDE.md` includes a routing table near the top. When you ask
Claude Code to "review the loop engine implementation," it jumps to
`docs/01-architecture/loop-engine.md` automatically. You don't have
to remember file paths.

The routing table is also what makes session prompts compact: most
prompts just say "Read first: docs/02-domain/pipeline-v1.md (Stage
2 section)" and Claude Code pulls it.

## When ultracode goes wrong

Symptoms and fixes:

| Symptom | Probable cause | Fix |
|---|---|---|
| Session stalls without output | Subagent stuck on a tool call | `/cancel`, restart with same prompt; usually self-heals |
| Diff includes changes you don't expect | Subagent over-interpreted scope | Reject the diff; restate scope explicitly: "ONLY modify files under X" |
| Tests pass but coverage thin | Subagent took shortcuts | `@test-writer please harden the new tests` (then re-run) |
| Cost crept up | Workflow fan-out wider than needed | For next session, lower from `ultracode` to `xhigh` |
| Core/Domain violation slips in | architect-reviewer not invoked | Explicit: `@architect-reviewer review the diff before commit` |

## Convention: one CR step = one session

Don't multi-task across CR steps in one Claude Code session. Each
step has its own verification gates and tag. Sessions are cheap to
start; keep them clean.

If a CR step takes >2 hours to converge, that's a signal — either
the prompt is wrong (scope unclear, contradictions), or you should
break the step into two. Pause and revise the action plan rather
than push through.

## What never happens in autopilot

Claude Code never:

- Pushes to a protected branch without explicit `git push` invocation
  in a tool call (we always do this; just naming it)
- Commits without running test + typecheck first (cr-step-protocol
  enforces)
- Edits archived `tests/_eLearn_archive/` content (out of scope by
  design)
- Reaches into `src/lib/core/` and imports from `src/lib/domain/`
  (grep-check would fail; commit gate fails)

These are guardrails of the protocol skill + grep-check skill, not
of Claude Code itself. The skills do the policing.

## References

- Anthropic Claude Code release notes (May 2026 — Dynamic Workflows
  research preview, ultracode mode)
- `.claude/skills/cr-step-protocol/SKILL.md` — the protocol enforced
  every CR step
- `.claude/skills/grep-check/SKILL.md` — the corrected import
  discipline check
- `docs/04-plans/v1-action-plan.md` — the per-step session prompts
