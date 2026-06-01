# CR-11 Sign-off Review — Gate B UI (inline editor + fork-on-regenerate + iteration history + diff)

| | |
|---|---|
| **Step** | CR-11 — Gate B UI (inline editor + regenerate + diff) |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `7e6616a` |
| **Tag** | `CR-11-gate-b` |
| **Reviewed at** | 2026-06-01 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-11 is genuinely done and built to a high standard. Every "You will see" / "Build" deliverable exists and behaves to spec: the `/workspaces/[id]/artifacts/[artifactId]/review` page renders the full Gate B shell, all 4 review actions are surfaced with the mandated `TODO(V2)` comment, fork-on-regenerate matches the decisions-log lineage byte-for-byte and preserves Immutable History, the iteration-history panel is sourced from persisted episodic memory, and a clean LCS line-diff compares any two branches. All deterministic gates pass on independent re-run. The one architectural-risk **major** (regenerate has no atomic in-flight guard, so a double-submit can run a second live billed loop) is real but bounded by per-stage `maxBudgetUSD` and the client button-disable, so it does not invalidate the step. **One inter-lens disagreement was adjudicated against the DECISIONS-LOG lens:** it claimed the `## CR-11 decisions` section "landed in the SAME code commit (7e6616a)" — this is factually wrong. `git show --stat 7e6616a` contains no decisions-log change, and `git status` shows it as an uncommitted ` M` working-tree modification. The SPEC and PROCESS lenses are correct: the binding decisions are uncommitted WIP. This is the exact recurring cadence gap CR-7 and CR-10 flagged as MAJOR, so it is promoted to a tracked major — but at this mid-protocol audit point (this audit is the gate before the follow-up commit, and CR-9/CR-10 used the same two-commit cadence) it does not invalidate the step. No blockers. Verdict: **SIGN-OFF WITH FOLLOW-UPS**.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0 — 689 passed / 3 skipped (env-gated; gate-b integration ran 10/10 with DB) |
| `npm run build` | exit 0 (production route `/workspaces/[id]/artifacts/[artifactId]/review` present) |
| Import discipline (`core` → `domain`) | empty (PASS) — re-derived `grep -rnE "from ['\"][^'\"]*domain/" src/lib/core/` returns nothing |
| `prisma validate` / `migrate status` | valid 🚀; 5 migrations, "Database schema is up to date" — additive CR-11 migration (`reviewFeedback`/`reviewedAt`/`detailJson`) |

## What's correct (strengths)

