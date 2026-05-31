# 002 — Project Learnings: Image Generation (Phase 4.0 through Phase 4.5)

- **Status:** Captured
- **Date:** 2026-04-20
- **Scope:** Model Management System (Phase 4.0A–4.1E), image judge + validators (Phase 4.2–4.3), tournament engine (Phase 4.4), image generation UI with SSE streaming (Phase 4.5), and the post-ship fix series (judge calibration, model-ID verification, regenerate flow refactor)
- **Author:** Second retrospective — distilled from commits `dde45b4` through `3e41b50`, the Phase 4 code, and the exploration agents' audit reports

---

## TL;DR

- The tournament pattern is the right generalisation for artifacts that cannot be iteratively revised. Images, audio, and video all belong here; text does not.
- One engine, two patterns. The same Loop Engine now hosts iterative-revise (text) and tournament (media) without a single line of domain code in `core/`. The `AgentExecutor` / `JudgeFunction` injection boundary paid for itself again.
- The MMS gateway is the single entry point for every provider call. It survived 4 providers, 5 models, and 2 disabled-then-reverified models without architectural drift.
- Shared provider utilities (`fetchWithTimeout`, `pollUntilComplete`, `maskApiKey`, `downloadAndSave`) are the contract every new provider follows. Writing a new provider is now a ~150-line task.
- **Deterministic validators before the vision judge** saved cost and caught real failures (corrupt PNG, wrong dimensions) at zero LLM expense.
- **Cross-family judging still matters for images.** Same-family vision judges rubber-stamp; GPT-4o vision scoring Flux/DALL-E/Gemini outputs caught real quality issues.
- Two load-bearing bugs were surfaced and fixed: a rate-limiter race (check-then-increment across `await`) and URL path injection (unescaped `modelApiId` + API key in query string).
- Open tensions persist: no Tier-3 domain auditor for images, cost enforcement is still post-hoc, model catalog is static, and two model families shipped disabled.

---

## 1. Context

Phase 3 proved the engine on text. Phase 4 was the stress test: could the same engine carry an entirely different artifact type — one where "revise" makes no sense — without touching `core/`?

The answer is yes, but it required two pieces the engine didn't previously have:

1. A **Model Management System** (`src/lib/core/models/`) — a gateway that owns provider dispatch, cost recording, rate limiting, and health tracking. Every AI call now routes through `gateway.request()` or `gateway.requestMultiple()`. No component talks to a provider directly.
2. A **tournament runner** (`src/lib/core/engine/tournament.ts`) — a parallel-generation loop that uses the injected judge to rank candidates across models, with PRESERVE/IMPROVE prompt refinement between rounds (borrowed directly from the text stage).

Phase 4 shipped 4 provider clients (fal.ai, OpenAI, Google Gemini, Freepik), 5 working models (Flux Dev, Flux Pro 1.1, DALL-E 3, Nano Banana Pro, Freepik Mystic), an image judge using GPT-4o vision, 3 deterministic validators, the tournament engine, a full UI at `/generate/image` with Server-Sent Events, and a fix pass that disabled 2 unreliable model families and humanised provider errors.

Test count went from 641 to 988.

---

## 2. What's Working (keep doing this)

### 2.1 Tournament pattern preserves the Core vs Domain boundary

The tournament runner lives at `src/lib/core/engine/tournament.ts`. It imports types from `core/models/types` and `core/engine/types` — nothing from `core/agentic/`, nothing from `core/review/`, nothing from `domain/`. `grep -r "from.*domain/" src/lib/core/` still returns nothing.

All dependencies are injected: the caller assembles `(gateway, judge, validators, rubric)` and calls `createTournamentRunner(...)`. This is the same discipline the ideation and text engines use. The engine does not know it's generating images.

- Critical files: [src/lib/core/engine/tournament.ts](../../src/lib/core/engine/tournament.ts), [src/lib/core/engine/tournament-types.ts](../../src/lib/core/engine/tournament-types.ts)

### 2.2 MMS as a single gateway actually held

