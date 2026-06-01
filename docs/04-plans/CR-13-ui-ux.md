# CR-13 — UI/UX Elevation (Workbench layout) · extension on shipped v1.0

Paste into Claude Code at repo root. This is **not a build** — CreatorOS V1 is shipped,
tested, and tagged `v1.0` (CR-1…CR-12 complete: backend, frontend, agents, cross-critique
loop, live acceptance test passing). CR-13 is an **additive UI/UX layer** that elevates the
existing app into the Workbench design language and fills only the backend gaps the new UI
provably needs.

**Tags:** per-track `cr13-<track>`; final `CR-13-ui-ux` (+ optional `v1.1`).

---

## 0. Prime directive & rules of engagement (working on shipped code)

1. **Non-breaking.** `npm test` (702 passing, 3 skipped), `npm run test:acceptance`,
   `npm run build`, `npx prisma validate`, and `grep -r "from.*domain/" src/lib/core/` (empty)
   must all stay green before and after every track. Run the suite after each track.
2. **Wrap, don't rewrite.** Migrate existing pages/components into the new frame and styling.
   Do **not** refactor data-layer, agent, loop, or API *logic*. Keep public component props and
   server-action signatures stable where tests or other modules depend on them; if a prop must
   change, update call sites in the same track and re-run tests.
3. **Never edit a test to make it pass.** If the redesign breaks a test, the redesign is wrong.
4. **Backend is additive and gap-driven only.** No schema migration unless the new UI strictly
   needs a field that doesn't exist — and then flag + justify it at the Phase-0 pause before writing it.
5. **Core purity holds.** No `domain/` imports in `core/`. UI lives in `app/**`, `components/**`.
6. **Respect the existing CR discipline:** commit + tag per track, no scope creep, the V2
   follow-ups in the decisions log stay out of scope. Leave `scripts/demo-gate-b.ts` untouched.
7. Toasts only on destructive-success; all else inline. Desktop-only. shadcn + Tailwind only;
   **no design-system invention** (tokens in §3).

---

## 1. Target layout — Workbench as the primary app frame

Every workspace-scoped page is migrated into one frame (Claude-artifacts feel):

```
┌────┬───────────────────────────────────────────────────────────────┐
│ N  │ TOP BAR · workspace switcher · breadcrumb · status             │ row 1
│ A  │ GOVERNANCE RIBBON (review screens) · version·lineage·score·cost │ row 2
│ V  ├───────────────────────────────┬───┬───────────────────────────┤
│    │ LEFT — working column         │ │ │ RIGHT — PREVIEW PANE      │
│ R  │ (tabs / forms / tables /      │drag│ (context-aware, rendered  │
│ A  │  outline / iteration history) │ │ │  "as it will appear")     │
│ I  │                          [ action bar ]                        │
│ L  │                               │ │ │                           │
└────┴───────────────────────────────┴───┴───────────────────────────┘
```

- **Far-left NavRail** — collapsible (52px icons ↔ 208px labels); Dashboard, Workspaces,
  Personas, Ideas, Pipeline, Audit; auto-collapses on review screens.
- **Top bar row 1** — workspace switcher (grouped by persona), breadcrumb, status pill.
- **Governance ribbon (row 2, review screens)** — version id/hash, model lineage
  (Claude→GPT-4o · Gemini-flash judge), score vs threshold, iterations, cost, approval state,
  audit link. *(Surfaces existing IterationRecord/StageSession/ledger data — see §5.)*
- **SplitPane** — draggable divider clamped 28–72%, persisted per route in component state.
- **Right PreviewPane — always renders the artifact "as it will appear," context-aware:**
  | Route | Left | Right preview |
  |---|---|---|
  | Dashboard | needs-you / in-progress / recent | active artifact rendered (or empty) |
  | Personas list/form | grid / grouped form | `PersonaPreview` (voice+audience sample) |
  | Workspaces list/new | rows / create | selected workspace summary |
  | IdeaLog | filter+table+quick-add | selected idea / Idea-Coach proposals |
  | Pipeline run | stage track + activity | best output-so-far rendered |
  | **Gate A** | section outline + Sources/Inputs/Rubric tabs | `MasterPreview` (rendered doc) |
  | **Gate B** | Outputs/Rubric/Inputs tabs + branch switcher | `LinkedInPreview` / `ArticlePreview` |
  | Audit | cost summary + ledger | per-row call detail |
