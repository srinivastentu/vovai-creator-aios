import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rm } from 'node:fs/promises'

import { createFalAiClient } from '../../src/lib/core/models/providers/fal-ai'

const FLUX_DEV = 'fal-ai/flux/dev'
const FLUX_PRO = 'fal-ai/flux-pro/v1.1'

const makeApiResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response

const makeImageResponse = (bytes = new Uint8Array([1, 2, 3, 4])): Response =>
  ({
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
  }) as unknown as Response

const defaultParams = {
  prompt: 'A futuristic city at sunset',
  width: 1024,
  height: 1024,
  outputDir: '/tmp/test-out',
}

const defaultFalBody = {
  images: [
    {
      url: 'https://fal.media/files/abc.jpg',
      width: 1024,
      height: 1024,
      content_type: 'image/jpeg',
    },
  ],
  seed: 12345,
  prompt: 'A futuristic city at sunset',
  has_nsfw_concepts: [false],
}

describe('createFalAiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.FAL_KEY = 'test-key-abc'
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    delete process.env.FAL_KEY
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    await rm('/tmp/test-out', { recursive: true, force: true }).catch(() => {})
  })

  it('has providerId "fal-ai"', () => {
    expect(createFalAiClient().providerId).toBe('fal-ai')
  })

  it('returns failure when FAL_KEY is not set, without calling fetch', async () => {
    delete process.env.FAL_KEY
    const client = createFalAiClient()
    const res = await client.execute(FLUX_DEV, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/FAL_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('successfully generates with Flux Dev', async () => {
    fetchMock
      .mockResolvedValueOnce(makeApiResponse(defaultFalBody))
      .mockResolvedValueOnce(makeImageResponse())
    const client = createFalAiClient()
    const res = await client.execute(FLUX_DEV, 'image-generation', defaultParams)
    expect(res.success).toBe(true)
    expect(res.filePath).toMatch(/\/tmp\/test-out\/fal-ai-flux-dev-.+\.jpg$/)
    expect(res.dimensions).toEqual({ width: 1024, height: 1024 })
    expect(res.mimeType).toBe('image/jpeg')
    expect(res.fileSizeBytes).toBe(4)
    expect(res.durationMs).toBeGreaterThanOrEqual(0)
    // fs writes happen; we don't assert on mocks here because node: builtin
    // mocking is unreliable across ESM in vitest — success + filePath prove it.
  })

  it('successfully generates with Flux Pro and uses correct endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(makeApiResponse(defaultFalBody))
      .mockResolvedValueOnce(makeImageResponse())
    const client = createFalAiClient()
    const res = await client.execute(FLUX_PRO, 'image-generation', defaultParams)
    expect(res.success).toBe(true)
    expect(res.filePath).toMatch(/fal-ai-flux-pro-.+\.jpg$/)
    expect(fetchMock.mock.calls[0][0]).toBe('https://fal.run/fal-ai/flux-pro/v1.1')
  })

  it('Flux Dev maps to correct endpoint URL', async () => {
    fetchMock
      .mockResolvedValueOnce(makeApiResponse(defaultFalBody))
      .mockResolvedValueOnce(makeImageResponse())
    const client = createFalAiClient()
    await client.execute(FLUX_DEV, 'image-generation', defaultParams)
    expect(fetchMock.mock.calls[0][0]).toBe('https://fal.run/fal-ai/flux/dev')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Key test-key-abc',
    )
  })

  it('returns failure for unknown modelApiId', async () => {
    const client = createFalAiClient()
    const res = await client.execute('fal-ai/unknown', 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unknown fal\.ai model/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns failure for unsupported capability', async () => {
    const client = createFalAiClient()
    const res = await client.execute(FLUX_DEV, 'text-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unsupported capability/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps HTTP 429 to rate limited failure', async () => {
    fetchMock.mockResolvedValueOnce(
      makeApiResponse({ detail: 'too many requests' }, false, 429),
    )
    const client = createFalAiClient()
    const res = await client.execute(FLUX_DEV, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Rate limited/)
  })

  it('maps HTTP 500 to server error failure', async () => {
    fetchMock.mockResolvedValueOnce(
      makeApiResponse({ detail: 'internal' }, false, 500),
    )
    const client = createFalAiClient()
    const res = await client.execute(FLUX_DEV, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Server error 500/)
  })

  it('returns failure when images array is empty', async () => {
    fetchMock.mockResolvedValueOnce(makeApiResponse({ images: [] }))
    const client = createFalAiClient()
    const res = await client.execute(FLUX_DEV, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No images returned/)
  })

  it('returns failure when image download fails', async () => {
    fetchMock
      .mockResolvedValueOnce(makeApiResponse(defaultFalBody))
      .mockResolvedValueOnce({ ok: false, status: 404 } as unknown as Response)
    const client = createFalAiClient()
    const res = await client.execute(FLUX_DEV, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Image download failed/)
  })

  it('returns failure on timeout', async () => {
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const e = new Error('aborted')
            e.name = 'AbortError'
            reject(e)
          })
        }),
    )
    const client = createFalAiClient()
    const res = await client.execute(FLUX_DEV, 'image-generation', {
      ...defaultParams,
      timeoutMs: 30,
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Timeout/)
  })

  it('appends negative prompt to main prompt', async () => {
    fetchMock
      .mockResolvedValueOnce(makeApiResponse(defaultFalBody))
      .mockResolvedValueOnce(makeImageResponse())
    const client = createFalAiClient()
    await client.execute(FLUX_DEV, 'image-generation', {
      ...defaultParams,
      negativePrompt: 'blurry, low quality',
    })
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as { prompt: string }
    expect(body.prompt).toContain(defaultParams.prompt)
    expect(body.prompt).toContain('Avoid: blurry, low quality')
  })

  it('checkHealth returns healthy when FAL_KEY set', async () => {
    const res = await createFalAiClient().checkHealth()
    expect(res.state).toBe('healthy')
    expect(res.providerId).toBe('fal-ai')
  })

  it('checkHealth returns down when FAL_KEY missing', async () => {
    delete process.env.FAL_KEY
    const res = await createFalAiClient().checkHealth()
    expect(res.state).toBe('down')
    expect(res.error).toMatch(/FAL_KEY/)
  })
})
