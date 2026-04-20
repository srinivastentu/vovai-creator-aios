import { randomUUID } from 'node:crypto'
import { createModelCatalog, type ModelCatalog } from './catalog'
import { createDefaultClients } from './config/default-clients'
import { getDefaultModels, getDefaultProviders } from './config/model-inventory'
import { createCostLedger, type CostLedger } from './cost-ledger'
import { createHealthMonitor, type HealthMonitor } from './health-monitor'
import { createProviderRegistry, type ProviderRegistry } from './providers/registry'
import type { ProviderClient, ProviderResult } from './providers/types'
import { createRateLimiter, type RateLimiter } from './rate-limiter'
import { createModelRouter, type ModelRouter } from './router'
import type {
  Capability,
  CostRecord,
  CostSummary,
  GatewayRequest,
  GatewayResponse,
  HealthStatus,
  ModelCostSummary,
  ModelDefinition,
  PricingEntry,
  ProviderDefinition,
} from './types'

export interface ModelGatewayDeps {
  catalog?: ModelCatalog
  providerRegistry?: ProviderRegistry
  costLedger?: CostLedger
  router?: ModelRouter
  rateLimiter?: RateLimiter
  healthMonitor?: HealthMonitor
}

export interface ModelGateway {
  request(req: GatewayRequest): Promise<GatewayResponse>
  requestMultiple(req: GatewayRequest, modelIds: string[]): Promise<GatewayResponse[]>
  getAvailableModels(capability: Capability): ModelDefinition[]
  getCostSummary(filter?: Parameters<CostLedger['getTotal']>[0]): CostSummary
  getCostTable(): ModelCostSummary[]
  getHealthDashboard(): Map<string, HealthStatus>
}

const createStubClient = (providerId: string): ProviderClient => ({
  providerId,
  async execute(): Promise<ProviderResult> {
    return {
      success: false,
      rawResponse: {},
      durationMs: 0,
      error: 'Provider client not available',
    }
  },
  async checkHealth() {
    return {
      providerId,
      state: 'down' as const,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      error: 'Provider client not available',
    }
  },
})

/**
 * Post-call cost calculation. Runs AFTER the provider returns, using the
 * usage counters on `ProviderResult` to multiply against `model.pricing`.
 * This is NOT a pre-call budget check — it records what was spent, it does
 * not gate what may be spent.
 *
 * Inputs: `ModelDefinition`, `Capability`, `ProviderResult`.
 * Output: `{ costUsd, unit }` — the final USD cost for this specific call
 * and the billing unit applied.
 *
 * Supported units: 'image', '1k-tokens-in', '1k-tokens-out', 'minute',
 * 'second', 'character'. When `model.pricing[capability]` is undefined,
 * returns `{ costUsd: 0, unit: 'none' }`. Per-minute / per-second units
 * currently fall through to the flat `costPerUnit` (no duration-based
 * multiplication — add when a provider needs it).
 */
const calculateFinalCost = (
  model: ModelDefinition,
  capability: Capability,
  result: ProviderResult,
): { costUsd: number; unit: string } => {
  const entry: PricingEntry | undefined = model.pricing[capability]
  if (!entry) return { costUsd: 0, unit: 'none' }
  if (entry.unit === '1k-tokens-in') {
    const tokens = result.tokensIn ?? 0
    return { costUsd: (tokens / 1000) * entry.costPerUnit, unit: entry.unit }
  }
  if (entry.unit === '1k-tokens-out') {
    const tokens = result.tokensOut ?? 0
    return { costUsd: (tokens / 1000) * entry.costPerUnit, unit: entry.unit }
  }
  if (entry.unit === 'character') {
    const chars = result.characters ?? 0
    return { costUsd: chars * entry.costPerUnit, unit: entry.unit }
  }
  return { costUsd: entry.costPerUnit, unit: entry.unit }
}

