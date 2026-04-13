# VOVAI Model Management System (MMS) — Architecture Specification v1.0

> **System 5** of the VOVAI eLearning AIOS Core Architecture.
> The centralized gateway through which EVERY AI model call in the platform flows.

---

## 1. Purpose & Problem Statement

The VOVAI platform uses 15+ AI models across 6+ providers for text generation, image generation, vision scoring, voice synthesis, music generation, and video generation. Without centralized management, each adapter tracks its own costs, handles its own retries, and manages its own API keys — creating fragmented observability and duplicated logic.

The MMS solves this by providing:

- **One gateway** for all AI calls — no component talks directly to an AI provider
- **One cost ledger** recording every call across all models and providers
- **One model catalog** knowing every model's capabilities, pricing, and status
- **One routing layer** selecting the best model based on preferences, availability, and budget
- **One health monitor** tracking provider availability and degradation
- **One rate limiter** preventing 429 errors before they happen

---

## 2. Architectural Placement

### 2.1 Core/Domain Classification

MMS is **100% Core**. The three-question test:

1. Would this change for Film AIOS? **No** — same models, same providers, same cost tracking.
2. Does it contain domain words? **No** — "model", "provider", "cost", "capability" are all generic.
3. Could another AIOS use it as-is? **Yes**, without any modification.

**Location:** `src/lib/core/models/`

### 2.2 System Map (updated from 4 to 5 systems)

```
src/lib/core/
├── engine/        ← System 1: Loop Engine
├── agentic/       ← System 2: Agentic System
├── review/        ← System 3: Human Review System
├── models/        ← System 5: Model Management System (NEW)
├── tools/         ← (future) Tool System
├── prompts/       ← (future) Prompt System
├── context/       ← (future) Context System
└── marketplace/   ← (future) Marketplace System

src/lib/domain/
└── workflows/
    ├── models/    ← Domain-specific model configuration (NEW)
    │   ├── default-assignments.ts
    │   ├── archetype-preferences.ts
    │   └── budget-policies.ts
    └── ...existing domain code...
```

### 2.3 The Import Rule

Same rule as always: `src/lib/core/models/` NEVER imports from `src/lib/domain/`. Domain model configurations import FROM core model types. Enforced by: `grep -r "from.*domain/" src/lib/core/` must return nothing.

---

## 3. MMS Internal Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    MODEL GATEWAY                          │
│  The single entry point. All AI calls go through here.   │
│  gateway.request(capability, params, preferences)        │
├──────────────┬───────────────────────┬───────────────────┤
│              │                       │                   │
│  ┌───────────▼──────────┐  ┌────────▼────────┐  ┌──────▼───────┐
│  │    MODEL ROUTER      │  │  RATE LIMITER   │  │   HEALTH     │
│  │ Selects best model   │  │ Per-provider    │  │   MONITOR    │
│  │ based on preferences │  │ request pacing  │  │ Availability │
│  └───────────┬──────────┘  └────────┬────────┘  └──────┬───────┘
│              │                      │                   │
│  ┌───────────▼──────────────────────▼───────────────────▼───────┐
│  │                    MODEL CATALOG                              │
│  │  Registry of all models: capabilities, pricing, parameters   │
│  ├──────────────────────────────────────────────────────────────┤
│  │                    PROVIDER REGISTRY                          │
│  │  Registry of all providers: auth, endpoints, API patterns    │
│  └──────────┬──────────┬──────────┬──────────┬─────────────────┘
│             │          │          │          │
│  ┌──────────▼──┐ ┌─────▼─────┐ ┌─▼────────┐ ┌▼──────────────┐
│  │ Google      │ │ fal.ai    │ │ OpenAI   │ │ Freepik       │
│  │ Gemini      │ │ Client    │ │ Client   │ │ Client        │
│  │ Client      │ │           │ │          │ │ (async/poll)  │
│  │ (NB2, NBPro │ │ (Flux Dev │ │ (DALL-E3 │ │ (NB, Mystic,  │
│  │  Imagen4)   │ │  Flux Pro)│ │  GPT-4o  │ │  Flux, Kling) │
│  │             │ │           │ │  vision) │ │               │
│  └──────────┬──┘ └─────┬─────┘ └─┬────────┘ └┬──────────────┘
│             │          │          │           │
│  ┌──────────▼──────────▼──────────▼───────────▼────────────────┐
│  │                    COST LEDGER                                │
│  │  Append-only record of every AI call with full cost data     │
│  └─────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Type Definitions

