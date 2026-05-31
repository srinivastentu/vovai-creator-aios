// Long-Form Article Judge (Stage 5b) — Google Gemini via the MMS gateway.
// Thin wrapper over the shared Gemini text judge with an article-specific
// serializer. Grades an ArticleArtifact against LONG_FORM_ARTICLE_RUBRIC.
// Cross-model (loop rule 7): the producer is Claude, so the judge is Gemini.

import type { JudgeFunction } from '../../../../../core/engine/types'
import { createGeminiTextJudge, type GeminiTextJudgeDeps } from '../gemini-text-judge'
import type { ArticleArtifact } from '../../types'

/** Render an article for the judge: title + word count header + the markdown. */
function serializeArticle(artifact: unknown): string {
  const a = artifact as ArticleArtifact
  const md = a?.markdown ?? ''
  const words =
    typeof a?.wordCount === 'number'
      ? a.wordCount
      : md.trim().split(/\s+/).filter(Boolean).length
  return [`TITLE: ${a?.title ?? ''}`, `WORD COUNT: ${words}`, '', md].join('\n')
}

export function createArticleJudge(deps: GeminiTextJudgeDeps = {}): JudgeFunction {
  return createGeminiTextJudge(
    { callerTag: 'article-judge', serialize: serializeArticle, artifactNoun: 'long-form article' },
    deps
  )
}
