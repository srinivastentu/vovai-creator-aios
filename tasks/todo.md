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

- [ ] **P1 — Schema + Core type.** Migration `cr_11_gate_b`:
      `IterationRecord.detailJson Json?`, `Artifact.reviewFeedback String?`,
      `Artifact.reviewedAt DateTime?`. Core: add `producersSucceeded` to
      `CrossCritiqueIterationRecord` + populate in `cross-critique.ts`
      (discharges CR-7 follow-up).
- [ ] **P2 — Pure domain logic + unit tests.** `review/artifact-review.ts`
      (Gate B action semantics, mirror master-review), `repurpose-persistence.ts`
      (iteration-history mapper, content rebuild + re-validate, completion
      check, fork payloads), `lib/diff.ts` (LCS line diff).
- [ ] **P3 — Data layer.** `data/artifacts.ts` (reads, plain module) +
      `data/artifact-actions.ts` (`"use server"` mutations: submitGateBReview,
      regenerateArtifact). User-scoped; TOCTOU-guarded; completion wiring.
- [ ] **P4 — Components + page + dashboard.** GateBReview, GateBActions,
      ArtifactEditor, IterationHistoryPanel, DiffView, ArtifactStatusBadge,
      artifact view-model types; page; dashboard artifacts surface.
- [ ] **P5 — Produce CLI persistence + carry-forward fixes.** pipeline-produce
      writes StageSession + IterationRecords. Discharge due-before-CR-11
      follow-ups: masters.ts TOCTOU + zero-row test (CR-10), review-system-v1
      Gate-A note (CR-10), IdeaRow archive inline error (CR-9), idea-coach
      home doc-bless (CR-9), Gate-B null-bestArtifact/terminationReason (CR-6).
- [ ] **P6 — Integration test.** gate-b-review.test.ts (real DB): all 4 actions,
      completion → idea completed, fork-on-regenerate (mock runner), sovereignty,
      cross-user isolation. + core cross-critique zero-producers assertion.
- [ ] **P7 — Gates + architect-reviewer + sign-off audit + commit/tag.**

## Review

_(append a review section as work completes)_