### 4.1 Capability Types

These are the categories of AI work the platform does. Every model declares which capabilities it supports.

```
text-generation      — Produce text content (articles, scripts, briefs)
text-scoring         — Evaluate/judge text artifacts (rubric-based grading)
image-generation     — Generate images from text prompts
image-scoring        — Evaluate images using vision models
voice-synthesis      — Convert text to speech
music-generation     — Generate background music
video-generation     — Generate video clips (text-to-video or image-to-video)
video-scoring        — Evaluate video clips using vision models
embedding            — Generate text/image embeddings
```

### 4.2 Provider Definition

A provider is an API service that hosts one or more models.

```
ProviderDefinition:
  id: string                    — Unique key (e.g., 'google-gemini', 'freepik', 'fal-ai', 'openai')
  name: string                  — Display name (e.g., 'Google Gemini API')
  authType: 'api-key' | 'bearer' | 'custom'
  authEnvVar: string            — Environment variable name (e.g., 'GOOGLE_GEMINI_API_KEY')
  baseUrl: string               — API base URL
  apiPattern: 'sync' | 'async-poll' | 'async-webhook'
  status: 'available' | 'degraded' | 'unavailable'
  rateLimits:
    requestsPerMinute: number
    requestsPerDay: number
  metadata: Record<string, unknown>  — Provider-specific config
```

### 4.3 Model Definition

A model is a specific AI model hosted by a provider.

```
ModelDefinition:
  id: string                    — Unique key (e.g., 'nanobanan-2', 'flux-dev', 'dall-e-3-standard')
  name: string                  — Display name (e.g., 'Nano Banana 2 (Gemini 3.1 Flash Image)')
  providerId: string            — Which provider hosts this model
  capabilities: Capability[]    — What this model can do
  qualityTier: 'budget' | 'standard' | 'premium'
  pricing:                      — Cost information per capability
    [capability]:
      costPerUnit: number       — USD per unit (per image, per 1K tokens, per minute, etc.)
      unit: string              — 'image' | '1k-tokens-in' | '1k-tokens-out' | 'minute' | 'second'
      byResolution?:            — Optional resolution-specific pricing
        '512': number
        '1k': number
        '2k': number
        '4k': number
  supportedParams:              — What parameters this model accepts
    resolutions?: string[]      — e.g., ['1024x1024', '1792x1024', '512x512']
    maxTokensIn?: number
    maxTokensOut?: number
    supportsNegativePrompt?: boolean
    supportsStyleReference?: boolean
    supportsSeed?: boolean
    customParams?: Record<string, ParamSchema>
  status: 'active' | 'deprecated' | 'disabled'
  apiModelId: string            — The actual model string sent to the API
                                  (e.g., 'gemini-3.1-flash-image-preview', 'dall-e-3')
  metadata: Record<string, unknown>
```

### 4.4 Gateway Request

What callers send to the gateway.

```
GatewayRequest:
  capability: Capability        — What kind of work (e.g., 'image-generation')
  params:                       — Capability-specific parameters
    prompt?: string
    width?: number
    height?: number
    content?: string            — For scoring: the artifact to evaluate
    [key: string]: unknown
  preferences:
    modelId?: string            — Explicit model choice (user selected from dropdown)
    providerId?: string         — Explicit provider choice
    qualityTier?: 'budget' | 'standard' | 'premium'
    strategy?: 'cheapest' | 'fastest' | 'highest-quality' | 'specific'
    maxCostUsd?: number         — Budget cap for this single call
    timeoutMs?: number          — Override default timeout
  context:                      — For cost attribution
    projectId?: string
    stageId?: string
    iterationNumber?: number
    tournamentRound?: number
    callerTag?: string          — Free-form tag for grouping costs (e.g., 'phase-4-testing')
```

### 4.5 Gateway Response

What the gateway returns.

```
GatewayResponse:
  success: boolean
  modelId: string               — Which model actually ran
  providerId: string            — Which provider was used
  capability: Capability
  result:                       — Capability-specific result
    filePath?: string           — For image/audio/video generation
    content?: string            — For text generation
    dimensions?: { width, height }
    mimeType?: string
    fileSizeBytes?: number
    revisedPrompt?: string      — If the model rewrote the prompt (DALL-E 3 does this)
    grade?: GradeReport         — For scoring capabilities
    [key: string]: unknown
  cost:
    costUsd: number
    tokensIn?: number
    tokensOut?: number
    durationMs: number
    unit: string
  error?: string                — If success is false
  metadata: Record<string, unknown>
```

