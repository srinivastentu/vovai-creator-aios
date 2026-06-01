# CR-8 Sign-off Review — Context Engineering System (System 6) + Stage 3/5 wiring

| | |
|---|---|
| **Step** | CR-8 — Context Engineering System (System 6, thin seam) + Workspace/role schema finish |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `15576be` |
| **Tag** | `CR-8-context-system` |
| **Reviewed at** | 2026-06-01 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-8 is properly done. The Context Engineering System ships exactly the V1 deliverable the action plan scopes: a Core seam (`ContextCurator` contract + `PassthroughCurator`) that is domain-agnostic machinery, a Domain seam (`creator/context/curation.ts`) that owns the curator choice and the priority table, and live wiring at Stage 3 (synthesizer) and Stage 5 (cross-critique producers). I independently re-derived every gate read-only — typecheck clean, 604 passed / 3 skipped, import-discipline grep empty, `prisma validate` OK, working tree clean — and confirmed each load-bearing claim against the source. All five lenses converged with zero blockers and zero majors. The single point worth tracking is a V1-inert design-risk the decisions log already flags (only producers consume the curated block; critics + integrator still render the raw full master); it becomes a real correctness divergence only when a V2 non-passthrough curator lands, which is out of the V1 plan. The verdict is **SIGN-OFF WITH FOLLOW-UPS** (rather than a bare sign-off) purely to keep that V2 item and three cosmetic doc-precision nits durably tracked — none invalidate the step or block CR-9.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0 — 604 passed / 3 skipped (607); matches commit's "582 → 604" |
| `npm run build` | exit 0 (per lenses; additive code-only change, typecheck clean) |
| Import discipline (`core` → `domain`) | empty (PASS) — `grep -rE "from ['\"][^'\"]*domain/" src/lib/core/` exit 1 |
| `prisma validate` / `migrate status` | valid; no drift (CR-8 adds no schema change) |
| New context tests | 22 passed (11 Core + 11 Domain) — `tests/unit/core/context.test.ts`, `tests/unit/domain/context-curation.test.ts` |
| Git hygiene | one well-formed commit; title + body + `Refs:` line + `Co-Authored-By` trailer; tag on correct commit; working tree clean |

## What's correct (strengths)

