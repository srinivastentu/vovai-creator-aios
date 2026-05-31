# Review System — V1 Policy

> The Loop Engine retains all 6 review actions from eLearn AIOS.
> CreatorOS V1 UI surfaces only 4. The unsurfaced actions are
> designed-in and tested at the engine level; their UI is deferred
> to V2.

## The 6 engine-level actions (unchanged)

| Action | Behavior | LoopState transition |
|---|---|---|
| `approve` | Lock `bestArtifact`. Stage complete. | → `approved` |
| `reject` | Clear all context and iterations. Fresh start. | → `generating` (clean) |
| `feedback` | Inject message into next iteration's context. Cleared after one iteration (Forge ADOPT 4). | → `generating` |
| `inline_edit` | Use `editedArtifact` as final. Implicit approval. | → `approved` |
| `use_segments` | Lock approved segments; rejected segments re-enter loop. | → `generating` (partial) |
| `mix_produce` | Combine elements from specified versions into new artifact. | → `generating` (composite) |

## V1 UI surfaces 4 of these

| V1 UI action | Engine action |
|---|---|
| **Approve** button | `approve` |
| **Request changes** textarea + button | `feedback` |
| **Reject** confirm dialog | `reject` |
| **Inline edit** (Tiptap save) | `inline_edit` |

## V1 UI does NOT surface

- **`use_segments`** — would require segment-aware UI (select-and-lock
  parts of a LinkedIn post or article). Deferred to V2 when artifact
  types diversify and segment semantics stabilize.
- **`mix_produce`** — would require a version-comparison UI with
  segment-picking from each. Also V2.

## The engine still accepts all 6

If a `use_segments` or `mix_produce` action somehow arrives at the
engine in V1 (e.g., from an integration test or future UI), it
processes correctly. The V1 web UI just doesn't expose the controls
to send these actions.

Every V1 UI component that renders review controls should include:

```typescript
// TODO(V2): surface use_segments + mix_produce actions
// The engine processes them; only the UI is gated.
```

## Gate types in V1

| Gate | Where | What's approved | UI requirements |
|---|---|---|---|
| **Gate A** | After Long-Form Master (Stage 3) | Knowledge base quality | **Source traceability panel** (non-negotiable) |
| **Gate B** | After each artifact in Repurpose (Stage 5) | Publishable output | Inline editor + Regenerate button + Diff view |

Gate A is one gate per pipeline run.
Gate B is one gate per artifact type (V1: 2 — LinkedIn + article).

## Sovereignty principle

Per master context §3.3 principle 5: **Human Sovereignty.** Humans
approve at every critical gate. AI suggests; human decides.

No artifact is "approved" without explicit human action. The system
cannot auto-approve based on a score threshold alone. Even if the
judge gives a 95/100, the human must click Approve. This is enforced
at the `core/review/` layer:

```typescript
function enforceHumanSovereignty(state, action) {
  if (state.status !== 'awaiting_review' && action.type === 'approve') {
    throw new SovereigntyViolation(
      'Cannot approve an artifact that is not in awaiting_review state'
    )
  }
}
```

## Feedback loop discipline (Forge ADOPT 4)

When the human submits `feedback`, the message is:
1. Injected into the next iteration's context as highest-priority
   revision instruction
2. **Cleared after that one iteration runs**
3. Not allowed to accumulate over multiple iterations

This prevents the agent from fixating on one comment at the expense
of overall quality across subsequent iterations.

## Regenerate UX in V1 (fork-on-edit)

When the user inline-edits an artifact then clicks Regenerate:

1. The edited version is saved as a new Artifact with
   `derivedVia: 'inline_edit'`, `parentArtifactIds: [bestArtifactId]`.
2. A new cross-critique iteration kicks off with the edited version
   as priority context.
3. The new artifact has `derivedVia: 'regenerate'`,
   `parentArtifactIds: [editedArtifactId]`.
4. UI shows both branches side-by-side; user can flip between them
   and approve either.

This preserves the eight-principles invariant: **Immutable History.**
No work is overwritten. Every version is reachable.

## Reviewer assignment (V1 — single user)

V1 has one local user. The `WorkspaceRole` enum exists in the schema
(`admin | writer | editor | reviewer`) but every record carries
`role='admin'`. V2 wires Clerk and uses the enum for real role-based
access — the data model is already shaped for it.