### 4.6 Cost Record

What gets appended to the cost ledger for every call.

```
CostRecord:
  id: string                    — UUID
  timestamp: string             — ISO 8601
  modelId: string
  providerId: string
  capability: Capability
  success: boolean
  costUsd: number
  durationMs: number
  tokensIn?: number
  tokensOut?: number
  resolution?: string           — For image/video calls
  context:
    projectId?: string
    stageId?: string
    iterationNumber?: number
    tournamentRound?: number
    callerTag?: string
  error?: string
```

---

## 5. Component Specifications

### 5.1 Model Catalog (`catalog.ts`)

The catalog is a registry of all models the system knows about. It is populated at startup from configuration.

**Functions:**

- `registerModel(definition: ModelDefinition): void` — Add a model to the catalog
- `getModel(id: string): ModelDefinition | undefined` — Get a specific model
- `findModels(filter): ModelDefinition[]` — Query models by capability, provider, quality tier, status
- `getModelsForCapability(capability: Capability): ModelDefinition[]` — All models that can do X
- `getModelsForProvider(providerId: string): ModelDefinition[]` — All models from provider Y
- `listAll(): ModelDefinition[]` — Everything in the catalog
- `updateStatus(modelId: string, status): void` — Mark model as active/deprecated/disabled

**The catalog is read-heavy, write-rare.** Models are registered at startup. Status updates happen on health check failures. No persistence needed — rebuilt from config on each app start.

### 5.2 Provider Registry (`providers/registry.ts`)

The registry of provider connections. Each provider has a client that knows how to call its API.

**Functions:**

- `registerProvider(definition: ProviderDefinition, client: ProviderClient): void`
- `getProvider(id: string): { definition: ProviderDefinition, client: ProviderClient } | undefined`
- `getAvailableProviders(): ProviderDefinition[]` — Only providers with valid API keys
- `checkAvailability(): Map<string, boolean>` — Checks which providers have their env var set

**ProviderClient interface** — what every provider client must implement:

```
ProviderClient:
  providerId: string
  execute(modelApiId: string, capability: Capability, params: Record<string, unknown>): Promise<ProviderResult>
  checkHealth(): Promise<HealthStatus>
```

`ProviderResult` is the raw result from the provider — the gateway maps it to `GatewayResponse`.

### 5.3 Provider Clients (`providers/google-gemini.ts`, etc.)

Each provider gets a dedicated client file. The client is a thin API wrapper — it knows how to authenticate and call the provider's endpoints. It does NOT track costs, does NOT retry, does NOT handle fallbacks. Those are the gateway's job.

**Provider clients to build:**

1. **Google Gemini Client** — REST API calls to `generativelanguage.googleapis.com`. Handles both Gemini native image models (NanoBanana 2, NanoBanana Pro) and Imagen 4 family. Auth: API key as query param or header. Pattern: synchronous (request → response with base64 image data).

2. **fal.ai Client** — REST API calls to `fal.run`. Handles Flux Dev and Flux Pro. Auth: `Authorization: Key ${FAL_KEY}`. Pattern: synchronous (request → response with image URL → download image).

3. **OpenAI Client** — Uses OpenAI SDK. Handles DALL-E 3 (standard, HD), GPT-4o vision (for scoring), and text generation/scoring models. Auth: SDK handles it via `OPENAI_API_KEY`. Pattern: synchronous via SDK.

4. **Freepik Client** — REST API calls to `api.freepik.com`. Handles NanoBanana via Freepik, Mystic, Flux via Freepik. Auth: `x-freepik-api-key` header. Pattern: **async poll** — submit task → poll status endpoint → download result when ready. Must implement poll loop with timeout and backoff.

**File saving convention:** For image/audio/video generation, provider clients save files to a specified `outputDir`. File names use format `{providerId}-{modelId}-{uuid}.{ext}`. The client returns the absolute file path.

### 5.4 Cost Ledger (`cost-ledger.ts`)

Append-only storage for cost records. Every gateway call appends one record.

**Functions:**

