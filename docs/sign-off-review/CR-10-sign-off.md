# CR-10 Sign-off Review — Gate A UI (source traceability panel)

| | |
|---|---|
| **Step** | CR-10 — Gate A UI (source traceability panel) |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `74990f2` |
| **Tag** | `CR-10-gate-a` |
| **Reviewed at** | 2026-06-01 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-10 is properly done and is **signed off with follow-ups**. The non-negotiable Gate A human review for a Long-Form Master is built exactly to spec: the review page at `/workspaces/[id]/master/[masterId]/review` implements the prescribed 3-pane layout (left section list · center markdown / inline-edit · right source-traceability panel) plus a sticky bottom bar surfacing exactly the 4 V1 review actions, with the mandated `TODO(V2): surface use_segments + mix_produce` markers present. The source-traceability panel renders every linked `ResearchSource` with its relevance snippet and even flags any zero-source section as an explicit Gate A failure — directly serving acceptance-test criterion 1. Review logic is correctly placed in Domain (it touches `MasterStatus`/`LongFormMaster`), the additive nullable schema migration matches the schema with no drift, and tests pin the load-bearing invariants (4-of-6 actions, human sovereignty, per-action validation, transitions, real-DB round-trip including immutable-history preservation on reject). All five lenses returned pass / pass-with-nits with zero blockers and (with one exception) zero majors. The one lens disagreement — the DECISIONS-LOG lens rated the missing `## CR-10 decisions` section a **major** while others rated it minor — was adjudicated **major**: CR-10 made genuine architectural decisions (Domain placement of Gate A logic, `feedback`/`reject` → `draft`, `approve` → `approved` not `in_repurpose`) recorded only as code comments, breaking the per-step cadence the log itself mandates. It must be written down before CR-11 reuses the review module, but it does not invalidate the step's code, so it tracks as a follow-up rather than a blocker.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 (`tsc --noEmit`, no output) |
| `npm run test` | exit 0 — 644 tests (641 passed / 3 standard skips); CR-10 subset 24/24 passed |
| `npm run build` | exit 0 (per lenses — new `/workspaces/[id]/master/[masterId]/review` route compiles as dynamic) |
| Import discipline (`core` → `domain`) | empty (PASS) — `grep -rnE "from ['\"][^'\"]*domain/" src/lib/core/` → exit 1 |
| `prisma validate` / `migrate status` | valid; "Database schema is up to date!" (4 migrations) |
| Schema ↔ migration consistency | `LongFormMaster.reviewFeedback String?` + `reviewedAt DateTime?` additive nullable; migration `20260601120000` matches, no backfill |

## What's correct (strengths)

