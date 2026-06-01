# CR-9 — CRUD UIs (Persona + Workspace + IdeaLog + Idea Coach)

**Sprint goal:** real web UI at `/personas`, `/workspaces`, `/workspaces/[id]`, and `/workspaces/[id]/ideas`, with a working **"Coach my ideas"** modal backed by the Idea Coach agent.

**Tag on completion:** `CR-9-crud-ui`

This document is the implementation contract for the session. It assumes Core (`src/lib/core/`) and the **Prisma** schema (`prisma/schema.prisma`, from CR-1) for the Domain entities exist from earlier CRs; CR-9 builds the **UI + the Idea Coach agent + one API route**. Where a data-layer call is referenced, it is a thin server action over the existing Prisma client — do not redesign the schema in this CR.

> **ORM note:** this repo uses **Prisma**, not Drizzle. All data-layer code below is Prisma (`prisma.<model>.findMany/create/update/delete`). Field types in the entity tables use Prisma vocabulary (`String[]`, `Json`).

---

## 0. Pre-flight (do this before writing any page)

1. **Read, in order:** `CLAUDE.md`, `docs/02-domain/entities.md`, `docs/02-domain/agents-and-personas.md` (Idea Coach section), `docs/03-decisions/creator-decisions-log.md` (UI scope + auth).
2. **Confirm the architectural contract still holds.** Before and after the sprint, this must return nothing:
   ```bash
   grep -r "from.*domain/" src/lib/core/
   ```
   UI code lives in `src/app/**` and `src/components/**`; it may import from `domain/` and `core/`, never the reverse.
3. **Confirm shadcn primitives are installed.** Required for CR-9:
   ```bash
   npx shadcn@latest add button card dialog input textarea select badge \
     table dropdown-menu form label sonner skeleton tabs slider collapsible
   ```
4. **Hardcoded user.** Everything is scoped to a single seeded user `local-user`. No Clerk, no auth middleware, no login screen.
   ```ts
   // src/lib/auth/current-user.ts
   // TODO(V2): wire Clerk — replace this constant with the session lookup.
   export const CURRENT_USER_ID = "local-user";
   export function getCurrentUserId() { return CURRENT_USER_ID; }
   ```
   Seed `local-user` in the dev seed script if not already present.

**No design-system invention.** Use shadcn primitives + Tailwind only. Colors, type, spacing, radius, status badges, and the empty-state pattern follow the locked design system (neutral base, single blue accent `blue-600`, Inter + JetBrains Mono, `--radius: 0.5rem`, soft-bg status badges). If a screen needs a token that doesn't exist, stop and ask — do not invent.

---

## 1. Entities in scope (from `entities.md`)

CR-9 touches three entities. Field lists below are the source of truth for the forms and tables.

**CreatorPersona** — authoring identity, owned by the user.
| Field | Type | UI |
|---|---|---|
| `id` | uuid | — |
| `userId` | text (`local-user`) | hidden |
| `name` | text | Identity group |
| `niches` | String[] | Identity group (tag input) |
| `creatorProfile` | Json `{ bio, expertiseAreas[], pov, hooks[] }` | Creator group |
| `voiceTone` | Json `{ formality: 0–1, vocabulary, signaturePhrases[], doNotSay[] }` | Voice group (advanced collapsible) |
| `audienceProfile` | Json `{ role, level, interests[], painPoints[] }` | Audience group |
| `defaultRubrics` | Json `{ linkedin_post: rubricId, long_form_article: rubricId }` | Rubrics group (**read-only in V1**) |
| `createdAt` / `updatedAt` | timestamp | meta |

**Workspace** — project container; picks one persona on creation.
| Field | Type | UI |
|---|---|---|
| `id` | uuid | — |
| `userId` | text | hidden |
| `personaId` | uuid (FK) | New-workspace select |
| `name` | text | New-workspace + dashboard header |
| `niches` | String[] | optional tag input |
| `lastActiveAt` | timestamp | list row |
| `createdAt` | timestamp | meta |

**Idea** — one row in the workspace IdeaLog.
| Field | Type | UI |
|---|---|---|
| `id` | uuid | — |
| `workspaceId` | uuid (FK) | hidden |
| `title` | text (required) | table + quick-add |
| `description` | text | preview + quick-add expander |
| `niches` | String[] | tag column + filter |
| `sourceUrl` | text? | quick-add expander |
| `status` | enum `captured \| in_progress \| completed \| archived` | badge + filter |
| `createdAt` / `updatedAt` | timestamp | "captured" column |

