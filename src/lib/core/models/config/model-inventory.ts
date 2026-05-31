import type { ModelDefinition, ProviderDefinition } from '../types'

export const getDefaultProviders = (): ProviderDefinition[] => [
  {
    id: 'google-gemini',
    name: 'Google Gemini API',
    authType: 'api-key',
    authEnvVar: 'GOOGLE_GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiPattern: 'sync',
    status: 'available',
    rateLimits: { requestsPerMinute: 60, requestsPerDay: 10000 },
    metadata: {},
  },
  {
    id: 'fal-ai',
    name: 'fal.ai',
    authType: 'bearer',
    authEnvVar: 'FAL_KEY',
    baseUrl: 'https://fal.run',
    apiPattern: 'sync',
    status: 'available',
    rateLimits: { requestsPerMinute: 60, requestsPerDay: 10000 },
    metadata: {},
  },
  {
    id: 'openai',
    name: 'OpenAI',
    authType: 'api-key',
    authEnvVar: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com',
    apiPattern: 'sync',
    status: 'available',
    rateLimits: { requestsPerMinute: 500, requestsPerDay: 10000 },
    metadata: {},
  },
  {
    id: 'freepik',
    name: 'Freepik API',
    authType: 'api-key',
    authEnvVar: 'FREEPIK_API_KEY',
    baseUrl: 'https://api.freepik.com',
    apiPattern: 'async-poll',
    status: 'available',
    rateLimits: { requestsPerMinute: 30, requestsPerDay: 5000 },
    metadata: {},
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    authType: 'api-key',
    authEnvVar: 'ELEVENLABS_API_KEY',
    baseUrl: 'https://api.elevenlabs.io',
    apiPattern: 'sync',
    status: 'available',
    rateLimits: { requestsPerMinute: 120, requestsPerDay: 20000 },
    metadata: { authHeaderName: 'xi-api-key' },
  },
]

