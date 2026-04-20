import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const makeMp3Buffer = (size = 128): ArrayBuffer => {
  const u = new Uint8Array(size)
  u[0] = 0xff
  u[1] = 0xfb
  u[2] = 0x90
  return u.buffer
}

const mockResponse = (opts: {
  ok: boolean
  status: number
  body?: ArrayBuffer | string | object
  contentType?: string
}): Response => {
  const headers = new Headers()
  if (opts.contentType) headers.set('content-type', opts.contentType)
  const init = { status: opts.status, headers } as ResponseInit
  if (opts.body instanceof ArrayBuffer) {
    return new Response(opts.body, init)
  }
  if (typeof opts.body === 'string') {
    return new Response(opts.body, init)
  }
  return new Response(JSON.stringify(opts.body ?? {}), init)
}

describe('elevenlabs provider', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'eleven-test-'))
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('happy path: synth returns file, characters, correct url/headers/body', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: makeMp3Buffer(), contentType: 'audio/mpeg' }),
      )
    const client = createElevenLabsClient({
      apiKey: 'test-key',
      outputDir: tmpDir,
      fetchImpl: fetchMock,
    })

    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'Hello world',
      voiceId: 'abc123',
    })

    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/abc123?output_format=mp3_44100_128',
    )
    expect((init as RequestInit).method).toBe('POST')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['xi-api-key']).toBe('test-key')
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Accept']).toBe('audio/mpeg')
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>
    expect(body.text).toBe('Hello world')
    expect(body.model_id).toBe('eleven_turbo_v2_5')

    expect(res.filePath).toBeTruthy()
    expect(res.filePath).toMatch(/\.mp3$/)
    expect(res.filePath!.startsWith(tmpDir)).toBe(true)
    expect(res.mimeType).toBe('audio/mpeg')
    expect(res.characters).toBe('Hello world'.length)
    expect(res.fileSizeBytes).toBe(128)
    const saved = await readFile(res.filePath!)
    expect(saved.byteLength).toBe(128)
    const s = await stat(res.filePath!)
    expect(s.isFile()).toBe(true)
  })

  it('filename matches {providerId}-{modelApiId}-{uuid}.mp3', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: makeMp3Buffer(), contentType: 'audio/mpeg' }),
      )
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'x',
      voiceId: 'v1',
    })
    expect(res.filePath).toBeTruthy()
    const fname = res.filePath!.split('/').pop()!
    expect(fname).toMatch(/^elevenlabs-eleven_turbo_v2_5-[0-9a-f-]{36}\.mp3$/)
  })

  it('unsupported capability returns failure, no fetch', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi.fn()
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'image-generation', {})
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unsupported capability/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['missing text', { voiceId: 'v' }],
    ['missing voiceId', { text: 'hi' }],
    ['empty text', { text: '', voiceId: 'v' }],
  ])('validation failure: %s', async (_label, params) => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi.fn()
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', params)
    expect(res.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('missing apiKey returns failure with no leakage', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi.fn()
    const client = createElevenLabsClient({ apiKey: '', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'hi',
      voiceId: 'v',
    })
    expect(res.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('HTTP 401 — auth failure, no key in error', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: false,
          status: 401,
          body: { detail: 'bad key' },
          contentType: 'application/json',
        }),
      )
    const client = createElevenLabsClient({
      apiKey: 'my-secret-key',
      outputDir: tmpDir,
      fetchImpl: fetchMock,
    })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'hi',
      voiceId: 'v',
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/auth/i)
    expect(res.error).not.toContain('my-secret-key')
  })

  it('HTTP 429 — rate limited', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: false, status: 429, body: { detail: 'slow down' } }),
      )
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'hi',
      voiceId: 'v',
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/rate.?limit/i)
  })

  it('HTTP 500 — server error', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ ok: false, status: 500, body: 'oops x'.repeat(200) }))
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'hi',
      voiceId: 'v',
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/500/)
    expect(res.error!.length).toBeLessThan(700)
  })

  it('network error — fetch throws', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'hi',
      voiceId: 'v',
    })
    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
  })

  it('AbortError on fetch returns timeout failure', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi.fn().mockImplementation(async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    })
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'hi',
      voiceId: 'v',
      timeoutMs: 100,
    })
    expect(res.success).toBe(false)
    expect(res.error!.toLowerCase()).toMatch(/timeout/)
  })

  it('non-audio content-type on 200 — failure, no file written', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          body: '{"err":"nope"}',
          contentType: 'application/json',
        }),
      )
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const res = await client.execute('eleven_turbo_v2_5', 'voice-synthesis', {
      text: 'hi',
      voiceId: 'v',
    })
    expect(res.success).toBe(false)
    expect(res.filePath).toBeUndefined()
  })

  it('checkHealth: 200 → healthy', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: { ok: 1 } }))
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const h = await client.checkHealth()
    expect(h.state).toBe('healthy')
  })

  it('checkHealth: 401 → down', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ ok: false, status: 401, body: {} }))
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const h = await client.checkHealth()
    expect(h.state).toBe('down')
  })

  it('checkHealth: 503 → degraded', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ ok: false, status: 503, body: {} }))
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const h = await client.checkHealth()
    expect(h.state).toBe('degraded')
  })

  it('checkHealth: network error → down', async () => {
    const { createElevenLabsClient } = await import('../elevenlabs')
    const fetchMock = vi.fn().mockRejectedValue(new Error('x'))
    const client = createElevenLabsClient({ apiKey: 'k', outputDir: tmpDir, fetchImpl: fetchMock })
    const h = await client.checkHealth()
    expect(h.state).toBe('down')
  })

  // Spec: execute() must never throw — every failure path returns { success: false }.
  // This is the literal try/catch form of that assertion. Other tests prove the
  // same property implicitly via return-value checks; a reader grepping for the
  // spec clause should also find the form here.
  it.each([
    {
      label: 'unsupported capability',
      capability: 'image-generation' as const,
      params: {} as Record<string, unknown>,
      makeFetch: () => vi.fn(),
    },
    {
      label: 'missing text',
      capability: 'voice-synthesis' as const,
      params: { voiceId: 'v' } as Record<string, unknown>,
      makeFetch: () => vi.fn(),
    },
    {
      label: 'HTTP 401',
      capability: 'voice-synthesis' as const,
      params: { text: 'x', voiceId: 'v' } as Record<string, unknown>,
      makeFetch: () =>
        vi.fn().mockResolvedValue(
          mockResponse({
            ok: false,
            status: 401,
            body: { detail: 'nope' },
            contentType: 'application/json',
          }),
        ),
    },
    {
      label: 'HTTP 500 malformed body',
      capability: 'voice-synthesis' as const,
      params: { text: 'x', voiceId: 'v' } as Record<string, unknown>,
      makeFetch: () =>
        vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 500, body: '<<not json>>' })),
    },
    {
      label: 'network error',
      capability: 'voice-synthesis' as const,
      params: { text: 'x', voiceId: 'v' } as Record<string, unknown>,
      makeFetch: () => vi.fn().mockRejectedValue(new Error('ECONNRESET')),
    },
    {
      label: 'AbortError timeout',
      capability: 'voice-synthesis' as const,
      params: { text: 'x', voiceId: 'v', timeoutMs: 10 } as Record<string, unknown>,
      makeFetch: () =>
        vi.fn().mockImplementation(async () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          throw err
        }),
    },
  ])(
    'execute never throws — $label returns { success: false }',
    async ({ capability, params, makeFetch }) => {
      const { createElevenLabsClient } = await import('../elevenlabs')
      const fetchMock = makeFetch()
      const client = createElevenLabsClient({
        apiKey: 'k',
        outputDir: tmpDir,
        fetchImpl: fetchMock,
      })
      let res: Awaited<ReturnType<typeof client.execute>> | undefined
      try {
        res = await client.execute('eleven_turbo_v2_5', capability, params)
      } catch (err) {
        throw new Error(`execute() threw instead of returning failure: ${String(err)}`)
      }
      expect(res).toBeDefined()
      expect(typeof res).toBe('object')
      expect(res!.success).toBe(false)
    },
  )
})
