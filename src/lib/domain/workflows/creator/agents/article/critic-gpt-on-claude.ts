// Long-Form Article Cross-Critique CRITIC — GPT-on-Claude (Stage 5b, CR-7).
//
// The mirror of critic-claude-on-gpt.ts: GPT-4o reads the Claude producer's draft.
// Same critic persona, builder, and parser (imported); only the model differs.

import type { AgentConfig } from '../../../../../core/engine/types'

export {
  ARTICLE_CRITIC_SYSTEM_PROMPT,
  buildArticleCriticUser,
  parseArticleCritique,
} from './critic-claude-on-gpt'

export const ARTICLE_CRITIC_GPT_ON_CLAUDE: AgentConfig = {
  id: 'article-critic-gpt-on-claude',
  name: 'Article Critic (GPT on Claude)',
  model: { primary: 'gpt-4o', fallback: 'gpt-4o' },
  maxRetries: 2,
  timeoutMs: 120_000,
}
