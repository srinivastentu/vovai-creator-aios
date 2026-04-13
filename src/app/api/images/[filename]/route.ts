import { readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OUTPUT_DIR = join(process.cwd(), 'output', 'images')

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

function isSafeFilename(name: string): boolean {
  if (!name || name.length > 255) return false
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return false
  if (name === '.' || name === '..' || name.startsWith('.')) return false
  return true
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
): Promise<Response> {
  const { filename } = await params
  if (!isSafeFilename(filename)) {
    return new Response('Bad filename', { status: 400 })
  }

  const ext = extname(filename).toLowerCase()
  const contentType = CONTENT_TYPES[ext]
  if (!contentType) {
    return new Response('Unsupported file type', { status: 400 })
  }

  const filePath = join(OUTPUT_DIR, filename)
  try {
    const s = await stat(filePath)
    if (!s.isFile()) return new Response('Not found', { status: 404 })
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const buf = await readFile(filePath)
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
