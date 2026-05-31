// Deterministic Stage 5a (LinkedIn) validator — runs BEFORE any judge (loop
// rule 6). A post that fails here never reaches the judge; the loop revises.
//
// Checks (docs/02-domain/rubrics.md Stage 5a row + entities.md artifact registry):
//   - charCount in [1300, 3000]
//   - ≥2 paragraph breaks (blank-line separators → scannable, no wall of text)
//   - first 3 lines present (the hook earns the rest of the read)
//
// In CR-4 the validator is the ONLY real quality gate (no LLM judge until CR-5).

import type { ValidationResult } from '../../../../core/engine/types'
import type { LinkedInArtifact } from '../types'

export const LINKEDIN_MIN_CHARS = 1300
export const LINKEDIN_MAX_CHARS = 3000
export const LINKEDIN_MIN_PARAGRAPH_BREAKS = 2
export const LINKEDIN_MIN_HOOK_LINES = 3

/** Count blank-line separators (a run of ≥1 blank line between text blocks). */
export function countParagraphBreaks(text: string): number {
  const matches = text.match(/\n[ \t]*\n/g)
  return matches ? matches.length : 0
}

/** Count non-empty lines (the hook needs at least a few). */
export function countNonEmptyLines(text: string): number {
  return text.split('\n').filter((l) => l.trim().length > 0).length
}

export function validateLinkedInPost(artifact: LinkedInArtifact): ValidationResult {
  const errors: { code: string; message: string }[] = []
  const text = artifact.text ?? ''
  const chars = text.length

  if (chars < LINKEDIN_MIN_CHARS) {
    errors.push({
      code: 'too_short',
      message: `post is ${chars} chars; need at least ${LINKEDIN_MIN_CHARS}`,
    })
  }
  if (chars > LINKEDIN_MAX_CHARS) {
    errors.push({
      code: 'too_long',
      message: `post is ${chars} chars; LinkedIn caps at ${LINKEDIN_MAX_CHARS}`,
    })
  }

  const breaks = countParagraphBreaks(text)
  if (breaks < LINKEDIN_MIN_PARAGRAPH_BREAKS) {
    errors.push({
      code: 'too_few_paragraph_breaks',
      message: `post has ${breaks} paragraph break(s); need at least ${LINKEDIN_MIN_PARAGRAPH_BREAKS} for scannability`,
    })
  }

  const lines = countNonEmptyLines(text)
  if (lines < LINKEDIN_MIN_HOOK_LINES) {
    errors.push({
      code: 'missing_hook_lines',
      message: `post has ${lines} non-empty line(s); the hook needs at least ${LINKEDIN_MIN_HOOK_LINES}`,
    })
  }

  return { valid: errors.length === 0, errors }
}
