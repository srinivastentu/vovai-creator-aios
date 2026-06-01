# CR-9 Sign-off Review — CRUD UIs (Persona + Workspace + Idea Log + Idea Coach)

| | |
|---|---|
| **Step** | CR-9 — CRUD UIs (Persona + Workspace + IdeaLog + Idea Coach) |
| **Verdict** | SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `f2d3145` |
| **Tag** | `CR-9-crud-ui` |
| **Reviewed at** | 2026-06-01 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

CR-9 is genuinely complete and the next step (CR-10 Gate A UI) is unblocked. Every deliverable the CR-9 spec enumerates exists and behaves as specified — all 7 routes (`/personas`, `/personas/new`, `/personas/[id]`, `/workspaces`, `/workspaces/new`, `/workspaces/[id]`, `/workspaces/[id]/ideas`) plus the coach API compile and pass their tests. The single most consequential binding decision in scope — the MMS single-gateway / cost-transparency principle — is honored exactly: the Idea Coach routes through `gateway.request` rather than the spec's fictional `executeAgent` helper, so the call lands in the Core `CostLedger`. The data layer is uniformly user-scoped, including the indirect ideas path. The two documented deviations from the spec sketch (free-text `formality`, real gateway machinery) are correct doc-precedence resolutions, not defects. **One lens disagreement adjudicated:** the Process lens rated the missing `## CR-9 decisions` section a *major*; I demote it to *minor* in line with the Decisions lens — per the CR-7 precedent this is the expected pre-sign-off state (decisions land in the sign-off follow-up commit), the binding decisions are already documented in code comments, and it neither invalidates CR-9 nor blocks CR-10. With zero blockers and zero majors after re-assessment, the verdict is **SIGN-OFF WITH FOLLOW-UPS**.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| `npm run test` (3 CR-9 files) | exit 0 — 13 passed / 0 skipped (full suite 617 passed / 3 skipped pre-existing live-MMS) |
| `npm run build` (`next build`) | exit 0 — all 7 routes + coach API compiled |
| Import discipline (`core` → `domain`) | empty (PASS) — and zero `src/lib/core/` files changed in `f2d3145` |
| `prisma validate` / `migrate status` | valid; up to date, no drift |
| Migration shape | additive only — `Workspace.niches` + `lastActiveAt`, both default-backed |

## What's correct (strengths)