- `record(entry: CostRecord): void` — Append a cost record
- `getTotal(filter?): CostSummary` — Total cost, optionally filtered by model/provider/project/stage/timeRange/callerTag
- `getByModel(modelId: string): CostRecord[]` — All records for a model
- `getByProvider(providerId: string): CostRecord[]` — All records for a provider
- `getByProject(projectId: string): CostRecord[]` — All records for a project
- `getSummaryTable(): ModelCostSummary[]` — Aggregated: model, provider, callCount, totalCost, avgCost, avgDuration, successRate
- `exportToJsonl(filePath: string): void` — Export all records to JSONL file
- `clear(): void` — Reset (for testing only)

**Storage strategy (phased):**

- Phase 1 (now): In-memory array + console log on each record + periodic JSONL flush to `data/cost-ledger.jsonl`
- Phase 2 (later): Prisma `CostRecord` table in PostgreSQL
- Phase 3 (production): Time-series optimized storage

The interface stays the same across all phases — only the backing store changes.

### 5.5 Model Router (`router.ts`)

Selects which model to use for a given request.

**Resolution order:**

1. **Explicit model** — If `preferences.modelId` is set and the model is active + available, use it. No further logic.
2. **Explicit provider** — If `preferences.providerId` is set, find the best model for the capability from that provider.
3. **Strategy-based** —
   - `cheapest`: Sort eligible models by `pricing[capability].costPerUnit` ascending, pick first available.
   - `fastest`: Sort by historical `avgDurationMs` from cost ledger (or estimated if no history), pick first available.
   - `highest-quality`: Sort by `qualityTier` (premium > standard > budget), pick first available.
   - `specific`: Requires `modelId` — same as (1).
4. **Default fallback** — If nothing specified, use the first available model for the capability sorted by quality tier descending (prefer premium).

**Availability check:** A model is "available" if: its status is `active`, its provider status is `available` or `degraded`, the provider's API key env var is set, and rate limits are not exhausted.

### 5.6 Rate Limiter (`rate-limiter.ts`)

Prevents 429 errors by tracking request counts per provider.

**Functions:**

- `canRequest(providerId: string): boolean` — Check if we're under the limit
- `recordRequest(providerId: string): void` — Increment the counter
- `getRemainingQuota(providerId: string): { perMinute: number, perDay: number }`
- `reset(providerId: string): void` — Manual reset (for testing)

Uses sliding window counters. Resets per-minute counters every 60 seconds, per-day counters every 24 hours.

### 5.7 Health Monitor (`health-monitor.ts`)

Tracks provider health based on recent call outcomes.

**Functions:**

- `recordOutcome(providerId: string, success: boolean, durationMs: number): void`
- `getHealth(providerId: string): HealthStatus` — Returns: status ('healthy' | 'degraded' | 'down'), successRate (last N calls), avgLatencyMs, lastError, lastChecked
- `getAll(): Map<string, HealthStatus>`

**Health calculation:** Uses a rolling window of the last 20 calls per provider. If success rate drops below 80%, status = 'degraded'. Below 50%, status = 'down'. The router uses this to avoid failing providers.

### 5.8 Model Gateway (`gateway.ts`)

The single entry point. Orchestrates all other components.

**Functions:**

- `request(req: GatewayRequest): Promise<GatewayResponse>` — The main function
- `requestMultiple(req: GatewayRequest, modelIds: string[]): Promise<GatewayResponse[]>` — Tournament: call multiple models in parallel for the same request
- `getAvailableModels(capability: Capability): ModelDefinition[]` — For UI dropdowns
- `getCostSummary(filter?): CostSummary` — Delegate to cost ledger
- `getHealthDashboard(): Map<string, HealthStatus>` — Delegate to health monitor

**`request()` flow:**

```
1. Validate the request (capability required, params present)
2. Route: resolve which model + provider to use (via router)
3. Check rate limit for the provider (via rate limiter)
4. If rate limited → try fallback model from same capability (via router)
5. Get the provider client (via provider registry)
6. Execute the call (via provider client)
7. Record cost (via cost ledger)
8. Record health outcome (via health monitor)
9. Map provider result → GatewayResponse
10. Return
```

**`requestMultiple()` flow (for tournament):**

```
1. For each modelId in the list:
   a. Resolve model + provider
   b. Check rate limit
   c. Create a promise for the execution
2. Execute all promises in parallel (Promise.allSettled)
3. Record costs for all (success and failure)
4. Record health outcomes for all
5. Return all responses (caller handles ranking)
```

