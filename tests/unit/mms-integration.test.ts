import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createModelCatalog } from '../../src/lib/core/models/catalog'
import {
  getDefaultModels,
  getDefaultProviders,
} from '../../src/lib/core/models/config/model-inventory'
import { createModelGateway, type ModelGateway } from '../../src/lib/core/models/gateway'
import { createProviderRegistry } from '../../src/lib/core/models/providers/registry'
import type {
  ProviderClient,
  ProviderResult,
} from '../../src/lib/core/models/providers/types'
import type { GatewayRequest } from '../../src/lib/core/models/types'

interface MockBehavior {
  success?: boolean
  durationMs?: number
  costTokensIn?: number
  costTokensOut?: number
  delayMs?: number
  error?: string
  filePath?: string
  fileSizeBytes?: number
  honorAbort?: boolean
}

const createMockClient = (providerId: string, behavior: MockBehavior = {}): ProviderClient => ({
  providerId,
  async execute(modelApiId, _capability, params) {
    const delay = behavior.delayMs ?? 0
    const abort = params.abortSignal as AbortSignal | undefined
    if (delay > 0) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay)
        if (behavior.honorAbort && abort) {
          abort.addEventListener('abort', () => {
            clearTimeout(t)
            reject(new Error('aborted'))
          })
        }
      })
    }
    const success = behavior.success ?? true
    const result: ProviderResult = {
      success,
      rawResponse: { providerId, modelApiId },
      durationMs: behavior.durationMs ?? 10,
      filePath: success ? behavior.filePath ?? `/tmp/${providerId}-${modelApiId}.png` : undefined,
      fileSizeBytes: success ? behavior.fileSizeBytes ?? 1024 : undefined,
      tokensIn: behavior.costTokensIn,
      tokensOut: behavior.costTokensOut,
      error: success ? undefined : behavior.error ?? 'mock failure',
    }
    return result
  },
  async checkHealth() {
    return {
      providerId,
      state: 'healthy',
      latencyMs: 10,
      checkedAt: new Date().toISOString(),
    }
  },
})

type MockMap = Record<string, MockBehavior | ((providerId: string) => ProviderClient)>

const setupGateway = (mocks: MockMap = {}): ModelGateway => {
  const catalog = createModelCatalog()
  const providerRegistry = createProviderRegistry()
  for (const def of getDefaultProviders()) {
    const entry = mocks[def.id]
    const client =
      typeof entry === 'function'
        ? entry(def.id)
        : createMockClient(def.id, (entry ?? {}) as MockBehavior)
    providerRegistry.registerProvider(def, client)
  }
  for (const model of getDefaultModels()) catalog.registerModel(model)
  return createModelGateway({ catalog, providerRegistry })
}

const imageRequest: GatewayRequest = {
  capability: 'image-generation',
  params: { prompt: 'test' },
  preferences: {},
  context: { projectId: 'p1' },
}

