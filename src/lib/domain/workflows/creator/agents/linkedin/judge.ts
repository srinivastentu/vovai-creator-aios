// LinkedIn Post Judge (Stage 5a) — Google Gemini via the MMS gateway.
// Thin wrapper over the shared Gemini text judge with a LinkedIn-specific
// serializer. Grades a LinkedInArtifact against LINKEDIN_POST_RUBRIC.
// Cross-model (loop rule 7): the producer is Claude, so the judge is Gemini.

import type { AgentConfig, JudgeFunction } from '../../../../../core/engine/types'
import { createGeminiTextJudge, DEFAULT_JUDGE_MODEL, type GeminiTextJudgeDeps } from '../gemini-text-judge'
import type { LinkedInArtifact } from '../../types'

/** Judge AgentConfig — the Cross-Critique config needs the model for the rule-10
 *  family check (judge must be a different family from producers + integrator). */
export const LINKEDIN_JUDGE_AGENT: AgentConfig = {
  id: 'linkedin-judge',
  name: 'LinkedIn Judge (Gemini)',
  model: { primary: DEFAULT_JUDGE_MODEL, fallback: 'gemini-2.5-flash' },
  maxRetries: 1,
  timeoutMs: 60_000,
}

/** Render a LinkedIn post for the judge: char count header + the post text. */
function serializeLinkedIn(artifact: unknown): string {
  const a = artifact as LinkedInArtifact
  const text = a?.text ?? ''
  const chars = typeof a?.charCount === 'number' ? a.charCount : text.length
  return [`CHARACTER COUNT: ${chars}`, '', text].join('\n')
}

export function createLinkedInJudge(deps: GeminiTextJudgeDeps = {}): JudgeFunction {
  return createGeminiTextJudge(
    { callerTag: 'linkedin-judge', serialize: serializeLinkedIn, artifactNoun: 'LinkedIn post' },
    deps
  )
}
