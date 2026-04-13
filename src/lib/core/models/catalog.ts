import type {
  Capability,
  ModelDefinition,
  ModelStatus,
  QualityTier,
} from './types'

export interface CatalogFilter {
  capability?: Capability
  providerId?: string
  qualityTier?: QualityTier
  status?: ModelStatus
}

export interface ModelCatalog {
  registerModel(definition: ModelDefinition): void
  getModel(id: string): ModelDefinition | undefined
  findModels(filter: CatalogFilter): ModelDefinition[]
  getModelsForCapability(capability: Capability): ModelDefinition[]
  getModelsForProvider(providerId: string): ModelDefinition[]
  listAll(): ModelDefinition[]
  updateStatus(modelId: string, status: ModelStatus): void
}

export const createModelCatalog = (): ModelCatalog => {
  const models = new Map<string, ModelDefinition>()

  const registerModel = (definition: ModelDefinition): void => {
    if (models.has(definition.id)) {
      throw new Error(`Model already registered: ${definition.id}`)
    }
    models.set(definition.id, definition)
  }

  const getModel = (id: string): ModelDefinition | undefined => models.get(id)

  const findModels = (filter: CatalogFilter): ModelDefinition[] => {
    const all = Array.from(models.values())
    return all.filter((m) => {
      if (filter.capability && !m.capabilities.includes(filter.capability)) return false
      if (filter.providerId && m.providerId !== filter.providerId) return false
      if (filter.qualityTier && m.qualityTier !== filter.qualityTier) return false
      if (filter.status && m.status !== filter.status) return false
      return true
    })
  }

  const getModelsForCapability = (capability: Capability): ModelDefinition[] =>
    findModels({ capability })

  const getModelsForProvider = (providerId: string): ModelDefinition[] =>
    findModels({ providerId })

  const listAll = (): ModelDefinition[] => Array.from(models.values())

  const updateStatus = (modelId: string, status: ModelStatus): void => {
    const existing = models.get(modelId)
    if (!existing) {
      throw new Error(`Cannot update status — unknown model: ${modelId}`)
    }
    models.set(modelId, { ...existing, status })
  }

  return {
    registerModel,
    getModel,
    findModels,
    getModelsForCapability,
    getModelsForProvider,
    listAll,
    updateStatus,
  }
}
