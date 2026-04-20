import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createModelCatalog } from '../catalog'
import { createModelGateway } from '../gateway'
import { createProviderRegistry } from '../providers/registry'
import type { ProviderClient, ProviderResult } from '../providers/types'
import type { ModelDefinition, ProviderDefinition } from '../types'

const mkProvider = (): ProviderDefinition => ({
  id: 'mock-voice',
  name: 'Mock Voice',
  authType: 'api-key',
  authEnvVar: 'MOCK_VOICE_KEY',
  baseUrl: 'https://mock.test',
  apiPattern: 'sync',
  status: 'available',
  rateLimits: { requestsPerMinute: 1000, requestsPerDay: 100000 },
  metadata: {},
})

const mkModel = (): ModelDefinition => ({
  id: 'mock-voice-turbo',
  name: 'Mock Voice Turbo',
  providerId: 'mock-voice',
  capabilities: ['voice-synthesis'],
  qualityTier: 'budget',
  pricing: { 'voice-synthesis': { costPerUnit: 0.0001, unit: 'character' } },
  supportedParams: {},
  status: 'active',
  apiModelId: 'mock_voice_turbo',
  metadata: {},
})

const mkClient = (characters: number): ProviderClient => ({
  providerId: 'mock-voice',
  execute: async (): Promise<ProviderResult> => ({
    success: true,
    rawResponse: {},
    filePath: '/tmp/fake.mp3',
    mimeType: 'audio/mpeg',
    fileSizeBytes: 1024,
    characters,
    durationMs: 42,
  }),
  checkHealth: async () => ({
    providerId: 'mock-voice',
    state: 'healthy',
    latencyMs: 0,
    checkedAt: new Date().toISOString(),
  }),
})

describe('gateway cost estimation — character unit', () => {
  let originalKey: string | undefined

  beforeEach(() => {
    originalKey = process.env.MOCK_VOICE_KEY
    process.env.MOCK_VOICE_KEY = 'test-key'
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.MOCK_VOICE_KEY
    else process.env.MOCK_VOICE_KEY = originalKey
  })

  it('multiplies characters by costPerUnit', async () => {
    const catalog = createModelCatalog()
    const registry = createProviderRegistry()
    catalog.registerModel(mkModel())
    registry.registerProvider(mkProvider(), mkClient(100))
    const gw = createModelGateway({ catalog, providerRegistry: registry })
    const res = await gw.request({
      capability: 'voice-synthesis',
      params: { text: 'x'.repeat(100), voiceId: 'v1' },
      preferences: { modelId: 'mock-voice-turbo' },
      context: {},
    })
    expect(res.success).toBe(true)
    expect(res.cost.costUsd).toBeCloseTo(100 * 0.0001, 10)
    expect(res.cost.unit).toBe('character')
    expect(res.result.characters).toBe(100)
  })
})
