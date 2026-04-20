import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const FILES_UNDER_AUDIT = [
  'src/lib/core/models/providers/fal-ai.ts',
  'src/lib/core/models/providers/openai.ts',
  'src/lib/core/models/providers/google-gemini.ts',
  'src/lib/core/models/providers/freepik.ts',
  'src/lib/core/models/providers/elevenlabs.ts',
  'src/app/api/images/[filename]/route.ts',
]

const FORBIDDEN_LITERALS = [
  '"output/images"',
  "'output/images'",
  '"./output/images"',
  "'./output/images'",
  '"output/audio"',
  "'output/audio'",
  '"output/voice"',
  "'output/voice'",
  '"./output/voice"',
  "'./output/voice'",
  '"public/images"',
  "'public/images'",
]

describe('hard-coded output-path regression guard', () => {
  it.each(FILES_UNDER_AUDIT)('%s contains no forbidden literals', async (rel) => {
    const abs = resolve(process.cwd(), rel)
    let src: string
    try {
      src = await readFile(abs, 'utf8')
    } catch (err) {
      // elevenlabs.ts may not exist until Task 7 creates it; skip gracefully.
      if (rel.endsWith('elevenlabs.ts')) return
      throw err
    }
    for (const literal of FORBIDDEN_LITERALS) {
      expect(src, `${rel} contains forbidden literal ${literal}`).not.toContain(literal)
    }
  })
})
