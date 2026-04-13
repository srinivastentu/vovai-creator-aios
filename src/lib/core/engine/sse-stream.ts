// Minimal SSE helper for streaming loop events to clients.
// Domain-agnostic; only depends on web streams.

export interface SSEStream {
  readable: ReadableStream<Uint8Array>
  send: (event: string, data: unknown) => void
  close: () => void
}

export function createSSEStream(): SSEStream {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  let closed = false

  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    cancel() {
      closed = true
      controller = null
    },
  })

  const send = (event: string, data: unknown) => {
    if (closed || !controller) return
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    try {
      controller.enqueue(encoder.encode(payload))
    } catch {
      closed = true
    }
  }

  const close = () => {
    if (closed || !controller) return
    closed = true
    try {
      controller.close()
    } catch {
      // already closed
    }
    controller = null
  }

  return { readable, send, close }
}

export const SSE_HEADERS: HeadersInit = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}
