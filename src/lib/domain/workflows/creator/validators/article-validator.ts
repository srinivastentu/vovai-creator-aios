// Deterministic Stage 5b (long-form article) validator — runs BEFORE any judge
// (loop rule 6). An article that fails here never reaches the judge; the loop
// revises.
//
// Checks (docs/02-domain/rubrics.md Stage 5b row + entities.md artifact registry):
//   - wordCount in [1200, 3000]
//   - ≥2 H2 sections (markdown `## ` headings)
//   - explicit intro (prose between the H1 title and the first H2)
//   - explicit conclusion (the final H2 reads as a wrap-up)
//
// In CR-4 the validator is the ONLY real quality gate (no LLM judge until CR-5).

import type { ValidationResult } from '../../../../core/engine/types'
import type { ArticleArtifact } from '../types'

export const ARTICLE_MIN_WORDS = 1200
export const ARTICLE_MAX_WORDS = 3000
export const ARTICLE_MIN_H2 = 2
export const ARTICLE_MIN_INTRO_WORDS = 25

/** Heading text that signals a closing/summary section. */
const CONCLUSION_RE =
  /\b(conclusion|takeaway|takeaways|closing|final thoughts?|in summary|summary|wrap[- ]?up|bottom line|the upshot|where this leaves us)\b/i

/** Count whitespace-delimited words across the whole markdown body. */
export function articleWordCount(markdown: string): number {
  return markdown.trim().split(/\s+/).filter(Boolean).length
}

/** Lines that are H2 headings (`## Heading`), with their heading text. */
export function h2Headings(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((l) => /^##[ \t]+(.+)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1].trim())
}

/** The prose between the first H1 and the first H2 (the intro). */
function introText(markdown: string): string {
  const lines = markdown.split('\n')
  const firstH2 = lines.findIndex((l) => /^##[ \t]+/.test(l.trim()))
  const upto = firstH2 === -1 ? lines.length : firstH2
  return lines
    .slice(0, upto)
    .filter((l) => !/^#{1,6}[ \t]+/.test(l.trim())) // drop heading lines (incl. H1)
    .join(' ')
    .trim()
}

export function validateArticle(artifact: ArticleArtifact): ValidationResult {
  const errors: { code: string; message: string }[] = []
  const markdown = artifact.markdown ?? ''

  const words = articleWordCount(markdown)
  if (words < ARTICLE_MIN_WORDS) {
    errors.push({
      code: 'too_short',
      message: `article is ${words} words; need at least ${ARTICLE_MIN_WORDS}`,
    })
  }
  if (words > ARTICLE_MAX_WORDS) {
    errors.push({
      code: 'too_long',
      message: `article is ${words} words; cap is ${ARTICLE_MAX_WORDS}`,
    })
  }

  const h2s = h2Headings(markdown)
  if (h2s.length < ARTICLE_MIN_H2) {
    errors.push({
      code: 'too_few_h2',
      message: `article has ${h2s.length} H2 section(s); need at least ${ARTICLE_MIN_H2}`,
    })
  }

  const intro = introText(markdown)
  const introWords = intro ? intro.split(/\s+/).filter(Boolean).length : 0
  if (introWords < ARTICLE_MIN_INTRO_WORDS) {
    errors.push({
      code: 'missing_intro',
      message: `article needs an explicit intro before the first H2 (${introWords}/${ARTICLE_MIN_INTRO_WORDS} words)`,
    })
  }

  const lastH2 = h2s[h2s.length - 1]
  if (!lastH2 || !CONCLUSION_RE.test(lastH2)) {
    errors.push({
      code: 'missing_conclusion',
      message: `article needs an explicit conclusion section (final H2 "${lastH2 ?? '(none)'}" does not read as a wrap-up)`,
    })
  }

  return { valid: errors.length === 0, errors }
}
