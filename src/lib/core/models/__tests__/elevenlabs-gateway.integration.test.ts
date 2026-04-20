import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createModelCatalog } from '../catalog'
import { createCostLedger } from '../cost-ledger'
import { createModelGateway } from '../gateway'
import { createProviderRegistry } from '../providers/registry'
import { createElevenLabsClient } from '../providers/elevenlabs'
import { getDefaultModels, getDefaultProviders } from '../config/model-inventory'

const mp3 = (): ArrayBuffer => {
  const u = new Uint8Array(64)
  u[0] = 0xff
  u[1] = 0xfb
  return u.buffer
}

describe('ElevenLabs ↔ gateway integration', () => {
  let tmpDir: string
  let originalKey: string | undefined

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'eleven-gw-'))
    originalKey = process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_API_KEY = 'test-key'
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY
    else process.env.ELEVENLABS_API_KEY = originalKey
    vi.restoreAllMocks()
  })

  it('voice-synthesis request routes to ElevenLabs, writes mp3, records cost', async () => {
    const catalog = createModelCatalog()
    const registry = createProviderRegistry()
    const ledger = createCostLedger()

    for (const p of getDefaultProviders()) {
      if (p.id === 'elevenlabs') {
        const fetchMock = vi.fn().mockResolvedValue(
          new Response(mp3(), {
            status: 200,
            headers: { 'content-type': 'audio/mpeg' },
          }),
        )
        registry.registerProvider(
          p,
          createElevenLabsClient({
            apiKey: 'test',
            outputDir: tmpDir,
            fetchImpl: fetchMock,
          }),
        )
      }
    }
    for (const m of getDefaultModels()) {
      if (m.providerId === 'elevenlabs') catalog.registerModel(m)
    }

    const gw = createModelGateway({
      catalog,
      providerRegistry: registry,
      costLedger: ledger,
    })

    const res = await gw.request({
      capability: 'voice-synthesis',
      params: { text: 'Hello, world!', voiceId: 'test-voice' },
      preferences: { modelId: 'eleven-turbo-v2-5' },
      context: { callerTag: 'integration-test' },
    })

    expect(res.success).toBe(true)
    expect(res.modelId).toBe('eleven-turbo-v2-5')
    expect(res.providerId).toBe('elevenlabs')
    expect(res.capability).toBe('voice-synthesis')
    expect(res.result.filePath).toBeTruthy()
    expect((res.result.filePath as string).startsWith(tmpDir)).toBe(true)
    expect(res.result.mimeType).toBe('audio/mpeg')
    expect(res.result.characters).toBe('Hello, world!'.length)

    const records = ledger.getByProvider('elevenlabs')
    const voiceRecords = records.filter((r) => r.capability === 'voice-synthesis')
    expect(voiceRecords.length).toBe(1)
    const [record] = voiceRecords
    expect(record.modelId).toBe('eleven-turbo-v2-5')
    expect(record.providerId).toBe('elevenlabs')
    expect(record.success).toBe(true)
    expect(record.costUsd).toBeCloseTo('Hello, world!'.length * 0.00005, 10)
  })

  it('getAvailableModels returns active voice-synthesis models, excludes disabled', async () => {
    const catalog = createModelCatalog()
    const registry = createProviderRegistry()
    for (const p of getDefaultProviders()) {
      if (p.id === 'elevenlabs') {
        registry.registerProvider(
          p,
          createElevenLabsClient({ apiKey: 'test', outputDir: tmpDir, fetchImpl: vi.fn() }),
        )
      }
    }
    for (const m of getDefaultModels()) {
      if (m.providerId === 'elevenlabs') catalog.registerModel(m)
    }
    const gw = createModelGateway({ catalog, providerRegistry: registry })
    const ids = gw.getAvailableModels('voice-synthesis').map((m) => m.id).sort()
    expect(ids).toContain('eleven-turbo-v2-5')
    expect(ids).toContain('eleven-multilingual-v2')
    // eleven-v3 is disabled and must not be surfaced.
    expect(ids).not.toContain('eleven-v3')
  })
})
