/**
 * Outcome Architect Agent — Stage 0.3
 *
 * Takes proposed structure + audience profile and generates SMART,
 * Bloom-classified learning outcomes for every node. Each outcome is
 * measurable and mapped to an assessment type. Returns an OutcomesMap
 * with per-node outcomes and aggregate Bloom distribution stats.
 *
 * Level 2 (Product) — eLearn-specific agent configuration.
 */

import type { IdeationAgentConfig, AgentResult } from './framework/types'
import type {
  AudienceProfile,
  ProjectArchetype,
  ProposedStructure,
  OutcomesMap,
  BloomLevel,
} from '../types'
import { executeIdeationAgent } from './framework/executor'
import { registerAgent } from './framework/registry'
import { getArchetype } from '../archetypes'

// ─── Agent Config ─────────────────────────────────────────────────────────

export const OUTCOME_ARCHITECT_CONFIG: IdeationAgentConfig = {
  id: 'outcome-architect',
  name: 'Outcome Architect',
  tier: 'production',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 90_000,
  maxTokens: 16384,
}

// ─── Bloom Levels (ordered) ──────────────────────────────────────────────

const BLOOM_LEVELS: BloomLevel[] = [
  'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create',
]

// ─── System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Outcome Architect agent for an AI-powered eLearning platform.

Your mission: Generate precise, measurable learning outcomes for every node in a course structure. You are an expert in Bloom's taxonomy, SMART outcome design, and curriculum alignment.

## What You Produce

An OutcomesMap containing:
1. Course-level outcomes (3-5 high-level outcomes for the entire course)
2. Per-node outcomes (2-5 outcomes per topic/module based on depth and complexity)
3. Bloom distribution statistics (count of outcomes at each Bloom level)
4. Coverage notes (assessment of outcome coverage quality)

## Outcome Rules

Every outcome MUST be:
- **Specific:** Targets a single, concrete skill or knowledge area
- **Measurable:** Uses observable action verbs (not "understand" or "know" — use "explain", "demonstrate", "analyze")
- **Achievable:** Realistic for the target audience within the allocated time
- **Relevant:** Directly tied to the node's content and key concepts
- **Time-bound:** Achievable within the estimated time for that node

Every outcome MUST include:
- A Bloom level classification (remember, understand, apply, analyze, evaluate, create)
- The \`measurable\` flag set to true (all outcomes must be measurable)
- A unique id in the format "OC-{nodeIndex}-{outcomeIndex}" (e.g., "OC-1-1", "OC-1-2")

## Bloom Distribution Guidelines
- Beginner topics: heavier on remember/understand (60%+)
- Intermediate topics: balanced across apply/analyze (50%+)
- Advanced topics: emphasize evaluate/create (40%+)
- Course-level: should span all levels with emphasis on higher-order thinking
- Overall distribution should progress from lower to higher across the course

## Depth Rules
- Depth 0 (Course/Subject): 3-5 high-level outcomes covering the full scope
- Depth 1 (Module/Grade): 3-4 outcomes per module covering its learning arc
- Depth 2 (Topic/Chapter): 2-4 outcomes per topic aligned to key concepts
- Depth 3 (Subtopic): 1-2 focused outcomes per subtopic

## Output Format

Return a JSON object matching this exact schema:

{
  "courseOutcomes": [
    {
      "id": "OC-0-1",
      "text": "By the end of this course, learners will be able to design complete instructional plans using backward design principles",
      "bloomLevel": "create",
      "measurable": true,
      "status": "draft"
    }
  ],
  "nodeOutcomes": [
    {
      "nodeTitle": "Module or Topic title",
      "nodePath": "module-1/topic-1",
      "depth": 2,
      "outcomes": [
        {
          "id": "OC-1-1",
          "text": "Explain the three stages of backward design and their purpose in curriculum planning",
          "bloomLevel": "understand",
          "measurable": true,
          "status": "draft"
        }
      ],
      "bloomDistribution": { "remember": 0, "understand": 1, "apply": 1, "analyze": 0, "evaluate": 0, "create": 0 }
    }
  ],
  "totalOutcomes": 25,
  "bloomDistribution": { "remember": 3, "understand": 5, "apply": 7, "analyze": 5, "evaluate": 3, "create": 2 },
  "coverageNotes": "Assessment of how well outcomes cover the curriculum scope, any gaps, and Bloom progression quality"
}

## Important
- Generate outcomes for EVERY module and topic in the structure
- Subtopics (if present) are structural only — do NOT generate separate outcomes for subtopics
- Bloom levels should progress logically across the course
- Use active, observable verbs matched to each Bloom level
- Return ONLY the JSON object. No markdown fences, no commentary.`

// ─── Output Schema ────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['courseOutcomes', 'nodeOutcomes', 'totalOutcomes', 'bloomDistribution', 'coverageNotes'],
  properties: {
    courseOutcomes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'text', 'bloomLevel', 'measurable', 'status'],
      },
    },
    nodeOutcomes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['nodeTitle', 'nodePath', 'depth', 'outcomes', 'bloomDistribution'],
      },
    },
    totalOutcomes: { type: 'number' },
    bloomDistribution: {
      type: 'object',
      required: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
    },
    coverageNotes: { type: 'string' },
  },
}

// ─── Agent Runner ─────────────────────────────────────────────────────────

/**
 * Run the Outcome Architect agent.
 *
 * @param brief - The raw project brief
 * @param archetype - Detected project archetype
 * @param structure - Proposed course structure from Curriculum Strategist
 * @param audienceProfile - Audience profile from Audience Analyst
 * @returns AgentResult containing the OutcomesMap
 */
export async function runOutcomeArchitect(
  brief: string,
  archetype: ProjectArchetype,
  structure: ProposedStructure,
  audienceProfile: AudienceProfile
): Promise<AgentResult<OutcomesMap>> {
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
    `## Proposed Structure\n${JSON.stringify(structure, null, 2)}`,
    '',
    `## Bloom Level Reference (ordered low → high)`,
    BLOOM_LEVELS.map((l, i) => `  ${i + 1}. ${l}`).join('\n'),
    '',
    'Generate SMART learning outcomes for every node in this structure.',
  ]

  return executeIdeationAgent<OutcomesMap>(
    OUTCOME_ARCHITECT_CONFIG,
    SYSTEM_PROMPT,
    sections.join('\n'),
    OUTPUT_SCHEMA
  )
}

// ─── Self-Registration ────────────────────────────────────────────────────

registerAgent(OUTCOME_ARCHITECT_CONFIG)
