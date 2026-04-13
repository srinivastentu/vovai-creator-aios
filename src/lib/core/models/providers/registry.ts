import type { ProviderDefinition } from '../types'
import type { ProviderClient } from './types'

export interface ProviderEntry {
  definition: ProviderDefinition
  client: ProviderClient
}

export interface ProviderRegistry {
  registerProvider(definition: ProviderDefinition, client: ProviderClient): void
  getProvider(id: string): ProviderEntry | undefined
  getAvailableProviders(): ProviderDefinition[]
  checkAvailability(): Map<string, boolean>
  listAll(): ProviderDefinition[]
}

export const createProviderRegistry = (): ProviderRegistry => {
  const entries = new Map<string, ProviderEntry>()

  const registerProvider = (
    definition: ProviderDefinition,
    client: ProviderClient,
  ): void => {
    if (entries.has(definition.id)) {
      throw new Error(`Provider already registered: ${definition.id}`)
    }
    if (client.providerId !== definition.id) {
      throw new Error(
        `Provider client id mismatch: client='${client.providerId}', definition='${definition.id}'`,
      )
    }
    entries.set(definition.id, { definition, client })
  }

  const getProvider = (id: string): ProviderEntry | undefined => entries.get(id)

  const isEnvConfigured = (envVar: string): boolean => {
    const value = process.env[envVar]
    return typeof value === 'string' && value.length > 0
  }

  const checkAvailability = (): Map<string, boolean> => {
    const map = new Map<string, boolean>()
    for (const { definition } of entries.values()) {
      map.set(definition.id, isEnvConfigured(definition.authEnvVar))
    }
    return map
  }

  const getAvailableProviders = (): ProviderDefinition[] =>
    Array.from(entries.values())
      .filter(({ definition }) => isEnvConfigured(definition.authEnvVar))
      .map((e) => e.definition)

  const listAll = (): ProviderDefinition[] =>
    Array.from(entries.values()).map((e) => e.definition)

  return {
    registerProvider,
    getProvider,
    getAvailableProviders,
    checkAvailability,
    listAll,
  }
}
