# Domain Entities

> The CreatorOS-specific data model. Lives entirely in
> `src/lib/domain/` (and `prisma/schema.prisma`). Core knows nothing
> about any of these.

## Hierarchy

```
User (one human in V1; multi-user schema designed in)
  └── CreatorPersona [1..N]   — "BuildOS persona", "AgriOS persona", ...
       │
       └── Workspace [1..N]   — a project container
            │
            ├── Niche tags    — free-text tags, per Idea
            │
            ├── IdeaLog
            │    └── Idea [1..N]   — captured ideas with tags + status
            │
            ├── LongFormMaster [1..N]   — one per idea taken to production
            │    │
            │    ├── LongFormSection [3..N]   — ordered sections
            │    │    └── SourceRef [1..N]   — links section ↔ ResearchSource
            │    │
            │    └── ResearchSource [3..N]   — traceable sources
            │
            └── Artifact [1..N]   — repurposed deliverables
                 ├── linkedin_post
                 ├── long_form_article
                 └── (V2+: blog_post, newsletter, x_post, x_thread,
                           image_post, carousel, ...)
```

## Entity definitions

### User

The human. Has account credentials. Owns Personas.
V1: hardcoded local user `local-user` / `local@creator.os`.
V2+: real auth via Clerk.

### CreatorPersona

An authoring identity. The user picks which persona to use when
producing content. The persona drives:

- **Voice & tone document** — free-text + structured fields:
  formality, vocabulary, signature phrases, do-not-say
- **Audience profile** — who this persona writes for: role, level,
  interests, pain points
- **Creator profile** — who this persona is: bio, expertise areas,
  POV, hooks
- **Default rubric refs** — what "good" looks like for this persona

A user typically has one persona per niche (BuildOS persona for AI
content, MediOS for medical AI, etc.), but personas and niches are
architecturally decoupled. A persona could span multiple niches.

### Workspace

A project container. Picks one CreatorPersona on creation. Holds an
IdeaLog, LongFormMasters, and Artifacts for that persona's work.

V1: each workspace has `role='admin'` for the hardcoded user.
V2+: the `WorkspaceRole` enum (`admin | writer | editor | reviewer`)
becomes meaningful when Clerk arrives.

### Niche

