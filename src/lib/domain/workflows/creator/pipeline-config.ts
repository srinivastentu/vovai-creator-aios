// CreatorOS V1 pipeline configuration — the ordered list of LoopStages the
// Domain Workflow sequences. Stages are added per CR step.
//
// CR-2: Stage 2 (Research). CR-3: Stage 3 (Long-Form Master). CR-4: Stage 5
// (Repurpose) single-model producers — modeled as per-artifact-type SIBLINGS
// (pipeline-v1.md), not a linear stage. CR-7 swaps them to Cross-Critique.

import { RESEARCH_STAGE } from './research-stage'
import { LONG_FORM_MASTER_STAGE } from './long-form-master-stage'
import {
  SINGLE_PRODUCER_LINKEDIN_STAGE,
  SINGLE_PRODUCER_ARTICLE_STAGE,
} from './single-producer-stage'

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

export {
  SINGLE_PRODUCER_LINKEDIN_STAGE,
  SINGLE_PRODUCER_ARTICLE_STAGE,
  SINGLE_PRODUCER_STRUCTURAL_RUBRIC,
  createLinkedInStage,
  createArticleStage,
  createStructuralPassJudge,
  runProducerLoop,
  buildArtifactPersistence,
} from './single-producer-stage'
export type {
  Producer,
  SingleProducerStage,
  SingleProducerStageDeps,
  RunProducerLoopArgs,
  RunProducerLoopResult,
  ProducerIterationEvent,
  ArtifactPersistencePayload,
} from './single-producer-stage'

/** The linear, single-artifact-T V1 stages, in pipeline order (Stage 2 → 3). */
export const CREATOR_V1_STAGES = [RESEARCH_STAGE, LONG_FORM_MASTER_STAGE]

/**
 * Stage 5 (Repurpose) sibling stages — one StageSession per artifact type
 * (pipeline-v1.md). Kept separate from CREATOR_V1_STAGES because each carries a
 * different artifact T (LinkedIn vs article) and they run as siblings, not in a
 * linear sequence.
 */
export const SINGLE_PRODUCER_STAGES = [
  SINGLE_PRODUCER_LINKEDIN_STAGE,
  SINGLE_PRODUCER_ARTICLE_STAGE,
]