Every image request in Phase 4 — whether from the API route, from a test, or from a script — went through `gateway.request()` or `gateway.requestMultiple()`. The gateway does five things in one place:

1. Resolves the model via the router (strategy: cheapest / fastest / highest-quality / specific).
2. Checks rate limits and reserves the slot before yielding.
3. Dispatches to the provider client, threading an `AbortSignal`.
4. Records the outcome in the cost ledger with full context (projectId, stageId, tournamentRound, callerTag).
5. Feeds the outcome to the health monitor for the next routing decision.

No component bypassed this. When we disabled Imagen 4 in the catalog, nothing in the UI or API broke — the gateway returned an "unavailable" error and the tournament skipped the model.

- Critical files: [src/lib/core/models/gateway.ts](../../src/lib/core/models/gateway.ts), [src/lib/core/models/router.ts](../../src/lib/core/models/router.ts)

### 2.3 Shared provider utilities make new providers cheap

`src/lib/core/models/providers/shared.ts` exports the contract every provider uses:

| Helper | Purpose |
|---|---|
| `fetchWithTimeout` | Wraps `fetch` with external `AbortSignal` + internal timeout; masks API keys in errors |
| `maskApiKey` | Strips `key=***` from error messages before throw/log |
| `readErrorDetail` | Extracts nested error messages from JSON / text bodies |
| `downloadAndSave` | Streams an image response to disk with MIME-type detection |
| `saveBase64ToDisk` | Decodes and writes base64 images (Gemini inline data) |
| `pollUntilComplete` | Async polling loop with exponential backoff + abort support (Freepik pattern) |
| `failure` | Standard error-response wrapper |

Writing the Freepik client (Phase 4.1D) was ~180 lines because `pollUntilComplete` already existed. Writing the next audio/video provider should be similar.

- Critical file: [src/lib/core/models/providers/shared.ts](../../src/lib/core/models/providers/shared.ts)

### 2.4 Validators run before the judge (Tier 1 → Tier 2)

Phase 4.3 landed three deterministic validators at `src/lib/core/agentic/validators/image-validators.ts`:

- `fileExists` — the generation returned a file path, but does the file actually exist?
- `fileSize` — minimum size defends against zero-byte or near-empty responses
- `imageDimensions` — matches the requested aspect ratio within tolerance

The tournament runner calls validators at step 2 (before judge at step 3). Entries that fail validation are never sent to the vision API. Cost saved, and real bugs caught — during testing, one provider returned a 200 response with an empty body and a valid-looking file path. The `fileSize` validator flagged it.

This mirrors the text pipeline's structural validators (word count, required sections). The pattern generalises.

### 2.5 Cross-family vision judging

Claude produces text → GPT-4o judges. For images: Flux / DALL-E 3 / Gemini / Freepik produce → GPT-4o vision judges. Same principle, same reasoning — same-family judges share the producer's blind spots. GPT-4o vision is the only judge model in the Phase 4 image judge ([src/lib/core/agentic/judges/image-judge.ts](../../src/lib/core/agentic/judges/image-judge.ts)); it never scores its own output because OpenAI's DALL-E 3 is a different model family.

### 2.6 SSE streaming for real-time tournament progress

`src/app/api/generate/image/route.ts` writes structured tournament events to a `ReadableStream` and returns it as Server-Sent Events. The event taxonomy is defined in `tournament-types.ts`:

- `tournament:round-start`
- `tournament:generation-complete` / `tournament:generation-failed`
- `tournament:validation-complete`
- `tournament:entry-judged`
- `tournament:round-complete`
- `tournament:winner-selected`
- `tournament:escalation`
- `tournament:all-failed`

The UI hook `src/hooks/useImageTournament.ts` consumes the stream, merges entries into state, and renders progress as it arrives. No long-polling, no request-response bulk delivery. The pattern is directly reusable for the audio and video pipelines.

### 2.7 Best-seen separated from latest-generated in the UI

The Phase 4.5 two-column UI (committed in `314d29e`) renders the current round on the left and the best entry so far on the right. When a weak round follows a strong one, the user's "best" pane does not regress. This makes best-version tracking visible rather than implicit — and mirrors the same rule as text ([lessons.md](../../tasks/lessons.md) §2.4).