- **Preview components** (the "Claude design/preview" feel, all render from existing artifact
  content — frontend only): `LinkedInPreview` (post card: avatar, name, “• 1st”, line-broken body,
  reactions mock), `ArticlePreview` (reading view, heading hierarchy, ~70ch), `MasterPreview`
  (doc + section anchors), `PersonaPreview`, `IdeaPreview`. Tasteful empty state when nothing yet.

---

## 2. Routes to migrate (all already exist — restyle + restructure, don't recreate)

`/` · `/personas` `/personas/new` `/personas/[id]` · `/workspaces` `/workspaces/new` ·
`/workspaces/[id]` · `/workspaces/[id]/ideas` · `/workspaces/[id]/pipelines/[ideaId]` ·
`/workspaces/[id]/master/[masterId]/review` (Gate A, workbench) ·
`/workspaces/[id]/master/[masterId]/repurpose` ·
`/workspaces/[id]/artifacts/[artifactId]/review` (Gate B, workbench) ·
`/workspaces/[id]/audit`.

For each: confirm the existing route + its data fetch, then mount its content into the AppFrame,
apply the design system, wire its PreviewPane behavior, and preserve all current functionality.

---

## 3. Design system (locked — apply consistently)

shadcn neutral base; single accent `blue-600`; destructive `red-600`; no purple/gradients/sparkles.
Status (soft bg+text): captured=slate · running/in_progress=blue · awaiting/in_review=amber ·
approved/done=green · rejected/failed=red · archived=muted. Type: Inter (UI 14px, reading 16px/
`leading-7`) + JetBrains Mono (costs/tokens/ids). `--radius: 0.5rem`. Lucide icons (Idea Coach =
`Lightbulb`, fork = `GitFork`, sources = `Link2`). Loading: <500ms nothing / region Skeleton /
action button-spinner / long-run labeled live state. One `EmptyState` everywhere.

---

## 4. Backend — additive, gap-driven, verify before writing

Most data already exists (CR-12 shipped the full path). The new UI may need thin additive reads;
**confirm each against the real code in Phase 0 before building**:
- Governance-ribbon aggregation (version id/hash, lineage, score-vs-threshold, approval, cost) —
  likely a read over existing `IterationRecord`/`StageSession`/ledger; add a server action if not present.
- Pipeline `status` poll endpoint (3–5s) for the run view + Gate B while a branch generates — use
  if it exists; add a thin `GET …/status` if not. **No SSE.**
- Audit CSV export endpoint — add if missing.
- Preview shaping — only if artifact/master content isn't already returned in a render-ready form.

If anything requires a **schema/migration**, stop and justify at the Phase-0 pause. Default: zero migrations.

---

## 5. Orchestration — sub-agent workflow

### Phase 0 — Discovery & gap analysis (serial) — **STOP & REPORT after this**
> **workflow:** audit the current CreatorOS UI + data/API surface and produce a migration map.
Read the actual code: enumerate existing routes, their page components, the components they use,
the server actions/API routes they call, and the data each returns. Produce:
(a) **migration map** — per route, what moves into the AppFrame + what its PreviewPane shows;
(b) **component inventory** — existing vs new (the AppFrame shell, preview components, any gaps);
(c) **backend gap list** — exactly which §4 reads are missing, with proposed signatures, and an
explicit "0 migrations needed" or a justified migration request;
(d) **risk list** — any place a restyle would touch logic/props that tests depend on.
Do not change code in Phase 0. Tag nothing. Pause for human review.

### Phase 1 — Shared frame foundation (serial)
> **workflow:** build the additive Workbench shell + design layer.
Deliver `components/shell/*` (`AppFrame`, `NavRail`, `TopBar`, `GovernanceRibbon`, `SplitPane`,
`PreviewPane` + the 5 preview components), confirm/extend design tokens in `globals.css`/tailwind,
and any missing `components/common/*` (EmptyState, StatusBadge, ConfirmDialog, NicheTagInput,
SaveBar, ContentSkeleton). Build it **additively** — existing pages keep working until migrated.
Run full suite. Tag `cr13-foundation`.

### Phase 2 — Parallel migration tracks (sub-agents, owned folders)
> **workflow (parallel):** migrate the page groups into the AppFrame against the Phase-0 map.

