// Deterministic Stage 3 validator — runs BEFORE the LLM judge (loop rule 6).
// A master that fails here never reaches the expensive judge.
//
// Checks (docs/02-domain/rubrics.md, Stage 3 row):
//   - ≥3 sections
//   - every section has a non-empty heading + contentMarkdown
//   - every section has ≥1 SourceRef
//   - every SourceRef resolves to a source in the dossier (the artifact's
//     own `sources` pool — kept on the artifact so this stays pure)
//   - total word count ≥ 800

import type { ValidationResult } from '../../../../core/engine/types'
import type { MasterArtifact } from '../types'

export const MIN_SECTIONS = 3
export const MIN_WORDS = 800

/** Count whitespace-delimited words across all section bodies + headings. */
export function masterWordCount(master: MasterArtifact): number {
  return master.sections.reduce((total, s) => {
    const text = `${s.heading} ${s.contentMarkdown}`.trim()
    if (!text) return total
    return total + text.split(/\s+/).filter(Boolean).length
  }, 0)
}

export function validateMaster(master: MasterArtifact): ValidationResult {
  const errors: { code: string; message: string }[] = []

  if (master.sections.length < MIN_SECTIONS) {
    errors.push({
      code: 'too_few_sections',
      message: `master has ${master.sections.length} section(s); need at least ${MIN_SECTIONS}`,
    })
  }

  const validIds = new Set(master.sources.map((s) => s.researchSourceId))

  master.sections.forEach((section, i) => {
    const label = `section ${i + 1}${section.heading ? ` ("${section.heading}")` : ''}`

    if (!section.heading || !section.heading.trim()) {
      errors.push({ code: 'missing_heading', message: `${label} has no heading` })
    }
    if (!section.contentMarkdown || !section.contentMarkdown.trim()) {
      errors.push({ code: 'missing_content', message: `${label} has no content` })
    }
    if (section.sourceRefs.length === 0) {
      errors.push({ code: 'untraced_section', message: `${label} has no SourceRef` })
    }

    const unresolved = section.sourceRefs
      .map((r) => r.researchSourceId)
      .filter((id) => !validIds.has(id))
    if (unresolved.length > 0) {
      errors.push({
        code: 'unresolved_source_ref',
        message: `${label} cites source id(s) not in the dossier: ${unresolved
          .slice(0, 3)
          .join(', ')}${unresolved.length > 3 ? ` (+${unresolved.length - 3} more)` : ''}`,
      })
    }
  })

  const words = masterWordCount(master)
  if (words < MIN_WORDS) {
    errors.push({
      code: 'too_short',
      message: `master is ${words} words; need at least ${MIN_WORDS}`,
    })
  }

  return { valid: errors.length === 0, errors }
}