### 2.8 Regenerate + feedback logic lives in the hook, not the component

Commit `3e41b50` moved the regenerate-with-feedback flow from the page component into `useImageTournament`. The hook now owns prompt augmentation when the user supplies free-form feedback. The component renders, the hook coordinates. This is the right boundary for future `/generate/audio` and `/generate/video` pages.

---

## 3. Open Tensions (unresolved)

### 3.1 No Tier-3 domain auditor for images

Text has a fact-auditor (Tier 3). Images do not. An image can have 6 fingers on a hand, unreadable text, a hallucinated logo, or NSFW drift — and nothing in the current pipeline catches it. The judge rubric mentions "technical-quality" (artifact detection) but that's a dimension of the Tier-2 score, not a Tier-3 block.

**Candidates for the Tier-3 image auditor:** NSFW classification (SafeSearch API or equivalent), brand-safety check, object-count verification, text legibility check. These should be designed before Phase 5 audio / Phase 6 video so the three-tier pattern generalises.

### 3.2 Cost enforcement is still post-hoc

The gateway records cost *after* the provider returns, not before. `lessons.md` §2026-04-13 already flagged this at the text stage — "accept one overrun at the boundary". Images are 10–100× the cost of text. Video will be 10–100× the cost of images. A pre-call budget check that blocks requests once the project / stage ceiling is reached is now load-bearing; the current post-hoc behaviour masks overruns until the ledger is inspected.

**Status update (2026-04-20):** Tracked as `tasks/todo.md` TD-10 (HARD-BLOCKER mandatory before Phase 6 video). Non-blocking for Phase 5 audio since per-call voice cost is low. The Phase 5.1A `calculateFinalCost` rename explicitly carves out the `estimate*` namespace for the future pre-call budget helper.

### 3.3 Provider error humanisation is heuristic

`humanizeError()` and `mapHttpError()` in the provider clients work by pattern-matching on HTTP status and string fragments ("rate limit", "quota", "unavailable"). As we added Gemini and Freepik, the patterns diverged — Google returns `429` with a JSON body, Freepik returns `202` for async and `400` for validation. The mapping is brittle and inconsistent.

A structured error type from each provider would be cleaner. Candidate: add `{ code, category, retryable, userMessage }` to `ProviderResult` and have each client emit it.

**Status update (2026-04-20):** Tracked as `tasks/todo.md` TD-11. Candidate to bundle with 5.1B (voice rubric + judge) or 5.1C (voice validators) — whichever exposes the next heuristic-divergence case first.

### 3.4 Model catalog is static

`src/lib/core/models/config/model-inventory.ts` defines providers and models as module-level exports. There is no way to A/B test a different rubric version or a different judge model without a code change and redeploy. Fine for now; will become a gap when we need to experiment with judge calibration per-customer.

### 3.5 Two model families are shipped disabled

- `nanobanan-2` (Gemini 3.1 Flash Image Preview): 503 UNAVAILABLE on free-tier API keys. Works with paid keys. Disabled in catalog with a comment to re-enable once stabilised or with paid-tier auth.
- `imagen-4-fast` / `imagen-4-standard`: Google's documentation listed these model IDs; the v1beta API returns 404. Correct IDs are versioned (e.g., `imagen-4.0-fast-001`) and may require paid-tier access. Removed entirely from the catalog in commit `6923435`.

Both need re-verification in the provider sandbox before they come back. This is a process gap, not a code gap — see §4.7 below.

---

## 4. Patterns Worth Formalising

### 4.1 Tournament for media, iterative-revise for text

Text has a continuous improvement trajectory: a draft can be targeted and sharpened one dimension at a time. Images, audio, and video do not — you regenerate with a different seed, prompt, or model. The tournament pattern is the right abstraction for any artifact where "revise" is actually "regenerate":

```
Round 1: generate N candidates in parallel → validate each → judge each → rank
   ↓
If top score ≥ threshold: finalize
If top score < threshold and rounds remain:
    refine prompt from best grade (PRESERVE ≥8 / IMPROVE <8)
    advance topN models to next round
```

