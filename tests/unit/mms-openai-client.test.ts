import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rm } from 'node:fs/promises'

const imagesGenerate = vi.fn()
const chatCreate = vi.fn()

vi.mock('openai', () => {
  class APIError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'APIError'
      this.status = status
    }
  }
  class OpenAI {
    images = { generate: imagesGenerate }
    chat = { completions: { create: chatCreate } }
  }
  return { default: OpenAI, APIError }
})

import { APIError as MockAPIError } from 'openai'
import { createOpenAiClient } from '../../src/lib/core/models/providers/openai'

const DALL_E = 'dall-e-3'
const GPT_4O = 'gpt-4o'

const makeImageResponse = (bytes = new Uint8Array([1, 2, 3, 4])): Response =>
  ({
    ok: true,
    status: 200,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => bytes.buffer,
  }) as unknown as Response

const defaultImageParams = {
  prompt: 'A futuristic city at sunset',
  outputDir: '/tmp/test-openai-out',
}

describe('createOpenAiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-xyz'
    imagesGenerate.mockReset()
    chatCreate.mockReset()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    delete process.env.OPENAI_API_KEY
    vi.unstubAllGlobals()
    await rm('/tmp/test-openai-out', { recursive: true, force: true }).catch(() => {})
  })

  it('has providerId "openai"', () => {
    expect(createOpenAiClient().providerId).toBe('openai')
  })

  // --- Image Generation ---

  it('returns failure when OPENAI_API_KEY is missing, without calling SDK', async () => {
    delete process.env.OPENAI_API_KEY
    const res = await createOpenAiClient().execute(
      DALL_E,
      'image-generation',
      defaultImageParams,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/OPENAI_API_KEY/)
    expect(imagesGenerate).not.toHaveBeenCalled()
  })

  it('generates a standard DALL-E 3 image successfully', async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [{ url: 'https://openai.example/img.png', revised_prompt: 'revised!' }],
    })
    fetchMock.mockResolvedValueOnce(makeImageResponse())
    const res = await createOpenAiClient().execute(
      DALL_E,
      'image-generation',
      defaultImageParams,
    )
    expect(res.success).toBe(true)
    expect(res.filePath).toMatch(/openai-dalle3-standard-.+\.png$/)
    expect(res.dimensions).toEqual({ width: 1024, height: 1024 })
    expect(res.mimeType).toBe('image/png')
    expect(res.revisedPrompt).toBe('revised!')
    expect(imagesGenerate.mock.calls[0][0].quality).toBe('standard')
  })

  it('generates HD when params.quality = "hd"', async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [{ url: 'https://openai.example/img.png' }],
    })
    fetchMock.mockResolvedValueOnce(makeImageResponse())
    const res = await createOpenAiClient().execute(DALL_E, 'image-generation', {
      ...defaultImageParams,
      quality: 'hd',
    })
    expect(res.success).toBe(true)
    expect(imagesGenerate.mock.calls[0][0].quality).toBe('hd')
    expect(res.filePath).toMatch(/openai-dalle3-hd-/)
  })

  it('defaults to 1024x1024 when no dimensions provided', async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [{ url: 'https://openai.example/img.png' }],
    })
    fetchMock.mockResolvedValueOnce(makeImageResponse())
    await createOpenAiClient().execute(DALL_E, 'image-generation', defaultImageParams)
    expect(imagesGenerate.mock.calls[0][0].size).toBe('1024x1024')
  })

  it('maps landscape dimensions to 1792x1024', async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [{ url: 'https://openai.example/img.png' }],
    })
    fetchMock.mockResolvedValueOnce(makeImageResponse())
    const res = await createOpenAiClient().execute(DALL_E, 'image-generation', {
      ...defaultImageParams,
      width: 1920,
      height: 1080,
    })
    expect(imagesGenerate.mock.calls[0][0].size).toBe('1792x1024')
    expect(res.dimensions).toEqual({ width: 1792, height: 1024 })
  })

  it('maps portrait dimensions to 1024x1792', async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [{ url: 'https://openai.example/img.png' }],
    })
    fetchMock.mockResolvedValueOnce(makeImageResponse())
    const res = await createOpenAiClient().execute(DALL_E, 'image-generation', {
      ...defaultImageParams,
      width: 1080,
      height: 1920,
    })
    expect(imagesGenerate.mock.calls[0][0].size).toBe('1024x1792')
    expect(res.dimensions).toEqual({ width: 1024, height: 1792 })
  })

  it('captures revised_prompt in metadata', async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [
        { url: 'https://openai.example/img.png', revised_prompt: 'ENHANCED PROMPT' },
      ],
    })
    fetchMock.mockResolvedValueOnce(makeImageResponse())
    const res = await createOpenAiClient().execute(
      DALL_E,
      'image-generation',
      defaultImageParams,
    )
    expect(res.revisedPrompt).toBe('ENHANCED PROMPT')
  })

  it('appends style and negative prompt to outgoing prompt', async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [{ url: 'https://openai.example/img.png' }],
    })
    fetchMock.mockResolvedValueOnce(makeImageResponse())
    await createOpenAiClient().execute(DALL_E, 'image-generation', {
      ...defaultImageParams,
      style: 'watercolor',
      negativePrompt: 'blurry, text',
    })
    const sent = imagesGenerate.mock.calls[0][0].prompt as string
    expect(sent).toContain(defaultImageParams.prompt)
    expect(sent).toContain('Style: watercolor')
    expect(sent).toContain('Do NOT include: blurry, text')
  })

  it('maps SDK APIError 429 to Rate limited failure', async () => {
    imagesGenerate.mockRejectedValueOnce(new (MockAPIError as unknown as new (s: number, m: string) => Error)(429, 'too many'))
    const res = await createOpenAiClient().execute(
      DALL_E,
      'image-generation',
      defaultImageParams,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Rate limited/)
  })

  it('maps SDK APIError 500 to Server error failure', async () => {
    imagesGenerate.mockRejectedValueOnce(new (MockAPIError as unknown as new (s: number, m: string) => Error)(500, 'boom'))
    const res = await createOpenAiClient().execute(
      DALL_E,
      'image-generation',
      defaultImageParams,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Server error 500/)
  })

  it('fails when response has no image URL', async () => {
    imagesGenerate.mockResolvedValueOnce({ data: [] })
    const res = await createOpenAiClient().execute(
      DALL_E,
      'image-generation',
      defaultImageParams,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/No image URL/)
  })

  it('fails when image download fails', async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [{ url: 'https://openai.example/img.png' }],
    })
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response)
    const res = await createOpenAiClient().execute(
      DALL_E,
      'image-generation',
      defaultImageParams,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Image download failed/)
  })

  // --- Image Scoring ---

  it('calls chat completions with pre-built messages', async () => {
    const preMessages = [
      { role: 'system', content: 'you are a judge' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'score this' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAA' },
          },
        ],
      },
    ]
    chatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"score": 0.9}' } }],
      usage: { prompt_tokens: 1500, completion_tokens: 40 },
    })
    const res = await createOpenAiClient().execute(GPT_4O, 'image-scoring', {
      messages: preMessages,
    })
    expect(res.success).toBe(true)
    expect(res.content).toBe('{"score": 0.9}')
    expect(res.tokensIn).toBe(1500)
    expect(res.tokensOut).toBe(40)
    expect(chatCreate.mock.calls[0][0].messages).toEqual(preMessages)
  })

  it('builds messages from systemPrompt + userContent', async () => {
    chatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    })
    const userContent = [{ type: 'text', text: 'hi' }]
    await createOpenAiClient().execute(GPT_4O, 'image-scoring', {
      systemPrompt: 'be terse',
      userContent,
    })
    const sent = chatCreate.mock.calls[0][0].messages
    expect(sent[0]).toEqual({ role: 'system', content: 'be terse' })
    expect(sent[1]).toEqual({ role: 'user', content: userContent })
  })

  it('sends temperature 0 for scoring', async () => {
    chatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })
    await createOpenAiClient().execute(GPT_4O, 'image-scoring', {
      messages: [{ role: 'user', content: 'x' }],
    })
    expect(chatCreate.mock.calls[0][0].temperature).toBe(0)
  })

  it('returns failure when scoring SDK throws', async () => {
    chatCreate.mockRejectedValueOnce(new (MockAPIError as unknown as new (s: number, m: string) => Error)(500, 'nope'))
    const res = await createOpenAiClient().execute(GPT_4O, 'image-scoring', {
      messages: [{ role: 'user', content: 'x' }],
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Server error 500/)
  })

  it('returns failure when neither messages nor systemPrompt provided', async () => {
    const res = await createOpenAiClient().execute(GPT_4O, 'image-scoring', {})
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/messages or systemPrompt/)
    expect(chatCreate).not.toHaveBeenCalled()
  })

  it('returns failure when scoring called without API key', async () => {
    delete process.env.OPENAI_API_KEY
    const res = await createOpenAiClient().execute(GPT_4O, 'image-scoring', {
      messages: [{ role: 'user', content: 'x' }],
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/OPENAI_API_KEY/)
    expect(chatCreate).not.toHaveBeenCalled()
  })

  // --- Unsupported capability ---

  it('returns failure for unsupported capability', async () => {
    const res = await createOpenAiClient().execute(
      DALL_E,
      'text-generation',
      defaultImageParams,
    )
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Unsupported capability/)
  })

  // --- Health ---

  it('checkHealth returns healthy when OPENAI_API_KEY set', async () => {
    const res = await createOpenAiClient().checkHealth()
    expect(res.state).toBe('healthy')
    expect(res.providerId).toBe('openai')
  })

  it('checkHealth returns down when OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY
    const res = await createOpenAiClient().checkHealth()
    expect(res.state).toBe('down')
    expect(res.error).toMatch(/OPENAI_API_KEY/)
  })
})
