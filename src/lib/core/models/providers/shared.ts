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
  } finally {
    clearTimeout(timer)
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
  }
}

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
