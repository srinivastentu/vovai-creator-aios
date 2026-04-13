import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createProviderRegistry } from '../../src/lib/core/models/providers/registry'
import type { ProviderDefinition, Capability } from '../../src/lib/core/models/types'
import type {
  ProviderClient,
  ProviderResult,
  HealthCheckResult,
} from '../../src/lib/core/models/providers/types'

const makeProvider = (
  overrides: Partial<ProviderDefinition> = {},
): ProviderDefinition => ({
  id: 'prov-a',
  name: 'Provider A',
  authType: 'api-key',
  authEnvVar: 'TEST_PROV_A_KEY',
  baseUrl: 'https://a.example.com',
  apiPattern: 'sync',
  status: 'available',
  rateLimits: { requestsPerMinute: 60, requestsPerDay: 1000 },
  metadata: {},
  ...overrides,
})

const makeClient = (providerId: string): ProviderClient => ({
  providerId,
  execute: async (
    _modelApiId: string,
    _capability: Capability,
    _params: Record<string, unknown>,
  ): Promise<ProviderResult> => ({
    success: true,
    rawResponse: {},
    durationMs: 0,
  }),
  checkHealth: async (): Promise<HealthCheckResult> => ({
    providerId,
    state: 'healthy',
    latencyMs: 0,
    checkedAt: new Date().toISOString(),
  }),
})

const ENV_VARS = ['TEST_PROV_A_KEY', 'TEST_PROV_B_KEY']
const saved: Record<string, string | undefined> = {}

describe('ProviderRegistry', () => {
  beforeEach(() => {
    for (const v of ENV_VARS) {
      saved[v] = process.env[v]
      delete process.env[v]
    }
  })

  afterEach(() => {
    for (const v of ENV_VARS) {
      if (saved[v] === undefined) delete process.env[v]
      else process.env[v] = saved[v]
    }
  })

  it('registers a provider and retrieves it by id', () => {
    const registry = createProviderRegistry()
    const def = makeProvider()
    const client = makeClient('prov-a')
    registry.registerProvider(def, client)
    const entry = registry.getProvider('prov-a')
    expect(entry?.definition).toEqual(def)
    expect(entry?.client).toBe(client)
  })

  it('throws when registering a duplicate id', () => {
    const registry = createProviderRegistry()
    registry.registerProvider(makeProvider(), makeClient('prov-a'))
    expect(() =>
      registry.registerProvider(makeProvider(), makeClient('prov-a')),
    ).toThrow(/already registered/)
  })

  it('getAvailableProviders filters by env var presence', () => {
    const registry = createProviderRegistry()
    registry.registerProvider(
      makeProvider({ id: 'prov-a', authEnvVar: 'TEST_PROV_A_KEY' }),
      makeClient('prov-a'),
    )
    registry.registerProvider(
      makeProvider({ id: 'prov-b', authEnvVar: 'TEST_PROV_B_KEY' }),
      makeClient('prov-b'),
    )
    process.env.TEST_PROV_A_KEY = 'sk-test'
    const available = registry.getAvailableProviders()
    expect(available.map((p) => p.id)).toEqual(['prov-a'])
  })

  it('checkAvailability returns correct map', () => {
    const registry = createProviderRegistry()
    registry.registerProvider(
      makeProvider({ id: 'prov-a', authEnvVar: 'TEST_PROV_A_KEY' }),
      makeClient('prov-a'),
    )
    registry.registerProvider(
      makeProvider({ id: 'prov-b', authEnvVar: 'TEST_PROV_B_KEY' }),
      makeClient('prov-b'),
    )
    process.env.TEST_PROV_B_KEY = 'fk-test'
    const map = registry.checkAvailability()
    expect(map.get('prov-a')).toBe(false)
    expect(map.get('prov-b')).toBe(true)
  })

  it('getProvider returns undefined for unknown id', () => {
    const registry = createProviderRegistry()
    expect(registry.getProvider('missing')).toBeUndefined()
  })
})
