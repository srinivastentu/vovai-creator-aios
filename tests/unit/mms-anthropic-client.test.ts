import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const messagesCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'APIError'
      this.status = status
    }
  }
  class Anthropic {
    messages = { create: messagesCreate }
  }
  return { default: Anthropic, APIError }
})

import { APIError as MockAPIError } from '@anthropic-ai/sdk'
import { createAnthropicClient } from '../../src/lib/core/models/providers/anthropic'

const SONNET = 'claude-sonnet-4-20250514'

describe('createAnthropicClient', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    messagesCreate.mockReset()
  })
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
  })

  it('has providerId "anthropic"', () => {
    expect(createAnthropicClient().providerId).toBe('anthropic')
  })

  it('text-generation returns content + token usage and passes system/user/max_tokens', async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'the post' }],
      usage: { input_tokens: 900, output_tokens: 1200 },
    })
    const res = await createAnthropicClient().execute(SONNET, 'text-generation', {
      systemPrompt: 'you are a producer',
      prompt: 'write the post',
      temperature: 0.8,
      maxOutputTokens: 4096,
    })
    expect(res.success).toBe(true)
    expect(res.content).toBe('the post')
    expect(res.tokensIn).toBe(900)
    expect(res.tokensOut).toBe(1200)
    const call = messagesCreate.mock.calls[0][0]
    expect(call.model).toBe(SONNET)
    expect(call.system).toBe('you are a producer')
    expect(call.temperature).toBe(0.8)
    expect(call.max_tokens).toBe(4096)
    expect(call.messages).toEqual([{ role: 'user', content: 'write the post' }])
  })

  it('text-scoring shares the text path (capability also accepted)', async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"score":9}' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    })
    const res = await createAnthropicClient().execute(SONNET, 'text-scoring', { prompt: 'grade' })
    expect(res.success).toBe(true)
    expect(res.content).toBe('{"score":9}')
  })

  it('omits the system field when no systemPrompt is given', async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'x' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    })
    await createAnthropicClient().execute(SONNET, 'text-generation', { prompt: 'hi' })
    expect(messagesCreate.mock.calls[0][0].system).toBeUndefined()
  })

  it('fails when prompt is missing, without calling the SDK', async () => {
    const res = await createAnthropicClient().execute(SONNET, 'text-generation', {})
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/prompt is required/)
    expect(messagesCreate).not.toHaveBeenCalled()
  })

  it('fails without API key, without calling the SDK', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await createAnthropicClient().execute(SONNET, 'text-generation', { prompt: 'x' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/ANTHROPIC_API_KEY/)
    expect(messagesCreate).not.toHaveBeenCalled()
  })

  it('returns failure (not empty success) when the model returns no text block', async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    })
    const res = await createAnthropicClient().execute(SONNET, 'text-generation', { prompt: 'x' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Empty response/)
  })

  it('maps SDK APIError 429 to a Rate limited failure', async () => {
    messagesCreate.mockRejectedValueOnce(
      new (MockAPIError as unknown as new (s: number, m: string) => Error)(429, 'slow down'),
    )
    const res = await createAnthropicClient().execute(SONNET, 'text-generation', { prompt: 'x' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Rate limited/)
  })

  it('maps SDK APIError 500 to a Server error failure', async () => {
    messagesCreate.mockRejectedValueOnce(
      new (MockAPIError as unknown as new (s: number, m: string) => Error)(500, 'boom'),
    )
    const res = await createAnthropicClient().execute(SONNET, 'text-generation', { prompt: 'x' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Server error 500/)
  })

  it('returns failure for an unsupported capability', async () => {
    const res = await createAnthropicClient().execute(SONNET, 'image-generation', { prompt: 'x' })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unsupported capability/)
  })

  it('checkHealth reflects the API key presence', async () => {
    expect((await createAnthropicClient().checkHealth()).state).toBe('healthy')
    delete process.env.ANTHROPIC_API_KEY
    const down = await createAnthropicClient().checkHealth()
    expect(down.state).toBe('down')
    expect(down.error).toMatch(/ANTHROPIC_API_KEY/)
  })
})
