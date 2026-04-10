// Ideation Pipeline Config — LE-7
// Wires 5 ideation stages with agent configs, rubrics, and orchestrator.
// DOMAIN layer: imports from core/engine (types) and domain/workflows.

import type { AgentConfig } from '../../../core/engine/types'
import type { IdeationAgentConfig } from '../agents/framework/types'
import type { StageConfig, IdeationPipeline } from '../pipeline-orchestrator'
import { createPipeline } from '../pipeline-orchestrator'

// Rubrics
import { BRIEF_RUBRIC } from '../rubrics/brief-rubric'
import { AUDIENCE_RUBRIC } from '../rubrics/audience-rubric'
import { STRUCTURE_RUBRIC_DEFINITION } from '../rubrics/structure-rubric'
import { COMPONENT_RUBRIC } from '../rubrics/component-rubric'
import { HANDOFF_RUBRIC } from '../rubrics/handoff-rubric'

// Agent configs
import { ORCHESTRATOR_CONFIG } from '../agents/orchestrator'
import { AUDIENCE_ANALYST_CONFIG } from '../agents/audience-analyst'
import { CURRICULUM_STRATEGIST_CONFIG } from '../agents/curriculum-strategist'
import { OUTCOME_ARCHITECT_CONFIG } from '../agents/outcome-architect'
import { COMPONENT_RECOMMENDER_CONFIG } from '../agents/component-recommender'
import { STRUCTURE_OPTIMIZER_CONFIG } from '../agents/structure-optimizer'

// ---------------------------------------------------------------------------
// Bridge: IdeationAgentConfig → core AgentConfig
// ---------------------------------------------------------------------------

function toAgentConfig(config: IdeationAgentConfig): AgentConfig {
  return {
    id: config.id,
    name: config.name,
    model: config.model,
    maxRetries: config.maxRetries,
    timeoutMs: config.timeoutMs,
  }
}

// ---------------------------------------------------------------------------
// Handoff checker — no dedicated agent file yet, define inline
// ---------------------------------------------------------------------------

const HANDOFF_CHECKER_CONFIG: IdeationAgentConfig = {
  id: 'handoff-checker',
  name: 'Handoff Checker',
  tier: 'governance',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 30_000,
}

// ---------------------------------------------------------------------------
// 5 Ideation Stages
// ---------------------------------------------------------------------------

export const ELEARN_IDEATION_STAGES: StageConfig[] = [
  {
    id: 'brief',
    agents: [toAgentConfig(ORCHESTRATOR_CONFIG)],
    rubric: BRIEF_RUBRIC,
    threshold: 75,
    maxIterations: 3,
    minIterations: 2,
    loopPattern: 'standard',
    reviewerRoles: ['project_owner'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
  {
    id: 'audience',
    agents: [toAgentConfig(AUDIENCE_ANALYST_CONFIG)],
    rubric: AUDIENCE_RUBRIC,
    threshold: 75,
    maxIterations: 3,
    minIterations: 2,
    loopPattern: 'standard',
    dependsOn: ['brief'],
    reviewerRoles: ['project_owner'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
  {
    id: 'structure',
    agents: [
      toAgentConfig(CURRICULUM_STRATEGIST_CONFIG),
      toAgentConfig(OUTCOME_ARCHITECT_CONFIG),
    ],
    rubric: STRUCTURE_RUBRIC_DEFINITION,
    threshold: 75,
    maxIterations: 5,
    minIterations: 2,
    loopPattern: 'strategic',
    dependsOn: ['brief', 'audience'],
    reviewerRoles: ['project_owner', 'instructional_designer'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
  {
    id: 'components',
    agents: [
      toAgentConfig(COMPONENT_RECOMMENDER_CONFIG),
      toAgentConfig(STRUCTURE_OPTIMIZER_CONFIG),
    ],
    rubric: COMPONENT_RUBRIC,
    threshold: 75,
    maxIterations: 3,
    minIterations: 2,
    loopPattern: 'standard',
    dependsOn: ['brief', 'audience', 'structure'],
    reviewerRoles: ['project_owner'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
  {
    id: 'handoff',
    agents: [toAgentConfig(HANDOFF_CHECKER_CONFIG)],
    rubric: HANDOFF_RUBRIC,
    threshold: 80,
    maxIterations: 2,
    minIterations: 1,
    loopPattern: 'standard',
    dependsOn: ['brief', 'audience', 'structure', 'components'],
    reviewerRoles: ['project_owner'],
    reviewGateConfig: { allowedActions: ['approve', 'reject', 'feedback'] },
  },
]

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createElearnIdeationPipeline(blueprintId: string): IdeationPipeline {
  return createPipeline(
    `elearn-ideation-${blueprintId}`,
    blueprintId,
    ELEARN_IDEATION_STAGES
  )
}
