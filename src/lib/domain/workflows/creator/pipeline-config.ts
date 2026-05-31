// CreatorOS V1 pipeline configuration — the ordered list of LoopStages the
// Domain Workflow sequences. Stages are added per CR step.
//
// CR-2: Stage 2 (Research). Stages 3 (Long-Form Master) and 5 (Repurpose)
// land in CR-3 and CR-7.

import { RESEARCH_STAGE } from './research-stage'

export { RESEARCH_STAGE, createResearchStage, runResearchLoop } from './research-stage'
export type {
  ResearchStage,
  ResearchStageDeps,
  RunResearchLoopArgs,
  RunResearchLoopResult,
  ResearchIterationEvent,
} from './research-stage'

/** All wired V1 stages, in pipeline order. */
export const CREATOR_V1_STAGES = [RESEARCH_STAGE]
