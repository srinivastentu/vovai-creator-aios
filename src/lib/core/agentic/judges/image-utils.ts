// Read an image file and return base64 + mime type.
// Never throws; returns null on any error or unsupported format.

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export interface ImageBase64 {
  data: string
  mimeType: string
}

export async function readImageAsBase64(
  filePath: string,
): Promise<ImageBase64 | null> {
  if (typeof filePath !== 'string' || filePath.length === 0) return null
  const ext = extname(filePath).toLowerCase()
  const mimeType = MIME_BY_EXT[ext]
  if (!mimeType) return null
  try {
    const buf = await readFile(filePath)
    return { data: buf.toString('base64'), mimeType }
  } catch {
    return null
  }
}