- **Track A — Personas · Workspaces · Dashboard:** migrate `/personas/**`, `/workspaces/**`,
  `/workspaces/[id]`; apply frame + `PersonaPreview`/workspace summary/dashboard previews. `cr13-A`.
- **Track B — Ideas · Idea Coach:** migrate `/workspaces/[id]/ideas`; frame + Idea-Coach modal
  styling + `IdeaPreview`/proposals preview. `cr13-B`.
- **Track C — Pipeline:** migrate `/workspaces/[id]/pipelines/[ideaId]`; stage track + live
  activity + best-output preview; wire polling to existing/new `status`. `cr13-C`.
- **Track D — Gate A workbench:** `/master/[masterId]/review` + `/repurpose`; outline + Sources/
  Inputs/Rubric tabs + `MasterPreview`; preserve traceability + 4 actions. `cr13-D`.
- **Track E — Gate B workbench:** `/artifacts/[artifactId]/review`; Outputs/Rubric/Inputs tabs +
  branch switcher + fork dialog + `LinkedInPreview`/`ArticlePreview`; preserve fork-on-regenerate. `cr13-E`.
- **Track F — Audit · Governance + backend gaps:** `/audit` restyle + CostMeter + GovernanceRibbon
  data wiring; implement the **verified §4 additive reads** (governance aggregation, status poll,
  CSV export) — additive only. `cr13-F`.

Each track owns its `app/<route>/**` + `components/<feature>/*` (+ Track F the additive data/api).
Run the full suite at the end of each track; a track is not done until green.

### Phase 3 — Integration & regression (serial)
> **workflow:** wire entry redirect + NavRail active states + per-route breadcrumb/ribbon,
verify cross-track preview consistency, run the full suite **and** `npm run test:acceptance`
(live path must still pass), visual pass. Tag `CR-13-ui-ux` (+ optional `v1.1`).

---

## 6. Tests & regression gates

- **Regression (every track):** `npm test` green, `npm run build` exit 0, `prisma validate`,
  Core→Domain grep empty. The redesign adds tests, never removes/weakens them.
- **New UI tests:** AppFrame renders both frame variants; NavRail collapse/expand; SplitPane drag
  clamps 28–72%; PreviewPane renders the right component per route; governance ribbon shows live data.
- **Behavior preserved (e2e):** persona/workspace/idea CRUD; IdeaLog filters; Idea Coach 3–5 +
  add-to-log; Gate A traceability + approve; Gate B fork-on-regenerate + branch-named approve.
- **Acceptance (Phase 3):** `npm run test:acceptance` still PASSES end-to-end with the redesigned UI
  in the loop (it exercises the real path; the UI changes must not perturb it).

---

## 7. Definition of done

- [ ] Every route in §2 renders inside the AppFrame with the correct PreviewPane behavior.
- [ ] NavRail collapses/expands; SplitPane drags; governance ribbon live on review screens.
- [ ] All existing functionality preserved (CRUD, filters, Idea Coach, both gates, fork, audit, polling).
- [ ] Design tokens match §3 everywhere; no invented components; toasts only on destructive-success.
- [ ] Backend additions are additive-only and were justified at the Phase-0 pause (default: 0 migrations).
- [ ] `npm test` (≥702) green · `npm run test:acceptance` PASSES · `build` exit 0 · `prisma validate` ·
      Core→Domain grep empty.
- [ ] Each track committed + tagged; final `git tag CR-13-ui-ux`.

---

## 8. Execution instructions

1. Run **Phase 0 only**, then **STOP** and present the migration map + component inventory +
   backend gap list (with the explicit migrations verdict) + risk list. Wait for my go-ahead.
2. On approval: Phase 1 (serial), then Phase 2 as parallel sub-agents (owned folders, building
   against the Phase-0 map + Phase-1 shell). Commit + tag per track; run the suite each time.
3. Phase 3 integration + full regression incl. acceptance. Tag `CR-13-ui-ux`.
4. If context runs short: finish + tag the current track, summarize the rest, stop cleanly —
   every track is independently committable and resumable.

## 9. Out of scope
V2 follow-ups in the decisions log; any logic refactor of agents/loop/data; schema migrations
(unless justified in Phase 0); `scripts/demo-gate-b.ts`; mobile; new artifact types or pipeline patterns.