The `buildRefinedPrompt` helper in `tournament.ts:37` reuses the PRESERVE/IMPROVE rule from the text stage. Same principle, different artifact — that's the payoff for keeping the core pure.

Do not retrofit iterative-revise onto images, audio, or video. It does not work.

### 4.2 Synchronous slot reservation before async yield

The rate-limiter race (commit `05da6f3`) was a concrete instance of a general pattern: when multiple concurrent callers hit a shared quota, check-then-increment across an `await` point is unsafe. The fix — call `rateLimiter.recordRequest()` *before* `await executeWithTimeout(...)` — reserves the slot atomically in the event loop.

This generalises beyond rate limiters. Anywhere you check a budget, a semaphore, or a capacity limit, reserve synchronously first, reconcile on failure.

### 4.3 URL-encode every dynamic segment; API keys go in headers

Commit `49debd6` fixed two things:

1. Google Gemini URL was `${BASE_URL}/${modelApiId}:generateContent?key=${apiKey}`. A crafted `modelApiId` could inject query params. Fixed with `encodeURIComponent(modelApiId)` on all URL paths.
2. The API key in the query string leaked into HTTP error messages and logs. Moved to an `x-goog-api-key` header. Freepik task IDs were also encoded at this time.

Rule for every provider: no dynamic value goes into a URL path without `encodeURIComponent`; no credential goes into a URL at all.

### 4.4 `AbortSignal` threaded end-to-end

The flow is: API route creates the tournament runner → runner calls `gateway.requestMultiple()` → gateway threads an `AbortSignal` through `params.abortSignal` → provider client extracts it and forwards to `fetchWithTimeout` (or `pollUntilComplete` for async providers). Aborts propagate cleanly.

When the user clicks "Cancel" in the UI, the SSE stream closes, which triggers `controller.abort()` at the API route, which cascades through every in-flight model request in ≤ a few seconds.

### 4.5 Two-timeout race for guaranteed response

The gateway uses two timeouts:

1. **Client timeout** — fires `controller.abort()` at the user-supplied `timeoutMs` (default 120s).
2. **Safety-net timeout** — fires a fallback response 5 seconds later if the provider has not returned after the abort.

The caller always gets a response. Nothing hangs forever.

### 4.6 Judge calibration prompt with explicit score bands

The image judge's system prompt (updated in commit `314d29e`) includes an explicit calibration paragraph: "7 = competent production quality, 8 = professional, 9+ = exceptional — rare. Do not inflate." Without this, GPT-4o vision clustered all competent outputs at 8.5+ and the rubric lost discrimination.

Every new judge prompt (voice, music, video) must include the same calibration. Make it a template.

### 4.7 Sandbox-verify every model ID and tier before catalog entry

The Imagen 4 lesson: Google's public documentation listed `imagen-4-fast` and `imagen-4-standard` as valid model IDs. They are not valid against the v1beta API. The catalog entry was added based on the doc, and only caught when the tournament tried to route to them and the provider returned 404.

Rule: before adding a model to `model-inventory.ts`, call the provider's sandbox with the exact `apiModelId` and tier (free / paid) that will be used in production. Confirm a valid response. Document the verification in the commit message. This is a process rule, not a code rule — the next agent will re-learn it the hard way unless it is written down.

---

## 5. Architecture Notes

### 5.1 Tournament wiring diagram (end-to-end)

```
POST /api/generate/image (with prompt, modelIds, config)
   ↓
API route creates tournament runner: createTournamentRunner(gateway, judge, validators, rubric)
   ↓
Runner round 1:
   → gateway.requestMultiple(params, modelIds)
        → router.resolve() per model
        → rateLimiter.recordRequest() (synchronous)
        → providerClient.execute() (parallel, with AbortSignal)
        → response downloaded via downloadAndSave()
        → costLedger.record() per call
        → healthMonitor.recordOutcome() per call
   → runValidatorsOnEntry() per entry (synchronous)
   → judge(artifact, rubric) per validated entry (sequential, rate-limited)
   → rank across all entries, all rounds
   → if top ≥ threshold: emit winner-selected, finalize
   → else if rounds remain: refine prompt (PRESERVE/IMPROVE), advance topN
   → else: emit escalation or all-failed, finalize
   ↓
SSE stream yields structured events at each step
   ↓
useImageTournament hook merges events into state
   ↓
UI renders two-column: current round + best-so-far
```

