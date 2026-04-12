export {
  calculateWeightedScore,
  checkThresholds,
  createJudgeFunction,
} from './grader'

export type {
  Artifact,
  ProducerAdapter,
  ProduceArgs,
  ReviseArgs,
} from './adapters/types'

export {
  createClaudeTextAdapter,
  buildRevisePrompt,
} from './adapters/text-adapter'
export type { ClaudeTextAdapterOptions } from './adapters/text-adapter'
