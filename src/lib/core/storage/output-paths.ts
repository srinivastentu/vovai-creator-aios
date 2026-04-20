import { mkdir } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'

const resolveBase = (): string => {
  const fromEnv = process.env.OUTPUT_BASE_DIR
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return resolve(fromEnv)
  return resolve(process.cwd())
}

const base = resolveBase()

export const OUTPUT_DIRS = Object.freeze({
  text: join(base, 'output', 'text'),
  image: join(base, 'output', 'images'),
  voice: join(base, 'output', 'voice'),
  music: join(base, 'output', 'music'),
  video: join(base, 'output', 'video'),
  costLedger: join(base, 'output', 'cost-ledger'),
} as const)

export type OutputKind = keyof typeof OUTPUT_DIRS

export const getOutputBase = (): string => base

const FORBIDDEN_NAME = new Set(['.', '..'])

export const resolveOutputPath = (kind: OutputKind, filename: string): string => {
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('filename must be a non-empty string')
  }
  if (filename.includes('\0')) {
    throw new Error('filename contains null byte')
  }
  if (filename.includes('/') || filename.includes('\\')) {
    throw new Error('filename must not contain path separators')
  }
  if (FORBIDDEN_NAME.has(filename)) {
    throw new Error(`filename reserved: ${filename}`)
  }
  if (isAbsolute(filename)) {
    throw new Error('filename must be relative')
  }
  return join(OUTPUT_DIRS[kind], filename)
}

export const ensureOutputDir = async (kind: OutputKind): Promise<string> => {
  const dir = OUTPUT_DIRS[kind]
  await mkdir(dir, { recursive: true })
  return dir
}
