/**
 * Component Recommender Agent — Stage 0.3
 *
 * Takes structure + outcomes + audience + compatibility matrix and
 * recommends components for each node. Respects the COMPONENT_COMPATIBILITY
 * matrix for the archetype, attachableAt depths from the registry, and
 * dependency chains. Returns a ComponentPlan with per-node recommendations,
 * aggregate breakdown, and 3 budget tiers (essential, recommended, comprehensive).
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
} from '../types'
import { executeIdeationAgent } from './framework/executor'
import { registerAgent } from './framework/registry'
import { getArchetype } from '../archetypes'
import { getCompatibleComponents } from '../compatibility'
import { getComponent, COMPONENT_REGISTRY } from '../component-registry'

// ─── Agent Config ─────────────────────────────────────────────────────────

export const COMPONENT_RECOMMENDER_CONFIG: IdeationAgentConfig = {
  id: 'component-recommender',
  name: 'Component Recommender',
  tier: 'production',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 60_000,
}

// ─── System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Component Recommender agent for an AI-powered eLearning platform.

Your mission: Recommend the right mix of learning components (videos, study materials, quizzes, activities, etc.) for each node in a course structure. You balance pedagogical effectiveness, audience needs, and production cost.

## What You Produce

A ComponentPlan containing:
1. Per-node component recommendations with priority and rationale
2. Total component count and type breakdown
3. Three budget tiers: essential, recommended, comprehensive
4. Overall rationale for the component strategy

## Component Assignment Rules

1. **Respect the compatibility matrix.** Only recommend components that are "recommended" or "optional" for this archetype. NEVER recommend "unavailable" components.
2. **Respect attachableAt depths.** Each component can only attach at certain tree depths. Check the component registry data provided.
3. **Respect maxPerNode.** Don't exceed the maximum instances per node.
4. **Respect dependencies.** If component A depends on component B, B must also be recommended on the same node (or already present).
5. **Subtopics are structural only.** NEVER attach components to subtopic-depth nodes.

## Priority Guidelines

- **core:** Essential for the learning experience. Without this, the node fails to teach.
- **recommended:** Significantly enhances learning. Should be included in most budgets.
- **optional:** Nice-to-have. Enhances but not critical. Include in comprehensive tier only.

## Budget Tiers

Generate exactly 3 tiers:
- **essential:** Only core-priority components. Minimum viable learning experience.
- **recommended:** Core + recommended components. Good learning experience.
- **comprehensive:** All components including optional. Premium learning experience.

Each tier must include realistic cost estimates based on the component registry costs provided.

## Output Format

Return a JSON object matching this exact schema:

{
  "nodeRecommendations": [
    {
      "nodeTitle": "Module or Topic title",
      "nodePath": "module-1/topic-1",
      "depth": 2,
      "components": [
        {
          "componentType": "video",
          "priority": "core",
          "rationale": "Visual explanation of complex concepts increases retention for this audience",
          "estimatedCost": { "min": 3.00, "max": 12.00 }
        }
      ]
    }
  ],
  "totalComponents": 42,
  "componentBreakdown": {
    "video": 10,
    "study_material": 10,
    "quiz": 8,
    "activity": 6,
    "flashcards": 8
  },
  "budgetTiers": [
    {
      "name": "essential",
      "description": "Core components only — videos and study materials for each topic",
      "totalComponents": 20,
      "estimatedCost": { "min": 35.00, "max": 140.00, "currency": "USD" },
      "includedTypes": ["video", "study_material"]
    },
    {
      "name": "recommended",
      "description": "Adds quizzes and activities for active learning",
      "totalComponents": 34,
      "estimatedCost": { "min": 50.00, "max": 200.00, "currency": "USD" },
      "includedTypes": ["video", "study_material", "quiz", "activity"]
    },
    {
      "name": "comprehensive",
      "description": "Full component set including flashcards, discussions, and capstone",
      "totalComponents": 42,
      "estimatedCost": { "min": 65.00, "max": 260.00, "currency": "USD" },
      "includedTypes": ["video", "study_material", "quiz", "activity", "flashcards", "discussion_prompt"]
    }
  ],
  "rationale": "Explanation of the overall component strategy and how it serves the audience"
}

## Important
- Every topic-level node should have at least one component
- Module-level nodes may have components if appropriate for their depth
- Course-level components (glossary, certificate, capstone) attach at depth 0 or 1
- Cost estimates must come from the component registry data provided
- Return ONLY the JSON object. No markdown fences, no commentary.`

// ─── Output Schema ────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['nodeRecommendations', 'totalComponents', 'componentBreakdown', 'budgetTiers', 'rationale'],
  properties: {
    nodeRecommendations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['nodeTitle', 'nodePath', 'depth', 'components'],
      },
    },
    totalComponents: { type: 'number' },
    componentBreakdown: { type: 'object' },
    budgetTiers: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        required: ['name', 'description', 'totalComponents', 'estimatedCost', 'includedTypes'],
      },
    },
    rationale: { type: 'string' },
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Build a component registry summary for the prompt context */
function buildRegistrySummary(archetype: string): string {
  const compat = getCompatibleComponents(archetype)
  const available = [...compat.recommended, ...compat.optional]

  const lines: string[] = ['| Component | Category | Attachable At | Max/Node | Cost Range | Depends On | Availability |']
  lines.push('|---|---|---|---|---|---|---|')

  for (const compId of available) {
    const def = getComponent(compId)
    if (!def) continue
    const availability = compat.recommended.includes(compId) ? 'recommended' : 'optional'
    lines.push(
      `| ${def.name} (${def.id}) | ${def.category} | depths [${def.attachableAt.join(',')}] | ${def.maxPerNode} | $${def.estimatedCost.min.toFixed(2)}-$${def.estimatedCost.max.toFixed(2)} | ${def.dependsOn.length ? def.dependsOn.join(', ') : 'none'} | ${availability} |`
    )
  }

  if (compat.unavailable.length > 0) {
    lines.push('')
    lines.push(`**Unavailable for this archetype:** ${compat.unavailable.join(', ')}`)
  }

  return lines.join('\n')
}

