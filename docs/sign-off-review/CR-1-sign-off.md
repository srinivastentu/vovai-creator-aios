# CR-1 Sign-off Review — Minimal CreatorOS schema + BuildOS persona seeded

| | |
|---|---|
| **Step** | CR-1 — minimal schema + BuildOS persona seeded |
| **Verdict** | ✅ SIGN-OFF WITH FOLLOW-UPS |
| **Confidence** | high |
| **Reviewed commit** | `eb01b5a` (impl) + `448332b` (lesson follow-up) |
| **Tag** | `CR-1-schema` |
| **Reviewed at** | 2026-05-31 |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis, corroborated by direct live verification |

## Verdict

CR-1 is **genuinely and properly complete.** Scope was exactly right — minimal
Prisma schema + migration + idempotent seed of one BuildOS persona and one
idea; no UI, no API routes. Every authoritative requirement is met, independently
re-derived from the files. **Zero blockers, zero majors.** One lens rated the
missing `LongFormSection` order-uniqueness constraint a *major*; it was
adjudicated **down to minor** for CR-1 because the table is empty, no
authoritative doc mandates the constraint, and the next step (CR-2, Research)
writes no sections — so nothing is blocked. The two real gaps (section/iteration
uniqueness constraints; the unrecorded persona sign-off) are correctly-timed
follow-ups, not CR-1 rework.

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm run test` | ✅ exit 0 — 442 passed / 3 skipped (32 files) |
| `npm run build` | ✅ exit 0 |
| Import discipline (`core` → `domain`) | ✅ empty (PASS) |
| `prisma validate` | ✅ valid |
| `prisma migrate status` | ✅ up to date, no drift |
| Seed row counts (live DB) | ✅ User / CreatorPersona / Workspace / Idea = 1 each; all downstream tables = 0 |
| Seeded content vs spec | ✅ idea title, status, niches, persona JSON keys, rubric refs, FK integrity all match |
| Generated client | ✅ gitignored; all 11 model files present |

## What's correct (strengths)

- **All 11 models, 7 enums, every field** — type, nullability, default — match
  the action-plan block and [entities.md](../02-domain/entities.md) field-for-field.
  `schema.prisma` ↔ `migration.sql` are byte-consistent (7 enums, 11 tables, 16
  indexes, 13 FKs).
- **The three highest-risk reconciliation decisions are honored exactly:**
  - `DerivedVia` uses the Prisma-legal **underscore** form
    (`cross_critique \| inline_edit \| regenerate \| merge`) —
    [schema.prisma:52-57](../../prisma/schema.prisma#L52-L57).
  - `Artifact.longFormMasterId` is **REQUIRED / non-null** —
    [schema.prisma:207](../../prisma/schema.prisma#L207).
  - **All 13 FK `onDelete` policies** match the
    [entities.md delete-policy table](../02-domain/entities.md#L248-L259)
    line-for-line (owned parts Cascade; independent history Restrict). Traced
    destructive flows: deleting a `LongFormMaster` cascades sections + sources +
    (via both FKs) `SourceRef`s with **no orphan path**, while
    `Artifact → LongFormMaster` Restrict correctly blocks deleting a master that
    has artifacts.
- **`StageSession` + `IterationRecord`** episodic-memory tables (omitted by the
  action-plan schema block but mandated by the decisions log + addendum) are
  present — a **correct application of doc precedence** (decisions log > action
  plan), cited in a schema header comment
  ([schema.prisma:5-8](../../prisma/schema.prisma#L5-L8)).
- **Seed is verbatim** from the reviewed
  [buildos-persona.md](../02-domain/buildos-persona.md) "Seed values" and
  idempotent on stable ids — gives CR-2 a known target idea.
- **`StageSession.finalArtifactId` is an intentional acyclic soft pointer** (no
  `@relation`) — the *correct* call; a hard FK would create a circular Restrict
  coupling with `Artifact`.
- **Lesson captured** ([lessons.md:256-283](../../tasks/lessons.md#L256-L283)):
  the Prisma-7 `prisma generate`-after-`migrate dev` gotcha — accurate,
  root-caused, and directly relevant to CR-2/CR-3 scripts.
- **Process hygiene:** one well-formed commit (cr-step-protocol Step 8 format +
  `Refs:` line + Co-Authored-By), tag on the right commit, branch synced with
  origin; `db:seed` + `tsx` wired in [package.json:27,70](../../package.json#L27).

## Findings

### 🔴 Blockers

None.

### 🟠 Majors

None.

### 🟡 Minors (track as follow-ups)

1. **Missing `@@unique([longFormMasterId, order])` on `LongFormSection`**
   ([schema.prisma:161-172](../../prisma/schema.prisma#L161-L172)). Nothing
   prevents duplicate/gappy `order` values; Gate A (CR-10) renders sections by
   order and the CR-3 validator spec checks only `sections.length >= 3` and
   per-section sourceRefs. _Fix before CR-3 persists real masters._
2. **Persona sign-off traceability gap** —
   [buildos-persona.md](../02-domain/buildos-persona.md) still reads *"Status:
   DRAFT — Srinivas to review/edit before CR-1 seeds it"* with 5 unchecked boxes,
   yet the seed was committed verbatim and the doc never updated. The 2026-05-31
   decision required review **before** seeding, and CR-12 grades voice fidelity
   against this exact persona. _Resolve before CR-12._ (See "Needs human input".)
3. **Missing `@@unique([stageSessionId, version])` on `IterationRecord`**
   ([schema.prisma:245-260](../../prisma/schema.prisma#L245-L260)). The Gate B
   history panel and best-version tracking key on version per session. _Pin
   before CR-6/CR-11 write iteration rows._
4. **Persona `Json` columns unvalidated at runtime** (no Zod anywhere in
   `src/lib/domain`) — [schema.prisma:86-89](../../prisma/schema.prisma#L86-L89).
   Safe now (seed writes correct shapes; no consumers yet). _Add parse-on-read/
   write when CR-4 reads the persona and CR-9 accepts CRUD._

### ⚪ Nits

- `StageSession.finalArtifactId` soft pointer is correct — add a one-line schema
  comment so a future maintainer doesn't "fix" it into a circular FK.
- `costUSD` as `Float` — fine for the `< $5.00` tripwire; use Prisma `Decimal`
  for V2 billing.
- `User.email @unique` is an addition beyond the verbatim action-plan field list
  — correct and desirable; keep it.
- Seed header says the `doNotSay` array is "verbatim" but drops the doc's inline
  comment `// AI cliche frame` — persisted JSON is identical; harmless.
