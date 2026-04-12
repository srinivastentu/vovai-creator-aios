// Text validators — deterministic, zero-cost gates that run BEFORE the AI judge.
// Pure functions. No network, no disk, no domain imports.

import type { ValidationResult } from '../../engine/types'

export interface ValidatorResult {
  pass: boolean
  name: string
  message: string
}

export type Validator<T = unknown> = (artifact: T) => ValidatorResult

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractContent(artifact: unknown): string | null {
  if (artifact == null) return null
  if (typeof artifact === 'string') return artifact
  if (typeof artifact === 'object') {
    const obj = artifact as { content?: unknown; text?: unknown }
    if (typeof obj.content === 'string') return obj.content
    if (typeof obj.text === 'string') return obj.text
  }
  return null
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 0
  return trimmed.split(/\s+/).length
}

// ─── Validators ───────────────────────────────────────────────────────────

export function notEmpty(): Validator {
  return (artifact) => {
    const content = extractContent(artifact)
    if (content == null) {
      return {
        pass: false,
        name: 'notEmpty',
        message: 'Artifact content is null or undefined',
      }
    }
    if (content.trim().length === 0) {
      return {
        pass: false,
        name: 'notEmpty',
        message: 'Artifact content is empty or whitespace-only',
      }
    }
    return { pass: true, name: 'notEmpty', message: 'Content is non-empty' }
  }
}

export interface WordCountOptions {
  min?: number
  max?: number
}

export function wordCount(options: WordCountOptions = {}): Validator {
  const min = options.min ?? 200
  const max = options.max ?? 10_000
  return (artifact) => {
    const content = extractContent(artifact) ?? ''
    const n = countWords(content)
    if (n < min) {
      return {
        pass: false,
        name: 'wordCount',
        message: `Word count ${n} is below minimum ${min}`,
      }
    }
    if (n > max) {
      return {
        pass: false,
        name: 'wordCount',
        message: `Word count ${n} exceeds maximum ${max}`,
      }
    }
    return {
      pass: true,
      name: 'wordCount',
      message: `Word count ${n} within [${min}, ${max}]`,
    }
  }
}

// Sentence-terminator chars plus common closers (quotes, parens, brackets,
// and closing code-block brace) that legitimately end a finished artifact.
const COMPLETE_ENDINGS = new Set([
  '.', '!', '?', '"', "'", ')', ']', '}', '`',
  '\u201D', // right double quote
  '\u2019', // right single quote
])

export function completenessCheck(): Validator {
  return (artifact) => {
    const raw = extractContent(artifact) ?? ''
    const content = raw.trimEnd()
    if (content.length === 0) {
      return {
        pass: false,
        name: 'completenessCheck',
        message: 'Empty content cannot be complete',
      }
    }
    // Ellipsis indicates truncation, not completion.
    if (content.endsWith('...') || content.endsWith('\u2026')) {
      return {
        pass: false,
        name: 'completenessCheck',
        message: 'Content ends with ellipsis — likely truncated',
      }
    }
    const last = content[content.length - 1]
    if (!COMPLETE_ENDINGS.has(last)) {
      return {
        pass: false,
        name: 'completenessCheck',
        message: `Content ends mid-sentence (last char: ${JSON.stringify(last)})`,
      }
    }
    return {
      pass: true,
      name: 'completenessCheck',
      message: 'Content ends with a complete terminator',
    }
  }
}

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[TODO\]/i,
  /\[PLACEHOLDER\]/i,
  /\[INSERT[^\]]*\]/i,
  /\[FIXME\]/i,
  /lorem ipsum/i,
]

export function noPlaceholderContent(): Validator {
  return (artifact) => {
    const content = extractContent(artifact) ?? ''
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = pattern.exec(content)
      if (match) {
        return {
          pass: false,
          name: 'noPlaceholderContent',
          message: `Placeholder pattern detected: ${match[0]}`,
        }
      }
    }
    return {
      pass: true,
      name: 'noPlaceholderContent',
      message: 'No placeholder markers found',
    }
  }
}

// ─── Runner + engine bridge ───────────────────────────────────────────────

export function runValidators<T>(
  validators: Validator<T>[],
  artifact: T
): ValidatorResult[] {
  return validators.map((v) => v(artifact))
}

// Adapts an array of text validators into the engine's single-validator hook
// on LoopStage. All validators run; failures become ValidationResult.errors.
export function toStageValidator<T>(
  validators: Validator<T>[]
): (artifact: T) => ValidationResult {
  return (artifact) => {
    const results = runValidators(validators, artifact)
    const failures = results.filter((r) => !r.pass)
    return {
      valid: failures.length === 0,
      errors: failures.map((f) => ({ code: f.name, message: f.message })),
    }
  }
}
