import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import {
  fileExists,
  fileSize,
  imageDimensions,
  createImageValidators,
  IMAGE_VALIDATOR_DEFAULTS,
} from '../image-validators'

// ─── Minimal PNG builder ─────────────────────────────────────────────────
// Produces a structurally valid PNG with given dimensions. Optionally pads
// via a tEXt chunk so fileSize tests can exercise size thresholds.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function createTestPng(width: number, height: number, padToBytes?: number): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  // Single-row raw scanline (filter byte + RGB * width), deflated.
  const rowBytes = width * 3 + 1
  const raw = Buffer.alloc(rowBytes * height, 0)
  const idatData = deflateSync(raw)
  let png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
  ])
  if (padToBytes != null) {
    // IEND appended at end; compute padding before it.
    const iend = chunk('IEND', Buffer.alloc(0))
    const needed = padToBytes - png.length - iend.length
    if (needed > 12) {
      const padData = Buffer.alloc(needed - 12, 0x20) // chunk overhead = 12
      png = Buffer.concat([png, chunk('tEXt', padData), iend])
    } else {
      png = Buffer.concat([png, iend])
    }
  } else {
    png = Buffer.concat([png, chunk('IEND', Buffer.alloc(0))])
  }
  return png
}

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'img-val-'))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function writePng(name: string, width: number, height: number, padTo?: number): string {
  const p = join(tmp, name)
  writeFileSync(p, createTestPng(width, height, padTo))
  return p
}

// ─── fileExists ───────────────────────────────────────────────────────────

describe('fileExists', () => {
  it('passes for an existing file', () => {
    const p = writePng('ok.png', 1024, 1024, 20_000)
    const r = fileExists()({ imagePath: p })
    expect(r.pass).toBe(true)
  })
  it('fails for a missing file', () => {
    const r = fileExists()({ imagePath: join(tmp, 'nope.png') })
    expect(r.pass).toBe(false)
    expect(r.message).toMatch(/does not exist/)
  })
  it('fails for a directory', () => {
    const dir = join(tmp, 'adir')
    mkdirSync(dir)
    const r = fileExists()({ imagePath: dir })
    expect(r.pass).toBe(false)
    expect(r.message).toMatch(/not a file/)
  })
  it('fails for artifact without imagePath', () => {
    const r = fileExists()({ foo: 'bar' } as unknown)
    expect(r.pass).toBe(false)
    expect(r.message).toMatch(/missing imagePath/)
  })
  it('does not throw on null/undefined', () => {
    expect(fileExists()(null).pass).toBe(false)
    expect(fileExists()(undefined).pass).toBe(false)
  })
})

// ─── fileSize ─────────────────────────────────────────────────────────────

describe('fileSize', () => {
  it('passes for a normal-sized image', () => {
    const p = writePng('ok.png', 1024, 1024, 20_000)
    expect(fileSize()({ imagePath: p }).pass).toBe(true)
  })
  it('fails for empty file', () => {
    const p = join(tmp, 'empty.png')
    writeFileSync(p, Buffer.alloc(0))
    const r = fileSize()({ imagePath: p })
    expect(r.pass).toBe(false)
    expect(r.message).toMatch(/empty/)
  })
  it('fails for suspiciously small file', () => {
    const p = join(tmp, 'tiny.bin')
    writeFileSync(p, Buffer.alloc(50, 1))
    const r = fileSize()({ imagePath: p })
    expect(r.pass).toBe(false)
    expect(r.message).toMatch(/suspiciously small/)
  })
  it('fails for missing file without throwing', () => {
    const r = fileSize()({ imagePath: join(tmp, 'missing.png') })
    expect(r.pass).toBe(false)
  })
  it('respects custom min/max overrides', () => {
    const p = join(tmp, 's.bin')
    writeFileSync(p, Buffer.alloc(100, 1))
    expect(fileSize({ minFileSizeBytes: 50 })({ imagePath: p }).pass).toBe(true)
    expect(fileSize({ minFileSizeBytes: 200 })({ imagePath: p }).pass).toBe(false)
    expect(fileSize({ maxFileSizeBytes: 50 })({ imagePath: p }).pass).toBe(false)
  })
  it('fails for artifact without imagePath', () => {
    expect(fileSize()({} as unknown).message).toMatch(/missing imagePath/)
  })
  it('fails for files exceeding max', () => {
    const p = join(tmp, 'big.bin')
    writeFileSync(p, Buffer.alloc(200, 1))
    const r = fileSize({ minFileSizeBytes: 50, maxFileSizeBytes: 100 })({ imagePath: p })
    expect(r.pass).toBe(false)
    expect(r.message).toMatch(/exceeds maximum/)
  })
})

