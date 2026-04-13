import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rm } from 'node:fs/promises'

import { createFreepikClient } from '../../src/lib/core/models/providers/freepik'

const MYSTIC = 'mystic'
const OUT = '/tmp/freepik-test-out'

const makeJson = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => 'image/png' },
  }) as unknown as Response

const makeImage = (bytes = new Uint8Array([1, 2, 3])): Response =>
  ({
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
    headers: { get: () => 'image/png' },
  }) as unknown as Response

const submitOk = makeJson({
  data: { task_id: 'task-abc', status: 'IN_PROGRESS', generated: [] },
})
const pollInProgress = (): Response =>
  makeJson({ data: { task_id: 'task-abc', status: 'IN_PROGRESS', generated: [] } })
const pollCompleted = makeJson({
  data: {
    task_id: 'task-abc',
    status: 'COMPLETED',
    generated: ['https://cdn.freepik.com/img.png'],
  },
})
const pollFailed = makeJson({
  data: { task_id: 'task-abc', status: 'FAILED', generated: [] },
})

const defaultParams = {
  prompt: 'A futuristic city at sunset',
  width: 1024,
  height: 1024,
  outputDir: OUT,
}

describe('createFreepikClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let realSetTimeout: typeof setTimeout

  beforeEach(() => {
    process.env.FREEPIK_API_KEY = 'test-freepik-key'
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    realSetTimeout = globalThis.setTimeout
    vi.stubGlobal(
      'setTimeout',
      ((fn: () => void) => {
        Promise.resolve().then(fn)
        return 0
      }) as unknown as typeof setTimeout,
    )
  })

  afterEach(async () => {
    delete process.env.FREEPIK_API_KEY
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    globalThis.setTimeout = realSetTimeout
    await rm(OUT, { recursive: true, force: true }).catch(() => {})
  })

  it('has providerId "freepik"', () => {
    expect(createFreepikClient().providerId).toBe('freepik')
  })

  it('returns failure when FREEPIK_API_KEY is not set', async () => {
    delete process.env.FREEPIK_API_KEY
    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/FREEPIK_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns failure for unsupported capability', async () => {
    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'text-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unsupported capability/)
  })

  it('returns failure for unknown modelApiId', async () => {
    const client = createFreepikClient()
    const res = await client.execute('unknown', 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unknown Freepik model/)
  })

  it('generates Mystic image successfully with submit→poll→download', async () => {
    fetchMock
      .mockResolvedValueOnce(submitOk)
      .mockResolvedValueOnce(pollInProgress())
      .mockResolvedValueOnce(pollInProgress())
      .mockResolvedValueOnce(pollCompleted)
      .mockResolvedValueOnce(makeImage())

    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'image-generation', defaultParams)

    expect(res.success).toBe(true)
    expect(res.filePath).toMatch(/freepik-mystic-.*\.png$/)

    const submitCall = fetchMock.mock.calls[0]
    expect(submitCall[0]).toBe('https://api.freepik.com/v1/ai/mystic')
    const submitInit = submitCall[1] as RequestInit
    expect((submitInit.headers as Record<string, string>)['x-freepik-api-key']).toBe(
      'test-freepik-key',
    )
    const pollCall = fetchMock.mock.calls[1]
    expect(pollCall[0]).toBe('https://api.freepik.com/v1/ai/mystic/task-abc')
    expect(
      (pollCall[1].headers as Record<string, string>)['x-freepik-api-key'],
    ).toBe('test-freepik-key')
  })

  it('fails when submit returns 500', async () => {
    fetchMock.mockResolvedValueOnce(
      makeJson({ detail: 'internal' }, false, 500),
    )
    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Server error 500/)
  })

  it('fails when submit response is missing task_id', async () => {
    fetchMock.mockResolvedValueOnce(makeJson({ data: { status: 'IN_PROGRESS' } }))
    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/task_id missing/)
  })

  it('fails when poll returns FAILED', async () => {
    fetchMock
      .mockResolvedValueOnce(submitOk)
      .mockResolvedValueOnce(pollFailed)
    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Task failed/)
  })

  it('fails when poll never completes (max attempts)', async () => {
    fetchMock.mockResolvedValueOnce(submitOk)
    for (let i = 0; i < 100; i++) fetchMock.mockResolvedValueOnce(pollInProgress())
    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'image-generation', {
      ...defaultParams,
      timeoutMs: 600_000,
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Max attempts/)
  })

  it('fails when abort signal fires during polling', async () => {
    const ac = new AbortController()
    fetchMock
      .mockResolvedValueOnce(submitOk)
      .mockImplementationOnce(async () => {
        ac.abort()
        return pollInProgress()
      })
    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'image-generation', {
      ...defaultParams,
      abortSignal: ac.signal,
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Aborted/)
  })

  it('fails when download of generated URL fails', async () => {
    fetchMock
      .mockResolvedValueOnce(submitOk)
      .mockResolvedValueOnce(pollCompleted)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => null },
      } as unknown as Response)
    const client = createFreepikClient()
    const res = await client.execute(MYSTIC, 'image-generation', defaultParams)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/HTTP 404/)
  })

  it('passes negativePrompt natively without appending to prompt', async () => {
    fetchMock
      .mockResolvedValueOnce(submitOk)
      .mockResolvedValueOnce(pollCompleted)
      .mockResolvedValueOnce(makeImage())
    const client = createFreepikClient()
    await client.execute(MYSTIC, 'image-generation', {
      ...defaultParams,
      negativePrompt: 'blurry, low quality',
    })
    const submitInit = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(submitInit.body as string)
    expect(body.prompt).toBe('A futuristic city at sunset')
    expect(body.negative_prompt).toBe('blurry, low quality')
  })

  it('maps dimensions to Freepik aspect strings', async () => {
    const cases: Array<[number, number, string]> = [
      [1024, 1024, 'square_1_1'],
      [1920, 1080, 'widescreen_16_9'],
      [1080, 1920, 'social_story_9_16'],
    ]
    for (const [w, h, expected] of cases) {
      fetchMock.mockReset()
      fetchMock
        .mockResolvedValueOnce(submitOk)
        .mockResolvedValueOnce(pollCompleted)
        .mockResolvedValueOnce(makeImage())
      const client = createFreepikClient()
      await client.execute(MYSTIC, 'image-generation', {
        ...defaultParams,
        width: w,
        height: h,
      })
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
      expect(body.image_size).toBe(expected)
    }
  })

  it('checkHealth reports down without key, healthy with key', async () => {
    const client = createFreepikClient()
    expect((await client.checkHealth()).state).toBe('healthy')
    delete process.env.FREEPIK_API_KEY
    expect((await client.checkHealth()).state).toBe('down')
  })
})
