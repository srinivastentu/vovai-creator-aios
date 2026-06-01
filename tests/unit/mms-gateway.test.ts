import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createModelCatalog } from '../../src/lib/core/models/catalog'
import { createCostLedger } from '../../src/lib/core/models/cost-ledger'
import { createModelGateway } from '../../src/lib/core/models/gateway'
import { createHealthMonitor } from '../../src/lib/core/models/health-monitor'
import { createProviderRegistry } from '../../src/lib/core/models/providers/registry'
import type {
  ProviderClient,
  ProviderResult,
} from '../../src/lib/core/models/providers/types'
import { createRateLimiter } from '../../src/lib/core/models/rate-limiter'
import type {
  GatewayRequest,
  ModelDefinition,
  ProviderDefinition,
} from '../../src/lib/core/models/types'

const ENV_KEY = 'TEST_GATEWAY_KEY'

const makeProvider = (id: string): ProviderDefinition => ({
  id,
  name: id,
  authType: 'api-key',
  authEnvVar: ENV_KEY,
  baseUrl: 'http://x',
  apiPattern: 'sync',
  status: 'available',
  rateLimits: { requestsPerMinute: 100, requestsPerDay: 1000 },
  metadata: {},
})

const makeModel = (overrides: Partial<ModelDefinition>): ModelDefinition => ({
  id: 'm',
  name: 'm',
  providerId: 'p',
  capabilities: ['image-generation'],
  qualityTier: 'standard',
  pricing: { 'image-generation': { costPerUnit: 0.05, unit: 'image' } },
  supportedParams: {},
  status: 'active',
  apiModelId: 'api-m',
  metadata: {},
  ...overrides,
})

const mockClient = (id: string, result: ProviderResult): ProviderClient => ({
  providerId: id,
  async execute() {
    return result
  },
  async checkHealth() {
    return { providerId: id, state: 'healthy', latencyMs: 1, checkedAt: '' }
  },
})

const successResult: ProviderResult = {
  success: true,
  rawResponse: { ok: 1 },
  filePath: '/tmp/x.png',
  durationMs: 120,
}

const failureResult: ProviderResult = {
  success: false,
  rawResponse: {},
  durationMs: 50,
  error: 'upstream 500',
}

const baseRequest: GatewayRequest = {
  capability: 'image-generation',
  params: { prompt: 'hello' },
  preferences: {},
  context: { projectId: 'proj1' },
}

const buildGateway = (
  clients: Record<string, ProviderClient>,
  models: ModelDefinition[],
) => {
  const catalog = createModelCatalog()
  const registry = createProviderRegistry()
  for (const [id, client] of Object.entries(clients)) {
    registry.registerProvider(makeProvider(id), client)
  }
  for (const m of models) catalog.registerModel(m)
  const costLedger = createCostLedger({ silent: true })
  const rateLimiter = createRateLimiter()
  const healthMonitor = createHealthMonitor()
  const gateway = createModelGateway({
    catalog,
    providerRegistry: registry,
    costLedger,
    rateLimiter,
    healthMonitor,
  })
  return { catalog, registry, costLedger, rateLimiter, healthMonitor, gateway }
}