// ─── imageDimensions ──────────────────────────────────────────────────────

describe('imageDimensions', () => {
  it('passes 1024×1024', () => {
    const p = writePng('a.png', 1024, 1024)
    expect(imageDimensions()({ imagePath: p }).pass).toBe(true)
  })
  it('passes 1280×720', () => {
    const p = writePng('b.png', 1280, 720)
    expect(imageDimensions()({ imagePath: p }).pass).toBe(true)
  })
  it('passes 1920×1080', () => {
    const p = writePng('c.png', 1920, 1080)
    expect(imageDimensions()({ imagePath: p }).pass).toBe(true)
  })
  it('fails 100×100', () => {
    const p = writePng('d.png', 100, 100)
    const r = imageDimensions()({ imagePath: p })
    expect(r.pass).toBe(false)
    expect(r.message).toMatch(/100×100/)
  })
  it('fails 800×600', () => {
    const p = writePng('e.png', 800, 600)
    expect(imageDimensions()({ imagePath: p }).pass).toBe(false)
  })
  it('fails 1280×500 (widescreen width OK, height short)', () => {
    const p = writePng('f.png', 1280, 500)
    expect(imageDimensions()({ imagePath: p }).pass).toBe(false)
  })
  it('fails missing file without throwing', () => {
    const r = imageDimensions()({ imagePath: join(tmp, 'nope.png') })
    expect(r.pass).toBe(false)
  })
  it('fails artifact without imagePath', () => {
    expect(imageDimensions()(null).message).toMatch(/missing imagePath/)
  })
})

// ─── createImageValidators ────────────────────────────────────────────────

describe('createImageValidators', () => {
  it('returns exactly 3 validators in order', () => {
    const p = writePng('a.png', 1024, 1024, 20_000)
    const vs = createImageValidators()
    expect(vs).toHaveLength(3)
    const results = vs.map((v) => v({ imagePath: p }))
    expect(results.map((r) => r.name)).toEqual([
      'fileExists',
      'fileSize',
      'imageDimensions',
    ])
  })
  it('all pass for a valid 1024×1024 image', () => {
    const p = writePng('a.png', 1024, 1024, 20_000)
    const results = createImageValidators().map((v) => v({ imagePath: p }))
    expect(results.every((r) => r.pass)).toBe(true)
  })
  it('all fail gracefully for a missing file (no throw)', () => {
    const results = createImageValidators().map((v) =>
      v({ imagePath: join(tmp, 'missing.png') })
    )
    expect(results.every((r) => !r.pass)).toBe(true)
  })
  it('file-exists passes, file-size fails on tiny corrupt file', () => {
    const p = join(tmp, 'tiny.bin')
    writeFileSync(p, Buffer.alloc(50, 1))
    const [exists, size] = createImageValidators().map((v) => v({ imagePath: p }))
    expect(exists.pass).toBe(true)
    expect(size.pass).toBe(false)
  })
  it('custom options override defaults', () => {
    const p = writePng('a.png', 800, 600, 20_000)
    const vs = createImageValidators({ minWidth: 500, minHeight: 500 })
    const dimResult = vs[2]({ imagePath: p })
    expect(dimResult.pass).toBe(true)
  })
  it('defaults match IMAGE_VALIDATOR_DEFAULTS', () => {
    expect(IMAGE_VALIDATOR_DEFAULTS.minFileSizeBytes).toBe(10_240)
    expect(IMAGE_VALIDATOR_DEFAULTS.maxFileSizeBytes).toBe(20 * 1024 * 1024)
    expect(IMAGE_VALIDATOR_DEFAULTS.minWidth).toBe(1024)
    expect(IMAGE_VALIDATOR_DEFAULTS.minHeight).toBe(1024)
    expect(IMAGE_VALIDATOR_DEFAULTS.minWidescreenWidth).toBe(1280)
    expect(IMAGE_VALIDATOR_DEFAULTS.minWidescreenHeight).toBe(720)
  })
})