const loadDefaultInventory = (
  catalog: ModelCatalog,
  registry: ProviderRegistry,
): void => {
  const providers: ProviderDefinition[] = getDefaultProviders()
  const realClients = createDefaultClients()
  for (const def of providers) {
    const client = realClients.get(def.id) ?? createStubClient(def.id)
    registry.registerProvider(def, client)
  }
  for (const model of getDefaultModels()) catalog.registerModel(model)
}

const DEFAULT_GATEWAY_TIMEOUT_MS = 120_000
const GATEWAY_SAFETY_NET_MS = 5_000

const executeWithTimeout = async (
  client: ProviderClient,
  modelApiId: string,
  capability: Capability,
  params: Record<string, unknown>,
  timeoutMs: number,
): Promise<ProviderResult> => {
  const controller = new AbortController()
  const augmentedParams: Record<string, unknown> = {
    ...params,
    timeoutMs,
    abortSignal: controller.signal,
  }

  const raceTimeoutMs = timeoutMs + GATEWAY_SAFETY_NET_MS
  let raceTimer: NodeJS.Timeout | undefined
  let clientTimer: NodeJS.Timeout | undefined

  const timeoutPromise = new Promise<ProviderResult>((resolve) => {
    clientTimer = setTimeout(() => controller.abort(), timeoutMs)
    raceTimer = setTimeout(() => {
      resolve({
        success: false,
        rawResponse: {},
        durationMs: raceTimeoutMs,
        error: `Gateway timeout after ${raceTimeoutMs}ms`,
      })
    }, raceTimeoutMs)
  })

  try {
    return await Promise.race([
      client.execute(modelApiId, capability, augmentedParams),
      timeoutPromise,
    ])
  } finally {
    if (clientTimer) clearTimeout(clientTimer)
    if (raceTimer) clearTimeout(raceTimer)
  }
}

