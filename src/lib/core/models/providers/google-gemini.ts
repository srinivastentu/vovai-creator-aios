import type { Capability } from '../types'
import {
  failure as sharedFailure,
  fetchWithTimeout,
  readErrorDetail,
  saveBase64ToDisk,
} from './shared'
import type { HealthCheckResult, ProviderClient, ProviderResult } from './types'

const PROVIDER_ID = 'google-gemini'
const DEFAULT_TIMEOUT_MS = 120_000
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'

const ASPECT_DIMS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
}

const PREFIX_SLUGS: Array<{ match: string; slug: string }> = [
  { match: 'gemini-3.1-flash-image', slug: 'google-nanobanana-2' },
  { match: 'gemini-3-pro-image', slug: 'google-nanobanana-pro' },
  { match: 'imagen-4-fast', slug: 'google-imagen-4-fast' },
  { match: 'imagen-4-standard', slug: 'google-imagen-4-standard' },
  { match: 'imagen-4.0-fast', slug: 'google-imagen-4-fast' },
  { match: 'imagen-4.0-generate', slug: 'google-imagen-4-standard' },
]

const failure = (error: string, startedAt: number): ProviderResult =>
  sharedFailure(PROVIDER_ID, Date.now() - startedAt, error)

const slugFor = (modelApiId: string): string => {
  for (const { match, slug } of PREFIX_SLUGS) {
    if (modelApiId.startsWith(match)) return slug
  }
  return `google-${modelApiId.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
}

const mapAspectRatio = (width?: number, height?: number): AspectRatio => {
  if (!width || !height) return '1:1'
  const max = Math.max(width, height)
  if (Math.abs(width - height) / max < 0.1) return '1:1'
  if (width > height * 1.3) return '16:9'
  if (height > width * 1.3) return '9:16'
  if (width > height) return '4:3'
  return '3:4'
}

const mapHttpError = (status: number, detail: string): string => {
  if (status === 429) return `Rate limited: ${detail}`
  if (status >= 500) return `Server error ${status}: ${detail}`
  return `HTTP ${status}: ${detail}`
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType?: string; data?: string }
  inline_data?: { mime_type?: string; data?: string }
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>
}

interface ImagenResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string
    mimeType?: string
  }>
}

const extractInlineImage = (
  parts: GeminiPart[],
): { data: string; mimeType: string; text?: string } | undefined => {
  let text: string | undefined
  let imageData: string | undefined
  let mimeType = 'image/png'
  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data
    const data = inline?.data
    const mt =
      (p.inlineData?.mimeType ?? p.inline_data?.mime_type) || undefined
    if (data && !imageData) {
      imageData = data
      if (mt) mimeType = mt
    }
    if (typeof p.text === 'string' && !text) text = p.text
  }
  if (!imageData) return undefined
  return { data: imageData, mimeType, text }
}

export const createGoogleGeminiClient = (): ProviderClient => {
  const callGeminiNative = async (
    modelApiId: string,
    params: Record<string, unknown>,
    apiKey: string,
    startedAt: number,
  ): Promise<ProviderResult> => {
    const prompt = typeof params.prompt === 'string' ? params.prompt : ''
    if (!prompt) return failure('prompt is required', startedAt)

    const width = typeof params.width === 'number' ? params.width : 1024
    const height = typeof params.height === 'number' ? params.height : 1024
    const outputDir =
      typeof params.outputDir === 'string' ? params.outputDir : './output/images'
    const timeoutMs =
      typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS
    const abortSignal =
      params.abortSignal instanceof AbortSignal ? params.abortSignal : undefined

    const url = `${BASE_URL}/${encodeURIComponent(modelApiId)}:generateContent?key=${encodeURIComponent(apiKey)}`
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 1.0,
      },
    }

    let apiRes: Response
    try {
      apiRes = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

    if (!apiRes.ok) {
      const detail = await readErrorDetail(apiRes)
      return failure(mapHttpError(apiRes.status, detail), startedAt)
    }

    let parsed: GeminiResponse
    try {
      parsed = (await apiRes.json()) as GeminiResponse
    } catch (err) {
      return failure(
        `Invalid JSON response: ${err instanceof Error ? err.message : String(err)}`,
        startedAt,
      )
    }

    const candidate = parsed.candidates?.[0]
    if (!candidate) {
      return failure('No candidates returned from Gemini', startedAt)
    }
    const parts = candidate.content?.parts ?? []
    const extracted = extractInlineImage(parts)
    if (!extracted) {
      return failure('No inline image data in Gemini response', startedAt)
    }

    try {
      const saved = await saveBase64ToDisk(
        extracted.data,
        outputDir,
        slugFor(modelApiId),
        extracted.mimeType,
      )
      return {
        success: true,
        rawResponse: parsed as unknown as Record<string, unknown>,
        filePath: saved.filePath,
        dimensions: { width, height },
        mimeType: saved.mimeType,
        fileSizeBytes: saved.fileSizeBytes,
        revisedPrompt: extracted.text ?? prompt,
        durationMs: Date.now() - startedAt,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return failure(msg, startedAt)
    }
  }

  const callImagen = async (
    modelApiId: string,
    params: Record<string, unknown>,
    apiKey: string,
    startedAt: number,
  ): Promise<ProviderResult> => {
    const prompt = typeof params.prompt === 'string' ? params.prompt : ''
    if (!prompt) return failure('prompt is required', startedAt)

    const width = typeof params.width === 'number' ? params.width : undefined
    const height = typeof params.height === 'number' ? params.height : undefined
    const outputDir =
      typeof params.outputDir === 'string' ? params.outputDir : './output/images'
    const timeoutMs =
      typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS
    const abortSignal =
      params.abortSignal instanceof AbortSignal ? params.abortSignal : undefined

    const aspectRatio = mapAspectRatio(width, height)
    const url = `${BASE_URL}/${encodeURIComponent(modelApiId)}:predict?key=${encodeURIComponent(apiKey)}`
    const body = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
        outputOptions: { mimeType: 'image/png' },
      },
    }

    let apiRes: Response
    try {
      apiRes = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

    if (!apiRes.ok) {
      const detail = await readErrorDetail(apiRes)
      return failure(mapHttpError(apiRes.status, detail), startedAt)
    }

    let parsed: ImagenResponse
    try {
      parsed = (await apiRes.json()) as ImagenResponse
    } catch (err) {
      return failure(
        `Invalid JSON response: ${err instanceof Error ? err.message : String(err)}`,
        startedAt,
      )
    }

    const pred = parsed.predictions?.[0]
    if (!pred || !pred.bytesBase64Encoded) {
      return failure('No predictions returned from Imagen', startedAt)
    }

    const mimeType = pred.mimeType ?? 'image/png'
    try {
      const saved = await saveBase64ToDisk(
        pred.bytesBase64Encoded,
        outputDir,
        slugFor(modelApiId),
        mimeType,
      )
      return {
        success: true,
        rawResponse: parsed as unknown as Record<string, unknown>,
        filePath: saved.filePath,
        dimensions: ASPECT_DIMS[aspectRatio],
        mimeType: saved.mimeType,
        fileSizeBytes: saved.fileSizeBytes,
        revisedPrompt: prompt,
        durationMs: Date.now() - startedAt,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return failure(msg, startedAt)
    }
  }

  const execute = async (
    modelApiId: string,
    capability: Capability,
    params: Record<string, unknown>,
  ): Promise<ProviderResult> => {
    const startedAt = Date.now()
    if (capability !== 'image-generation') {
      return failure(`Unsupported capability: ${capability}`, startedAt)
    }
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) return failure('GOOGLE_GEMINI_API_KEY not set', startedAt)

    if (modelApiId.startsWith('gemini-')) {
      return callGeminiNative(modelApiId, params, apiKey, startedAt)
    }
    if (modelApiId.startsWith('imagen-')) {
      return callImagen(modelApiId, params, apiKey, startedAt)
    }
    return failure(`Unknown Google Gemini model: ${modelApiId}`, startedAt)
  }

  const checkHealth = async (): Promise<HealthCheckResult> => {
    const checkedAt = new Date().toISOString()
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return {
        providerId: PROVIDER_ID,
        state: 'down',
        latencyMs: 0,
        checkedAt,
        error: 'GOOGLE_GEMINI_API_KEY not set',
      }
    }
    return { providerId: PROVIDER_ID, state: 'healthy', latencyMs: 0, checkedAt }
  }

  return { providerId: PROVIDER_ID, execute, checkHealth }
}