// ─── Agent Runner ─────────────────────────────────────────────────────────

/**
 * Run the Component Recommender agent.
 *
 * @param brief - The raw project brief
 * @param archetype - Detected project archetype
 * @param structure - Proposed course structure from Curriculum Strategist
 * @param outcomesMap - Learning outcomes from Outcome Architect
 * @param audienceProfile - Audience profile from Audience Analyst
 * @returns AgentResult containing the ComponentPlan
 */
export async function runComponentRecommender(
  brief: string,
  archetype: ProjectArchetype,
  structure: ProposedStructure,
  outcomesMap: OutcomesMap,
  audienceProfile: AudienceProfile
): Promise<AgentResult<ComponentPlan>> {
  const archetypeDef = getArchetype(archetype)

  const sections = [
    `## Project Brief\n${brief}`,
    '',
    `## Archetype: ${archetypeDef.name}`,
    `Hierarchy: ${Object.entries(archetypeDef.hierarchy).map(([d, label]) => `Level ${d} = ${label}`).join(', ')}`,
    `Max depth: ${archetypeDef.maxDepth}`,
    `Production mode: ${archetypeDef.productionMode}`,
    '',
    `## Audience Profile\n${JSON.stringify(audienceProfile, null, 2)}`,
    '',
    `## Course Structure\n${JSON.stringify(structure, null, 2)}`,
    '',
    `## Learning Outcomes\n${JSON.stringify(outcomesMap, null, 2)}`,
    '',
    `## Component Registry (available for this archetype)\n${buildRegistrySummary(archetype)}`,
    '',
    'Recommend components for each node following the rules and compatibility matrix above.',
  ]

  return executeIdeationAgent<ComponentPlan>(
    COMPONENT_RECOMMENDER_CONFIG,
    SYSTEM_PROMPT,
    sections.join('\n'),
    OUTPUT_SCHEMA
  )
}

// ─── Self-Registration ────────────────────────────────────────────────────

registerAgent(COMPONENT_RECOMMENDER_CONFIG)
