import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rm } from 'node:fs/promises'
import {
  EXT_BY_MIME,
  downloadAndSave,
  failure,
  fetchWithTimeout,
  pollUntilComplete,
  readErrorDetail,
} from '../../src/lib/core/models/providers/shared'

const OUT = '/tmp/shared-test-out'

const makeJsonRes = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response

describe('providers/shared', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    await rm(OUT, { recursive: true, force: true }).catch(() => {})
  })

  describe('EXT_BY_MIME', () => {
    it('maps known mime types to extensions', () => {
      expect(EXT_BY_MIME['image/jpeg']).toBe('jpg')
      expect(EXT_BY_MIME['image/png']).toBe('png')
      expect(EXT_BY_MIME['image/webp']).toBe('webp')
    })
  })

  describe('failure', () => {
    it('returns a well-formed failure ProviderResult', () => {
      const r = failure('fal-ai', 123, 'boom')
      expect(r.success).toBe(false)
      expect(r.rawResponse).toEqual({})
      expect(r.durationMs).toBe(123)
      expect(r.error).toBe('boom')
    })
  })

  describe('fetchWithTimeout', () => {
    it('returns response on success', async () => {
      const expected = makeJsonRes({ ok: true })
      fetchMock.mockResolvedValueOnce(expected)
      const res = await fetchWithTimeout('http://x', { method: 'GET' }, 1000)
      expect(res).toBe(expected)
    })

    it('aborts fetch on internal timeout', async () => {
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
      await expect(
        fetchWithTimeout('http://x', { method: 'GET' }, 20),
      ).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('aborts fetch when external signal fires', async () => {
      const ctl = new AbortController()
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
      const p = fetchWithTimeout('http://x', { method: 'GET' }, 10_000, ctl.signal)
      setTimeout(() => ctl.abort(), 20)
      await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    })
  })

  describe('readErrorDetail', () => {
    it('returns body.detail when string', async () => {
      expect(await readErrorDetail(makeJsonRes({ detail: 'nope' }))).toBe('nope')
    })

    it('returns body.error.message when present', async () => {
      expect(
        await readErrorDetail(makeJsonRes({ error: { message: 'bad' } })),
      ).toBe('bad')
    })

    it('falls back to JSON stringify when no recognized shape', async () => {
      const out = await readErrorDetail(makeJsonRes({ x: 1 }))
      expect(out).toContain('"x":1')
    })

    it('falls back to text() when JSON parsing fails', async () => {
      const res = {
        json: async () => {
          throw new Error('not json')
        },
        text: async () => 'plain text error',
      } as unknown as Response
      expect(await readErrorDetail(res)).toBe('plain text error')
    })
  })

  describe('downloadAndSave', () => {
    it('downloads, saves, and returns metadata using mimeTypeHint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4, 5]).buffer,
      } as unknown as Response)

      const res = await downloadAndSave('http://x/img.jpg', OUT, 'test-prefix', {
        mimeTypeHint: 'image/jpeg',
      })
      expect(res.filePath).toMatch(
        /\/tmp\/shared-test-out\/test-prefix-[0-9a-f-]+\.jpg$/,
      )
      expect(res.fileSizeBytes).toBe(5)
      expect(res.mimeType).toBe('image/jpeg')
    })

    it('derives mimeType from content-type header when no hint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => new Uint8Array([9]).buffer,
      } as unknown as Response)

      const res = await downloadAndSave('http://x/img', OUT, 'p')
      expect(res.mimeType).toBe('image/png')
      expect(res.filePath).toMatch(/\.png$/)
    })

    it('throws when HTTP response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response)
      await expect(
        downloadAndSave('http://x/img', OUT, 'p'),
      ).rejects.toThrow(/HTTP 404/)
    })
  })

  describe('pollUntilComplete', () => {
    const mkStatus = (status: string, generated: string[] = []): Response =>
      makeJsonRes({ data: { task_id: 't', status, generated } })
    const isC = (b: unknown): boolean =>
      (b as { data?: { status?: string } })?.data?.status === 'COMPLETED'
    const isF = (b: unknown): boolean =>
      (b as { data?: { status?: string } })?.data?.status === 'FAILED'
    const extract = (b: unknown): unknown =>
      (b as { data?: { generated?: unknown } })?.data?.generated
    const noDelay = (): Promise<void> => Promise.resolve()

    it('succeeds after COMPLETED status', async () => {
      fetchMock
        .mockResolvedValueOnce(mkStatus('IN_PROGRESS'))
        .mockResolvedValueOnce(mkStatus('IN_PROGRESS'))
        .mockResolvedValueOnce(mkStatus('COMPLETED', ['https://x/img.png']))
      const res = await pollUntilComplete({
        pollUrl: 'https://api/x',
        headers: {},
        isComplete: isC,
        isFailed: isF,
        extractResult: extract,
        delay: noDelay,
      })
      expect(res.success).toBe(true)
      expect(res.attempts).toBe(3)
      expect(res.result).toEqual(['https://x/img.png'])
    })

    it('fails when isFailed matches', async () => {
      fetchMock.mockResolvedValueOnce(mkStatus('FAILED'))
      const res = await pollUntilComplete({
        pollUrl: 'https://api/x',
        headers: {},
        isComplete: isC,
        isFailed: isF,
        extractResult: extract,
        delay: noDelay,
      })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/Task failed/)
    })

    it('returns failure on max attempts', async () => {
      fetchMock.mockResolvedValue(mkStatus('IN_PROGRESS'))
      const res = await pollUntilComplete({
        pollUrl: 'https://api/x',
        headers: {},
        isComplete: isC,
        isFailed: isF,
        extractResult: extract,
        maxAttempts: 3,
        delay: noDelay,
      })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/Max attempts/)
      expect(res.attempts).toBe(3)
    })

    it('returns Aborted when signal already aborted', async () => {
      const ac = new AbortController()
      ac.abort()
      const res = await pollUntilComplete({
        pollUrl: 'https://api/x',
        headers: {},
        isComplete: isC,
        isFailed: isF,
        extractResult: extract,
        signal: ac.signal,
        delay: noDelay,
      })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/Aborted/)
      expect(res.attempts).toBe(0)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('aborts mid-poll via signal', async () => {
      const ac = new AbortController()
      fetchMock.mockResolvedValueOnce(mkStatus('IN_PROGRESS'))
      const abortingDelay = async (): Promise<void> => {
        ac.abort()
      }
      const res = await pollUntilComplete({
        pollUrl: 'https://api/x',
        headers: {},
        isComplete: isC,
        isFailed: isF,
        extractResult: extract,
        signal: ac.signal,
        delay: abortingDelay,
      })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/Aborted/)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('fails on HTTP error during poll', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'boom' }),
        text: async () => 'boom',
      } as unknown as Response)
      const res = await pollUntilComplete({
        pollUrl: 'https://api/x',
        headers: {},
        isComplete: isC,
        isFailed: isF,
        extractResult: extract,
        delay: noDelay,
      })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/HTTP 500/)
    })

    it('backoff increases interval between polls', async () => {
      fetchMock
        .mockResolvedValueOnce(mkStatus('IN_PROGRESS'))
        .mockResolvedValueOnce(mkStatus('IN_PROGRESS'))
        .mockResolvedValueOnce(mkStatus('IN_PROGRESS'))
        .mockResolvedValueOnce(mkStatus('COMPLETED', []))
      const delays: number[] = []
      await pollUntilComplete({
        pollUrl: 'https://api/x',
        headers: {},
        isComplete: isC,
        isFailed: isF,
        extractResult: extract,
        intervalMs: 1000,
        maxIntervalMs: 5000,
        backoffMultiplier: 2,
        delay: async (ms): Promise<void> => {
          delays.push(ms)
        },
      })
      expect(delays).toEqual([1000, 2000, 4000])
    })
  })
})