**Error handling:** The gateway NEVER throws. All errors are caught and returned as `{ success: false, error: '...' }`. If a provider call fails and there's a fallback model available for the same capability, the gateway MAY automatically retry with the fallback (configurable via `GatewayConfig.autoFallback: boolean`).

---

## 6. Model Inventory

### 6.1 Initial Models (Phase 4)

These are the models we register at system startup for image generation:

```
Provider: google-gemini
  Auth: GOOGLE_GEMINI_API_KEY
  Pattern: sync (REST)
  Models:
    - nanobanan-2          | Gemini 3.1 Flash Image    | image-generation | $0.067/img @1K | budget
    - nanobanan-pro        | Gemini 3 Pro Image        | image-generation | $0.134/img @1K | premium
    - imagen-4-fast        | Imagen 4 Fast             | image-generation | $0.020/img     | budget
    - imagen-4-standard    | Imagen 4 Standard         | image-generation | $0.040/img     | standard

Provider: fal-ai
  Auth: FAL_KEY
  Pattern: sync (REST + image download)
  Models:
    - flux-dev             | Flux Dev via fal.ai        | image-generation | $0.025/img     | budget
    - flux-pro             | Flux Pro 1.1 via fal.ai    | image-generation | $0.050/img     | standard

Provider: openai
  Auth: OPENAI_API_KEY (already exists from Phase 3)
  Pattern: sync (SDK)
  Models:
    - dall-e-3-standard    | DALL-E 3 Standard          | image-generation | $0.040/img     | standard
    - dall-e-3-hd          | DALL-E 3 HD                | image-generation | $0.080/img     | premium
    - gpt-4o-vision        | GPT-4o Vision              | image-scoring    | token-based    | premium
    - gpt-4o-mini-vision   | GPT-4o Mini Vision         | image-scoring    | token-based    | standard

Provider: freepik
  Auth: FREEPIK_API_KEY
  Pattern: async-poll
  Models:
    - freepik-nanobanan-2  | NanoBanana 2 via Freepik   | image-generation | TBD            | standard
    - freepik-nanobanan-pro| NanoBanana Pro via Freepik  | image-generation | TBD            | premium
    - freepik-mystic       | Mystic (Freepik exclusive)  | image-generation | TBD            | premium
```

### 6.2 Pre-existing Models (Phase 3 — to be migrated)

These models already exist in the system via standalone adapters. They will be migrated to MMS later with a backward-compatible wrapper.

```
Provider: anthropic (future provider client)
  Auth: ANTHROPIC_API_KEY
  Models:
    - claude-sonnet        | Claude Sonnet              | text-generation  | token-based    | standard
    - claude-haiku         | Claude Haiku (fallback)    | text-generation  | token-based    | budget

Provider: openai (already listed above, add text capabilities)
  Models:
    - gpt-4o              | GPT-4o                      | text-scoring     | token-based    | premium
    - gpt-4o-mini         | GPT-4o Mini                 | text-scoring     | token-based    | budget
```

### 6.3 Future Models (Phases 5-6)

```
Provider: elevenlabs (future)
  Models: voice models for TTS

Provider: suno (future)
  Models: music generation models

Provider: runway (future)
  Models: video generation (Gen-4)

Provider: kling (future, possibly via Freepik)
  Models: video generation (Kling 2.5, 3.0)
```

The MMS catalog is designed so adding these is: define model + register with provider. All routing, cost tracking, health monitoring comes free.

---

## 7. Integration Points

### 7.1 How the Loop Engine Uses MMS

Currently, the Loop Engine takes injected dependencies (`AgentExecutor`, `JudgeFunction`). This doesn't change. What changes is what CREATES those dependencies.

Before MMS: Stage factory creates a Claude text adapter directly, passing `ANTHROPIC_API_KEY`.
After MMS: Stage factory creates an adapter that internally calls `gateway.request({ capability: 'text-generation', ... })`.

The engine itself never knows the MMS exists. The MMS is used by the adapter/factory layer.

### 7.2 How the Tournament Uses MMS

The tournament engine (Phase 4.4) will call `gateway.requestMultiple()` to run all image models in parallel. It gets back an array of `GatewayResponse` objects, each with the image path, cost, model used. It passes these to the judge for scoring.

### 7.3 How the UI Uses MMS