Status → badge color (locked system): `captured` slate · `in_progress` blue · `completed` green · `archived` muted.

---

## 2. Files this CR creates

```
src/
├── lib/
│   ├── auth/current-user.ts                      # local-user constant (above)
│   └── domain/
│       ├── data/
│       │   ├── personas.ts                        # server actions: list/get/create/update/delete
│       │   ├── workspaces.ts                      # server actions: list/get/create + touchLastActive
│       │   └── ideas.ts                           # server actions: list(filter)/create/update/delete
│       └── agents/
│           └── idea-coach.ts                       # Idea Coach agent (standard loop, single pass)
├── app/
│   ├── personas/
│   │   ├── page.tsx                                # list  (Server Component)
│   │   ├── new/page.tsx                            # create form
│   │   └── [id]/page.tsx                           # edit form
│   ├── workspaces/
│   │   ├── page.tsx                                # list
│   │   ├── new/page.tsx                            # create form
│   │   └── [id]/
│   │       ├── page.tsx                            # dashboard
│   │       └── ideas/page.tsx                      # IdeaLog table
│   └── api/
│       └── workspaces/[id]/ideas/coach/route.ts    # POST → Idea Coach
└── components/
    ├── common/      EmptyState, StatusBadge, NicheTagInput, SaveBar, ConfirmDialog
    ├── personas/    PersonaCard, PersonaForm, VoiceToneFields
    ├── workspaces/  WorkspaceRow, WorkspaceForm, WorkspaceHeader
    └── ideas/       IdeaLogTable, IdeaRow, IdeaQuickAddRow, IdeaCoachModal, IdeaProposalCard
```

Component props follow the Part-3 inventory; this CR builds the subset above (the gate/pipeline components are out of scope).

---

## 3. Dynamic Workflows — parallel page authoring

The four page groups are independent (different routes, different entities, shared only by the common components). Author them in parallel:

> **workflow:** author Next.js pages for `/personas` (list, new, edit), `/workspaces` (list, new), `/workspaces/[id]` (dashboard), and `/workspaces/[id]/ideas` (table with filters).

**Sequencing constraint for the workflow:** the shared layer must land first so parallel branches don't each invent it.

1. **Phase 1 (serial, ~1 unit):** `src/lib/auth/current-user.ts`, the three `data/*.ts` server-action modules, and `components/common/*`. These are the shared contract.
2. **Phase 2 (parallel, 4 branches):** the four page groups, each consuming Phase-1 outputs. No branch may add a field to an entity or a new common component without surfacing it back — if a branch needs something shared, it stops and the shared module is amended, then branches resume.
3. **Phase 3 (serial):** Idea Coach agent + API route + modal wiring (depends on the ideas page existing).

Each branch owns only files under its route folder plus its `components/<feature>/*`. Merge conflicts are structurally impossible if branches respect folder ownership.

---

## 4. Data layer (server actions over existing schema)

Thin, typed, user-scoped. Example for personas; workspaces and ideas mirror the shape.

```ts
// src/lib/domain/data/personas.ts
"use server";
import { prisma } from "@/lib/db";              // PrismaClient singleton
import { getCurrentUserId } from "@/lib/auth/current-user";
import { revalidatePath } from "next/cache";

export async function listPersonas() {
  return prisma.creatorPersona.findMany({
    where: { userId: getCurrentUserId() },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPersona(id: string) {
  return prisma.creatorPersona.findFirst({
    where: { id, userId: getCurrentUserId() },   // user-scoped; null if not owned
  });
}

export async function createPersona(input: PersonaInput) {
  const row = await prisma.creatorPersona.create({
    data: { ...input, userId: getCurrentUserId() },
  });
  revalidatePath("/personas");
  return row;
}

export async function updatePersona(id: string, input: PersonaInput) {
  // updateMany so the userId scope is enforced in the where clause
  await prisma.creatorPersona.updateMany({
    where: { id, userId: getCurrentUserId() },
    data: { ...input },                          // updatedAt via @updatedAt in schema
  });
  revalidatePath("/personas"); revalidatePath(`/personas/${id}`);
  return getPersona(id);
}

export async function deletePersona(id: string) {
  await prisma.creatorPersona.deleteMany({
    where: { id, userId: getCurrentUserId() },
  });
  revalidatePath("/personas");
}
```