### 5.2 Cost aggregation path

Every provider call writes one `CostRecord` to the in-memory ledger (`src/lib/core/models/cost-ledger.ts`). The record includes: `modelId`, `providerId`, `capability`, `success`, `costUsd`, `durationMs`, `tokensIn`, `tokensOut`, `context.projectId`, `context.stageId`, `context.tournamentRound`, `context.callerTag`. The API route rolls the tournament's total via `gateway.getCostSummary()` and returns it in the SSE final frame.

Persistence to Prisma/JSONL is deferred (spec §Phase 2-3). In-memory + optional JSONL flush is the current state.

### 5.3 SSE event taxonomy

Documented in `tournament-types.ts` as `TournamentEventType`. The UI hook dispatches on `type` and merges by `round` + `modelId`. Adding a new event (e.g., `tournament:judge-failed`) requires: add to the type union, emit from the runner, handle in the hook, render in the UI. No other file needs to change.

---

## 6. Forward Agenda

### 6.1 Before Phase 5 starts

1. **Formalise Phase 4 verification** — the 8 untracked `output/images/*.png` at the time of writing suggest hand-testing happened but was not recorded. Pick 5–10 representative prompts, run the tournament, score whether the judge's winner matches the human pick. Capture findings as an appendix to this doc.
2. **Pre-call budget check** (§3.2) — implement before shipping audio (cheap-ish) and definitely before video (expensive). Block at the gateway, not post-hoc.
3. **Tier-3 image auditor design** (§3.1) — at minimum: NSFW + brand-safety. Design before building.

### 6.2 What Phase 5 (audio) inherits for free

- MMS gateway, cost ledger, rate limiter, health monitor
- Shared provider utilities (`fetchWithTimeout`, `pollUntilComplete`, `maskApiKey`)
- Tournament engine (reuse as-is; swap `ImageArtifact` for `AudioArtifact`)
- SSE streaming pattern
- UI hook shape (regenerate + feedback flow)

### 6.3 What Phase 5 must build new

- ElevenLabs voice provider client + Suno music provider client
- Voice rubric (5 dims: prosody, clarity, pacing, pronunciation, emotional fit) and music rubric (mood fit, composition, production quality, loopability)
- Audio judge (either a separate TTS-aware model, or GPT-4o with a structured audio-description intermediate step — design decision)
- Audio validators: duration bounds, sample rate, silence % (Tier 1)
- `/generate/audio` UI

### 6.4 Decisions carried forward to 003

- Does the audio judge need to transcribe before scoring, or can it score directly from an audio URL? (Phase 3/4 both used direct artifact input; audio may need transcription.)
- Does music quality scoring require reference tracks, or is the rubric standalone?
- How much of the tournament engine's `ImageArtifact`-specific plumbing generalises before it becomes worth adding a generic `MediaArtifact` base type?

These are the questions that should show up as open tensions in `003-audio-pipeline-learnings.md` once Phase 5 ships.

---

## 7. Related Docs

- [001 — Project Learnings: Foundations through Phase 3.5](./001-project-learnings-phase-3.md) — the template and the text-stage retrospective
- [tournament-pattern.md](../architecture/tournament-pattern.md) — the architectural spec for the engine
- [VOVAI_MMS_Architecture_v1.md](../architecture/VOVAI_MMS_Architecture_v1.md) — the MMS spec (now as-built)
- [recursive-loop-engine.md](../architecture/recursive-loop-engine.md) — the Loop Engine that hosts both iterative-revise and tournament
- [tasks/lessons.md](../../tasks/lessons.md) — the standing-rule index; Phase 4 entries added 2026-04-14 through 2026-04-19