export const createModelGateway = (deps: ModelGatewayDeps = {}): ModelGateway => {
  const catalog = deps.catalog ?? createModelCatalog()
  const providerRegistry = deps.providerRegistry ?? createProviderRegistry()
  const costLedger = deps.costLedger ?? createCostLedger()
  const rateLimiter = deps.rateLimiter ?? createRateLimiter()
  const healthMonitor = deps.healthMonitor ?? createHealthMonitor()

  if (!deps.catalog && !deps.providerRegistry) {
    loadDefaultInventory(catalog, providerRegistry)
  }

  const router =
    deps.router ??
    createModelRouter({ catalog, providerRegistry, healthMonitor, rateLimiter, costLedger })

  const failureResponse = (
    capability: Capability,
    modelId: string,
    providerId: string,
    error: string,
    durationMs = 0,
  ): GatewayResponse => ({
    success: false,
    modelId,
    providerId,
    capability,
    result: {},
    cost: { costUsd: 0, durationMs, unit: 'none' },
    error,
    metadata: {},
  })

  const recordOutcome = (
    req: GatewayRequest,
    model: ModelDefinition,
    success: boolean,
    durationMs: number,
    error?: string,
  ): void => {
    costLedger.record({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      modelId: model.id,
      providerId: model.providerId,
      capability: req.capability,
      success,
      costUsd: 0,
      durationMs,
      context: req.context,
      error,
    })
    healthMonitor.recordOutcome(model.providerId, success, durationMs, error)
  }

  const executeOne = async (
    req: GatewayRequest,
    modelId?: string,
  ): Promise<GatewayResponse> => {
    const preferences = modelId ? { ...req.preferences, modelId } : req.preferences
    let resolvedModelId = modelId ?? ''
    let resolvedProviderId = ''
    const startedAt = Date.now()
    try {
      if (!req.capability) {
        return failureResponse(
          req.capability as Capability,
          '',
          '',
          'capability is required',
        )
      }
      const resolved = router.resolve(req.capability, preferences)
      resolvedModelId = resolved.modelId
      resolvedProviderId = resolved.providerId

      const entry = providerRegistry.getProvider(resolved.providerId)
      if (!entry) {
        const durationMs = Date.now() - startedAt
        const err = `Provider not registered: ${resolved.providerId}`
        recordOutcome(req, resolved.modelDefinition, false, durationMs, err)
        return failureResponse(
          req.capability,
          resolved.modelId,
          resolved.providerId,
          err,
          durationMs,
        )
      }

      if (!rateLimiter.canRequest(resolved.providerId, entry.definition.rateLimits)) {
        const durationMs = Date.now() - startedAt
        const err = `Rate limit exceeded for provider ${resolved.providerId}`
        recordOutcome(req, resolved.modelDefinition, false, durationMs, err)
        return failureResponse(
          req.capability,
          resolved.modelId,
          resolved.providerId,
          err,
          durationMs,
        )
      }

      // Reserve the rate-limit slot before yielding to await, so concurrent
      // callers (e.g. requestMultiple) see the updated count and can't all
      // pass canRequest against the same pre-call state.
      rateLimiter.recordRequest(resolved.providerId)

      const timeoutMs = req.preferences.timeoutMs ?? DEFAULT_GATEWAY_TIMEOUT_MS
      const result = await executeWithTimeout(
        entry.client,
        resolved.modelDefinition.apiModelId,
        req.capability,
        req.params,
        timeoutMs,
      )
      const durationMs = result.durationMs || Date.now() - startedAt

      // Compute final cost from the provider's returned result (post-call, for ledger).
      const { costUsd, unit } = calculateFinalCost(
        resolved.modelDefinition,
        req.capability,
        result,
      )

      const record: CostRecord = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        modelId: resolved.modelId,
        providerId: resolved.providerId,
        capability: req.capability,
        success: result.success,
        costUsd: result.success ? costUsd : 0,
        durationMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        context: req.context,
        error: result.error,
      }
      costLedger.record(record)
      healthMonitor.recordOutcome(
        resolved.providerId,
        result.success,
        durationMs,
        result.error,
      )

      return {
        success: result.success,
        modelId: resolved.modelId,
        providerId: resolved.providerId,
        capability: req.capability,
        result: {
          filePath: result.filePath,
          content: result.content,
          dimensions: result.dimensions,
          mimeType: result.mimeType,
          fileSizeBytes: result.fileSizeBytes,
          revisedPrompt: result.revisedPrompt,
          characters: result.characters,
        },
        cost: {
          costUsd: result.success ? costUsd : 0,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          durationMs,
          unit,
        },
        error: result.error,
        metadata: { rawResponse: result.rawResponse },
      }
    } catch (err) {
      const durationMs = Date.now() - startedAt
      const message = err instanceof Error ? err.message : String(err)
      if (resolvedProviderId) {
        healthMonitor.recordOutcome(resolvedProviderId, false, durationMs, message)
      }
      return failureResponse(
        req.capability,
        resolvedModelId,
        resolvedProviderId,
        message,
        durationMs,
      )
    }
  }

  const request = (req: GatewayRequest): Promise<GatewayResponse> => executeOne(req)

  const requestMultiple = async (
    req: GatewayRequest,
    modelIds: string[],
  ): Promise<GatewayResponse[]> => {
    const settled = await Promise.allSettled(modelIds.map((id) => executeOne(req, id)))
    return settled.map((s, i) =>
      s.status === 'fulfilled'
        ? s.value
        : failureResponse(
            req.capability,
            modelIds[i],
            '',
            s.reason instanceof Error ? s.reason.message : String(s.reason),
          ),
    )
  }

  return {
    request,
    requestMultiple,
    getAvailableModels: (capability) => router.getAvailableModels(capability),
    getCostSummary: (filter) => costLedger.getTotal(filter),
    getCostTable: () => costLedger.getSummaryTable(),
    getHealthDashboard: () => healthMonitor.getAll(),
  }
}
