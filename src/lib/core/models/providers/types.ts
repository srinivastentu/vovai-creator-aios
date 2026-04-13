import type { Capability, HealthState } from '../types'

export interface ProviderResult {
  success: boolean
  rawResponse: Record<string, unknown>
  filePath?: string
  content?: string
  dimensions?: { width: number; height: number }
  mimeType?: string
  fileSizeBytes?: number
  revisedPrompt?: string
  tokensIn?: number
  tokensOut?: number
  durationMs: number
  error?: string
}

export interface HealthCheckResult {
  providerId: string
  state: HealthState
  latencyMs: number
  checkedAt: string
  error?: string
}

export interface ProviderClient {
  providerId: string
  execute(
    modelApiId: string,
    capability: Capability,
    params: Record<string, unknown>,
  ): Promise<ProviderResult>
  checkHealth(): Promise<HealthCheckResult>
}
