# CreatorOS Open Questions

> Genuinely-unresolved questions. Referenced by the decisions log and
> INDEX.md. When one is resolved, move it to
> `creator-decisions-log.md` and delete it here.

## Open

- **Niche taxonomy scoping.** Niches are stored as `String[]` on both
  CreatorPersona and Idea (free-text, V1). But the docs describe the
  *intended* taxonomy three ways: per-Idea (entities.md:15),
  per-Workspace list (entities.md:70), and per-tenant list
  (master-context.md). V1 ships free-text array-on-row; the
  curated-taxonomy scope (and whether a `Niche` table arrives) is
  deferred. Pin the intended model before V2.

- **`Artifact.bestScore` naming.** The field name collides
  semantically with the engine's "best across iterations"
  (`LoopState.bestArtifact`/`bestGrade`). `Artifact.bestScore` is just
  this artifact's own judge grade. Consider renaming to `judgeScore`
  before the Gate B UI (CR-11) is built. Non-blocking.

- **Missing-API-key behavior.** No spec for what happens when
  `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / Gemini key is unset
  (preflight check vs graceful per-call failure). Decide before CR-5
  (first real multi-provider stage).

- **Rate-limit / 429 policy for CreatorOS stages.** MMS has a rate
  limiter, but no CreatorOS-specific limits or 429 retry/backoff
  policy is written. V1 has no auto-retry (user clicks Resume);
  confirm that is the intended behavior under provider 429s.

- **UI/UX artifacts (CR-9–11).** No wireframes/component specs exist —
  only prose layouts. Intentional MVP minimalism; a lightweight
  wireframe pass before CR-9 would reduce churn.

## Resolved (moved from master-context.md §14)

master-context.md §14 listed these as "open"; they are in fact
resolved in the decisions log:

- Cost ceiling per project → **$5.00** (decisions log, Cost and quality).
- Idea promotion UX → **default to active workspace** (decisions log).
- Inline-edit vs regenerate semantics → **fork** (decisions log).
- Niche taxonomy free-text vs curated → **free-text in V1** (the
  remaining *scoping* question is still open, above).
- Persona learning over time → **V2+** (out of V1 scope).
- Cross-critique variant selection → **V2 testbed** (out of V1 scope).