- **MMS single-gateway / cost-transparency principle honored exactly** — the Idea Coach routes through `gateway.request` (capability `text-generation`, model `claude-sonnet-4-20250514`, `context.callerTag 'idea-coach'`) at [src/lib/domain/agents/idea-coach.ts:92](src/lib/domain/agents/idea-coach.ts#L92), not the spec's fictional `executeAgent` SDK helper. The call lands in the Core `CostLedger` on both success ([src/lib/core/models/gateway.ts:303](src/lib/core/models/gateway.ts#L303)) and failure ([src/lib/core/models/gateway.ts:204](src/lib/core/models/gateway.ts#L204)); [src/lib/core/models/cost-ledger.ts:44](src/lib/core/models/cost-ledger.ts#L44) filters on `context.callerTag`.
- **Multi-tenant scoping on every query, including the indirect ideas path** — `listIdeas`/update/delete join through `workspace.userId = getCurrentUserId()` ([src/lib/domain/data/ideas.ts:44](src/lib/domain/data/ideas.ts#L44), [:83](src/lib/domain/data/ideas.ts#L83), [:93](src/lib/domain/data/ideas.ts#L93), [:105](src/lib/domain/data/ideas.ts#L105)), so a forged `workspaceId` cannot leak another user's rows. Makes the V2 Clerk swap a genuine one-line change.
- **Doc-precedence resolved correctly** — persona sub-schemas follow the decisions-log-pinned `buildos-persona.md` (free-text `formality`, [src/lib/domain/persona-schema.ts:22](src/lib/domain/persona-schema.ts#L22)) over the spec's slider sketch (required for the seeded BuildOS persona to round-trip), and the canonical field name `defaultRubricRefs` ([prisma/schema.prisma:89](prisma/schema.prisma#L89)) is used over the spec table's stale `defaultRubrics`.
- **Coach route handles every boundary path with the correct status** — malformed JSON → 400, not-owned/missing workspace → 404, missing persona → 404, generation failure → 422 ([src/app/api/workspaces/[id]/ideas/coach/route.ts:21](src/app/api/workspaces/[id]/ideas/coach/route.ts#L21)). The parser is tolerant with one bounded repair re-prompt ([src/lib/domain/agents/idea-coach.ts:110](src/lib/domain/agents/idea-coach.ts#L110)).
- **Clean git hygiene + additive migration** — one well-formed commit (correct title, body, `Refs`, `Co-Authored-By` trailer) on the right tag; the migration adds two default-backed columns only ([prisma/migrations/.../migration.sql](prisma/migrations)). Zero `src/lib/core/` files changed — a pure Domain + UI step, correctly placed.
- **Clerk forward-marker discharged** — [src/lib/auth/current-user.ts:3](src/lib/auth/current-user.ts#L3) carries `TODO(V2): wire Clerk`, fulfilling the CR-8 note that the marker "lands with the CR-9 UI code". Scope held — Promote is a disabled stub.

## Findings

### 🔴 Blockers

None.

### 🟠 Majors

None.

### 🟡 Minors (track as follow-ups)

1. **Decisions-log cadence missing** — no `## CR-9 decisions` section exists (`grep` returns nothing; the log ends at CR-8). CR-9 made three recordable decisions: the `executeAgent`→MMS-gateway substitution (documented only in [src/lib/domain/agents/idea-coach.ts:8](src/lib/domain/agents/idea-coach.ts#L8)), the additive `Workspace.niches`/`lastActiveAt` migration, and the agent-placement choice. Per the CR-7 precedent this is the expected pre-sign-off state; record in the sign-off follow-up commit ([docs/03-decisions/creator-decisions-log.md:945](docs/03-decisions/creator-decisions-log.md#L945)). _Fix before CR-10._
2. **Idea Coach agent placement** — [src/lib/domain/agents/idea-coach.ts:1](src/lib/domain/agents/idea-coach.ts#L1) sits outside the canonical `src/lib/domain/workflows/creator/agents/` tree where all 19 other agents live and where both [docs/02-domain/agents-and-personas.md:149](docs/02-domain/agents-and-personas.md#L149) and [.claude/skills/agent-persona-creation/SKILL.md:21](.claude/skills/agent-persona-creation/SKILL.md#L21) name it. It also ships a flat `SYSTEM_PROMPT` rather than the Forge persona-document template. Not an import-rule violation (grep empty; still Domain→Core). _Fix before CR-11._
3. **No CR-9 sign-off report / README index row** — `find` returns nothing; [docs/sign-off-review/README.md:152](docs/sign-off-review/README.md#L152) stops at CR-8. This audit produces the report; it plus the index row must be committed before CR-10 starts. _Fix before CR-10._
4. **Archive swallows errors silently** — [src/components/ideas/IdeaRow.tsx:87](src/components/ideas/IdeaRow.tsx#L87) has an empty `catch` with a comment, deviating from the CR-9 "all errors inline" rule. Practical risk near zero (archive is a non-destructive status update with no FK/constraint that can realistically fail). _Fix before CR-11._
5. **DB-gated tests skip silently without `DATABASE_URL`** — [tests/integration/data-crud.test.ts:32](tests/integration/data-crud.test.ts#L32) (`suite = hasDb ? describe : describe.skip`) means the CRUD round-trip/filter gate can pass vacuously in a DB-less CI. Locally with the DB present all 13 run and pass. _Fix before CR-12._

### ⚪ Nits

- Idea Coach loading state renders a fixed 3 skeleton cards; the spec phrased it as "3–5". 3 is within range — satisfies the literal requirement.
- `slider.tsx` is installed (per spec §0) but unused (the documented buildos-persona deviation made `formality` free-text); the spec's `form` primitive is absent (form built with `react-hook-form` directly). Both harmless.
- `IdeaProposalCard` list keyed `${title}-${index}`; two same-title proposals collide on the title portion (cosmetic React warning; discard logic is correct).
- The CR-9 spec entity table ([docs/04-plans/CR-9-crud-ui.md:53](docs/04-plans/CR-9-crud-ui.md#L53)) still labels the field `defaultRubrics`; code uses the canonical `defaultRubricRefs`. The spec doc is the stale one.
- No lesson captured for the CR-9 spec being authored against Drizzle (corrected in commit `611806f`). Optionally add a one-line `tasks/lessons.md` entry.

## Needs human input

- **UI/UX quality is human-judged.** The five lenses verified behavior, routing, and data discipline — not the visual polish or end-to-end feel of the persona/workspace/idea CRUD flows. Recommend a manual walkthrough (or rely on `tests/e2e/crud-walkthrough.spec.ts` under a production build) before CR-10 to confirm the dashboard, idea-log filters, and Idea Coach modal feel production-quality.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Append `## CR-9 decisions (2026-06-01)` recording the gateway substitution, the additive migration, and the agent placement | CR-10 | [docs/03-decisions/creator-decisions-log.md:945](docs/03-decisions/creator-decisions-log.md#L945) |
| Write the CR-9 sign-off report + add a CR-9 README index row | CR-10 | [docs/sign-off-review/CR-9-sign-off.md:1](docs/sign-off-review/CR-9-sign-off.md#L1) |
| Reconcile the Idea Coach agent home (move to `workflows/creator/agents/` or amend the doc + log) | CR-11 | [src/lib/domain/agents/idea-coach.ts:1](src/lib/domain/agents/idea-coach.ts#L1) |
| Surface archive failures inline instead of the silent empty catch | CR-11 | [src/components/ideas/IdeaRow.tsx:87](src/components/ideas/IdeaRow.tsx#L87) |
| Ensure CI provisions `DATABASE_URL` (or fails when DB-gated suites skip) | CR-12 | [tests/integration/data-crud.test.ts:32](tests/integration/data-crud.test.ts#L32) |
| Optionally assert `gateway.request` called with `callerTag === 'idea-coach'` | CR-12 | [tests/unit/idea-coach.test.ts:1](tests/unit/idea-coach.test.ts#L1) |

## Bottom line

Signed off with follow-ups. CR-9 is genuinely done — all gates green, the cost-transparency principle and multi-tenant scoping correctly applied, and CR-10 (Gate A UI) is unblocked. Before starting CR-10, write the CR-9 decisions-log section and sign-off report (the two CR-10-due minors); the remaining minors/nits are tracked for CR-11/CR-12.