- Route + layout match the spec exactly: 3-pane grid `lg:grid-cols-[220px_minmax(0,1fr)_300px]` — section list · markdown/inline-edit · source panel — plus a sticky 4-action bottom bar ([src/components/review/GateAReview.tsx:126](src/components/review/GateAReview.tsx#L126)).
- The non-negotiable source-traceability panel renders every linked `ResearchSource` + relevance snippet per section and surfaces zero-source sections as an explicit Gate A failure ([src/components/review/SourcePanel.tsx:24](src/components/review/SourcePanel.tsx#L24)).
- Exactly the 4 V1 actions are surfaced; the two engine-only actions are excluded with the mandated `TODO(V2)` comment in both layers ([src/lib/domain/workflows/creator/review/master-review.ts:20](src/lib/domain/workflows/creator/review/master-review.ts#L20), [src/components/review/GateAActions.tsx:19](src/components/review/GateAActions.tsx#L19)).
- Correct Core/Domain placement with documented V2 convergence TODO; import-discipline grep empty ([src/lib/domain/workflows/creator/review/master-review.ts:1](src/lib/domain/workflows/creator/review/master-review.ts#L1)).
- Security + atomicity: every masters query user-scoped via `workspace.userId`; inline-edit section writes + status/note write in one `$transaction`; section updates scoped to the verified master ([src/lib/domain/data/masters.ts:91](src/lib/domain/data/masters.ts#L91)).
- Tests pin spec-mandated invariants with real assertions including immutable-history preservation on reject ([tests/unit/domain/master-review.test.ts:17](tests/unit/domain/master-review.test.ts#L17), [tests/integration/gate-a-review.test.ts:86](tests/integration/gate-a-review.test.ts#L86)).
- Git hygiene: one well-formed commit with `Refs:` line and the `Co-Authored-By` trailer; tag on the correct commit.
- Forward-readiness for CR-11 intact: only additive nullable columns added; `StageSession`/`IterationRecord`/`Artifact` shapes CR-11 reads are untouched.

## Findings

### 🔴 Blockers
None.

### 🟠 Majors
1. **Decisions-log cadence broken — no CR-10 section.** The log's last section is `## CR-9 decisions` ([docs/03-decisions/creator-decisions-log.md:942](docs/03-decisions/creator-decisions-log.md#L942)); there is no `## CR-10 decisions`. CR-10 made genuine decisions documented only in code comments: Domain placement of Gate A logic (vs routing through Core `processReview`); `feedback` AND `reject` → `draft` ([master-review.ts:112](src/lib/domain/workflows/creator/review/master-review.ts#L112)); `approve`/`inline_edit` → `approved` (not the spec's `in_repurpose`). The log's own "How to append" rule says these ship in the code commit. Process/traceability defect — does not invalidate the code, tracks as a follow-up. _Fix before CR-11._

### 🟡 Minors (track as follow-ups)
1. **TOCTOU on the Gate A status check** — status is read separately ([masters.ts:78](src/lib/domain/data/masters.ts#L78)), validated, then the transaction `updateMany` filters only on `{ id, workspace.userId }` — not on `status='gate_a_pending'` ([masters.ts:102](src/lib/domain/data/masters.ts#L102)). Concurrent submits could double-apply. ~zero probability under V1's single user; trivial to harden. _Fix before CR-11._
2. **Doc-precedence deviation on reject/feedback semantics** — review-system-v1.md maps `reject` → `generating (clean)` (clears context/iterations) and `feedback` → `generating`; CR-10 collapses both onto `draft` ([master-review.ts:112](src/lib/domain/workflows/creator/review/master-review.ts#L112)), losing the distinction at the data layer. Defensible for CLI-driven V1 but unpinned. _Fix before CR-11._
3. **Stale `reviewFeedback` across re-synthesis** — nothing clears `reviewFeedback`/`reviewedAt` when a master returns to `gate_a_pending`; an old note can persist until the next reviewer action ([masters.ts:102](src/lib/domain/data/masters.ts#L102)). Approve correctly nulls it. _Fix before CR-11._
4. **No cross-user isolation test** — scoping is enforced in code ([masters.ts:23](src/lib/domain/data/masters.ts#L23)) but the integration test seeds only `local-user` ([tests/integration/gate-a-review.test.ts:80](tests/integration/gate-a-review.test.ts#L80)); the CR-9 user-scoping decision is mechanically unguarded. _Fix before CR-12._
5. **`in_repurpose` defined-but-unwritten** — the enum member is rendered as a label ([GateAReview.tsx:33](src/components/review/GateAReview.tsx#L33)) but never set by code; pipeline-v1.md says approve "unlock[s] Stage 4". Correct lifecycle (in_repurpose belongs to a later Stage-4-entry CR) and does not block CR-11 (pipeline-produce loads master by id, no status gate). _Note before CR-11._

### ⚪ Nits
- `"use server"` at [masters.ts:1](src/lib/domain/data/masters.ts#L1) exposes the two read-only query functions as RPC-callable server actions though they are only called from server components; only `submitGateAReview` needs it. Reads are user-scoped so risk ~zero.
- Commit "+18 unit tests" is loosely stated — 15 `it()` blocks, ~18 cases after `it.each` expansion. Not material.
- `MarkdownView` uses react-markdown without `rehype-raw`/`dangerouslySetInnerHTML` — XSS-safe by default; a deliberate posture worth keeping.
- No `tasks/lessons.md` entry — acceptable; no correction occurred this step.

## Needs human input

- **UI/UX visual polish** of the Gate A review screen is human-judged. The lenses verified routing, layout structure, data discipline, and behavior — not rendered look-and-feel. Recommend a manual walkthrough of `/workspaces/[id]/master/[masterId]/review` before CR-11.
- **Confirm the Gate A approve terminal status.** CR-10 lands approve/inline_edit at `approved`; pipeline-v1.md phrasing ("unlock Stage 4") plus the `in_repurpose` enum could be read differently. The reviewer's read is that `approved` is correct; a one-line confirmation in the new CR-10 decisions section settles it against the CR-4 phrasing.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Append `## CR-10 decisions` (Domain placement + V2 Core-routing TODO; feedback/reject→draft rationale; approve→approved not in_repurpose) | CR-11 | [docs/03-decisions/creator-decisions-log.md:942](docs/03-decisions/creator-decisions-log.md#L942) |
| Add `status: REVIEWABLE_STATUS` to the `updateMany` where clause; treat zero-row update as "already reviewed"; add a test | CR-11 | [src/lib/domain/data/masters.ts:102](src/lib/domain/data/masters.ts#L102) |
| Add a cross-user isolation test (second seeded user → null / throws) | CR-12 | [tests/integration/gate-a-review.test.ts:80](tests/integration/gate-a-review.test.ts#L80) |
| Add a "V1 Gate A adaptation" note clarifying generating-state transitions are the live-LoopState path; V1 maps reject/feedback to `draft` | CR-11 | [docs/01-architecture/review-system-v1.md:13](docs/01-architecture/review-system-v1.md#L13) |
| Clear `reviewFeedback`/`reviewedAt` on re-synthesis back to `gate_a_pending` | CR-11 | [src/lib/domain/data/masters.ts:102](src/lib/domain/data/masters.ts#L102) |
| Move `submitGateAReview` to a dedicated `"use server"` actions file; import the read queries as plain async fns | CR-12 | [src/lib/domain/data/masters.ts:1](src/lib/domain/data/masters.ts#L1) |

## Bottom line

**Signed off with follow-ups.** CR-10 is genuinely complete: the non-negotiable Gate A source-traceability review is built to spec, all deterministic gates pass, and nothing CR-11 depends on is disturbed. You are clear to proceed to **CR-11 (Gate B UI)**, provided the CR-10 decisions section is written to the log and the TOCTOU / reject-semantics doc follow-ups are tracked before CR-11 reuses the review module.