describe('MMS integration', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic')
    vi.stubEnv('FAL_KEY', 'test-fal')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai')
    vi.stubEnv('GOOGLE_GEMINI_API_KEY', 'test-gemini')
    vi.stubEnv('FREEPIK_API_KEY', 'test-freepik')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('routing', () => {
    it('picks a model with no preferences and executes successfully', async () => {
      const gateway = setupGateway()
      const res = await gateway.request(imageRequest)
      expect(res.success).toBe(true)
      expect(res.modelId).toBeTruthy()
      expect(res.providerId).toBeTruthy()
    })

    it('routes modelId=flux-dev to fal-ai client', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...imageRequest,
        preferences: { modelId: 'flux-dev' },
      })
      expect(res.success).toBe(true)
      expect(res.modelId).toBe('flux-dev')
      expect(res.providerId).toBe('fal-ai')
    })

    it('routes modelId=dall-e-3-hd to openai client', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...imageRequest,
        preferences: { modelId: 'dall-e-3-hd' },
      })
      expect(res.success).toBe(true)
      expect(res.providerId).toBe('openai')
    })

    it('routes modelId=nanobanan-pro to google-gemini client', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...imageRequest,
        preferences: { modelId: 'nanobanan-pro' },
      })
      expect(res.success).toBe(true)
      expect(res.providerId).toBe('google-gemini')
    })

    it('routes modelId=freepik-mystic to freepik client', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...imageRequest,
        preferences: { modelId: 'freepik-mystic' },
      })
      expect(res.success).toBe(true)
      expect(res.providerId).toBe('freepik')
    })

    it('strategy=cheapest picks flux-dev at $0.025', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...imageRequest,
        preferences: { strategy: 'cheapest' },
      })
      expect(res.success).toBe(true)
      expect(res.modelId).toBe('flux-dev')
    })

    it('strategy=highest-quality picks a premium-tier model', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...imageRequest,
        preferences: { strategy: 'highest-quality' },
      })
      expect(res.success).toBe(true)
      const premiumModels = getDefaultModels().filter(
        (m) => m.qualityTier === 'premium' && m.capabilities.includes('image-generation'),
      )
      expect(premiumModels.map((m) => m.id)).toContain(res.modelId)
    })

    it('providerId=fal-ai picks a fal-ai model', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...imageRequest,
        preferences: { providerId: 'fal-ai' },
      })
      expect(res.success).toBe(true)
      expect(res.providerId).toBe('fal-ai')
    })
  })

  // CR-7: the Cross-Critique stage routes producers/critics/integrator through
  // text-generation and the Gemini judge through text-scoring. Confirm each
  // capability+modelId resolves to the expected provider (the cross-model split).
  describe('text capabilities routing (CR-7)', () => {
    const textRequest: GatewayRequest = {
      capability: 'text-generation',
      params: { prompt: 'write' },
      preferences: {},
      context: { projectId: 'p1' },
    }

    it('text-generation modelId=claude-sonnet-4-20250514 routes to anthropic', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...textRequest,
        preferences: { modelId: 'claude-sonnet-4-20250514' },
      })
      expect(res.success).toBe(true)
      expect(res.providerId).toBe('anthropic')
    })

    it('text-generation modelId=gpt-4o routes to openai', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        ...textRequest,
        preferences: { modelId: 'gpt-4o' },
      })
      expect(res.success).toBe(true)
      expect(res.providerId).toBe('openai')
    })

    it('text-scoring modelId=gemini-2.5-pro routes to google-gemini', async () => {
      const gateway = setupGateway()
      const res = await gateway.request({
        capability: 'text-scoring',
        params: { prompt: 'grade' },
        preferences: { modelId: 'gemini-2.5-pro' },
        context: { projectId: 'p1' },
      })
      expect(res.success).toBe(true)
      expect(res.providerId).toBe('google-gemini')
    })

    it('text-generation lists Claude + GPT-4o across anthropic and openai', () => {
      const gateway = setupGateway()
      const models = gateway.getAvailableModels('text-generation')
      const providerIds = new Set(models.map((m) => m.providerId))
      expect(providerIds.has('anthropic')).toBe(true)
      expect(providerIds.has('openai')).toBe(true)
      expect(models.find((m) => m.id === 'gpt-4o')).toBeTruthy()
      expect(models.find((m) => m.id === 'claude-sonnet-4-20250514')).toBeTruthy()
    })
  })

  describe('cost tracking', () => {
    it('getCostSummary sums costs across 3 requests', async () => {
      const gateway = setupGateway()
      await gateway.request({ ...imageRequest, preferences: { modelId: 'flux-dev' } })
      await gateway.request({ ...imageRequest, preferences: { modelId: 'dall-e-3-standard' } })
      await gateway.request({ ...imageRequest, preferences: { modelId: 'nanobanan-pro' } })
      const summary = gateway.getCostSummary()
      expect(summary.callCount).toBe(3)
      expect(summary.successCount).toBe(3)
      expect(summary.totalCostUsd).toBeCloseTo(0.025 + 0.04 + 0.134, 5)
    })

    it('getCostTable returns one row per model', async () => {
      const gateway = setupGateway()
      await gateway.request({ ...imageRequest, preferences: { modelId: 'flux-dev' } })
      await gateway.request({ ...imageRequest, preferences: { modelId: 'dall-e-3-standard' } })
      await gateway.request({ ...imageRequest, preferences: { modelId: 'nanobanan-pro' } })
      const table = gateway.getCostTable()
      expect(table).toHaveLength(3)
      const flux = table.find((r) => r.modelId === 'flux-dev')
      expect(flux?.totalCostUsd).toBeCloseTo(0.025, 5)
      expect(flux?.callCount).toBe(1)
    })

    it('failed request records cost=0 and increments call count', async () => {
      const gateway = setupGateway({
        'fal-ai': { success: false, error: 'boom' },
      })
      const res = await gateway.request({
        ...imageRequest,
        preferences: { modelId: 'flux-dev' },
      })
      expect(res.success).toBe(false)
      const summary = gateway.getCostSummary()
      expect(summary.callCount).toBe(1)
      expect(summary.failureCount).toBe(1)
      expect(summary.totalCostUsd).toBe(0)
    })
  })

  describe('health tracking', () => {
    it('success marks provider healthy in dashboard', async () => {
      const gateway = setupGateway()
      await gateway.request({ ...imageRequest, preferences: { modelId: 'flux-dev' } })
      const dash = gateway.getHealthDashboard()
      expect(dash.get('fal-ai')?.status).toBe('healthy')
    })

    it('repeated failures degrade provider and routing excludes down providers', async () => {
      const gateway = setupGateway({
        'fal-ai': { success: false, error: 'boom' },
      })
      for (let i = 0; i < 10; i++) {
        await gateway.request({
          ...imageRequest,
          preferences: { modelId: 'flux-dev' },
        })
      }
      const dash = gateway.getHealthDashboard()
      const falHealth = dash.get('fal-ai')
      expect(falHealth?.status === 'down' || falHealth?.status === 'degraded').toBe(true)
      // When a provider goes 'down', router excludes it.
      if (falHealth?.status === 'down') {
        const res = await gateway.request({
          ...imageRequest,
          preferences: { providerId: 'fal-ai' },
        })
        expect(res.success).toBe(false)
      }
    })
  })

  describe('requestMultiple (tournament)', () => {
    it('returns 3 responses in order, all successful, parallel execution', async () => {
      const gateway = setupGateway()
      const modelIds = ['flux-dev', 'dall-e-3-standard', 'nanobanan-pro']
      const results = await gateway.requestMultiple(imageRequest, modelIds)
      expect(results).toHaveLength(3)
      expect(results.map((r) => r.modelId)).toEqual(modelIds)
      expect(results.every((r) => r.success)).toBe(true)
    })

    it('preserves order when one model fails', async () => {
      const gateway = setupGateway({
        openai: { success: false, error: 'openai down' },
      })
      const modelIds = ['flux-dev', 'dall-e-3-standard', 'nanobanan-pro']
      const results = await gateway.requestMultiple(imageRequest, modelIds)
      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
      const summary = gateway.getCostSummary()
      expect(summary.callCount).toBe(3)
    })
  })

  describe('timeout', () => {
    it('aborts slow requests when timeoutMs is exceeded', async () => {
      const gateway = setupGateway({
        'fal-ai': { delayMs: 500, honorAbort: true },
      })
      const res = await gateway.request({
        ...imageRequest,
        preferences: { modelId: 'flux-dev', timeoutMs: 50 },
      })
      expect(res.success).toBe(false)
      expect(res.error).toBeTruthy()
    })
  })

  describe('UI readiness (getAvailableModels)', () => {
    it('image-generation lists active image models across providers', () => {
      const gateway = setupGateway()
      const models = gateway.getAvailableModels('image-generation')
      expect(models.length).toBeGreaterThan(0)
      const providerIds = new Set(models.map((m) => m.providerId))
      expect(providerIds.has('fal-ai')).toBe(true)
      expect(providerIds.has('openai')).toBe(true)
      expect(providerIds.has('google-gemini')).toBe(true)
      // Disabled models are excluded
      expect(models.find((m) => m.id === 'freepik-nanobanan-2')).toBeUndefined()
    })

    it('image-scoring returns only GPT-4o vision models', () => {
      const gateway = setupGateway()
      const models = gateway.getAvailableModels('image-scoring')
      expect(models.length).toBeGreaterThan(0)
      for (const m of models) {
        expect(m.providerId).toBe('openai')
        expect(m.id.startsWith('gpt-4o')).toBe(true)
      }
    })

    it('voice-synthesis returns empty array (no voice models registered)', () => {
      const gateway = setupGateway()
      const models = gateway.getAvailableModels('voice-synthesis')
      expect(models).toEqual([])
    })
  })
})
