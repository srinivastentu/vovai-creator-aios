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

export {
  createWebSearchClient,
  parseWebSearchContent,
  readSearchCount,
  WEB_SEARCH_COST_PER_CALL,
} from './adapters/web-search-adapter'
export type {
  WebSearchSource,
  WebSearchRun,
  WebSearchArgs,
  WebSearchRunner,
  WebSearchClientOptions,
} from './adapters/web-search-adapter'

export { createTextGenerationStage } from './stages/text-generation-stage'
export type {
  TextGenerationStage,
  TextGenerationStageOptions,
  TextStageContext,
  TextStageCostEvent,
} from './stages/text-generation-stage'

export { runTextLoop } from './stages/run-text-loop'
export type {
  RunTextLoopArgs,
  RunTextLoopResult,
  IterationEvent,
} from './stages/run-text-loop'
