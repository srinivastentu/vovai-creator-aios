// Deterministic Stage 2 validator — runs BEFORE the LLM judge (loop rule 6).
// A dossier that fails here never reaches the expensive judge.

import type { ValidationResult } from '../../../../core/engine/types'
import type { ResearchDossier } from '../types'

export const MIN_SOURCES = 3

/** True for syntactically valid http(s) URLs. */
export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate a ResearchDossier: at least MIN_SOURCES sources, every URL
 * well-formed. Mirrors the Core `ValidationResult` shape so it plugs straight
 * into `LoopStage.validator`.
 */
export function validateDossier(dossier: ResearchDossier): ValidationResult {
  const errors: { code: string; message: string }[] = []

  const count = dossier.sources.length
  if (count < MIN_SOURCES) {
    errors.push({
      code: 'too_few_sources',
      message: `dossier has ${count} source(s); need at least ${MIN_SOURCES}`,
    })
  }

  const badUrls = dossier.sources
    .map((s) => s.url)
    .filter((url) => !isValidUrl(url))
  if (badUrls.length > 0) {
    errors.push({
      code: 'invalid_url',
      message: `malformed URL(s): ${badUrls.slice(0, 3).join(', ')}${
        badUrls.length > 3 ? ` (+${badUrls.length - 3} more)` : ''
      }`,
    })
  }

  return { valid: errors.length === 0, errors }
}
