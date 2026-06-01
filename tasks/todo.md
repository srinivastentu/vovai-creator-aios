# CreatorOS — Task Tracker

> Active spine for the current CR step. The eLearn-vintage tracker is
> archived at `tasks/_eLearn_archive/todo.md`. Build progress is
> tracked via git tags: `git tag | grep CR-`.

## Current Focus — CR-11 — Gate B UI (inline editor + regenerate + diff)

Per-artifact review (Gate B). Page `/workspaces/[id]/artifacts/[id]/review`.
4 actions surfaced (approve | feedback | reject | inline_edit) + Regenerate
(fork). Iteration-history panel. Diff view. Both-artifacts-approved →
Idea.status='completed'.

### Key decisions (pinned this session — see decisions log for rationale)

- **Editor: Textarea + live markdown/plain preview, NOT Tiptap.** Artifacts
  are plain-text (LinkedIn) / markdown (article); a WYSIWYG would risk
  mangling markdown the acceptance test needs byte-clean. Mirrors Gate A's
  Textarea precedent + the CR-9 "use the repo's actual machinery" pattern.
- **Regenerate = live cross-critique in a server action, gated on API keys,
  runner injectable for tests.** Honors the prompt's "kick off new
  cross-critique iteration … both branches side-by-side." Fork lineage is the
  testable contract; the live loop is injected/mocked in tests.
- **Iteration history persisted in StageSession + IterationRecord** (per
  entities.md / memory-architecture.md), with an additive `IterationRecord.
  detailJson` for the cross-critique per-role snippets. The produce CLI +
  the regenerate action both write these rows.
- **Fork semantics:** inline-edit Save → fork (derivedVia='inline_edit',
  parent=[current], approved). Regenerate → A_edited (inline_edit) then
  A_regen (regenerate, parent=[A_edited]). Originals immutable.

## Plan

- [x] **P1 — Schema + Core type.** Migration `cr_11_gate_b`:
      `IterationRecord.detailJson`, `Artifact.reviewFeedback/reviewedAt`. Core:
      `CrossCritiqueIterationRecord.producersSucceeded` (discharges CR-7 follow-up).
- [x] **P2 — Pure domain logic + unit tests.** `review/artifact-review.ts`,
      `repurpose-persistence.ts` (history mapper, rebuild+revalidate, completion,
      fork specs), `lib/diff.ts` (LCS line diff). 37 unit tests.
- [x] **P3 — Data layer.** `data/artifacts.ts` (reads) + `data/artifact-actions.ts`
      (`"use server"`: submitGateBReview TOCTOU-guarded, regenerateArtifact +
      injectable runner + API-key gate). Completion wiring.
- [x] **P4 — Components + page + dashboard.** GateBReview, GateBActions,
      ArtifactEditor (Textarea+preview), IterationHistoryPanel, DiffView,
      ArtifactStatusBadge, ArtifactBody, view-models; page `[artifactId]`; dashboard.
- [x] **P5 — Produce CLI persistence + carry-forward fixes.** pipeline-produce
      writes StageSession + IterationRecords (shared repurpose-context). Discharged
      CR-6 (null/terminationReason), CR-7 (degradation signal), CR-10 (masters
      TOCTOU + review-system-v1 note), CR-9 (IdeaRow toast + idea-coach doc-bless).
- [x] **P6 — Integration test.** gate-b-review.test.ts (real DB, 10 tests) + core
      zero-producers assertion.
- [x] **P7 — Gates + architect-reviewer (APPROVE) + sign-off (SIGN-OFF WITH
      FOLLOW-UPS) + commit `7e6616a` + tag `CR-11-gate-b`.**

## Review

**Shipped (CR-11 — Gate B).** Per-artifact review at
`/workspaces/[id]/artifacts/[artifactId]/review`: markdown-safe inline editor,
4 surfaced actions (approve/feedback/reject/inline_edit) + live cross-critique
**Regenerate** that forks (A_edited → A_regen, immutable history), an
iteration-history panel sourced from persisted `StageSession`/`IterationRecord`
(new `detailJson`), a branches list + LCS diff, and Idea auto-completion when both
V1 artifact types are approved. Core gained `producersSucceeded`. The produce CLI +
regenerate action now persist episodic history.

**Gates.** typecheck 0 · test 689 passed/3 skipped (was 641) · build 0 · grep-check
empty · prisma valid/no-drift · architect-reviewer APPROVE · sign-off SIGN-OFF WITH
FOLLOW-UPS (zero blockers).

**Carry-forwards discharged (due before CR-11):** CR-6 null-best/terminationReason,
CR-7 dialectic-degradation signal, CR-9 IdeaRow toast + idea-coach home, CR-10
masters TOCTOU + review-system-v1 gate-adaptation note.

**Open (due before CR-12):** regenerate atomic in-flight guard (MAJOR, bounded by
budget cap + button-disable); explicit zero-row-path test for both gates; manual
UI walkthrough + Tiptap→Textarea confirmation (human-judged). See the CR-11
sign-off follow-ups in `docs/03-decisions/creator-decisions-log.md`.
