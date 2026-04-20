import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { OUTPUT_DIRS } from '../../storage/output-paths'
import type { Capability, HealthState } from '../types'
import { failure as sharedFailure, maskApiKey } from './shared'
import type { HealthCheckResult, ProviderClient, ProviderResult } from './types'

const PROVIDER_ID = 'elevenlabs'
const DEFAULT_BASE_URL = 'https://api.elevenlabs.io'
const DEFAULT_TIMEOUT_MS = 60_000
const HEALTH_TIMEOUT_MS = 10_000
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

export interface ElevenLabsClientOptions {
  apiKey?: string
  baseUrl?: string
  outputDir?: string
  defaultTimeoutMs?: number
  fetchImpl?: FetchImpl
}

interface VoiceSettingsInput {
  stability?: number
  similarityBoost?: number
  style?: number
  useSpeakerBoost?: boolean
  speed?: number
}

const mapVoiceSettings = (
  input?: VoiceSettingsInput,
): Record<string, unknown> | undefined => {
  if (!input) return undefined
  const out: Record<string, unknown> = {}
  if (typeof input.stability === 'number') out.stability = input.stability
  if (typeof input.similarityBoost === 'number') out.similarity_boost = input.similarityBoost
  if (typeof input.style === 'number') out.style = input.style
  if (typeof input.useSpeakerBoost === 'boolean') out.use_speaker_boost = input.useSpeakerBoost
  if (typeof input.speed === 'number') out.speed = input.speed
  return Object.keys(out).length > 0 ? out : undefined
}

const truncate = (s: string, max = 500): string =>
  s.length <= max ? s : `${s.slice(0, max)}…`

const scrubKey = (s: string, apiKey: string): string => {
  if (!apiKey) return s
  return s.split(apiKey).join('***')
}

const safeErrorBody = async (res: Response, apiKey: string): Promise<string> => {
  try {
    const txt = await res.text()
    return scrubKey(maskApiKey(truncate(txt)), apiKey)
  } catch {
    return ''
  }
}

export const createElevenLabsClient = (
  opts: ElevenLabsClientOptions = {},
): ProviderClient => {
  const apiKey = opts.apiKey ?? process.env.ELEVENLABS_API_KEY ?? ''
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL
  const outputDir = opts.outputDir ?? OUTPUT_DIRS.voice
  const defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS
  const doFetch: FetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init))

  const failure = (error: string, startedAt: number): ProviderResult =>
    sharedFailure(PROVIDER_ID, Date.now() - startedAt, scrubKey(maskApiKey(error), apiKey))

  const fetchWithAbort = async (
    url: string,
    init: RequestInit,
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onExternal = (): void => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', onExternal, { once: true })
    }
    try {
      return await doFetch(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      if (externalSignal) externalSignal.removeEventListener('abort', onExternal)
    }
  }

  const execute = async (
    modelApiId: string,
    capability: Capability,
    params: Record<string, unknown>,
  ): Promise<ProviderResult> => {
    const startedAt = Date.now()

    if (capability !== 'voice-synthesis') {
      return failure(`Unsupported capability: ${capability}`, startedAt)
    }
    if (!apiKey) {
      return failure('ELEVENLABS_API_KEY not set', startedAt)
    }
    const text = typeof params.text === 'string' ? params.text : ''
    if (!text) return failure('text is required', startedAt)
    const voiceId = typeof params.voiceId === 'string' ? params.voiceId : ''
    if (!voiceId) return failure('voiceId is required', startedAt)

    const outputFormat =
      typeof params.outputFormat === 'string' ? params.outputFormat : DEFAULT_OUTPUT_FORMAT
    const languageCode =
      typeof params.languageCode === 'string' ? params.languageCode : undefined
    const voiceSettings =
      typeof params.voiceSettings === 'object' && params.voiceSettings !== null
        ? (params.voiceSettings as VoiceSettingsInput)
        : undefined
    const timeoutMs =
      typeof params.timeoutMs === 'number' ? params.timeoutMs : defaultTimeoutMs
    const abortSignal =
      params.abortSignal instanceof AbortSignal ? params.abortSignal : undefined
    const overrideOutputDir =
      typeof params.outputDir === 'string' ? params.outputDir : outputDir

    const url =
      `${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}` +
      `?output_format=${encodeURIComponent(outputFormat)}`
    const body: Record<string, unknown> = {
      text,
      model_id: modelApiId,
    }
    const mappedSettings = mapVoiceSettings(voiceSettings)
    if (mappedSettings) body.voice_settings = mappedSettings
    if (languageCode) body.language_code = languageCode

    let res: Response
    try {
      res = await fetchWithAbort(
        url,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
        abortSignal,
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return failure(`Timeout after ${timeoutMs}ms`, startedAt)
      }
      const msg = err instanceof Error ? err.message : String(err)
      return failure(`Network error: ${msg}`, startedAt)
    }

    if (!res.ok) {
      const detail = await safeErrorBody(res, apiKey)
      if (res.status === 401 || res.status === 403) {
        return failure(`Authentication failed (HTTP ${res.status}): ${detail}`, startedAt)
      }
      if (res.status === 429) {
        return failure(`Rate limited: ${detail}`, startedAt)
      }
      if (res.status >= 500) {
        return failure(`Server error ${res.status}: ${detail}`, startedAt)
      }
      return failure(`HTTP ${res.status}: ${detail}`, startedAt)
    }

    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    if (!contentType.startsWith('audio/')) {
      return failure(
        `Unexpected content-type '${contentType}' for voice-synthesis`,
        startedAt,
      )
    }

    let buffer: Buffer
    try {
      buffer = Buffer.from(await res.arrayBuffer())
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return failure(`Failed to read response body: ${msg}`, startedAt)
    }
    if (buffer.byteLength === 0) {
      return failure('Empty audio response', startedAt)
    }

    const filename = `${PROVIDER_ID}-${modelApiId}-${randomUUID()}.mp3`
    const filePath = join(overrideOutputDir, filename)
    try {
      await mkdir(overrideOutputDir, { recursive: true })
      await writeFile(filePath, buffer)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return failure(`File write failed: ${msg}`, startedAt)
    }

    return {
      success: true,
      rawResponse: {
        modelApiId,
        voiceId,
        outputFormat,
        contentType,
      },
      filePath,
      mimeType: 'audio/mpeg',
      fileSizeBytes: buffer.byteLength,
      characters: text.length,
      durationMs: Date.now() - startedAt,
    }
  }

  const checkHealth = async (): Promise<HealthCheckResult> => {
    const checkedAt = new Date().toISOString()
    if (!apiKey) {
      return {
        providerId: PROVIDER_ID,
        state: 'down',
        latencyMs: 0,
        checkedAt,
        error: 'ELEVENLABS_API_KEY not set',
      }
    }
    const startedAt = Date.now()
    try {
      const res = await fetchWithAbort(
        `${baseUrl}/v1/user`,
        { method: 'GET', headers: { 'xi-api-key': apiKey } },
        HEALTH_TIMEOUT_MS,
      )
      const latencyMs = Date.now() - startedAt
      let state: HealthState
      if (res.ok) state = 'healthy'
      else if (res.status === 401 || res.status === 403) state = 'down'
      else if (res.status >= 500) state = 'degraded'
      else state = 'down'
      return { providerId: PROVIDER_ID, state, latencyMs, checkedAt }
    } catch {
      return {
        providerId: PROVIDER_ID,
        state: 'down',
        latencyMs: Date.now() - startedAt,
        checkedAt,
      }
    }
  }

  return { providerId: PROVIDER_ID, execute, checkHealth }
}
