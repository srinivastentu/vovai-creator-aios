/**
 * Structure Optimizer Agent — Stage 0.4
 *
 * Analyzes a proposed blueprint for structural health: balance between
 * modules, content gaps, redundancy, sequencing issues, depth problems,
 * and component mismatches. Returns an OptimizationReport with a health
 * score (0-100), categorized issues, and prioritized actions.
 *
 * Level 2 (Product) — eLearn-specific agent configuration.
 */

import type { IdeationAgentConfig, AgentResult } from './framework/types'
import type {
  AudienceProfile,
  ProjectArchetype,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
  OptimizationReport,
} from '../types'
import { executeIdeationAgent } from './framework/executor'
import { registerAgent } from './framework/registry'
import { getArchetype } from '../archetypes'

// ─── Agent Config ─────────────────────────────────────────────────────────

export const STRUCTURE_OPTIMIZER_CONFIG: IdeationAgentConfig = {
  id: 'structure-optimizer',
  name: 'Structure Optimizer',
  tier: 'governance',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 60_000,
}

// ─── System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Structure Optimizer agent for an AI-powered eLearning platform.

Your mission: Analyze a proposed course structure and identify structural health issues — balance problems, content gaps, redundancy, sequencing errors, depth mismatches, and component assignment issues. You are a structural quality inspector, not a content creator.

## What You Produce

An OptimizationReport containing:
1. healthScore (0-100): overall structural health
2. criticalIssues: problems that MUST be fixed before production
3. warnings: issues that should be addressed but aren't blocking
4. suggestions: nice-to-have improvements
5. actions: prioritized list of recommended actions (most important first)
6. summary: one-paragraph assessment

## Issue Types You Check

1. **balance**: Are modules roughly similar in scope? Flag if any module has 3x+ more topics than another without justification.
2. **gap**: Are there missing topics that the brief requires but the structure doesn't cover? Are there learning outcomes with no supporting content?
3. **redundancy**: Are topics duplicated across modules? Are there components that cover the same content?
4. **sequencing**: Do topics build on prerequisites that appear later in the sequence? Are advanced topics placed before foundational ones?
5. **depth**: Is the hierarchy too shallow (lumping) or too deep (unnecessary splitting)?
6. **component_mismatch**: Do components match the node's purpose? Are there nodes with no components? Are there components on nodes that shouldn't have them?

## Severity Guidelines

- **critical**: Would cause production failure or learner confusion. Must fix.
- **warning**: Degrades quality but doesn't block production. Should fix.
- **suggestion**: Improvement opportunity. Nice to fix.

## Health Score

- 90-100: Excellent — production-ready structure
- 75-89: Good — minor issues to address
- 60-74: Adequate — significant issues need attention
- Below 60: Poor — major restructuring needed

## Output Format

Return a JSON object matching this exact schema:

{
  "healthScore": 82,
  "criticalIssues": [
    {
      "type": "sequencing",
      "severity": "critical",
      "location": "module-2/topic-1",
      "description": "Advanced assessment design appears before foundational learning outcomes topic",
      "suggestedAction": "Move 'Assessment Design' after 'Learning Outcomes & Alignment' in Module 1"
    }
  ],
  "warnings": [...],
  "suggestions": [...],
  "actions": [
    "Fix sequencing: move Assessment Design after Learning Outcomes",
    "Add a topic on formative vs summative assessment in Module 2",
    "Consider splitting Module 3 into two smaller modules"
  ],
  "summary": "The structure is generally sound with good coverage and logical progression. Two sequencing issues need attention before production, and Module 3 is significantly larger than others. Addressing these issues will improve balance and learner experience."
}

## Important
- Be specific about locations (use node paths or module/topic names)
- Every critical issue MUST have a concrete suggested action
- Actions should be prioritized — most impactful first
- Don't flag issues that don't exist — be accurate, not alarmist
- Return ONLY the JSON object. No markdown fences, no commentary.`

// ─── Output Schema ────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['healthScore', 'criticalIssues', 'warnings', 'suggestions', 'actions', 'summary'],
  properties: {
    healthScore: { type: 'number', minimum: 0, maximum: 100 },
    criticalIssues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'severity', 'location', 'description', 'suggestedAction'],
      },
    },
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'severity', 'location', 'description', 'suggestedAction'],
      },
    },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'severity', 'location', 'description', 'suggestedAction'],
      },
    },
    actions: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

// ─── Agent Runner ─────────────────────────────────────────────────────────

/**
 * Run the Structure Optimizer agent.
 *
 * @param brief - The raw project brief
 * @param archetype - Detected project archetype
 * @param structure - Proposed course structure
 * @param outcomesMap - Learning outcomes per node
 * @param componentPlan - Component assignments per node
 * @param audienceProfile - Audience profile
 * @returns AgentResult containing the OptimizationReport
 */
export async function runStructureOptimizer(
  brief: string,
  archetype: ProjectArchetype,
  structure: ProposedStructure,
  outcomesMap: OutcomesMap,
  componentPlan: ComponentPlan,
  audienceProfile: AudienceProfile
): Promise<AgentResult<OptimizationReport>> {
  const archetypeDef = getArchetype(archetype)

  const sections = [
    `## Project Brief\n${brief}`,
    '',
    `## Archetype: ${archetypeDef.name}`,
    `Hierarchy: ${Object.entries(archetypeDef.hierarchy).map(([d, label]) => `Level ${d} = ${label}`).join(', ')}`,
    `Max depth: ${archetypeDef.maxDepth}`,
    '',
    `## Audience Profile\n${JSON.stringify(audienceProfile, null, 2)}`,
    '',
    `## Course Structure\n${JSON.stringify(structure, null, 2)}`,
    '',
    `## Learning Outcomes\n${JSON.stringify(outcomesMap, null, 2)}`,
    '',
    `## Component Plan\n${JSON.stringify(componentPlan, null, 2)}`,
    '',
    'Analyze this structure for balance, gaps, redundancy, sequencing, depth, and component issues.',
  ]

  return executeIdeationAgent<OptimizationReport>(
    STRUCTURE_OPTIMIZER_CONFIG,
    SYSTEM_PROMPT,
    sections.join('\n'),
    OUTPUT_SCHEMA
  )
}

// ─── Self-Registration ────────────────────────────────────────────────────

registerAgent(STRUCTURE_OPTIMIZER_CONFIG)
