import { OUTPUT_DIRS } from '../../storage/output-paths'
import type { Capability } from '../types'
import {
  downloadAndSave,
  failure as sharedFailure,
  fetchWithTimeout,
  readErrorDetail,
} from './shared'
import type { HealthCheckResult, ProviderClient, ProviderResult } from './types'

const PROVIDER_ID = 'fal-ai'
const DEFAULT_TIMEOUT_MS = 120_000

const ENDPOINTS: Record<string, { url: string; slug: string }> = {
  'fal-ai/flux/dev': { url: 'https://fal.run/fal-ai/flux/dev', slug: 'flux-dev' },
  'fal-ai/flux-pro/v1.1': {
    url: 'https://fal.run/fal-ai/flux-pro/v1.1',
    slug: 'flux-pro',
  },
}

const failure = (error: string, startedAt: number): ProviderResult =>
  sharedFailure(PROVIDER_ID, Date.now() - startedAt, error)

interface FalImage {
  url: string
  width?: number
  height?: number
  content_type?: string
}

interface FalResponse {
  images?: FalImage[]
  seed?: number
  prompt?: string
  [k: string]: unknown
}

const buildPrompt = (prompt: string, negativePrompt?: string): string =>
  negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}` : prompt

export const createFalAiClient = (): ProviderClient => {
  const execute = async (
    modelApiId: string,
    capability: Capability,
    params: Record<string, unknown>,
  ): Promise<ProviderResult> => {
    const startedAt = Date.now()

    if (capability !== 'image-generation') {
      return failure(`Unsupported capability: ${capability}`, startedAt)
    }

    const apiKey = process.env.FAL_KEY
    if (!apiKey) {
      return failure('FAL_KEY not set', startedAt)
    }

    const endpoint = ENDPOINTS[modelApiId]
    if (!endpoint) {
      return failure(`Unknown fal.ai model: ${modelApiId}`, startedAt)
    }

    const prompt = typeof params.prompt === 'string' ? params.prompt : ''
    if (!prompt) return failure('prompt is required', startedAt)
    const negativePrompt =
      typeof params.negativePrompt === 'string' ? params.negativePrompt : undefined
    const width = typeof params.width === 'number' ? params.width : 1024
    const height = typeof params.height === 'number' ? params.height : 1024
    const seed = typeof params.seed === 'number' ? params.seed : undefined
    const outputDir =
      typeof params.outputDir === 'string' ? params.outputDir : OUTPUT_DIRS.image
    const timeoutMs =
      typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS
    const abortSignal =
      params.abortSignal instanceof AbortSignal ? params.abortSignal : undefined

    const finalPrompt = buildPrompt(prompt, negativePrompt)
    const body: Record<string, unknown> = {
      prompt: finalPrompt,
      image_size: { width, height },
      num_images: 1,
    }
    if (seed !== undefined) body.seed = seed

    let apiRes: Response
    try {
      apiRes = await fetchWithTimeout(
        endpoint.url,
        {
          method: 'POST',
          headers: {
            Authorization: `Key ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
        abortSignal,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (err instanceof Error && err.name === 'AbortError') {
        return failure(`Timeout after ${timeoutMs}ms`, startedAt)
      }
      return failure(`Network error: ${msg}`, startedAt)
    }

    if (!apiRes.ok) {
      const detail = await readErrorDetail(apiRes)
      if (apiRes.status === 429) {
        return failure(`Rate limited: ${detail}`, startedAt)
      }
      if (apiRes.status >= 500) {
        return failure(`Server error ${apiRes.status}: ${detail}`, startedAt)
      }
      return failure(`HTTP ${apiRes.status}: ${detail}`, startedAt)
    }

    let parsed: FalResponse
    try {
      parsed = (await apiRes.json()) as FalResponse
    } catch (err) {
      return failure(
        `Invalid JSON response: ${err instanceof Error ? err.message : String(err)}`,
        startedAt,
      )
    }

    const images = parsed.images ?? []
    if (images.length === 0) {
      return failure('No images returned from fal.ai', startedAt)
    }
    const image = images[0]
    if (!image.url) return failure('Image URL missing in response', startedAt)

    const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt))
    const mimeTypeHint = image.content_type ?? 'image/png'
    try {
      const saved = await downloadAndSave(
        image.url,
        outputDir,
        `fal-ai-${endpoint.slug}`,
        { timeoutMs: remaining, externalSignal: abortSignal, mimeTypeHint },
      )
      return {
        success: true,
        rawResponse: parsed as Record<string, unknown>,
        filePath: saved.filePath,
        dimensions: {
          width: image.width ?? width,
          height: image.height ?? height,
        },
        mimeType: saved.mimeType,
        fileSizeBytes: saved.fileSizeBytes,
        revisedPrompt: parsed.prompt ?? finalPrompt,
        durationMs: Date.now() - startedAt,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (err instanceof Error && err.name === 'AbortError') {
        return failure(`Image download timeout after ${remaining}ms`, startedAt)
      }
      return failure(msg, startedAt)
    }
  }

  const checkHealth = async (): Promise<HealthCheckResult> => {
    const checkedAt = new Date().toISOString()
    if (!process.env.FAL_KEY) {
      return {
        providerId: PROVIDER_ID,
        state: 'down',
        latencyMs: 0,
        checkedAt,
        error: 'FAL_KEY not set',
      }
    }
    return { providerId: PROVIDER_ID, state: 'healthy', latencyMs: 0, checkedAt }
  }

  return { providerId: PROVIDER_ID, execute, checkHealth }
}