- **Fork-on-regenerate lineage matches the binding contract byte-for-byte and preserves Immutable History:** A_edited (`derivedVia=inline_edit`, `parent=[bestArtifactId]`, `status=draft`) → A_regen (`derivedVia=regenerate`, `parent=[A_edited]`, `status=awaiting_review`); the original is never mutated; A_edited survives even when regeneration fails. ([src/lib/domain/workflows/creator/repurpose-persistence.ts:183](src/lib/domain/workflows/creator/repurpose-persistence.ts#L183), [src/lib/domain/data/artifact-actions.ts:228](src/lib/domain/data/artifact-actions.ts#L228), [tests/integration/gate-b-review.test.ts:219](tests/integration/gate-b-review.test.ts#L219)). Enum members correctly use the underscored Prisma form, overriding the action plan's stale hyphenated literal.
- **The regenerate path reuses the single CR-7 cross-critique seam** instead of forking a weaker second production path, so Pattern-5 Rules 10 (catalog-backed producer≠judge family guard), 11 (producers never see the rubric — the human edit reaches them as `priorEditBlock`, a control-signal block), and 12 (hard budget cap via `getJudgeCostUsd` folding judge spend in before the check) are inherited, not re-implemented. ([src/lib/domain/workflows/creator/regenerate-runner.ts:15](src/lib/domain/workflows/creator/regenerate-runner.ts#L15), [src/lib/domain/workflows/creator/cross-critique-stage.ts:334](src/lib/domain/workflows/creator/cross-critique-stage.ts#L334)).
- **Core/Domain import discipline intact:** the only Core change is a 1-field, zero-domain-word `producersSucceeded` addition that passes the three-question test as pure machinery and discharges the CR-7 dialectic-degradation follow-up (zero-producers case tested). ([src/lib/core/engine/types.ts:149](src/lib/core/engine/types.ts#L149), [src/lib/core/engine/cross-critique.ts:331](src/lib/core/engine/cross-critique.ts#L331)).
- **Review semantics are correct and safe:** 4 surfaced actions with the mandated `TODO(V2)` comment; transitions match `review-system-v1.md`; human sovereignty enforced; `submitGateBReview` is TOCTOU-guarded and idempotent (status in the `updateMany` where-clause, zero-row→"already reviewed"); inline edits are rebuilt with counts recomputed by code and re-validated; every query/mutation user-scopes via `workspace.userId`; Idea auto-completes only when BOTH V1 artifact types are approved. ([src/lib/domain/workflows/creator/review/artifact-review.ts:21](src/lib/domain/workflows/creator/review/artifact-review.ts#L21), [src/lib/domain/data/artifact-actions.ts:111](src/lib/domain/data/artifact-actions.ts#L111)).
- **The iteration-history panel is driven by real persisted StageSession/IterationRecord rows** (not in-memory loop state), written by both the CLI and the regenerate action, surfacing producer A/B + critiques + integrator + per-dimension judge grade + cost, plus dialectic degradation and judge-skipped. ([src/lib/domain/data/artifacts.ts:36](src/lib/domain/data/artifacts.ts#L36), [src/components/review/IterationHistoryPanel.tsx:22](src/components/review/IterationHistoryPanel.tsx#L22)).
- **Data-layer separation discharges the CR-10 server-action follow-up early** (plain reads vs `"use server"` mutations), and cross-user isolation is asserted. ([tests/integration/gate-b-review.test.ts:265](tests/integration/gate-b-review.test.ts#L265)).

## Findings

### 🔴 Blockers

None.

### 🟠 Majors

1. **Regenerate has no atomic in-flight guard.** A concurrent or double-submit of `regenerateArtifact` (two tabs, retry) creates a second A_edited seed and runs a second LIVE, billed cross-critique loop. The status check at [src/lib/domain/data/artifact-actions.ts:183](src/lib/domain/data/artifact-actions.ts#L183) is read-only and never claims the source artifact — unlike the TOCTOU-guarded `submitGateBReview` ([artifact-actions.ts:111](src/lib/domain/data/artifact-actions.ts#L111)). Bounded by per-stage `maxBudgetUSD` (~$2/stage) and the client button-disable, so major-not-blocker for V1. _Fix before CR-12._
2. **Decisions-log cadence gap (recurring).** The binding `## CR-11 decisions` section is NOT in commit `7e6616a` — it is an uncommitted working-tree change (`git status` → ` M docs/03-decisions/creator-decisions-log.md`; `git show --stat 7e6616a` contains no decisions-log entry). The DECISIONS-LOG lens's claim that it "landed in the SAME code commit (7e6616a)" was verified false against the commit. This is the exact gap CR-7 and CR-10 flagged as MAJOR. It does not invalidate the step (this audit is the pre-follow-up gate; CR-9/CR-10 used the same two-commit cadence), but the section + `docs/sign-off-review/CR-11-sign-off.md` MUST be committed before CR-12. ([docs/03-decisions/creator-decisions-log.md:1147](docs/03-decisions/creator-decisions-log.md#L1147)). _Fix before CR-12._

### 🟡 Minors (track as follow-ups)

1. **Zero-row-path test not added** — the CR-10 follow-up required BOTH the TOCTOU guard AND a zero-row-path test. The guard code is present for both gates ([masters.ts:106](src/lib/domain/data/masters.ts#L106), [artifact-actions.ts:111](src/lib/domain/data/artifact-actions.ts#L111)) but `grep -rn 'already reviewed' tests/` returns nothing. _Fix before CR-12._
2. **Tiptap → Textarea substitution undocumented as a CR-11 decision** — the spec and the CR-10 decisions log pre-committed a Tiptap editor; CR-11 ships a Textarea + Write/Preview tabs (tiptap absent from `package.json`). Technically sound (byte-clean markdown round-trip protects the validator's deterministic counts) but overrides a pinned decision and is not yet recorded. ([src/components/review/ArtifactEditor.tsx:5](src/components/review/ArtifactEditor.tsx#L5)). _Record in the CR-11 decisions section._
3. **agent-persona-creation skill still lists the stale Idea Coach path** — the CR-9 follow-up said to amend "the doc/skill"; only the doc was updated. ([.claude/skills/agent-persona-creation/SKILL.md:21](.claude/skills/agent-persona-creation/SKILL.md#L21)). _Fix before CR-12._
4. **tasks/todo.md CR-11 checkboxes all unchecked + empty Review section**, despite the work being complete and committed. ([tasks/todo.md:1](tasks/todo.md#L1)). _Fix before CR-12._
5. **Dashboard lists A_edited `inline_edit` seed forks as standalone rows** — `listArtifactsForWorkspace` has no `derivedVia` filter. Cosmetic; seeds remain reachable via the Branches panel. ([src/lib/domain/data/artifacts.ts:65](src/lib/domain/data/artifacts.ts#L65)).
6. **Gate B `feedback` → `draft` is effectively a terminal "park with a note"** in V1 (no CLI/UI re-produces a draft in place); the mapping is documented but the re-produce mechanism is not. ([src/lib/domain/workflows/creator/review/artifact-review.ts:105](src/lib/domain/workflows/creator/review/artifact-review.ts#L105)).

### ⚪ Nits

- DiffView shows `+0/−0` with no explicit "identical" affordance when two distinct branches have identical bodies. ([src/components/review/DiffView.tsx:22](src/components/review/DiffView.tsx#L22)).
- Money stored as Prisma `Float` (`costUSD`, `bestScore`). Fine for V1 / the <$5 assertion; migrate to Decimal/integer-cents if V2 introduces billing. ([prisma/schema.prisma:228](prisma/schema.prisma#L228)).

## Needs human input

- **Manual quality judgment of the Gate B UI** (acceptance criteria 2 & 3 are human-judged): is the inline editor + history + diff experience publishable-quality and usable? The lenses verified routing, data discipline, transitions, and lineage — not rendered visual polish. Recommend a manual walkthrough of `/workspaces/[id]/artifacts/[artifactId]/review` before CR-12.
- **Confirm the Tiptap → Textarea substitution is acceptable** as the V1 Gate B inline editor (it overrides the CR-10 pre-committed "full Tiptap inline editor is CR-11" line). The byte-clean-markdown rationale is sound; this is a deliberate scope substitution that should be acknowledged.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Commit the `## CR-11 decisions` section + add `docs/sign-off-review/CR-11-sign-off.md` (record Tiptap→Textarea, StageSession.finalArtifactId soft-ref, additive columns, branch-chips realization of "side-by-side", discharged carry-forwards) | CR-12 | [docs/03-decisions/creator-decisions-log.md:1147](docs/03-decisions/creator-decisions-log.md#L1147) |
| Add an atomic in-flight guard to `regenerateArtifact` (claim the source via `updateMany` with status in the where-clause; restore on failure) | CR-12 | [src/lib/domain/data/artifact-actions.ts:183](src/lib/domain/data/artifact-actions.ts#L183) |
| Add the zero-row-path test (already-reviewed race) for both `submitGateAReview` and `submitGateBReview` | CR-12 | [tests/integration/gate-b-review.test.ts:204](tests/integration/gate-b-review.test.ts#L204) |
| Correct the stale Idea Coach example path in the skill | CR-12 | [.claude/skills/agent-persona-creation/SKILL.md:21](.claude/skills/agent-persona-creation/SKILL.md#L21) |
| Check off completed CR-11 plan items + add a Review section | CR-12 | [tasks/todo.md:1](tasks/todo.md#L1) |
| (Optional) Filter the dashboard list to exclude `derivedVia='inline_edit'` seed forks | CR-12 | [src/lib/domain/data/artifacts.ts:65](src/lib/domain/data/artifacts.ts#L65) |

## Bottom line

**Signed off with follow-ups.** CR-11 is properly complete — fork-on-regenerate, immutable history, review sovereignty, TOCTOU-guarded review, persisted iteration history, clean diff, and the zero-domain-word Core enhancement are all verified correct, and every deterministic gate is green. No blockers. Two majors must be tracked before CR-12: commit the binding CR-11 decisions-log section + sign-off report (the recurring cadence gap — verified uncommitted, not in `7e6616a`), and add an atomic guard to `regenerateArtifact` to prevent double-billed regeneration. The user is clear to proceed to **CR-12 (V1 acceptance test)** once the decisions section + sign-off report are committed.