- [tasks/todo.md](../../tasks/todo.md) CR-1 "Current Focus"/"Review" sections
  left empty (CLAUDE.md workflow rule 5) — populate per step or retire the
  convention in favor of git tags + lessons.md.
- Untracked `bibliography/` scratch dir in the working tree — gitignore it or
  move it out, to keep future "working tree clean" prereq checks unambiguous.
- The lesson commit (`448332b`) landed 74s after the tag, so the tag excludes the
  lesson doc — immaterial (docs-only follow-up; tags mark code-completion state).

## Needs human input

The persona was seeded from a doc still marked **DRAFT**. CR-1's *technical*
completion does not depend on it, but the V1 acceptance test's voice-fidelity
grade (CR-12) does. **Did you review/approve the BuildOS persona content before
it was seeded?**

- **If yes** → flip [buildos-persona.md](../02-domain/buildos-persona.md) status
  to APPROVED, check the boxes, and record the sign-off (closes the trace).
- **If not** → review it now; the seed is idempotent, so re-running
  `npm run db:seed` after any edit is safe.

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| Add `@@unique([longFormMasterId, order])` + a contiguity check in the CR-3 validator | CR-3 | [schema.prisma:161-172](../../prisma/schema.prisma#L161-L172) + CR-3 validator |
| Add `@@unique([stageSessionId, version])` | CR-6 / CR-11 | [schema.prisma:245-260](../../prisma/schema.prisma#L245-L260) |
| Confirm + record BuildOS persona sign-off (flip DRAFT → APPROVED) | CR-12 | [buildos-persona.md](../02-domain/buildos-persona.md) |
| Add Zod schemas for the 4 persona `Json` sub-shapes (parse-on-read/write); Zod `min(1)` on `description` fields | CR-4 / CR-9 | `src/lib/domain` + CR-9 API boundary |
| Document `finalArtifactId` as an intentional soft pointer (one-line comment) | CR-11 | [schema.prisma:233](../../prisma/schema.prisma#L233) |
| Decide where human review feedback persists (column/JSON on `IterationRecord` vs dedicated table) | CR-10 / CR-11 | new migration in that step |
| Ensure the architect-reviewer verdict appears in the session report for code-bearing steps | CR-2+ | session final report |

## Bottom line

**CR-1 is signed off.** The schema is the load-bearing foundation for the whole
V1 pipeline and it is implemented exactly to spec with high craft. None of the
follow-ups are CR-1 rework — they are correctly-timed work for CR-3, CR-6/CR-11,
CR-9, and CR-12. **Clear to proceed to CR-2 (Research stage).**
