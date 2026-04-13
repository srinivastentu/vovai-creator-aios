import type { Capability } from '../types'
import {
  downloadAndSave,
  failure as sharedFailure,
  fetchWithTimeout,
  pollUntilComplete,
  readErrorDetail,
} from './shared'
import type { HealthCheckResult, ProviderClient, ProviderResult } from './types'

const PROVIDER_ID = 'freepik'
const DEFAULT_TIMEOUT_MS = 300_000
const SUBMIT_TIMEOUT_MS = 30_000
const BASE = 'https://api.freepik.com'

const ENDPOINTS: Record<string, { path: string; slug: string }> = {
  mystic: { path: '/v1/ai/mystic', slug: 'freepik-mystic' },
}

type AspectString =
  | 'square_1_1'
  | 'widescreen_16_9'
  | 'social_story_9_16'
  | 'classic_4_3'
  | 'traditional_3_4'

const ASPECT_DIMS: Record<AspectString, { width: number; height: number }> = {
  square_1_1: { width: 1024, height: 1024 },
  widescreen_16_9: { width: 1344, height: 768 },
  social_story_9_16: { width: 768, height: 1344 },
  classic_4_3: { width: 1024, height: 768 },
  traditional_3_4: { width: 768, height: 1024 },
}

const mapAspectRatio = (width?: number, height?: number): AspectString => {
  if (!width || !height) return 'square_1_1'
  const max = Math.max(width, height)
  if (Math.abs(width - height) / max < 0.1) return 'square_1_1'
  if (width > height * 1.6) return 'widescreen_16_9'
  if (height > width * 1.6) return 'social_story_9_16'
  if (width > height) return 'classic_4_3'
  return 'traditional_3_4'
}

const failure = (error: string, startedAt: number): ProviderResult =>
  sharedFailure(PROVIDER_ID, Date.now() - startedAt, error)

const mapHttpError = (status: number, detail: string): string => {
  if (status === 429) return `Rate limited: ${detail}`
  if (status >= 500) return `Server error ${status}: ${detail}`
  return `HTTP ${status}: ${detail}`
}

interface SubmitResponse {
  data?: { task_id?: string; status?: string; generated?: string[] }
}

interface PollBody {
  data?: { task_id?: string; status?: string; generated?: string[] }
}

export const createFreepikClient = (): ProviderClient => {
  const execute = async (
    modelApiId: string,
    capability: Capability,
    params: Record<string, unknown>,
  ): Promise<ProviderResult> => {
    const startedAt = Date.now()

    if (capability !== 'image-generation') {
      return failure(`Unsupported capability: ${capability}`, startedAt)
    }

    const apiKey = process.env.FREEPIK_API_KEY
    if (!apiKey) return failure('FREEPIK_API_KEY not set', startedAt)

    const endpoint = ENDPOINTS[modelApiId]
    if (!endpoint) return failure(`Unknown Freepik model: ${modelApiId}`, startedAt)

    const prompt = typeof params.prompt === 'string' ? params.prompt : ''
    if (!prompt) return failure('prompt is required', startedAt)

    const negativePrompt =
      typeof params.negativePrompt === 'string' ? params.negativePrompt : undefined
    const width = typeof params.width === 'number' ? params.width : undefined
    const height = typeof params.height === 'number' ? params.height : undefined
    const outputDir =
      typeof params.outputDir === 'string' ? params.outputDir : './output/images'
    const timeoutMs =
      typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS
    const abortSignal =
      params.abortSignal instanceof AbortSignal ? params.abortSignal : undefined

    const imageSize = mapAspectRatio(width, height)
    const submitBody: Record<string, unknown> = {
      prompt,
      num_images: 1,
      image_size: imageSize,
      webhook_url: null,
    }
    if (negativePrompt) submitBody.negative_prompt = negativePrompt

    const headers: Record<string, string> = {
      'x-freepik-api-key': apiKey,
      'Content-Type': 'application/json',
    }

    let submitRes: Response
    try {
      submitRes = await fetchWithTimeout(
        `${BASE}${endpoint.path}`,
        { method: 'POST', headers, body: JSON.stringify(submitBody) },
        Math.min(SUBMIT_TIMEOUT_MS, timeoutMs),
        abortSignal,
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return failure(`Timeout after ${SUBMIT_TIMEOUT_MS}ms`, startedAt)
      }
      const msg = err instanceof Error ? err.message : String(err)
      return failure(`Network error: ${msg}`, startedAt)
    }

    if (!submitRes.ok) {
      const detail = await readErrorDetail(submitRes)
      return failure(mapHttpError(submitRes.status, detail), startedAt)
    }

    let submitParsed: SubmitResponse
    try {
      submitParsed = (await submitRes.json()) as SubmitResponse
    } catch (err) {
      return failure(
        `Invalid JSON response: ${err instanceof Error ? err.message : String(err)}`,
        startedAt,
      )
    }

    const taskId = submitParsed.data?.task_id
    if (!taskId) return failure('task_id missing in submit response', startedAt)

    const remainingAfterSubmit = Math.max(
      1,
      timeoutMs - (Date.now() - startedAt),
    )

    const poll = await pollUntilComplete({
      pollUrl: `${BASE}${endpoint.path}/${encodeURIComponent(taskId)}`,
      headers: { 'x-freepik-api-key': apiKey },
      isComplete: (body): boolean => {
        const b = body as PollBody
        return b?.data?.status === 'COMPLETED'
      },
      isFailed: (body): boolean => {
        const b = body as PollBody
        return b?.data?.status === 'FAILED'
      },
      extractResult: (body): unknown => {
        const b = body as PollBody
        return b?.data?.generated
      },
      signal: abortSignal,
      timeoutMs: remainingAfterSubmit,
    })

    if (!poll.success) {
      return failure(poll.error ?? 'Polling failed', startedAt)
    }

    const generated = Array.isArray(poll.result) ? (poll.result as string[]) : []
    if (generated.length === 0 || typeof generated[0] !== 'string') {
      return failure('No generated URLs in completed task', startedAt)
    }

    const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt))
    try {
      const saved = await downloadAndSave(
        generated[0],
        outputDir,
        endpoint.slug,
        { timeoutMs: remaining, externalSignal: abortSignal },
      )
      return {
        success: true,
        rawResponse: {
          submit: submitParsed as unknown as Record<string, unknown>,
          poll: (poll.lastBody ?? {}) as Record<string, unknown>,
        },
        filePath: saved.filePath,
        dimensions: ASPECT_DIMS[imageSize],
        mimeType: saved.mimeType,
        fileSizeBytes: saved.fileSizeBytes,
        revisedPrompt: prompt,
        durationMs: Date.now() - startedAt,
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return failure(`Image download timeout after ${remaining}ms`, startedAt)
      }
      const msg = err instanceof Error ? err.message : String(err)
      return failure(msg, startedAt)
    }
  }

  const checkHealth = async (): Promise<HealthCheckResult> => {
    const checkedAt = new Date().toISOString()
    if (!process.env.FREEPIK_API_KEY) {
      return {
        providerId: PROVIDER_ID,
        state: 'down',
        latencyMs: 0,
        checkedAt,
        error: 'FREEPIK_API_KEY not set',
      }
    }
    return { providerId: PROVIDER_ID, state: 'healthy', latencyMs: 0, checkedAt }
  }

  return { providerId: PROVIDER_ID, execute, checkHealth }
}
