import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createModelCatalog } from '../../src/lib/core/models/catalog'
import { createCostLedger } from '../../src/lib/core/models/cost-ledger'
import { createHealthMonitor } from '../../src/lib/core/models/health-monitor'
import { createProviderRegistry } from '../../src/lib/core/models/providers/registry'
import type { ProviderClient } from '../../src/lib/core/models/providers/types'
import { createRateLimiter } from '../../src/lib/core/models/rate-limiter'
import { createModelRouter } from '../../src/lib/core/models/router'
import type {
  ModelDefinition,
  ProviderDefinition,
} from '../../src/lib/core/models/types'

const makeProvider = (id: string, envVar: string): ProviderDefinition => ({
  id,
  name: id,
  authType: 'api-key',
  authEnvVar: envVar,
  baseUrl: 'http://x',
  apiPattern: 'sync',
  status: 'available',
  rateLimits: { requestsPerMinute: 10, requestsPerDay: 100 },
  metadata: {},
})

const stub = (id: string): ProviderClient => ({
  providerId: id,
  async execute() {
    return { success: true, rawResponse: {}, durationMs: 10 }
  },
  async checkHealth() {
    return { providerId: id, state: 'healthy', latencyMs: 1, checkedAt: '' }
  },
})

const makeModel = (overrides: Partial<ModelDefinition>): ModelDefinition => ({
  id: 'm',
  name: 'm',
  providerId: 'pa',
  capabilities: ['image-generation'],
  qualityTier: 'standard',
  pricing: { 'image-generation': { costPerUnit: 0.05, unit: 'image' } },
  supportedParams: {},
  status: 'active',
  apiModelId: 'm',
  metadata: {},
  ...overrides,
})

const ENV_A = 'TEST_ROUTER_A_KEY'
const ENV_B = 'TEST_ROUTER_B_KEY'

const setup = () => {
  const catalog = createModelCatalog()
  const registry = createProviderRegistry()
  registry.registerProvider(makeProvider('pa', ENV_A), stub('pa'))
  registry.registerProvider(makeProvider('pb', ENV_B), stub('pb'))
  const healthMonitor = createHealthMonitor()
  const rateLimiter = createRateLimiter()
  const costLedger = createCostLedger({ silent: true })
  const router = createModelRouter({
    catalog,
    providerRegistry: registry,
    healthMonitor,
    rateLimiter,
    costLedger,
  })
  return { catalog, registry, healthMonitor, rateLimiter, costLedger, router }
}

describe('ModelRouter', () => {
  beforeEach(() => {
    process.env[ENV_A] = 'key-a'
    process.env[ENV_B] = 'key-b'
  })
  afterEach(() => {
    delete process.env[ENV_A]
    delete process.env[ENV_B]
  })

  it('explicit modelId available → returns it', () => {
    const { catalog, router } = setup()
    catalog.registerModel(makeModel({ id: 'x', providerId: 'pa' }))
    const r = router.resolve('image-generation', { modelId: 'x' })
    expect(r.modelId).toBe('x')
  })

  it('explicit modelId not found → throws', () => {
    const { router } = setup()
    expect(() => router.resolve('image-generation', { modelId: 'missing' })).toThrow(
      /not found/,
    )
  })

  it('explicit modelId but provider down → throws', () => {
    const { catalog, healthMonitor, router } = setup()
    catalog.registerModel(makeModel({ id: 'x', providerId: 'pa' }))
    for (let i = 0; i < 10; i += 1) healthMonitor.recordOutcome('pa', false, 10, 'err')
    expect(() => router.resolve('image-generation', { modelId: 'x' })).toThrow(/unavailable/)
  })

  it('explicit providerId → picks highest tier available model from it', () => {
    const { catalog, router } = setup()
    catalog.registerModel(
      makeModel({ id: 'budget', providerId: 'pa', qualityTier: 'budget' }),
    )
    catalog.registerModel(
      makeModel({ id: 'premium', providerId: 'pa', qualityTier: 'premium' }),
    )
    catalog.registerModel(
      makeModel({ id: 'otherprem', providerId: 'pb', qualityTier: 'premium' }),
    )
    const r = router.resolve('image-generation', { providerId: 'pa' })
    expect(r.modelId).toBe('premium')
  })

  it('strategy cheapest → lowest-cost model', () => {
    const { catalog, router } = setup()
    catalog.registerModel(
      makeModel({
        id: 'cheap',
        providerId: 'pa',
        pricing: { 'image-generation': { costPerUnit: 0.01, unit: 'image' } },
      }),
    )
    catalog.registerModel(
      makeModel({
        id: 'expensive',
        providerId: 'pb',
        pricing: { 'image-generation': { costPerUnit: 1.0, unit: 'image' } },
      }),
    )
    const r = router.resolve('image-generation', { strategy: 'cheapest' })
    expect(r.modelId).toBe('cheap')
  })

  it('strategy highest-quality → premium tier', () => {
    const { catalog, router } = setup()
    catalog.registerModel(makeModel({ id: 'b', providerId: 'pa', qualityTier: 'budget' }))
    catalog.registerModel(makeModel({ id: 'p', providerId: 'pb', qualityTier: 'premium' }))
    const r = router.resolve('image-generation', { strategy: 'highest-quality' })
    expect(r.modelId).toBe('p')
  })

  it('default (no preferences) → picks premium available model', () => {
    const { catalog, router } = setup()
    catalog.registerModel(makeModel({ id: 'b', providerId: 'pa', qualityTier: 'budget' }))
    catalog.registerModel(makeModel({ id: 'p', providerId: 'pb', qualityTier: 'premium' }))
    const r = router.resolve('image-generation', {})
    expect(r.modelId).toBe('p')
  })

  it('filters out models with provider missing API key', () => {
    const { catalog, router } = setup()
    delete process.env[ENV_A]
    catalog.registerModel(makeModel({ id: 'a', providerId: 'pa' }))
    catalog.registerModel(makeModel({ id: 'b', providerId: 'pb' }))
    const r = router.resolve('image-generation', {})
    expect(r.modelId).toBe('b')
  })

  it('filters out models whose provider is rate-limited', () => {
    const { catalog, rateLimiter, router } = setup()
    catalog.registerModel(makeModel({ id: 'a', providerId: 'pa', qualityTier: 'premium' }))
    catalog.registerModel(makeModel({ id: 'b', providerId: 'pb', qualityTier: 'standard' }))
    // Exhaust pa's per-minute limit (10)
    for (let i = 0; i < 10; i += 1) rateLimiter.recordRequest('pa')
    const r = router.resolve('image-generation', {})
    expect(r.modelId).toBe('b')
  })

  it('getAvailableModels only returns active + available', () => {
    const { catalog, router } = setup()
    catalog.registerModel(makeModel({ id: 'active', providerId: 'pa' }))
    catalog.registerModel(
      makeModel({ id: 'deprecated', providerId: 'pa', status: 'deprecated' }),
    )
    const list = router.getAvailableModels('image-generation').map((m) => m.id)
    expect(list).toContain('active')
    expect(list).not.toContain('deprecated')
  })
})