The UI will call `gateway.getAvailableModels('image-generation')` to populate a model selection dropdown. It will call `gateway.getCostSummary()` to show cost dashboards. Users can override the model for any stage by setting `preferences.modelId`.

### 7.4 Backward Compatibility with Phase 3

The existing `createClaudeTextAdapter` and `createOpenAITextJudge` continue working as-is. They are NOT refactored in Phase 4. Instead, we add an MMS-aware adapter factory that new code (image generation, tournament) uses. Phase 3 text generation continues using the old adapters until we do a dedicated migration sprint.

---

## 8. Domain-Side Configuration

Domain code configures HOW the MMS is used for eLearning, without the MMS knowing anything about eLearning.

### 8.1 Default Model Assignments (`domain/workflows/models/default-assignments.ts`)

Maps pipeline stages to default models:

```
Stage V5 (Image Generation) → 'nanobanan-pro' (premium quality for educational images)
Stage V9 (Video Generation) → 'kling-3.0' (future)
Stage V10 (Music Generation) → 'suno-v4' (future)
Text Producer (all stages)   → 'claude-sonnet'
Text Judge (all stages)      → 'gpt-4o'
```

### 8.2 Archetype Preferences (`domain/workflows/models/archetype-preferences.ts`)

Different project types prefer different quality/cost tradeoffs:

```
K-12 archetype       → qualityTier: 'standard', strategy: 'cheapest'
Professional archetype → qualityTier: 'premium', strategy: 'highest-quality'
Channel archetype     → qualityTier: 'standard', strategy: 'fastest'
```

### 8.3 Budget Policies (`domain/workflows/models/budget-policies.ts`)

Per-project or per-stage cost limits:

```
Phase 0 (Ideation) budget: $5.00 max
Image generation per shot: $0.50 max
Total project budget: configurable by user
```

---

## 9. File Structure

```
src/lib/core/models/
├── types.ts                    — All MMS type definitions
│                                 (Capability, ProviderDefinition, ModelDefinition,
│                                  GatewayRequest, GatewayResponse, CostRecord, etc.)
├── catalog.ts                  — Model catalog registry
├── cost-ledger.ts              — Append-only cost recording + queries
├── router.ts                   — Model selection logic
├── rate-limiter.ts             — Per-provider rate management
├── health-monitor.ts           — Provider health tracking
├── gateway.ts                  — The single entry point for all AI calls
├── providers/
│   ├── registry.ts             — Provider registry
│   ├── types.ts                — ProviderClient interface, ProviderResult type
│   ├── google-gemini.ts        — Google Gemini API client
│   ├── fal-ai.ts               — fal.ai API client
│   ├── openai.ts               — OpenAI SDK client
│   └── freepik.ts              — Freepik API client (async poll)
├── config/
│   └── model-inventory.ts      — Default model + provider definitions loaded at startup
└── index.ts                    — Barrel exports

src/lib/domain/workflows/models/
├── default-assignments.ts      — Stage → model mapping
├── archetype-preferences.ts    — Archetype → quality tier / strategy
└── budget-policies.ts          — Cost limits per project/stage
```

---

## 10. Phased Build Plan

### Phase 4.0A — MMS Foundation: Types + Catalog + Provider Registry

**Deliverables:**
- `types.ts` — All type definitions from Section 4
- `catalog.ts` — Model catalog with register, get, find, list
- `providers/types.ts` — ProviderClient interface
- `providers/registry.ts` — Provider registry with register, get, checkAvailability
- `config/model-inventory.ts` — Hardcoded initial model + provider definitions (image models only for now)
- Tests for catalog and registry

**Acceptance criteria:**
- Can register models and providers
- Can query models by capability
- Can check which providers have API keys configured
- All types exported, typecheck clean, zero domain imports

### Phase 4.0B — MMS Plumbing: Cost Ledger + Gateway Skeleton

**Deliverables:**
- `cost-ledger.ts` — In-memory cost recording with query functions and JSONL export
- `gateway.ts` — Basic gateway: resolve model → call provider → record cost → return
- `rate-limiter.ts` — Sliding window rate limiter
- `health-monitor.ts` — Rolling window health tracker
- `router.ts` — Model selection with all 4 strategies
- Tests for each component

