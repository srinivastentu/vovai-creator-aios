import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProviderResult } from './types'

export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const failure = (
  _providerId: string,
  durationMs: number,
  error: string,
): ProviderResult => ({
  success: false,
  rawResponse: {},
  durationMs,
  error,
})

export const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const onExternalAbort = (): void => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    const message = maskApiKey(err instanceof Error ? err.message : String(err))
    const wrapped = new Error(message)
    if (err instanceof Error && err.name) wrapped.name = err.name
    throw wrapped
  } finally {
    clearTimeout(timer)
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
  }
}

export const maskApiKey = (s: string): string =>
  s.replace(/([?&])key=[^&\s]+/g, '$1key=***')

export const readErrorDetail = async (res: Response): Promise<string> => {
  try {
    const body = (await res.json()) as {
      detail?: unknown
      error?: { message?: unknown }
    }
    if (body && typeof body.detail === 'string') return body.detail
    if (
      body &&
      body.error &&
      typeof body.error.message === 'string'
    ) {
      return body.error.message
    }
    return JSON.stringify(body)
  } catch {
    try {
      return await res.text()
    } catch {
      return ''
    }
  }
}

export interface DownloadResult {
  filePath: string
  fileSizeBytes: number
  mimeType: string
}

export interface DownloadOptions {
  timeoutMs?: number
  externalSignal?: AbortSignal
  mimeTypeHint?: string
}

export const downloadAndSave = async (
  imageUrl: string,
  outputDir: string,
  filePrefix: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> => {
  const { timeoutMs = 120_000, externalSignal, mimeTypeHint } = options
  const res = await fetchWithTimeout(
    imageUrl,
    { method: 'GET' },
    timeoutMs,
    externalSignal,
  )
  if (!res.ok) {
    throw new Error(`Image download failed: HTTP ${res.status}`)
  }

  const headerMime = res.headers?.get?.('content-type')?.split(';')[0]?.trim()
  const mimeType = mimeTypeHint ?? headerMime ?? 'image/png'
  const ext = EXT_BY_MIME[mimeType] ?? 'png'
  const filename = `${filePrefix}-${randomUUID()}.${ext}`
  const filePath = join(outputDir, filename)

  const buffer = Buffer.from(await res.arrayBuffer())
  await mkdir(outputDir, { recursive: true })
  await writeFile(filePath, buffer)

  return { filePath, fileSizeBytes: buffer.byteLength, mimeType }
}

export interface PollOptions {
  pollUrl: string
  headers: Record<string, string>
  isComplete: (body: unknown) => boolean
  isFailed: (body: unknown) => boolean
  extractResult: (body: unknown) => unknown
  intervalMs?: number
  maxIntervalMs?: number
  backoffMultiplier?: number
  maxAttempts?: number
  timeoutMs?: number
  signal?: AbortSignal
  fetchTimeoutMs?: number
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>
}

export interface PollResult {
  success: boolean
  result?: unknown
  error?: string
  attempts: number
  totalMs: number
  lastBody?: unknown
}

const defaultDelay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('Aborted'))
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
  })

export const pollUntilComplete = async (
  opts: PollOptions,
): Promise<PollResult> => {
  const {
    pollUrl,
    headers,
    isComplete,
    isFailed,
    extractResult,
    intervalMs = 2000,
    maxIntervalMs = 10_000,
    backoffMultiplier = 1.5,
    maxAttempts = 60,
    timeoutMs,
    signal,
    fetchTimeoutMs = 30_000,
    delay = defaultDelay,
  } = opts

  const startedAt = Date.now()
  let attempts = 0
  let currentInterval = intervalMs
  let lastBody: unknown

  if (signal?.aborted) {
    return { success: false, error: 'Aborted', attempts: 0, totalMs: 0 }
  }

  while (attempts < maxAttempts) {
    if (attempts > 0) {
      try {
        await delay(currentInterval, signal)
      } catch {
        return {
          success: false,
          error: 'Aborted',
          attempts,
          totalMs: Date.now() - startedAt,
          lastBody,
        }
      }
      currentInterval = Math.min(
        Math.round(currentInterval * backoffMultiplier),
        maxIntervalMs,
      )
    }

    if (signal?.aborted) {
      return {
        success: false,
        error: 'Aborted',
        attempts,
        totalMs: Date.now() - startedAt,
        lastBody,
      }
    }

    if (timeoutMs !== undefined && Date.now() - startedAt >= timeoutMs) {
      return {
        success: false,
        error: `Poll timeout after ${timeoutMs}ms`,
        attempts,
        totalMs: Date.now() - startedAt,
        lastBody,
      }
    }

    attempts += 1

    let res: Response
    try {
      res = await fetchWithTimeout(
        pollUrl,
        { method: 'GET', headers },
        fetchTimeoutMs,
        signal,
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          success: false,
          error: 'Aborted',
          attempts,
          totalMs: Date.now() - startedAt,
          lastBody,
        }
      }
      return {
        success: false,
        error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        attempts,
        totalMs: Date.now() - startedAt,
        lastBody,
      }
    }

    if (!res.ok) {
      const detail = await readErrorDetail(res)
      return {
        success: false,
        error: `HTTP ${res.status}: ${detail}`,
        attempts,
        totalMs: Date.now() - startedAt,
        lastBody,
      }
    }

    let body: unknown
    try {
      body = await res.json()
    } catch (err) {
      return {
        success: false,
        error: `Invalid JSON response: ${err instanceof Error ? err.message : String(err)}`,
        attempts,
        totalMs: Date.now() - startedAt,
        lastBody,
      }
    }
    lastBody = body

    if (isFailed(body)) {
      return {
        success: false,
        error: 'Task failed',
        attempts,
        totalMs: Date.now() - startedAt,
        lastBody: body,
      }
    }

    if (isComplete(body)) {
      return {
        success: true,
        result: extractResult(body),
        attempts,
        totalMs: Date.now() - startedAt,
        lastBody: body,
      }
    }
  }

  return {
    success: false,
    error: 'Max attempts reached',
    attempts,
    totalMs: Date.now() - startedAt,
    lastBody,
  }
}

export const saveBase64ToDisk = async (
  base64Data: string,
  outputDir: string,
  filePrefix: string,
  mimeType = 'image/png',
): Promise<DownloadResult> => {
  let buffer: Buffer
  try {
    buffer = Buffer.from(base64Data, 'base64')
  } catch (err) {
    throw new Error(
      `Base64 decode failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (buffer.byteLength === 0) {
    throw new Error('Base64 decode produced empty buffer')
  }
  const ext = EXT_BY_MIME[mimeType] ?? 'png'
  const filename = `${filePrefix}-${randomUUID()}.${ext}`
  const filePath = join(outputDir, filename)
  await mkdir(outputDir, { recursive: true })
  await writeFile(filePath, buffer)
  return { filePath, fileSizeBytes: buffer.byteLength, mimeType }
}
