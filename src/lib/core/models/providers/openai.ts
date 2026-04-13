import OpenAI, { APIError } from 'openai'
import type { Capability } from '../types'
import { downloadAndSave, failure as sharedFailure } from './shared'
import type { HealthCheckResult, ProviderClient, ProviderResult } from './types'

const PROVIDER_ID = 'openai'
const DEFAULT_TIMEOUT_MS = 120_000

type DalleSize = '1024x1024' | '1792x1024' | '1024x1792'
type DalleQuality = 'standard' | 'hd'

const failure = (error: string, startedAt: number): ProviderResult =>
  sharedFailure(PROVIDER_ID, Date.now() - startedAt, error)

const mapSize = (width?: number, height?: number): DalleSize => {
  if (!width || !height) return '1024x1024'
  const ratio = width / height
  if (ratio > 1.3) return '1792x1024'
  if (ratio < 0.77) return '1024x1792'
  return '1024x1024'
}

const parseSize = (size: DalleSize): { width: number; height: number } => {
  const [w, h] = size.split('x').map((n) => Number.parseInt(n, 10))
  return { width: w, height: h }
}

const resolveQuality = (
  modelApiId: string,
  params: Record<string, unknown>,
): DalleQuality => {
  const q = params.quality
  if (q === 'hd' || q === 'standard') return q
  return modelApiId.toLowerCase().includes('hd') ? 'hd' : 'standard'
}

const buildImagePrompt = (
  prompt: string,
  style?: string,
  negativePrompt?: string,
): string => {
  let out = prompt
  if (style) out += `\n\nStyle: ${style}`
  if (negativePrompt) out += `\n\nDo NOT include: ${negativePrompt}`
  return out
}

const mapApiError = (
  err: unknown,
  timeoutMs: number,
): string => {
  if (err instanceof APIError) {
    const status = typeof err.status === 'number' ? err.status : 0
    const msg = err.message || 'API error'
    if (status === 429) return `Rate limited: ${msg}`
    if (status >= 500) return `Server error ${status}: ${msg}`
    if (status > 0) return `HTTP ${status}: ${msg}`
    return `API error: ${msg}`
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'APIUserAbortError') {
      return `Timeout after ${timeoutMs}ms`
    }
    return `Network error: ${err.message}`
  }
  return `Network error: ${String(err)}`
}

interface ImageGenerateResponse {
  data?: Array<{ url?: string; revised_prompt?: string }>
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: unknown
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

export const createOpenAiClient = (): ProviderClient => {
  let cachedClient: OpenAI | undefined

  const getClient = (apiKey: string): OpenAI => {
    if (!cachedClient) cachedClient = new OpenAI({ apiKey })
    return cachedClient
  }

  const handleImageGeneration = async (
    modelApiId: string,
    params: Record<string, unknown>,
    startedAt: number,
  ): Promise<ProviderResult> => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return failure('OPENAI_API_KEY not set', startedAt)

    const prompt = typeof params.prompt === 'string' ? params.prompt : ''
    if (!prompt) return failure('prompt is required', startedAt)

    const width = typeof params.width === 'number' ? params.width : undefined
    const height = typeof params.height === 'number' ? params.height : undefined
    const style = typeof params.style === 'string' ? params.style : undefined
    const negativePrompt =
      typeof params.negativePrompt === 'string' ? params.negativePrompt : undefined
    const outputDir =
      typeof params.outputDir === 'string' ? params.outputDir : './output/images'
    const timeoutMs =
      typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS
    const abortSignal =
      params.abortSignal instanceof AbortSignal ? params.abortSignal : undefined

    const size = mapSize(width, height)
    const quality = resolveQuality(modelApiId, params)
    const finalPrompt = buildImagePrompt(prompt, style, negativePrompt)

    let response: ImageGenerateResponse
    try {
      const client = getClient(apiKey)
      response = (await client.images.generate(
        {
          model: 'dall-e-3',
          prompt: finalPrompt,
          size,
          quality,
          n: 1,
          response_format: 'url',
        },
        { signal: abortSignal },
      )) as unknown as ImageGenerateResponse
    } catch (err) {
      return failure(mapApiError(err, timeoutMs), startedAt)
    }

    const first = response.data?.[0]
    if (!first || !first.url) {
      return failure('No image URL returned', startedAt)
    }

    const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt))
    try {
      const saved = await downloadAndSave(
        first.url,
        outputDir,
        `openai-dalle3-${quality}`,
        { timeoutMs: remaining, externalSignal: abortSignal, mimeTypeHint: 'image/png' },
      )
      const dimensions = parseSize(size)
      return {
        success: true,
        rawResponse: response as unknown as Record<string, unknown>,
        filePath: saved.filePath,
        dimensions,
        mimeType: saved.mimeType,
        fileSizeBytes: saved.fileSizeBytes,
        revisedPrompt: first.revised_prompt ?? finalPrompt,
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

  const handleImageScoring = async (
    modelApiId: string,
    params: Record<string, unknown>,
    startedAt: number,
  ): Promise<ProviderResult> => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return failure('OPENAI_API_KEY not set', startedAt)

    const timeoutMs =
      typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS
    const abortSignal =
      params.abortSignal instanceof AbortSignal ? params.abortSignal : undefined

    let messages: ChatMessage[]
    if (Array.isArray(params.messages)) {
      messages = params.messages as ChatMessage[]
    } else if (
      typeof params.systemPrompt === 'string' ||
      params.userContent !== undefined
    ) {
      const built: ChatMessage[] = []
      if (typeof params.systemPrompt === 'string') {
        built.push({ role: 'system', content: params.systemPrompt })
      }
      if (params.userContent === undefined) {
        return failure('userContent required when messages not provided', startedAt)
      }
      built.push({ role: 'user', content: params.userContent })
      messages = built
    } else {
      return failure('messages or systemPrompt+userContent required', startedAt)
    }

    let response: ChatCompletionResponse
    try {
      const client = getClient(apiKey)
      response = (await client.chat.completions.create(
        {
          model: modelApiId,
          messages: messages as never,
          temperature: 0,
          max_tokens: 4096,
        },
        { signal: abortSignal },
      )) as unknown as ChatCompletionResponse
    } catch (err) {
      return failure(mapApiError(err, timeoutMs), startedAt)
    }

    const content = response.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      return failure('Empty response from OpenAI', startedAt)
    }

    return {
      success: true,
      rawResponse: response as unknown as Record<string, unknown>,
      content,
      tokensIn: response.usage?.prompt_tokens ?? 0,
      tokensOut: response.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - startedAt,
    }
  }

  const execute = async (
    modelApiId: string,
    capability: Capability,
    params: Record<string, unknown>,
  ): Promise<ProviderResult> => {
    const startedAt = Date.now()
    if (capability === 'image-generation') {
      return handleImageGeneration(modelApiId, params, startedAt)
    }
    if (capability === 'image-scoring') {
      return handleImageScoring(modelApiId, params, startedAt)
    }
    return failure(`Unsupported capability: ${capability}`, startedAt)
  }

  const checkHealth = async (): Promise<HealthCheckResult> => {
    const checkedAt = new Date().toISOString()
    if (!process.env.OPENAI_API_KEY) {
      return {
        providerId: PROVIDER_ID,
        state: 'down',
        latencyMs: 0,
        checkedAt,
        error: 'OPENAI_API_KEY not set',
      }
    }
    return { providerId: PROVIDER_ID, state: 'healthy', latencyMs: 0, checkedAt }
  }

  return { providerId: PROVIDER_ID, execute, checkHealth }
}
