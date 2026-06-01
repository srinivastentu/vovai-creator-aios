import { createAnthropicClient } from '../providers/anthropic'
import { createElevenLabsClient } from '../providers/elevenlabs'
import { createFalAiClient } from '../providers/fal-ai'
import { createFreepikClient } from '../providers/freepik'
import { createGoogleGeminiClient } from '../providers/google-gemini'
import { createOpenAiClient } from '../providers/openai'
import type { ProviderClient } from '../providers/types'

export const createDefaultClients = (): Map<string, ProviderClient> => {
  const map = new Map<string, ProviderClient>()
  if (process.env.ANTHROPIC_API_KEY) {
    map.set('anthropic', createAnthropicClient())
  }
  if (process.env.FAL_KEY) {
    map.set('fal-ai', createFalAiClient())
  }
  if (process.env.OPENAI_API_KEY) {
    map.set('openai', createOpenAiClient())
  }
  if (process.env.GOOGLE_GEMINI_API_KEY) {
    map.set('google-gemini', createGoogleGeminiClient())
  }
  if (process.env.FREEPIK_API_KEY) {
    map.set('freepik', createFreepikClient())
  }
  if (process.env.ELEVENLABS_API_KEY) {
    map.set('elevenlabs', createElevenLabsClient())
  }
  return map
}
