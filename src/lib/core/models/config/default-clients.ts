import { createFalAiClient } from '../providers/fal-ai'
import type { ProviderClient } from '../providers/types'

export const createDefaultClients = (): Map<string, ProviderClient> => {
  const map = new Map<string, ProviderClient>()
  if (process.env.FAL_KEY) {
    map.set('fal-ai', createFalAiClient())
  }
  return map
}