**Acceptance criteria:**
- Gateway can receive a request, route to a mock provider, and return a response
- Cost ledger records the call and can report totals
- Rate limiter correctly throttles
- Health monitor degrades status after failures
- Router selects cheapest/fastest/premium correctly
- `gateway.requestMultiple()` works with mock providers (for tournament readiness)

### Phase 4.1A-D — Provider Clients (one per step)

Each provider client is a separate step:
- 4.1A: fal.ai client (simplest, REST)
- 4.1B: OpenAI client (SDK, familiar pattern)
- 4.1C: Google Gemini client (REST, multiple models)
- 4.1D: Freepik client (async poll, most complex)

Each step: build client, register models in inventory, test with mocks, verify gateway can route to it.

### Phase 4.1E — Integration Verification

- End-to-end: call gateway for image-generation → routes to available provider → saves image → records cost
- Cost summary table prints correctly
- `getAvailableModels('image-generation')` returns all configured models
- `requestMultiple()` calls 2+ models in parallel, returns all results
- Backward compatibility: Phase 3 text generation still works unchanged

After this, MMS is complete and we proceed to Phase 4.2 (Image Judge) which uses `gateway.request({ capability: 'image-scoring', ... })`.

---

## 11. Impact on Existing Code

### 11.1 What Changes

- `CLAUDE.md` / `CLAUDE_updated.md` — Add System 5 to the architecture section
- `src/lib/core/agentic/adapters/image-types.ts` (Step 1 output) — Refactor into `src/lib/core/models/types.ts`. The image-specific types become part of the broader MMS type system. The `ImageProducerAdapter` interface is replaced by `ProviderClient` + the gateway.
- New env vars: `GOOGLE_GEMINI_API_KEY`, `FAL_KEY`, `FREEPIK_API_KEY` (in addition to existing `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)

### 11.2 What Does NOT Change

- Loop Engine (`src/lib/core/engine/`) — No changes. Still takes injected dependencies.
- Human Review System (`src/lib/core/review/`) — No changes.
- Phase 3 text adapters — Continue working as-is. Migrated to MMS later.
- All existing tests — Must continue passing.
- The core/domain import rule — Still enforced.

### 11.3 Migration Path for Phase 3 Adapters

Not done now. Future task: create an Anthropic provider client in MMS, register Claude Sonnet/Haiku as text-generation models, create a thin `createMmsTextAdapter()` that wraps `gateway.request({ capability: 'text-generation' })` into the existing `AgentExecutor` interface. The old `createClaudeTextAdapter` is then deprecated but not removed.

---

## 12. Key Design Decisions

1. **Gateway never throws.** All errors returned as `{ success: false }`. Callers don't need try/catch.

2. **Provider clients are stateless.** They receive credentials from the registry, execute a call, return a result. No internal state.

3. **Cost ledger is append-only.** Never delete or modify cost records. This is audit trail data.

4. **Catalog is configuration-driven.** Models are defined in `config/model-inventory.ts`, not discovered at runtime. Adding a model = adding to config + implementing provider client support.

5. **No retry in provider clients.** Retry logic lives in the gateway (with fallback to alternate providers). Provider clients do one attempt.

6. **MMS does not know about eLearning.** It knows about capabilities (text, image, voice, video), not about briefs, scripts, lessons, or storyboards.

7. **The gateway is the boundary.** Everything outside the MMS calls the gateway. Everything inside the MMS is internal implementation. Only types and gateway functions are exported.

8. **Same model, multiple providers is supported.** NanoBanana 2 can be accessed via Google direct AND Freepik. They are separate model entries with different IDs (`nanobanan-2` vs `freepik-nanobanan-2`) but the router can compare their costs/performance.
---

## 13. Current State (as of Phase 4.1E)

- 4 providers registered: fal-ai, openai, google-gemini, freepik
- 11 active models, 2 disabled (NB via Freepik — use google-gemini instead)
- Provider clients: all 4 implemented and tested
- Gateway: operational with timeout, abort signal, cost tracking, health monitoring
- Shared utilities: fetchWithTimeout, downloadAndSave, saveBase64ToDisk, pollUntilComplete, failure, readErrorDetail, maskApiKey
- Tests: ~60 MMS-specific unit tests plus an end-to-end integration suite in `tests/unit/mms-integration.test.ts`
- Manual live-API script: `scripts/test-mms-live.ts` (run with real env keys)
- Ready for: Phase 4.2 (Image Judge), Phase 4.4 (Tournament via requestMultiple)