describe('ModelGateway', () => {
  beforeEach(() => {
    process.env[ENV_KEY] = 'key'
  })
  afterEach(() => {
    delete process.env[ENV_KEY]
    vi.restoreAllMocks()
  })

  it('successful request returns GatewayResponse', async () => {
    const { gateway } = buildGateway(
      { p: mockClient('p', successResult) },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    const res = await gateway.request(baseRequest)
    expect(res.success).toBe(true)
    expect(res.modelId).toBe('m')
    expect(res.providerId).toBe('p')
    expect(res.cost.costUsd).toBeCloseTo(0.05)
    expect(res.result.filePath).toBe('/tmp/x.png')
  })

  it('records cost in ledger on success', async () => {
    const { gateway, costLedger } = buildGateway(
      { p: mockClient('p', successResult) },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    await gateway.request(baseRequest)
    expect(costLedger.getRecordCount()).toBe(1)
    expect(costLedger.getTotal().totalCostUsd).toBeCloseTo(0.05)
  })

  it('records health outcome', async () => {
    const { gateway, healthMonitor } = buildGateway(
      { p: mockClient('p', successResult) },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    await gateway.request(baseRequest)
    expect(healthMonitor.getHealth('p').sampleSize).toBe(1)
  })

  it('records rate limiter request', async () => {
    const { gateway, rateLimiter } = buildGateway(
      { p: mockClient('p', successResult) },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    await gateway.request(baseRequest)
    const q = rateLimiter.getRemainingQuota('p', {
      requestsPerMinute: 100,
      requestsPerDay: 1000,
    })
    expect(q.perMinute).toBe(99)
  })

  it('failing provider returns success:false and records failure', async () => {
    const { gateway, healthMonitor, costLedger } = buildGateway(
      { p: mockClient('p', failureResult) },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    const res = await gateway.request(baseRequest)
    expect(res.success).toBe(false)
    expect(res.error).toBe('upstream 500')
    expect(res.cost.costUsd).toBe(0)
    expect(costLedger.getTotal().failureCount).toBe(1)
    expect(healthMonitor.getHealth('p').successRate).toBe(0)
  })

  it('no available model returns success:false with descriptive error', async () => {
    const { gateway } = buildGateway({ p: mockClient('p', successResult) }, [])
    const res = await gateway.request(baseRequest)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No available model/)
  })

  it('requestMultiple calls multiple models in parallel', async () => {
    const { gateway } = buildGateway(
      {
        p: mockClient('p', successResult),
      },
      [
        makeModel({ id: 'm1', providerId: 'p' }),
        makeModel({ id: 'm2', providerId: 'p' }),
      ],
    )
    const res = await gateway.requestMultiple(baseRequest, ['m1', 'm2'])
    expect(res).toHaveLength(2)
    expect(res[0].modelId).toBe('m1')
    expect(res[1].modelId).toBe('m2')
    expect(res.every((r) => r.success)).toBe(true)
  })

  it('requestMultiple records costs and health for mixed outcomes', async () => {
    const { gateway, costLedger, healthMonitor } = buildGateway(
      {
        a: mockClient('a', successResult),
        b: mockClient('b', failureResult),
      },
      [
        makeModel({ id: 'm1', providerId: 'a' }),
        makeModel({ id: 'm2', providerId: 'b' }),
      ],
    )
    await gateway.requestMultiple(baseRequest, ['m1', 'm2'])
    expect(costLedger.getRecordCount()).toBe(2)
    expect(healthMonitor.getHealth('a').successRate).toBe(1)
    expect(healthMonitor.getHealth('b').successRate).toBe(0)
  })

  it('requestMultiple preserves input order', async () => {
    const { gateway } = buildGateway(
      { p: mockClient('p', successResult) },
      [
        makeModel({ id: 'm1', providerId: 'p' }),
        makeModel({ id: 'm2', providerId: 'p' }),
        makeModel({ id: 'm3', providerId: 'p' }),
      ],
    )
    const res = await gateway.requestMultiple(baseRequest, ['m3', 'm1', 'm2'])
    expect(res.map((r) => r.modelId)).toEqual(['m3', 'm1', 'm2'])
  })

  it('getAvailableModels delegates to router', async () => {
    const { gateway } = buildGateway(
      { p: mockClient('p', successResult) },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    const list = gateway.getAvailableModels('image-generation')
    expect(list.map((m) => m.id)).toEqual(['m'])
  })

  it('getCostSummary delegates to ledger', async () => {
    const { gateway } = buildGateway(
      { p: mockClient('p', successResult) },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    await gateway.request(baseRequest)
    expect(gateway.getCostSummary().callCount).toBe(1)
  })

  it('gateway never throws, even when provider client throws', async () => {
    const throwingClient: ProviderClient = {
      providerId: 'p',
      async execute() {
        throw new Error('boom')
      },
      async checkHealth() {
        return { providerId: 'p', state: 'down', latencyMs: 0, checkedAt: '' }
      },
    }
    const { gateway } = buildGateway(
      { p: throwingClient },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    const res = await gateway.request(baseRequest)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/boom/)
  })

  const signalHonoringClient = (): ProviderClient => ({
    providerId: 'p',
    async execute(_modelApiId, _capability, params) {
      const signal = params.abortSignal as AbortSignal | undefined
      return new Promise<ProviderResult>((resolve) => {
        if (!signal) return
        const onAbort = (): void => {
          resolve({
            success: false,
            rawResponse: {},
            durationMs: 0,
            error: 'Timeout (aborted)',
          })
        }
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })
      })
    },
    async checkHealth() {
      return { providerId: 'p', state: 'healthy', latencyMs: 0, checkedAt: '' }
    },
  })

  it('enforces preferences.timeoutMs when provider execute hangs', async () => {
    const { gateway } = buildGateway(
      { p: signalHonoringClient() },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    const t0 = Date.now()
    const res = await gateway.request({
      ...baseRequest,
      preferences: { timeoutMs: 80 },
    })
    const elapsed = Date.now() - t0
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/timeout/i)
    expect(elapsed).toBeLessThan(500)
  })

  it('records timeout as failure in ledger and health', async () => {
    const { gateway, costLedger, healthMonitor } = buildGateway(
      { p: signalHonoringClient() },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    await gateway.request({ ...baseRequest, preferences: { timeoutMs: 60 } })
    expect(costLedger.getTotal().failureCount).toBe(1)
    expect(healthMonitor.getHealth('p').successRate).toBe(0)
  })

  it('passes timeoutMs and abortSignal to provider client params', async () => {
    let capturedParams: Record<string, unknown> | undefined
    const capturingClient: ProviderClient = {
      providerId: 'p',
      async execute(_m, _c, params) {
        capturedParams = params
        return successResult
      },
      async checkHealth() {
        return { providerId: 'p', state: 'healthy', latencyMs: 0, checkedAt: '' }
      },
    }
    const { gateway } = buildGateway(
      { p: capturingClient },
      [makeModel({ id: 'm', providerId: 'p' })],
    )
    await gateway.request({ ...baseRequest, preferences: { timeoutMs: 500 } })
    expect(capturedParams?.timeoutMs).toBe(500)
    expect(capturedParams?.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('default-inventory request without env key fails at provider availability check', async () => {
    // No env keys set → provider registry marks providers unavailable; router rejects before dispatch
    delete process.env.GOOGLE_GEMINI_API_KEY
    delete process.env.FAL_KEY
    delete process.env.OPENAI_API_KEY
    const gateway = createModelGateway()
    const res = await gateway.request({
      capability: 'image-generation',
      params: {},
      preferences: { modelId: 'nanobanan-pro' },
      context: {},
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/provider api key missing|Provider client not available/)
  })

  // --- Token cost model (CR-7): input + optional output billing ---

  const tokenResult = (tokensIn: number, tokensOut: number): ProviderResult => ({
    success: true,
    rawResponse: {},
    content: 'generated text',
    tokensIn,
    tokensOut,
    durationMs: 30,
  })

  it('text-generation bills input + output tokens when costPerUnitOut is set', async () => {
    const { gateway } = buildGateway(
      { p: mockClient('p', tokenResult(1000, 500)) },
      [
        makeModel({
          id: 'txt',
          providerId: 'p',
          capabilities: ['text-generation'],
          pricing: {
            'text-generation': { costPerUnit: 0.003, unit: '1k-tokens-in', costPerUnitOut: 0.015 },
          },
          apiModelId: 'api-txt',
        }),
      ],
    )
    const res = await gateway.request({
      capability: 'text-generation',
      params: { prompt: 'x' },
      preferences: { modelId: 'txt' },
      context: {},
    })
    // 1000/1000*0.003 (in) + 500/1000*0.015 (out) = 0.003 + 0.0075 = 0.0105
    expect(res.cost.costUsd).toBeCloseTo(0.0105, 6)
    expect(res.cost.tokensIn).toBe(1000)
    expect(res.cost.tokensOut).toBe(500)
  })

  it('input-only token pricing ignores output when costPerUnitOut is absent (judge convention)', async () => {
    const { gateway } = buildGateway(
      { p: mockClient('p', tokenResult(1000, 500)) },
      [
        makeModel({
          id: 'score',
          providerId: 'p',
          capabilities: ['text-scoring'],
          pricing: { 'text-scoring': { costPerUnit: 0.00125, unit: '1k-tokens-in' } },
          apiModelId: 'api-score',
        }),
      ],
    )
    const res = await gateway.request({
      capability: 'text-scoring',
      params: {},
      preferences: { modelId: 'score' },
      context: {},
    })
    // 1000/1000*0.00125 only; output not billed.
    expect(res.cost.costUsd).toBeCloseTo(0.00125, 6)
  })
})
