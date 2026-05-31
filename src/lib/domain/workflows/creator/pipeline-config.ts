// CreatorOS V1 pipeline configuration — the ordered list of LoopStages the
// Domain Workflow sequences. Stages are added per CR step.
//
// CR-2: Stage 2 (Research). CR-3: Stage 3 (Long-Form Master). Stage 5
// (Repurpose) lands in CR-7.

import { RESEARCH_STAGE } from './research-stage'
import { LONG_FORM_MASTER_STAGE } from './long-form-master-stage'

export { RESEARCH_STAGE, createResearchStage, runResearchLoop } from './research-stage'
export type {
  ResearchStage,
  ResearchStageDeps,
  RunResearchLoopArgs,
  RunResearchLoopResult,
  ResearchIterationEvent,
} from './research-stage'

export {
  LONG_FORM_MASTER_STAGE,
  createMasterStage,
  runMasterLoop,
  buildMasterPersistence,
} from './long-form-master-stage'
export type {
  MasterStage,
  MasterStageDeps,
  RunMasterLoopArgs,
  RunMasterLoopResult,
  MasterIterationEvent,
  MasterPersistencePayload,
  MasterPersistenceSection,
} from './long-form-master-stage'

/** All wired V1 stages, in pipeline order. */
export const CREATOR_V1_STAGES = [RESEARCH_STAGE, LONG_FORM_MASTER_STAGE]
