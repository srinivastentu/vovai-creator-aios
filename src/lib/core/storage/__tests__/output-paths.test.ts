import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, isAbsolute } from 'node:path'

describe('output-paths', () => {
  let tmpBase: string
  let originalBase: string | undefined

  beforeEach(async () => {
    tmpBase = await mkdtemp(join(tmpdir(), 'vovai-output-'))
    originalBase = process.env.OUTPUT_BASE_DIR
    process.env.OUTPUT_BASE_DIR = tmpBase
    vi.resetModules()
  })

  afterEach(async () => {
    if (originalBase === undefined) delete process.env.OUTPUT_BASE_DIR
    else process.env.OUTPUT_BASE_DIR = originalBase
    await rm(tmpBase, { recursive: true, force: true })
  })

  it('OUTPUT_DIRS has all required keys, all absolute', async () => {
    const { OUTPUT_DIRS } = await import('../output-paths')
    for (const key of ['text', 'image', 'voice', 'music', 'video', 'costLedger'] as const) {
      expect(OUTPUT_DIRS[key]).toBeTypeOf('string')
      expect(OUTPUT_DIRS[key].length).toBeGreaterThan(0)
      expect(isAbsolute(OUTPUT_DIRS[key])).toBe(true)
    }
  })

  it('getOutputBase honors OUTPUT_BASE_DIR', async () => {
    const { getOutputBase } = await import('../output-paths')
    expect(getOutputBase()).toBe(tmpBase)
  })

  it('resolveOutputPath joins cleanly', async () => {
    const { resolveOutputPath, OUTPUT_DIRS } = await import('../output-paths')
    const p = resolveOutputPath('image', 'foo.png')
    expect(p).toBe(join(OUTPUT_DIRS.image, 'foo.png'))
  })

  it.each([
    ['../etc/passwd'],
    ['/abs/foo'],
    ['foo/bar.png'],
    ['foo\\bar.png'],
    ['\u0000evil'],
    [''],
    ['.'],
    ['..'],
  ])('resolveOutputPath rejects traversal/abs/empty: %s', async (bad) => {
    const { resolveOutputPath } = await import('../output-paths')
    expect(() => resolveOutputPath('image', bad)).toThrow()
  })

  it('ensureOutputDir creates the dir and is idempotent', async () => {
    const { ensureOutputDir, OUTPUT_DIRS } = await import('../output-paths')
    const first = await ensureOutputDir('voice')
    const second = await ensureOutputDir('voice')
    expect(first).toBe(OUTPUT_DIRS.voice)
    expect(second).toBe(OUTPUT_DIRS.voice)
    const s = await stat(OUTPUT_DIRS.voice)
    expect(s.isDirectory()).toBe(true)
  })

  it('no I/O at import time', async () => {
    await rm(tmpBase, { recursive: true, force: true })
    await expect(import('../output-paths')).resolves.toBeTruthy()
  })
})
