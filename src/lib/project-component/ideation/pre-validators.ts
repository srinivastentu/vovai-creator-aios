/**
 * Deterministic Pre-Validators — cheap programmatic checks that run
 * BEFORE the expensive LLM rubric grader.
 *
 * Catches obvious structural failures without burning API tokens.
 * Level 1 (Engine) — validates structure shape, not eLearning semantics.
 */

import type { ProposedStructure } from '../types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a proposed structure passes minimum structural requirements.
 * Run this before sending to the LLM rubric grader.
 */
export function validateStructure(structure: ProposedStructure): ValidationResult {
  const errors: string[] = []

  // Must have at least 1 module
  if (!structure.modules || structure.modules.length === 0) {
    errors.push('Structure must contain at least 1 module.')
  }

  // Each module must have at least 1 topic
  for (const mod of structure.modules ?? []) {
    if (!mod.topics || mod.topics.length === 0) {
      errors.push(`Module "${mod.title}" has no topics.`)
    }
  }

  // No empty titles
  if (!structure.courseTitle?.trim()) {
    errors.push('Course title is empty.')
  }
  for (const mod of structure.modules ?? []) {
    if (!mod.title?.trim()) {
      errors.push('A module has an empty title.')
    }
    for (const topic of mod.topics ?? []) {
      if (!topic.title?.trim()) {
        errors.push(`A topic in module "${mod.title}" has an empty title.`)
      }
    }
  }

  // No empty descriptions on modules
  for (const mod of structure.modules ?? []) {
    if (!mod.description?.trim()) {
      errors.push(`Module "${mod.title}" has no description.`)
    }
  }

  return { valid: errors.length === 0, errors }
}