export const getDefaultModels = (): ModelDefinition[] => [
  // Google Gemini
  {
    id: 'nanobanan-2',
    name: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    providerId: 'google-gemini',
    capabilities: ['image-generation'],
    qualityTier: 'budget',
    pricing: {
      'image-generation': {
        costPerUnit: 0.067,
        unit: 'image',
        byResolution: { '1k': 0.067 },
      },
    },
    supportedParams: {
      resolutions: ['1024x1024'],
      supportsNegativePrompt: false,
      supportsSeed: true,
    },
    // Disabled: free-tier Gemini API for gemini-3.1-flash-image-preview returns
    // 503 UNAVAILABLE on every image-generation call. NanoBanana Pro works; keep it.
    // Re-enable when the preview model stabilizes or with paid-tier access.
    status: 'disabled',
    apiModelId: 'gemini-3.1-flash-image-preview',
    metadata: {},
  },
  {
    id: 'nanobanan-pro',
    name: 'Nano Banana Pro (Gemini 3 Pro Image)',
    providerId: 'google-gemini',
    capabilities: ['image-generation'],
    qualityTier: 'premium',
    pricing: {
      'image-generation': {
        costPerUnit: 0.134,
        unit: 'image',
        byResolution: { '1k': 0.134 },
      },
    },
    supportedParams: {
      resolutions: ['1024x1024', '2048x2048'],
      supportsNegativePrompt: false,
      supportsSeed: true,
    },
    status: 'active',
    apiModelId: 'nano-banana-pro-preview',
    metadata: {},
  },
  // Gemini text models (CR-5) — text-generation + text-scoring (judges).
  // The action plan named gemini-1.5-pro-latest / gemini-1.5-flash, but the 1.5
  // family is retired on Google's v1beta API (verified via ListModels); these
  // are the current GA equivalents. MMS bills a single unit per (model,
  // capability) — we bill input tokens (the dominant volume for a judge call),
  // matching the gpt-4o-vision precedent; output tokens are not separately
  // billed in V1. Pricing reflects Google's per-1M input rates.
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    providerId: 'google-gemini',
    capabilities: ['text-generation', 'text-scoring'],
    qualityTier: 'premium',
    pricing: {
      'text-generation': { costPerUnit: 0.00125, unit: '1k-tokens-in' },
      'text-scoring': { costPerUnit: 0.00125, unit: '1k-tokens-in' },
    },
    supportedParams: {
      maxTokensIn: 1048576,
      maxTokensOut: 65536,
    },
    status: 'active',
    apiModelId: 'gemini-2.5-pro',
    metadata: {},
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    providerId: 'google-gemini',
    capabilities: ['text-generation', 'text-scoring'],
    qualityTier: 'standard',
    pricing: {
      'text-generation': { costPerUnit: 0.0003, unit: '1k-tokens-in' },
      'text-scoring': { costPerUnit: 0.0003, unit: '1k-tokens-in' },
    },
    supportedParams: {
      maxTokensIn: 1048576,
      maxTokensOut: 65536,
    },
    status: 'active',
    apiModelId: 'gemini-2.5-flash',
    metadata: {},
  },
  // Imagen 4 (fast/standard) intentionally omitted: Google's v1beta API rejects
  // `imagen-4-fast` / `imagen-4-standard` with 404 (not supported for predict).
  // Re-add with verified apiModelId (e.g. `imagen-4.0-*-001`) and paid-tier key.

  // fal.ai
  {
    id: 'flux-dev',
    name: 'Flux Dev via fal.ai',
    providerId: 'fal-ai',
    capabilities: ['image-generation'],
    qualityTier: 'budget',
    pricing: {
      'image-generation': { costPerUnit: 0.025, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024', '1792x1024', '1024x1792'],
      supportsNegativePrompt: true,
      supportsSeed: true,
    },
    status: 'active',
    apiModelId: 'fal-ai/flux/dev',
    metadata: {},
  },
  {
    id: 'flux-pro',
    name: 'Flux Pro 1.1 via fal.ai',
    providerId: 'fal-ai',
    capabilities: ['image-generation'],
    qualityTier: 'standard',
    pricing: {
      'image-generation': { costPerUnit: 0.05, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024', '1792x1024', '1024x1792'],
      supportsNegativePrompt: true,
      supportsSeed: true,
    },
    status: 'active',
    apiModelId: 'fal-ai/flux-pro/v1.1',
    metadata: {},
  },

  // OpenAI
  {
    id: 'dall-e-3-standard',
    name: 'DALL-E 3 Standard',
    providerId: 'openai',
    capabilities: ['image-generation'],
    qualityTier: 'standard',
    pricing: {
      'image-generation': { costPerUnit: 0.04, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024', '1792x1024', '1024x1792'],
      supportsNegativePrompt: false,
      supportsSeed: false,
    },
    status: 'active',
    apiModelId: 'dall-e-3',
    metadata: { quality: 'standard' },
  },
  {
    id: 'dall-e-3-hd',
    name: 'DALL-E 3 HD',
    providerId: 'openai',
    capabilities: ['image-generation'],
    qualityTier: 'premium',
    pricing: {
      'image-generation': { costPerUnit: 0.08, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024', '1792x1024', '1024x1792'],
      supportsNegativePrompt: false,
      supportsSeed: false,
    },
    status: 'active',
    apiModelId: 'dall-e-3',
    metadata: { quality: 'hd' },
  },
  {
    id: 'gpt-4o-vision',
    name: 'GPT-4o Vision',
    providerId: 'openai',
    capabilities: ['image-scoring'],
    qualityTier: 'premium',
    pricing: {
      'image-scoring': { costPerUnit: 0.0025, unit: '1k-tokens-in' },
    },
    supportedParams: {
      maxTokensIn: 128000,
      maxTokensOut: 16384,
    },
    status: 'active',
    apiModelId: 'gpt-4o',
    metadata: {},
  },
  {
    id: 'gpt-4o-mini-vision',
    name: 'GPT-4o Mini Vision',
    providerId: 'openai',
    capabilities: ['image-scoring'],
    qualityTier: 'standard',
    pricing: {
      'image-scoring': { costPerUnit: 0.00015, unit: '1k-tokens-in' },
    },
    supportedParams: {
      maxTokensIn: 128000,
      maxTokensOut: 16384,
    },
    status: 'active',
    apiModelId: 'gpt-4o-mini',
    metadata: {},
  },

  // Freepik
  // NanoBanana-via-Freepik: not exposed via Freepik REST API; use google-gemini client for NanoBanana.
  {
    id: 'freepik-nanobanan-2',
    name: 'NanoBanana 2 via Freepik',
    providerId: 'freepik',
    capabilities: ['image-generation'],
    qualityTier: 'standard',
    pricing: {
      'image-generation': { costPerUnit: 0.08, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024'],
      supportsNegativePrompt: false,
      supportsSeed: true,
    },
    status: 'disabled',
    apiModelId: 'nanobanana-2',
    metadata: {},
  },
  {
    id: 'freepik-nanobanan-pro',
    name: 'NanoBanana Pro via Freepik',
    providerId: 'freepik',
    capabilities: ['image-generation'],
    qualityTier: 'premium',
    pricing: {
      'image-generation': { costPerUnit: 0.15, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024', '2048x2048'],
      supportsNegativePrompt: false,
      supportsSeed: true,
    },
    status: 'disabled',
    apiModelId: 'nanobanana-pro',
    metadata: {},
  },
  {
    id: 'freepik-mystic',
    name: 'Mystic (Freepik exclusive)',
    providerId: 'freepik',
    capabilities: ['image-generation'],
    qualityTier: 'premium',
    pricing: {
      'image-generation': { costPerUnit: 0.1, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024', '2048x2048'],
      supportsNegativePrompt: true,
      supportsSeed: true,
    },
    status: 'active',
    apiModelId: 'mystic',
    metadata: {},
  },

  // ── ElevenLabs (voice-synthesis) ─────────────────────────────────────
  // Per-character pricing below is a conservative default. ElevenLabs bills
  // in credits with per-plan multipliers (see https://elevenlabs.io/pricing).
  // ParamSchema supports only primitive types; `voiceSettings` is a nested
  // object handled by the client at runtime and omitted from customParams.
  {
    id: 'eleven-turbo-v2-5',
    name: 'Eleven Turbo v2.5',
    providerId: 'elevenlabs',
    capabilities: ['voice-synthesis'],
    qualityTier: 'budget',
    pricing: {
      'voice-synthesis': { costPerUnit: 0.00005, unit: 'character' },
    },
    supportedParams: {
      customParams: {
        voiceId: { type: 'string', required: true, description: 'ElevenLabs voice_id' },
        outputFormat: { type: 'string', description: 'e.g. mp3_44100_128' },
        languageCode: { type: 'string' },
      },
    },
    status: 'active',
    apiModelId: 'eleven_turbo_v2_5',
    metadata: {},
  },
  {
    id: 'eleven-multilingual-v2',
    name: 'Eleven Multilingual v2',
    providerId: 'elevenlabs',
    capabilities: ['voice-synthesis'],
    qualityTier: 'standard',
    pricing: {
      'voice-synthesis': { costPerUnit: 0.0001, unit: 'character' },
    },
    supportedParams: {
      customParams: {
        voiceId: { type: 'string', required: true, description: 'ElevenLabs voice_id' },
        outputFormat: { type: 'string', description: 'e.g. mp3_44100_128' },
        languageCode: { type: 'string' },
      },
    },
    status: 'active',
    apiModelId: 'eleven_multilingual_v2',
    metadata: {},
  },
  // eleven_v3 availability not verified live as of Phase 5.1A planning.
  // Shipping disabled until 5.1E smoke-test confirms GA status for this account.
  {
    id: 'eleven-v3',
    name: 'Eleven v3 (alpha)',
    providerId: 'elevenlabs',
    capabilities: ['voice-synthesis'],
    qualityTier: 'premium',
    pricing: {
      'voice-synthesis': { costPerUnit: 0.0002, unit: 'character' },
    },
    supportedParams: {
      customParams: {
        voiceId: { type: 'string', required: true, description: 'ElevenLabs voice_id' },
        outputFormat: { type: 'string', description: 'e.g. mp3_44100_128' },
        languageCode: { type: 'string' },
      },
    },
    status: 'disabled',
    apiModelId: 'eleven_v3',
    metadata: {},
  },
]
