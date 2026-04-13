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
    status: 'active',
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
    apiModelId: 'gemini-3-pro-image',
    metadata: {},
  },
  {
    id: 'imagen-4-fast',
    name: 'Imagen 4 Fast',
    providerId: 'google-gemini',
    capabilities: ['image-generation'],
    qualityTier: 'budget',
    pricing: {
      'image-generation': { costPerUnit: 0.02, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024'],
      supportsNegativePrompt: true,
      supportsSeed: true,
    },
    status: 'active',
    apiModelId: 'imagen-4-fast',
    metadata: {},
  },
  {
    id: 'imagen-4-standard',
    name: 'Imagen 4 Standard',
    providerId: 'google-gemini',
    capabilities: ['image-generation'],
    qualityTier: 'standard',
    pricing: {
      'image-generation': { costPerUnit: 0.04, unit: 'image' },
    },
    supportedParams: {
      resolutions: ['1024x1024', '2048x2048'],
      supportsNegativePrompt: true,
      supportsSeed: true,
    },
    status: 'active',
    apiModelId: 'imagen-4-standard',
    metadata: {},
  },

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
    status: 'active',
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
    status: 'active',
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
]
