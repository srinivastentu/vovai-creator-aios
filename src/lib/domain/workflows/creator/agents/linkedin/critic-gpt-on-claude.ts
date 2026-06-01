// LinkedIn Cross-Critique CRITIC — GPT-on-Claude (Stage 5a, CR-7).
//
// The mirror of critic-claude-on-gpt.ts: GPT-4o reads the Claude producer's draft.
// Same critic persona, builder, and parser (imported); only the model differs, so
// the two critics expose different model families to each producer's blind spots.

import type { AgentConfig } from '../../../../../core/engine/types'

export {
  LINKEDIN_CRITIC_SYSTEM_PROMPT,
  buildLinkedInCriticUser,
  parseLinkedInCritique,
} from './critic-claude-on-gpt'

export const LINKEDIN_CRITIC_GPT_ON_CLAUDE: AgentConfig = {
  id: 'linkedin-critic-gpt-on-claude',
  name: 'LinkedIn Critic (GPT on Claude)',
  model: { primary: 'gpt-4o', fallback: 'gpt-4o' },
  maxRetries: 2,
  timeoutMs: 120_000,
}