`ideas.ts` adds a filtered list. `niches` is a Postgres `String[]` in the Prisma schema, so use `has` for the array-contains match:

```ts
// src/lib/domain/data/ideas.ts → listIdeas
export async function listIdeas(
  workspaceId: string,
  filter?: { status?: IdeaStatus; niche?: string; q?: string }
) {
  return prisma.idea.findMany({
    where: {
      workspaceId,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.niche ? { niches: { has: filter.niche } } : {}),
      ...(filter?.q ? { title: { contains: filter.q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
```

> If `niches` is instead modeled as `Json` (not `String[]`) in `prisma/schema.prisma`, swap `{ niches: { has } }` for a `String[]` migration or filter in application code — check the schema before writing this.

`workspaces.ts` includes `touchLastActive(id)` → `prisma.workspace.update({ where: { id }, data: { lastActiveAt: new Date() } })`, called from the dashboard loader.

**Rule:** every action filters by `getCurrentUserId()` (personas/workspaces) or by `workspaceId` already scoped to the user. No action returns another user's rows — even though there's only one user today, this keeps the Clerk swap a one-line change.

---

## 5. Pages

### 5.1 `/personas` — list (Server Component)

Server-fetches `listPersonas()`, renders a responsive grid of `PersonaCard`. Header has the page title + primary `New persona` link to `/personas/new`. Empty → `EmptyState` (icon `UserPlus`, "Create your first persona", CTA → `/personas/new`). Delete is a `ConfirmDialog` → `deletePersona` → success toast ("Persona deleted") — the **only** toast in this CR.

### 5.2 `/personas/new` + `/personas/[id]` — form

Both render `PersonaForm` (client component). `new` mounts empty; `[id]` server-fetches `getPersona(id)` (404 → `notFound()`) and passes it in. The form is the data-heavy one — **group fields, don't wall them**: a sticky in-form jump-rail (Identity · Creator · Voice · Audience · Rubrics) over sectioned fields, with `VoiceToneFields` holding the formality slider + vocabulary select and an **Advanced collapsible** for `signaturePhrases` / `doNotSay`. Rubrics group is **read-only** (V1 has one rubric per type; no authoring UI). Sticky `SaveBar` shows dirty state; save calls `createPersona`/`updatePersona` then routes to `/personas`. Save failure → **inline** error on the SaveBar, edits preserved (never a toast for errors). Validate with `react-hook-form` + a zod schema; `name` required, everything else optional.

> **Deferred:** the Stage-0 "Persona Setup Assistant" conversational helper is **not** in CR-9 (V2). Manual form only.

### 5.3 `/workspaces` — list

Server-fetches workspaces joined to their persona name. Renders `WorkspaceRow` per workspace (name, persona, `lastActiveAt` relative, idea count, latest status pill). Row click → `/workspaces/[id]`. Row `⋯` → rename / delete (`ConfirmDialog`). Primary `New workspace` → `/workspaces/new`. Empty → `EmptyState`; if **no persona exists**, CTA routes to `/personas/new` instead (a workspace requires a persona).

### 5.4 `/workspaces/new` — create

`WorkspaceForm`: `name` (required) + persona `Select` (options from `listPersonas()`; if none, redirect to `/personas/new`) + optional `NicheTagInput`. Create → `createWorkspace` → route to the new `/workspaces/[id]`.

### 5.5 `/workspaces/[id]` — dashboard

