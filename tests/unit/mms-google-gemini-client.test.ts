import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGoogleGeminiClient } from '../../src/lib/core/models/providers/google-gemini'

const NANOBANAN_2 = 'gemini-3.1-flash-image-preview'
const NANOBANAN_PRO = 'gemini-3-pro-image'
const IMAGEN_FAST = 'imagen-4-fast'
const IMAGEN_STD = 'imagen-4-standard'

// A 16-byte sample buffer encoded as base64, non-empty.
const sampleBase64 = Buffer.from(
  [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82],
).toString('base64')

const jsonResponse = (data: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as unknown as Response

const outDir = join(tmpdir(), 'test-google-gemini-out')

describe('createGoogleGeminiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.GOOGLE_GEMINI_API_KEY = 'test-key-abc'
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY
    vi.unstubAllGlobals()
    await rm(outDir, { recursive: true, force: true }).catch(() => {})
  })

  const defaults = { prompt: 'A futuristic city at sunset', outputDir: outDir }

  it('has providerId "google-gemini"', () => {
    expect(createGoogleGeminiClient().providerId).toBe('google-gemini')
  })

  // --- Gemini native ---

  it('returns failure when GOOGLE_GEMINI_API_KEY is missing', async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY
    const res = await createGoogleGeminiClient().execute(
      NANOBANAN_2,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/GOOGLE_GEMINI_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('generates NanoBanana 2 image successfully via generateContent', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                { text: 'Here is the image' },
                { inlineData: { mimeType: 'image/png', data: sampleBase64 } },
              ],
            },
          },
        ],
      }),
    )
    const res = await createGoogleGeminiClient().execute(
      NANOBANAN_2,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(true)
    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain(`${NANOBANAN_2}:generateContent`)
    expect(calledUrl).toContain('key=test-key-abc')
    expect(res.filePath).toMatch(/google-nanobanana-2-.+\.png$/)
    const onDisk = await readFile(res.filePath!)
    expect(onDisk.byteLength).toBeGreaterThan(0)
    expect(res.revisedPrompt).toBe('Here is the image')
  })

  it('generates NanoBanana Pro via generateContent endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: sampleBase64 } }],
            },
          },
        ],
      }),
    )
    const res = await createGoogleGeminiClient().execute(
      NANOBANAN_PRO,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `${NANOBANAN_PRO}:generateContent`,
    )
    expect(res.filePath).toMatch(/google-nanobanana-pro-/)
  })

  it('fails when Gemini response has no candidates', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const res = await createGoogleGeminiClient().execute(
      NANOBANAN_2,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No candidates/)
  })

  it('fails when Gemini response has no inlineData part', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'only text' }] } }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(
      NANOBANAN_2,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No inline image/)
  })

  it('sends prompt text in contents[0].parts[0].text', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: sampleBase64 } }],
            },
          },
        ],
      }),
    )
    await createGoogleGeminiClient().execute(NANOBANAN_2, 'image-generation', defaults)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.contents[0].parts[0].text).toBe(defaults.prompt)
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE', 'TEXT'])
  })

  it('maps HTTP 429 to Rate limited failure (Gemini)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'too many' } }, 429),
    )
    const res = await createGoogleGeminiClient().execute(
      NANOBANAN_2,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Rate limited/)
  })

  it('maps HTTP 500 to Server error failure (Gemini)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'boom' } }, 500),
    )
    const res = await createGoogleGeminiClient().execute(
      NANOBANAN_2,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Server error 500/)
  })

  // --- Imagen 4 ---

  it('generates Imagen 4 Fast image successfully via :predict', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        predictions: [{ bytesBase64Encoded: sampleBase64, mimeType: 'image/png' }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(
      IMAGEN_FAST,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain(`${IMAGEN_FAST}:predict`)
    expect(res.filePath).toMatch(/google-imagen-4-fast-.+\.png$/)
    const onDisk = await readFile(res.filePath!)
    expect(onDisk.byteLength).toBeGreaterThan(0)
  })

  it('generates Imagen 4 Standard via :predict endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        predictions: [{ bytesBase64Encoded: sampleBase64, mimeType: 'image/png' }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(
      IMAGEN_STD,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain(`${IMAGEN_STD}:predict`)
    expect(res.filePath).toMatch(/google-imagen-4-standard-/)
  })

  it('maps square dimensions to aspectRatio "1:1"', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        predictions: [{ bytesBase64Encoded: sampleBase64, mimeType: 'image/png' }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(IMAGEN_FAST, 'image-generation', {
      ...defaults,
      width: 1024,
      height: 1024,
    })
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.parameters.aspectRatio).toBe('1:1')
    expect(res.dimensions).toEqual({ width: 1024, height: 1024 })
  })

  it('maps landscape dimensions to aspectRatio "16:9"', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        predictions: [{ bytesBase64Encoded: sampleBase64, mimeType: 'image/png' }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(IMAGEN_FAST, 'image-generation', {
      ...defaults,
      width: 1920,
      height: 1080,
    })
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.parameters.aspectRatio).toBe('16:9')
    expect(res.dimensions).toEqual({ width: 1344, height: 768 })
  })

  it('maps portrait dimensions to aspectRatio "9:16"', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        predictions: [{ bytesBase64Encoded: sampleBase64, mimeType: 'image/png' }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(IMAGEN_FAST, 'image-generation', {
      ...defaults,
      width: 1080,
      height: 1920,
    })
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.parameters.aspectRatio).toBe('9:16')
    expect(res.dimensions).toEqual({ width: 768, height: 1344 })
  })

  it('maps moderate landscape dimensions to aspectRatio "4:3"', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        predictions: [{ bytesBase64Encoded: sampleBase64, mimeType: 'image/png' }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(IMAGEN_FAST, 'image-generation', {
      ...defaults,
      width: 1200,
      height: 1000,
    })
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.parameters.aspectRatio).toBe('4:3')
    expect(res.dimensions).toEqual({ width: 1024, height: 768 })
  })

  it('maps moderate portrait dimensions to aspectRatio "3:4"', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        predictions: [{ bytesBase64Encoded: sampleBase64, mimeType: 'image/png' }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(IMAGEN_FAST, 'image-generation', {
      ...defaults,
      width: 1000,
      height: 1200,
    })
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.parameters.aspectRatio).toBe('3:4')
    expect(res.dimensions).toEqual({ width: 768, height: 1024 })
  })

  it('fails when Imagen predictions array is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ predictions: [] }))
    const res = await createGoogleGeminiClient().execute(
      IMAGEN_FAST,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No predictions/)
  })

  it('decodes base64 and writes non-empty buffer to disk', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        predictions: [{ bytesBase64Encoded: sampleBase64, mimeType: 'image/png' }],
      }),
    )
    const res = await createGoogleGeminiClient().execute(
      IMAGEN_STD,
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(true)
    const onDisk = await readFile(res.filePath!)
    expect(onDisk.byteLength).toBe(16)
    expect(res.fileSizeBytes).toBe(16)
  })

  // --- General ---

  it('returns failure for unknown modelApiId', async () => {
    const res = await createGoogleGeminiClient().execute(
      'foo-bar',
      'image-generation',
      defaults,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unknown Google Gemini model/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns failure for unsupported capability', async () => {
    const res = await createGoogleGeminiClient().execute(
      NANOBANAN_2,
      'video-generation',
      defaults,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unsupported capability/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('checkHealth reflects GOOGLE_GEMINI_API_KEY presence', async () => {
    const healthy = await createGoogleGeminiClient().checkHealth()
    expect(healthy.state).toBe('healthy')
    expect(healthy.providerId).toBe('google-gemini')
    delete process.env.GOOGLE_GEMINI_API_KEY
    const down = await createGoogleGeminiClient().checkHealth()
    expect(down.state).toBe('down')
    expect(down.error).toMatch(/GOOGLE_GEMINI_API_KEY/)
  })
})