A tag. Free-text or selected from a workspace-level list. Used on
Ideas for organization (browse "AI in agriculture" ideas vs "AI in
medicine" ideas). Not a hierarchy parent. Multi-tag allowed.

V1: free-text only. No curated taxonomy.

### Idea

One entry in the IdeaLog:

```typescript
interface Idea {
  id: string
  workspaceId: string
  title: string
  description: string
  niches: string[]
  sourceUrl?: string                   // optional link that sparked the idea
  status: 'captured' | 'in_progress' | 'completed' | 'archived'
  promotedAt?: Date                    // when promoted to pipeline
  createdAt: Date
  updatedAt: Date
}
```

Can be promoted to a Workspace pipeline (becomes the seed for
Research → Long-Form Master → Artifacts).

### LongFormMaster

The living raw-material asset for one idea. **Structured**, not a
single text blob.

```typescript
interface LongFormMaster {
  id: string
  workspaceId: string
  ideaId: string
  title: string
  sections: LongFormSection[]
  status: 'draft' | 'gate_a_pending' | 'approved' | 'in_repurpose'
  createdAt: Date
  updatedAt: Date
}

interface LongFormSection {
  id: string
  longFormMasterId: string
  order: number
  heading: string
  contentMarkdown: string
  sourceRefs: SourceRef[]              // every section ↔ ≥1 source
}
```

Properties:

- Multi-modal in principle (text sections, embedded image refs,
  transcript excerpts, source quotes). V1 is text-primary.
- Every source traced — non-negotiable for Gate A.
- Inline-editable.
- V1: no versioning. Single saved state with `updatedAt` timestamp.
- V2+: versioned, diff-tracked, change-detection-triggered
  regeneration of downstream artifacts.

### ResearchSource

A source consulted during research. Persisted to the DB for
traceability.

```typescript
interface ResearchSource {
  id: string
  longFormMasterId: string
  url: string
  type: 'web' | 'upload'
  title: string
  snippet: string                      // extracted excerpt or summary
  fetchedAt: Date
}
```

### SourceRef

Links a LongFormSection to a ResearchSource with a relevance excerpt.
This is the join that makes Gate A's source traceability panel
buildable.

```typescript
interface SourceRef {
  id: string
  sectionId: string
  researchSourceId: string
  relevanceSnippet: string             // the quote that informs this section
}
```

### Artifact

A publishable deliverable. Platform-aware. Each artifact type has
its own config (character limits, format rules, style, structure).

```typescript
interface Artifact {
  id: string
  workspaceId: string
  longFormMasterId?: string            // null for non-master-derived artifacts
  artifactType: 'linkedin_post' | 'long_form_article'   // V1
  content: unknown                     // shape depends on artifactType
  parentArtifactIds: string[]          // for fork-on-regenerate
  derivedVia: 'cross_critique' | 'inline_edit' | 'regenerate' | 'merge'  // underscores — Prisma-legal; see reconciliation addendum
  bestScore?: number                   // judge's grade for this artifact
  status: 'draft' | 'awaiting_review' | 'approved' | 'rejected'
  costUSD: number                      // cumulative cost to produce
  createdAt: Date
  updatedAt: Date
}
```

All artifacts are inline-editable. All can be regenerated. Regenerate
forks rather than overwrites (Immutable History principle).

## V1 artifact registry

| Type | Platform | Length constraints | Other constraints |
|---|---|---|---|
| `linkedin_post` | LinkedIn | 1,300–3,000 chars | Hook in first 3 lines; line breaks for scannability; closing CTA optional |
| `long_form_article` | Blog / LinkedIn Article / Substack | 1,200–3,000 words | Heading hierarchy (H1 + ≥2 H2); intro + body + conclusion; scannable |

V2+ artifact types: `blog_post`, `newsletter`, `x_post`, `x_thread`,
`image_post`, `carousel`, `reel_script`, `youtube_long_script`,
`podcast_episode`. Designed; not in V1.

## Schema location

All entities live in `prisma/schema.prisma` and become Prisma client
types. Domain code in `src/lib/domain/` imports those types and
adds business logic. Core code in `src/lib/core/` never imports
Prisma types directly — it works with generic shapes
(`LoopState<T>`, `unknown` content) so it stays portable.

## V1 simplifications worth flagging

- **No version history** on LongFormMaster (just `updatedAt`).
- **No cascade rules** on Workspace delete (returns 400 if linked
  ideas exist, to preserve Immutable History).
- **No soft delete.** Hard delete with FK constraints.
- **No multi-workspace concurrent runs.** One pipeline at a time
  per workspace.

All of the above are V2+ concerns. V1 ships with these constraints
explicit, not hidden.

## V1 reconciliation addendum (2026-05-31)

> Resolves pre-CR-1 audit findings so the schema is unambiguous. These
> override the conceptual shapes above where they differ. Decisions are
> pinned in `docs/03-decisions/creator-decisions-log.md` (2026-05-31).

### `derivedVia` is underscored (Prisma-legal)

Prisma enum members cannot contain hyphens. The canonical spelling is
`cross_critique | inline_edit | regenerate | merge`. Any remaining
hyphenated mentions in prose (review-system-v1.md, pipeline-v1.md, the
CR-4/CR-11 literals in the action plan) are stale — code must use the
underscore form the generated Prisma enum produces.

### `Artifact.longFormMasterId` is REQUIRED in V1

The conceptual shape marks it optional (non-master-derived artifacts
are a V2 idea). **V1 narrows it to required** — every V1 artifact is
derived from a LongFormMaster. CR-1 schema: non-nullable FK.

### Relations & delete policy (V1)

All foreign keys are explicit Prisma `@relation`s. Delete policy
encodes Immutable History (principle 3):

| FK | onDelete |
|---|---|
| CreatorPersona → User | Restrict |
| Workspace → User, Workspace → CreatorPersona | Restrict |
| Idea → Workspace | Restrict (Workspace delete 400s if ideas exist) |
| LongFormMaster → Workspace, → Idea | Restrict |
| LongFormSection → LongFormMaster | Cascade (sections are owned parts) |
| SourceRef → LongFormSection, → ResearchSource | Cascade |
| ResearchSource → LongFormMaster | Cascade |
| Artifact → Workspace, → LongFormMaster | Restrict |
| StageSession → Workspace | Restrict |
| IterationRecord → StageSession | Cascade |

"Cascade" only where the child is an owned structural part; everything
that represents independent history is "Restrict" (delete blocked,
surfaced as 400).

### Episodic-memory tables are part of V1 schema

Per `docs/01-architecture/memory-architecture.md`, V1 persists loop
history in two tables that the conceptual hierarchy above omitted:

- **StageSession** — one row per stage run: `id, workspaceId,
  stageId, status, finalArtifactId?, costUSD, terminationReason?,
  startedAt, completedAt?`.
- **IterationRecord** — one row per loop iteration: `id,
  stageSessionId, version, gradeJson?, modelUsed, tokensIn,
  tokensOut, costUSD, createdAt`.

These home the Gate B iteration-history panel (CR-11) and
`terminationReason`. CR-1 creates both. (V2 adds nullable `embedding`
columns for semantic memory; V1 writes none.)

### CreatorPersona JSON sub-schemas

The inner shapes of `voiceTone`, `audienceProfile`, `creatorProfile`,
and `defaultRubricRefs` are defined in
`docs/02-domain/buildos-persona.md`, along with the reviewed seed
content. `defaultRubricRefs` values are rubric ids from
`docs/02-domain/rubrics.md` (`research-rubric`,
`long-form-master-rubric`, `linkedin-post-rubric`, `article-rubric`).