Server-fetches the workspace + persona + recent ideas + (placeholder) approved artifacts. `WorkspaceHeader` (name, `Persona: … · Niches: …`, Edit menu). Body: recent-ideas list (link to full IdeaLog) and a "recently approved" region (empty in CR-9 — pipeline isn't built yet; render the empty variant). On load, call `touchLastActive(id)`. Pipeline/"needs you now" cards are stubbed/hidden this CR. This screen exists mainly so the workspace has a landing route; the IdeaLog is the working surface.

### 5.6 `/workspaces/[id]/ideas` — IdeaLog table

The richest screen in CR-9. `IdeaLogTable` (client component, seeded by a server fetch) composes:
- **Filter bar:** title search (`Input`), status `Select` (All/captured/in_progress/completed/archived), niche `Select` (union of niches across the workspace's ideas). Filters call `listIdeas(workspaceId, filter)` via a server action / `router.refresh()` with search params — keep filter state in the URL (`?status=&niche=&q=`) so it's shareable and survives reload.
- **`IdeaQuickAddRow`** pinned at the top: `title` input (required) + `+ niche` + `+ url` + a `▾` description expander; Enter or `Add` calls `createIdea` and refocuses. Add failure → inline error on the row, typed text kept.
- **`IdeaRow`** per idea: title + truncated description, niche chips, `StatusBadge`, relative captured date, status-aware primary action (`captured → Promote` — stubbed this CR to a disabled tooltip "available after CR-pipeline"; the others mirror), and a `⋯` menu (edit, archive, delete).
- **Header action:** `Idea Coach` button (Lucide `Lightbulb`, **not** a sparkle) → opens `IdeaCoachModal`.
- Empty (no ideas, no filters) → `EmptyState` (icon `Lightbulb`, CTA → open Idea Coach). Empty (filters active) → "No ideas match these filters" + Clear.

---

## 6. Idea Coach (agent + API + modal)

### 6.1 Agent — `src/lib/domain/agents/idea-coach.ts`

Idea Coach is a **Stage-1 optional standard-loop agent** (single pass, no rubric gate): given an umbrella topic + niche + persona context, it proposes 3–5 specific titles, each with a one-line angle. It uses the Core agent executor and the Model Management System for the call + cost ledger entry — do not call the model SDK directly.

```ts
// src/lib/domain/agents/idea-coach.ts
import { executeAgent } from "@/lib/core/agentic/executor";
import { z } from "zod";

export const ProposalSchema = z.object({
  title: z.string().min(8).max(120),
  angle: z.string().min(10).max(240),
});
export const CoachResultSchema = z.object({
  proposals: z.array(ProposalSchema).min(3).max(5),
});
export type IdeaProposal = z.infer<typeof ProposalSchema>;

export async function coachIdeas(input: {
  umbrella: string;
  niche: string;
  persona: { name: string; audienceProfile: unknown; voiceTone: unknown };
  workspaceId: string;
}) {
  return executeAgent({
    agent: "idea-coach",
    model: "claude-sonnet",            // MMS resolves the concrete model id
    workspaceId: input.workspaceId,    // cost ledger scope
    responseSchema: CoachResultSchema, // executor validates + repairs to schema
    system:
      "You are Idea Coach. Given an umbrella topic and a niche, propose 3–5 " +
      "specific, publishable content titles for this creator. Each needs a one-line " +
      "angle. Match the persona's audience and voice. No hashtags, no emoji. " +
      "Return JSON only: { proposals: [{ title, angle }] }.",
    user: JSON.stringify({
      umbrella: input.umbrella, niche: input.niche,
      persona: input.persona,
    }),
  });
}
```

The executor handles: model dispatch, JSON-mode parsing, schema validation (re-prompt once on failure), and the **append-only cost ledger** entry tagged `stage: idea-coach`. If it still fails schema after the repair pass, throw — the route maps it to a 422.

### 6.2 API — `POST /api/workspaces/[id]/ideas/coach`

```ts
// src/app/api/workspaces/[id]/ideas/coach/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspace } from "@/lib/domain/data/workspaces";
import { getPersona } from "@/lib/domain/data/personas";
import { coachIdeas } from "@/lib/domain/agents/idea-coach";

const Body = z.object({ umbrella: z.string().min(3), niche: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const ws = await getWorkspace(params.id);          // user-scoped; null if not owned
  if (!ws) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const persona = await getPersona(ws.personaId);

  try {
    const result = await coachIdeas({
      umbrella: parsed.data.umbrella,
      niche: parsed.data.niche,
      persona: { name: persona.name, audienceProfile: persona.audienceProfile, voiceTone: persona.voiceTone },
      workspaceId: params.id,
    });
    return NextResponse.json(result);                // { proposals: [...] }
  } catch {
    return NextResponse.json({ error: "generation_failed" }, { status: 422 });
  }
}
```

Note: the route **proposes only** — it does not create ideas. "Add to log" is a separate `createIdea` server action so the user curates which proposals land.

### 6.3 Modal — `IdeaCoachModal`

shadcn `Dialog`, opened from the IdeaLog header (the log stays visible behind it). Top: `umbrella` text input + `niche` select (defaults to the workspace's active niche) + `Propose titles`. Submitting `POST`s to the coach route and renders 3–5 `IdeaProposalCard`s — **full compact cards, rationale always visible, no hover-reveal** (locked decision). Each card: title, one-line angle, `Discard` + `Add to log`. `Add to log` → `createIdea({ workspaceId, title, description: angle, niches: [niche], status: "captured" })`; the card flips to a persistent `✓ Added` state. Footer: `Propose more` (re-runs) + `Done`. Loading → 3–5 **skeleton cards** (LLM call, reliably >500ms), no "AI is thinking" copy. Failure → inline error in the results region + Retry, inputs preserved. On close, the IdeaLog behind reflects any added rows (`router.refresh()`), no toast.

---

## 7. Tests

Put unit/integration tests next to the modules; e2e under `tests/e2e/`. Target the acceptance criteria, not coverage theater.

**CRUD round-trips (one per entity)** — Vitest against the server actions over a test DB:
```ts
// persona round-trip
const created = await createPersona({ name: "BuildOS Creator", niches: ["AI"], ... });
expect(created.id).toBeTruthy();
const fetched = await getPersona(created.id);
expect(fetched!.name).toBe("BuildOS Creator");
const updated = await updatePersona(created.id, { ...created, name: "BuildOS" });
expect(updated.name).toBe("BuildOS");
await deletePersona(created.id);
expect(await getPersona(created.id)).toBeNull();
```
Mirror for workspace (create with a real `personaId`) and idea (create under a workspace, update status `captured → in_progress`, delete).

**Idea Coach returns 3–5 topics** — mock the MMS executor to return a fixed JSON payload; assert the route responds `200` with `proposals.length` in `[3,5]` and each item passing `ProposalSchema`. Add one test where the model returns malformed JSON → assert the executor's repair path runs and, if still bad, the route returns `422`.

**Niche filter + status filter work** — integration test on `listIdeas`: seed ideas with mixed niches/statuses, assert `listIdeas(ws, { status: "captured" })` and `listIdeas(ws, { niche: "AI" })` return exactly the expected subsets, and combined filter intersects.

**e2e (Playwright, the "you will see" check):**
1. `/personas/new` → fill name + niche → save → row appears at `/personas`.
2. `/workspaces/new` → pick persona → create → lands on dashboard.
3. `/workspaces/[id]/ideas` → quick-add an idea → row appears; set status filter → list narrows.
4. Click **Idea Coach** → type umbrella + niche → **Propose** (mock the route) → 3–5 cards → **Add to log** → modal card shows Added, idea appears in the table behind.

---

## 8. Definition of done

- [ ] `/personas` (list), `/personas/new`, `/personas/[id]` — create, edit, delete all round-trip.
- [ ] `/workspaces` (list), `/workspaces/new` — create works; list shows persona + status + idea count.
- [ ] `/workspaces/[id]` dashboard renders with persona header (pipeline regions stubbed/empty).
- [ ] `/workspaces/[id]/ideas` — quick-add, edit, archive, delete; status + niche + title filters work and persist in the URL.
- [ ] **"Coach my ideas"** modal returns 3–5 proposals; "Add to log" creates ideas; cost ledger gets an `idea-coach` entry.
- [ ] All toasts suppressed except destructive-success; all errors inline.
- [ ] shadcn primitives only; design tokens match the locked system; no invented components.
- [ ] `grep -r "from.*domain/" src/lib/core/` returns nothing.
- [ ] Tests green: CRUD round-trips, Idea Coach 3–5, filters.

```bash
git add -A
git commit -m "CR-9: CRUD UIs (Persona, Workspace, IdeaLog) + Idea Coach agent + coach API"
git tag CR-9-crud-ui
```

---

## 9. Out of scope (do not build in CR-9)

Gate A / Gate B review screens, pipeline run view, audit log screen, the Promote→pipeline action (stub it), Persona Setup Assistant, Clerk auth, mobile layouts, real artifact data on the dashboard. These are later CRs; leaving them stubbed is correct, not incomplete.