import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createMock = vi.fn()

vi.mock('openai', () => {
  class APIError extends Error {
    status: number
    constructor(message: string, status = 500) {
      super(message)
      this.status = status
    }
  }
  class OpenAI {
    chat = { completions: { create: createMock } }
    constructor(_opts: unknown) {}
  }
  return { default: OpenAI, APIError }
})

describe('openai provider — handleImageScoring systemPrompt merge', () => {
  beforeEach(() => {
    createMock.mockReset()
    process.env.OPENAI_API_KEY = 'test-key'
  })
  afterEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  it('prepends systemPrompt as system message when messages array is provided', async () => {
    const { createOpenAiClient } = await import('../openai')
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"dimensionScores":[]}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    })

    const client = createOpenAiClient()
    const userMessages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'prompt' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
        ],
      },
    ]
    await client.execute('gpt-4o', 'image-scoring', {
      messages: userMessages,
      systemPrompt: 'RUBRIC_SYSTEM_INSTRUCTIONS',
    })

    expect(createMock).toHaveBeenCalledTimes(1)
    const sent = createMock.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    expect(sent.messages[0]).toEqual({
      role: 'system',
      content: 'RUBRIC_SYSTEM_INSTRUCTIONS',
    })
    expect(sent.messages[1].role).toBe('user')
    expect(sent.messages).toHaveLength(2)
  })

  it('does not duplicate system message when messages already contains one', async () => {
    const { createOpenAiClient } = await import('../openai')
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })

    const client = createOpenAiClient()
    await client.execute('gpt-4o', 'image-scoring', {
      messages: [
        { role: 'system', content: 'inline-sys' },
        { role: 'user', content: 'hi' },
      ],
      systemPrompt: 'SHOULD_BE_IGNORED',
    })

    const sent = createMock.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    expect(sent.messages).toHaveLength(2)
    expect(sent.messages[0]).toEqual({ role: 'system', content: 'inline-sys' })
  })
})
