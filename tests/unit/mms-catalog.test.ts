import { describe, it, expect } from 'vitest'
import { createModelCatalog } from '../../src/lib/core/models/catalog'
import type { ModelDefinition } from '../../src/lib/core/models/types'

const makeModel = (overrides: Partial<ModelDefinition> = {}): ModelDefinition => ({
  id: 'm1',
  name: 'Model 1',
  providerId: 'prov-a',
  capabilities: ['image-generation'],
  qualityTier: 'standard',
  pricing: { 'image-generation': { costPerUnit: 0.05, unit: 'image' } },
  supportedParams: {},
  status: 'active',
  apiModelId: 'm-1',
  metadata: {},
  ...overrides,
})

describe('ModelCatalog', () => {
  it('registers a model and retrieves it by id', () => {
    const catalog = createModelCatalog()
    const m = makeModel()
    catalog.registerModel(m)
    expect(catalog.getModel('m1')).toEqual(m)
  })

  it('throws when registering a duplicate id', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel())
    expect(() => catalog.registerModel(makeModel())).toThrow(/already registered/)
  })

  it('findModels filters by capability', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel({ id: 'img', capabilities: ['image-generation'] }))
    catalog.registerModel(makeModel({ id: 'txt', capabilities: ['text-generation'] }))
    const result = catalog.findModels({ capability: 'text-generation' })
    expect(result.map((m) => m.id)).toEqual(['txt'])
  })

  it('findModels filters by provider', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel({ id: 'a1', providerId: 'prov-a' }))
    catalog.registerModel(makeModel({ id: 'b1', providerId: 'prov-b' }))
    const result = catalog.findModels({ providerId: 'prov-b' })
    expect(result.map((m) => m.id)).toEqual(['b1'])
  })

  it('findModels filters by qualityTier', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel({ id: 'budget', qualityTier: 'budget' }))
    catalog.registerModel(makeModel({ id: 'premium', qualityTier: 'premium' }))
    const result = catalog.findModels({ qualityTier: 'premium' })
    expect(result.map((m) => m.id)).toEqual(['premium'])
  })

  it('findModels filters by status', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel({ id: 'active', status: 'active' }))
    catalog.registerModel(makeModel({ id: 'disabled', status: 'disabled' }))
    const result = catalog.findModels({ status: 'disabled' })
    expect(result.map((m) => m.id)).toEqual(['disabled'])
  })

  it('findModels applies multiple filters with AND logic', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(
      makeModel({ id: 'match', providerId: 'openai', qualityTier: 'premium' }),
    )
    catalog.registerModel(
      makeModel({ id: 'wrong-tier', providerId: 'openai', qualityTier: 'budget' }),
    )
    catalog.registerModel(
      makeModel({ id: 'wrong-prov', providerId: 'fal-ai', qualityTier: 'premium' }),
    )
    const result = catalog.findModels({ providerId: 'openai', qualityTier: 'premium' })
    expect(result.map((m) => m.id)).toEqual(['match'])
  })

  it('getModelsForCapability returns only matching models', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel({ id: 'img', capabilities: ['image-generation'] }))
    catalog.registerModel(makeModel({ id: 'vid', capabilities: ['video-generation'] }))
    expect(catalog.getModelsForCapability('image-generation').map((m) => m.id)).toEqual([
      'img',
    ])
  })

  it('getModelsForProvider returns only matching models', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel({ id: 'a1', providerId: 'prov-a' }))
    catalog.registerModel(makeModel({ id: 'b1', providerId: 'prov-b' }))
    expect(catalog.getModelsForProvider('prov-a').map((m) => m.id)).toEqual(['a1'])
  })

  it('updateStatus changes model status', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel({ id: 'm1', status: 'active' }))
    catalog.updateStatus('m1', 'deprecated')
    expect(catalog.getModel('m1')?.status).toBe('deprecated')
  })

  it('updateStatus throws for unknown model', () => {
    const catalog = createModelCatalog()
    expect(() => catalog.updateStatus('missing', 'disabled')).toThrow(/unknown model/)
  })

  it('getModel returns undefined for unknown id', () => {
    const catalog = createModelCatalog()
    expect(catalog.getModel('nope')).toBeUndefined()
  })

  it('listAll returns all registered models', () => {
    const catalog = createModelCatalog()
    catalog.registerModel(makeModel({ id: 'a' }))
    catalog.registerModel(makeModel({ id: 'b' }))
    catalog.registerModel(makeModel({ id: 'c' }))
    expect(catalog.listAll().map((m) => m.id).sort()).toEqual(['a', 'b', 'c'])
  })
})
