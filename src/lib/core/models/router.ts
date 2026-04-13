import type { ModelCatalog } from './catalog'
import type { CostLedger } from './cost-ledger'
import type { HealthMonitor } from './health-monitor'
import type { ProviderRegistry } from './providers/registry'
import type { RateLimiter } from './rate-limiter'
import type {
  Capability,
  GatewayPreferences,
  ModelDefinition,
  QualityTier,
} from './types'

export interface ResolvedModel {
  modelId: string
  providerId: string
  modelDefinition: ModelDefinition
}

export interface ModelRouterDeps {
  catalog: ModelCatalog
  providerRegistry: ProviderRegistry
  healthMonitor: HealthMonitor
  rateLimiter: RateLimiter
  costLedger: CostLedger
}

export interface ModelRouter {
  resolve(capability: Capability, preferences: GatewayPreferences): ResolvedModel
  getAvailableModels(capability: Capability): ModelDefinition[]
}

const TIER_RANK: Record<QualityTier, number> = {
  premium: 3,
  standard: 2,
  budget: 1,
}

const priceFor = (m: ModelDefinition, capability: Capability): number => {
  const entry = m.pricing[capability]
  return entry?.costPerUnit ?? Number.POSITIVE_INFINITY
}

export const createModelRouter = (deps: ModelRouterDeps): ModelRouter => {
  const { catalog, providerRegistry, healthMonitor, rateLimiter, costLedger } = deps

  const isProviderAvailable = (providerId: string): { ok: boolean; reason?: string } => {
    const entry = providerRegistry.getProvider(providerId)
    if (!entry) return { ok: false, reason: `provider not registered: ${providerId}` }
    const envConfigured = providerRegistry.checkAvailability().get(providerId) === true
    if (!envConfigured) return { ok: false, reason: `provider api key missing: ${providerId}` }
    if (healthMonitor.getHealth(providerId).status === 'down')
      return { ok: false, reason: `provider health is down: ${providerId}` }
    if (!rateLimiter.canRequest(providerId, entry.definition.rateLimits))
      return { ok: false, reason: `provider rate-limited: ${providerId}` }
    return { ok: true }
  }

  const filterAvailable = (models: ModelDefinition[]): ModelDefinition[] =>
    models.filter(
      (m) => m.status === 'active' && isProviderAvailable(m.providerId).ok,
    )

  const sortByTierDesc = (models: ModelDefinition[]): ModelDefinition[] =>
    [...models].sort((a, b) => TIER_RANK[b.qualityTier] - TIER_RANK[a.qualityTier])

  const sortByPriceAsc = (
    models: ModelDefinition[],
    capability: Capability,
  ): ModelDefinition[] =>
    [...models].sort((a, b) => priceFor(a, capability) - priceFor(b, capability))

  const sortByFastest = (models: ModelDefinition[]): ModelDefinition[] => {
    const table = costLedger.getSummaryTable()
    const avgById = new Map(table.map((row) => [row.modelId, row.avgDurationMs]))
    const hasData = models.some((m) => avgById.has(m.id))
    if (!hasData) return sortByTierDesc(models)
    return [...models].sort((a, b) => {
      const av = avgById.get(a.id) ?? Number.POSITIVE_INFINITY
      const bv = avgById.get(b.id) ?? Number.POSITIVE_INFINITY
      return av - bv
    })
  }

  const toResolved = (m: ModelDefinition): ResolvedModel => ({
    modelId: m.id,
    providerId: m.providerId,
    modelDefinition: m,
  })

  const resolve = (
    capability: Capability,
    preferences: GatewayPreferences,
  ): ResolvedModel => {
    if (preferences.modelId) {
      const m = catalog.getModel(preferences.modelId)
      if (!m) throw new Error(`Model not found: ${preferences.modelId}`)
      if (!m.capabilities.includes(capability))
        throw new Error(
          `Model ${preferences.modelId} does not support capability ${capability}`,
        )
      if (m.status !== 'active')
        throw new Error(`Model ${preferences.modelId} is not active (status=${m.status})`)
      const avail = isProviderAvailable(m.providerId)
      if (!avail.ok)
        throw new Error(
          `Model ${preferences.modelId} unavailable: ${avail.reason ?? 'unknown'}`,
        )
      return toResolved(m)
    }

    if (preferences.providerId) {
      const candidates = filterAvailable(
        catalog
          .getModelsForCapability(capability)
          .filter((m) => m.providerId === preferences.providerId),
      )
      if (candidates.length === 0)
        throw new Error(
          `No available model for capability ${capability} on provider ${preferences.providerId}`,
        )
      return toResolved(sortByTierDesc(candidates)[0])
    }

    const all = filterAvailable(catalog.getModelsForCapability(capability))
    if (all.length === 0)
      throw new Error(`No available model for capability ${capability}`)

    const strategy = preferences.strategy
    if (strategy === 'specific')
      throw new Error(`Strategy 'specific' requires a modelId`)
    if (strategy === 'cheapest') return toResolved(sortByPriceAsc(all, capability)[0])
    if (strategy === 'fastest') return toResolved(sortByFastest(all)[0])
    // 'highest-quality' or undefined
    return toResolved(sortByTierDesc(all)[0])
  }

  const getAvailableModels = (capability: Capability): ModelDefinition[] =>
    filterAvailable(catalog.getModelsForCapability(capability))

  return { resolve, getAvailableModels }
}
