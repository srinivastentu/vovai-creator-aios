import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTextGeneration } from './useTextGeneration'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  let i = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[i]!))
      i += 1
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

function sseEvent(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
}

describe('useTextGeneration', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips malformed SSE chunks without crashing', async () => {
    const chunks = [
      sseEvent('session', { sessionId: 'abc', maxIterations: 3 }),
      'event: iteration_complete\ndata: {not-json\n\n',
      sseEvent('loop_complete', {
        sessionId: 'abc',
        bestArtifact: 'ok',
        bestScore: 9,
        status: 'presenting',
        iterations: [],
      }),
    ]
    fetchMock.mockResolvedValue(sseResponse(chunks))

    const { result } = renderHook(() => useTextGeneration())
    await act(async () => {
      await result.current.generate('topic')
    })
    expect(result.current.state.status).toBe('presenting')
    expect(result.current.state.sessionId).toBe('abc')
  })

  it('transitions to error when stream ends without loop_complete', async () => {
    const chunks = [sseEvent('session', { sessionId: 'x', maxIterations: 3 })]
    fetchMock.mockResolvedValue(sseResponse(chunks))

    const { result } = renderHook(() => useTextGeneration())
    await act(async () => {
      await result.current.generate('topic')
    })
    expect(result.current.state.status).toBe('error')
    expect(result.current.state.error).toMatch(/unexpectedly/i)
  })

  it('cancel() aborts and marks state as error', async () => {
    // Never-resolving stream — cancel should unwind it.
    let abortSignal: AbortSignal | undefined
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      abortSignal = init.signal!
      return new Promise((_resolve, reject) => {
        abortSignal!.addEventListener('abort', () => {
          const e = new Error('aborted')
          e.name = 'AbortError'
          reject(e)
        })
      })
    })

    const { result } = renderHook(() => useTextGeneration())
    let genPromise: Promise<void>
    await act(async () => {
      genPromise = result.current.generate('topic')
      await Promise.resolve()
    })
    await act(async () => {
      result.current.cancel()
      await genPromise
    })
    expect(result.current.state.status).toBe('error')
    expect(result.current.state.error).toMatch(/cancel/i)
  })

  it('surfaces json error body instead of raw text', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const { result } = renderHook(() => useTextGeneration())
    await act(async () => {
      await result.current.generate('topic')
    })
    expect(result.current.state.status).toBe('error')
    expect(result.current.state.error).toBe('Rate limit exceeded')
  })
})
