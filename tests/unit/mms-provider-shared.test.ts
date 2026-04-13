import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rm } from 'node:fs/promises'
import {
  EXT_BY_MIME,
  downloadAndSave,
  failure,
  fetchWithTimeout,
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
})
