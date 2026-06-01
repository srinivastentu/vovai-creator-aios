// Model Management System (MMS) — core type definitions.
// No imports from domain/. All types are AIOS-agnostic.

export type Capability =
  | 'text-generation'
  | 'text-scoring'
  | 'image-generation'
  | 'image-scoring'
  | 'voice-synthesis'
  | 'music-generation'
  | 'video-generation'
  | 'video-scoring'
  | 'embedding'

export type QualityTier = 'budget' | 'standard' | 'premium'

export type RoutingStrategy = 'cheapest' | 'fastest' | 'highest-quality' | 'specific'

export type ProviderStatus = 'available' | 'degraded' | 'unavailable'
export type ModelStatus = 'active' | 'deprecated' | 'disabled'
export type HealthState = 'healthy' | 'degraded' | 'down'
export type ApiPattern = 'sync' | 'async-poll' | 'async-webhook'
export type AuthType = 'api-key' | 'bearer' | 'custom'

export interface RateLimits {
  requestsPerMinute: number
  requestsPerDay: number
}

export interface ProviderDefinition {
  id: string
  name: string
  authType: AuthType
  authEnvVar: string
  baseUrl: string
  apiPattern: ApiPattern
  status: ProviderStatus
  rateLimits: RateLimits
  metadata: Record<string, unknown>
}

export interface ResolutionPricing {
  '512'?: number
  '1k'?: number
  '2k'?: number
  '4k'?: number
}

export interface PricingEntry {
  costPerUnit: number
  unit: 'image' | '1k-tokens-in' | '1k-tokens-out' | 'minute' | 'second' | 'character'
  byResolution?: ResolutionPricing
  /**
   * Optional per-1k-OUTPUT-token rate for token-billed text models. When set on a
   * `'1k-tokens-in'` entry the gateway bills `input × costPerUnit + output ×
   * costPerUnitOut`, so generation spend (output-dominated: producers, the
   * integrator) lands in the ledger accurately. Entries that omit it bill input
   * only — preserving the CR-5 judge convention (`text-scoring`, input-dominated)
   * and every existing single-unit entry unchanged.
   */
  costPerUnitOut?: number
}

export interface ParamSchema {
  type: 'string' | 'number' | 'boolean' | 'enum'
  required?: boolean
  enumValues?: readonly string[]
  description?: string
}

export interface SupportedParams {
  resolutions?: string[]
  maxTokensIn?: number
  maxTokensOut?: number
  supportsNegativePrompt?: boolean
  supportsStyleReference?: boolean
  supportsSeed?: boolean
  customParams?: Record<string, ParamSchema>
}

export interface ModelDefinition {
  id: string
  name: string
  providerId: string
  capabilities: Capability[]
  qualityTier: QualityTier
  pricing: Partial<Record<Capability, PricingEntry>>
  supportedParams: SupportedParams
  status: ModelStatus
  apiModelId: string
  metadata: Record<string, unknown>
}

export interface GatewayPreferences {
  modelId?: string
  providerId?: string
  qualityTier?: QualityTier
  strategy?: RoutingStrategy
  maxCostUsd?: number
  timeoutMs?: number
}

export interface GatewayContext {
  projectId?: string
  stageId?: string
  iterationNumber?: number
  tournamentRound?: number
  callerTag?: string
}

export interface GatewayRequestParams {
  prompt?: string
  width?: number
  height?: number
  content?: string
  [key: string]: unknown
}

export interface GatewayRequest {
  capability: Capability
  params: GatewayRequestParams
  preferences: GatewayPreferences
  context: GatewayContext
}

export interface GatewayResult {
  filePath?: string
  content?: string
  dimensions?: { width: number; height: number }
  mimeType?: string
  fileSizeBytes?: number
  revisedPrompt?: string
  characters?: number
  grade?: Record<string, unknown>
  [key: string]: unknown
}

export interface GatewayCost {
  costUsd: number
  tokensIn?: number
  tokensOut?: number
  durationMs: number
  unit: string
}

export interface GatewayResponse {
  success: boolean
  modelId: string
  providerId: string
  capability: Capability
  result: GatewayResult
  cost: GatewayCost
  error?: string
  metadata: Record<string, unknown>
}

export interface CostRecord {
  id: string
  timestamp: string
  modelId: string
  providerId: string
  capability: Capability
  success: boolean
  costUsd: number
  durationMs: number
  tokensIn?: number
  tokensOut?: number
  resolution?: string
  context: GatewayContext
  error?: string
}

export interface CostSummary {
  totalCostUsd: number
  callCount: number
  successCount: number
  failureCount: number
  avgCostUsd: number
  successRate: number
  totalTokensIn: number
  totalTokensOut: number
  totalDurationMs: number
}

export interface ModelCostSummary {
  modelId: string
  providerId: string
  callCount: number
  totalCostUsd: number
  avgCostUsd: number
  avgDurationMs: number
  successRate: number
}

export interface HealthStatus {
  providerId: string
  status: HealthState
  successRate: number
  avgLatencyMs: number
  sampleSize: number
  lastError?: string
  lastChecked: string
}