- **Textbook Core/Domain seam.** [src/lib/core/context/types.ts:3](src/lib/core/context/types.ts#L3) and [passthrough-curator.ts](src/lib/core/context/passthrough-curator.ts) are zero-domain-word machinery; the curator CHOICE + priority table live in Domain ([curation.ts:24](src/lib/domain/workflows/creator/context/curation.ts#L24), [curation.ts:58](src/lib/domain/workflows/creator/context/curation.ts#L58)). The grep-check returns empty. A V2 curator slots in by changing one line.
- **Correct, exhaustively-tested curator logic.** Stable priority-DESC sort with explicit index tiebreak ([passthrough-curator.ts:31](src/lib/core/context/passthrough-curator.ts#L31)), greedy keep-if-fits / drop-lowest-first, independent `maxBytes` hard cap ([passthrough-curator.ts:51](src/lib/core/context/passthrough-curator.ts#L51)), accurate `originalTokens`/`finalTokens`. Boundary tests cover order, stable tiebreak, both budget caps, keep-smaller-after-dropping-larger, and empty input.
- **CR-3 TODO(CR-8) genuinely discharged.** Zero `TODO(CR-8)` markers remain repo-wide; `MASTER_CONTEXT_PRIORITIES` derive from the shared `CREATOR_CONTEXT_PRIORITIES` ([long-form-synthesizer.ts:62](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts#L62)) and `assembleMasterContext` routes through the Core curator ([long-form-synthesizer.ts:209](src/lib/domain/workflows/creator/agents/long-form-synthesizer.ts#L209)), asserted by [context-curation.test.ts:63](tests/unit/domain/context-curation.test.ts#L63).
- **Live wiring, not dead code.** Stage 5 `runCrossCritiqueLoop` calls `prepareRepurposeContext` ONCE before the loop ([cross-critique-stage.ts:450](src/lib/domain/workflows/creator/cross-critique-stage.ts#L450), loop at [:461](src/lib/domain/workflows/creator/cross-critique-stage.ts#L461)) and threads it into `runLoop` each pass ([:463](src/lib/domain/workflows/creator/cross-critique-stage.ts#L463)); producers read `ctx.curatedContextBlock` with a sync fallback ([producer-gpt.ts:80](src/lib/domain/workflows/creator/agents/linkedin/producer-gpt.ts#L80)).
- **Coding standards clean.** No `any` / `as any` / `| string` union-widening in any changed source file; `curatedContextBlock?: string` ([types.ts:217](src/lib/domain/workflows/creator/types.ts#L217)) is a backward-compatible optional, non-mutation proven by [context-curation.test.ts:104](tests/unit/domain/context-curation.test.ts#L104).
- **Git hygiene corrects the CR-6 lesson.** Commit `15576be` carries the `Co-Authored-By` trailer CR-6 omitted, plus a proper body and `Refs:` line.
- **Forward-readiness intact.** Purely additive — no `src/app`, `api/`, or `prisma/` change — so CR-9 is unblocked; `role WorkspaceRole @default(admin)` ([schema.prisma:105](prisma/schema.prisma#L105), enum [:21](prisma/schema.prisma#L21)) verified correct with `role: 'admin'` in seed ([seed.ts:136](prisma/seed.ts#L136)).

## Findings

### 🔴 Blockers

None.

### 🟠 Majors

None.

### 🟡 Minors (track as follow-ups)

1. **Stage-5 curated-context consistency.** Only the two cross-critique producers consume `ctx.curatedContextBlock`; the critics and integrator still call `personaBlock(ctx)+masterBlock(ctx,...)` directly and ignore the curated block ([integrator.ts:84](src/lib/domain/workflows/creator/agents/linkedin/integrator.ts#L84), [article/integrator.ts:82](src/lib/domain/workflows/creator/agents/article/integrator.ts#L82), [critic-claude-on-gpt.ts:64](src/lib/domain/workflows/creator/agents/linkedin/critic-claude-on-gpt.ts#L64)). V1-inert because `PassthroughCurator` never drops (curated == raw, proven byte-identical by [context-curation.test.ts:108](tests/unit/domain/context-curation.test.ts#L108)). But `context-system.md:104-105` names Stage 5 as "select sections of Master relevant to short-form" — exactly where a V2 non-passthrough curator drops/compresses. When that curator lands, producers would see a curated subset while the integrator (which writes the FINAL artifact in the persona voice) and critics see the full uncurated master. The decisions log already flags it. _Track as a V2 follow-up; no change for V1._

### ⚪ Nits

- **Decisions-log phantom marker.** [creator-decisions-log.md:927](docs/03-decisions/creator-decisions-log.md#L927) asserts `// TODO(V2): wire Clerk + role-based authz` "remains the forward marker," but a repo-wide grep of `prisma/`, `src/`, `scripts/` finds no such marker — it is scheduled for CR-9 UI code. The verification substance (role correct from CR-1, nothing deferred) is accurate; only the asserted artifact is phantom.
- **Over-scoped "single source of truth."** [creator-decisions-log.md:868](docs/03-decisions/creator-decisions-log.md#L868) / [curation.ts:21](src/lib/domain/workflows/creator/context/curation.ts#L21) call `CREATOR_CONTEXT_PRIORITIES` the source of truth for "the context-system.md priority table." The doc's table ([context-system.md:126-135](docs/01-architecture/context-system.md#L126)) has 10 rows; the constant defines 7, correctly omitting `User query=10`, `Tool outputs=4`, `Conversation history=3` (no V1 consumer). The 7 overlapping values match exactly. It is the source of truth for the V1-used subset. The doc caveats (line 137) the numbers are conventions, not law.
- **Imprecise integrator framing.** [creator-decisions-log.md:932](docs/03-decisions/creator-decisions-log.md#L932) says the integrator consumes "the producer drafts + critiques ... not the raw source pool" — but [integrator.ts:84-86](src/lib/domain/workflows/creator/agents/linkedin/integrator.ts#L84) DOES inject `masterBlock(ctx,...)` (the full raw master). Reword to name the V2 risk precisely.
- **Producer separator normalization.** CR-8's `defaultProducerContext` joins persona+master with `\n\n` ([cross-critique-shared.ts:43](src/lib/domain/workflows/creator/agents/cross-critique-shared.ts#L43)), whereas pre-CR-8 the producer builder used `[...].filter(Boolean).join('\n')` (git `5447eff`), collapsing the separator to a single `\n`. So Stage-5 producers receive a one-character-different prompt vs CR-7 (Stage 3 is genuinely byte-identical). Honestly documented as an intentional fix ([creator-decisions-log.md:910](docs/03-decisions/creator-decisions-log.md#L910)); functionally inert. The "byte-identical to the inline fallback" test ([context-curation.test.ts:108](tests/unit/domain/context-curation.test.ts#L108)) compares the new curated path against the new `defaultProducerContext`, so it should not be read as "identical to the prior shipped prompt."
- **Critic/integrator separator inconsistency.** The same collapse pattern remains in the critic/integrator builders (single `\n`), a cosmetic role mismatch with the producers' `\n\n`. No behavioral impact ([integrator.ts:83](src/lib/domain/workflows/creator/agents/linkedin/integrator.ts#L83), [critic-claude-on-gpt.ts:60](src/lib/domain/workflows/creator/agents/linkedin/critic-claude-on-gpt.ts#L60)).

## Needs human input

None — every claim in scope was verifiable from the repo. (No live model run is part of CR-8; the acceptance-test prose judgments are a CR-12 concern.)

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Thread the curated master block into the cross-critique integrator (and optionally critics) so every Stage-5 LLM call sees the same curated source pool; otherwise producers see a curated subset while the integrator sees the full uncurated master. V1-inert under passthrough. | V2 (first non-passthrough curator; out of the V1 CR-1..CR-12 plan) | [src/lib/domain/workflows/creator/agents/linkedin/integrator.ts:84](src/lib/domain/workflows/creator/agents/linkedin/integrator.ts#L84) |
| Reword the Clerk/authz line to "the marker lands with the CR-9 UI code" (stop asserting a marker that does not yet exist). | CR-9 | [docs/03-decisions/creator-decisions-log.md:927](docs/03-decisions/creator-decisions-log.md#L927) |
| Reword the integrator justification to state it currently receives the FULL (uncurated) master alongside drafts+critiques. | CR-9 | [docs/03-decisions/creator-decisions-log.md:932](docs/03-decisions/creator-decisions-log.md#L932) |
| Optional: add a golden/snapshot assertion on a producer user message so future prompt drift (e.g. the separator change) is caught. | CR-12 | [tests/e2e/v1-acceptance.test.ts](tests/e2e/v1-acceptance.test.ts) |

## Bottom line

Signed off with follow-ups. CR-8 is genuinely complete and correct for V1: the System-6 seam is clean machinery, the wiring is live at Stages 3 and 5, the CR-3 TODO is discharged, and every deterministic gate passes. The user is clear to proceed to **CR-9 (CRUD UIs + Idea Coach)**. The one substantive follow-up (curated context reaching critics/integrator) is a V2 concern; the three doc-precision items are cosmetic and can ride along with CR-9.