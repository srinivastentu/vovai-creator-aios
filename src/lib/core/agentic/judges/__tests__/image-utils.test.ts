import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readImageAsBase64 } from '../image-utils'

const FIX = resolve(__dirname, 'fixtures')

describe('readImageAsBase64', () => {
  it('reads a PNG fixture and returns base64 + image/png', async () => {
    const r = await readImageAsBase64(resolve(FIX, 'test-image.png'))
    expect(r).not.toBeNull()
    expect(r!.mimeType).toBe('image/png')
    expect(r!.data.length).toBeGreaterThan(0)
    // Valid base64 only
    expect(/^[A-Za-z0-9+/]+={0,2}$/.test(r!.data)).toBe(true)
  })

  it('reads a JPEG fixture and returns image/jpeg', async () => {
    const r = await readImageAsBase64(resolve(FIX, 'test-image.jpg'))
    expect(r).not.toBeNull()
    expect(r!.mimeType).toBe('image/jpeg')
  })

  it('returns null for a non-existent file', async () => {
    const r = await readImageAsBase64(resolve(FIX, 'does-not-exist.png'))
    expect(r).toBeNull()
  })

  it('returns null for an unsupported extension', async () => {
    const r = await readImageAsBase64(resolve(FIX, 'ignored.bmp'))
    expect(r).toBeNull()
  })

  it('returns null (does not throw) for empty path', async () => {
    await expect(readImageAsBase64('')).resolves.toBeNull()
  })

  it('returns null for non-string input', async () => {
    // @ts-expect-error intentionally passing wrong type to confirm no throw
    await expect(readImageAsBase64(undefined)).resolves.toBeNull()
  })
})
