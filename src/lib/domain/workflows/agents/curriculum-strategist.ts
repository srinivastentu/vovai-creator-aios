/**
 * Curriculum Strategist Agent — Stage 0.2
 *
 * Proposes a hierarchical course structure with modules, topics, and
 * subtopics based on the project brief, archetype, and audience profile.
 * Includes sequencing rationale and 2 alternative structures so the
 * human can evaluate different approaches.
 *
 * Level 2 (Product) — eLearn-specific agent configuration.
 */

import type { IdeationAgentConfig, AgentResult } from './framework/types'
import type { AudienceProfile, ProjectArchetype, ProposedStructure } from '../types'
import { executeIdeationAgent } from './framework/executor'
import { registerAgent } from './framework/registry'
import { getArchetype } from '../archetypes'

// ─── Agent Config ─────────────────────────────────────────────────────────

export const CURRICULUM_STRATEGIST_CONFIG: IdeationAgentConfig = {
  id: 'curriculum-strategist',
  name: 'Curriculum Strategist',
  tier: 'production',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 90_000,
  maxTokens: 16384,
}

// ─── System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Curriculum Strategist agent for an AI-powered eLearning platform.

Your mission: Design a hierarchical course structure that transforms a project brief into a well-sequenced, pedagogically sound curriculum. You are an expert in instructional design, learning science, and curriculum architecture.

## What You Produce

A complete course structure with:
1. Course title and description
2. Modules — major thematic units (typically 4-8 for a full course)
3. Topics within each module — specific learning units (2-5 per module)
4. Optional subtopics — granular breakdown when a topic is complex
5. Sequencing rationale — WHY this order, not just WHAT the order is
6. Two alternative structures — different valid approaches the human can consider
7. Confidence score — your confidence in this being the best structure (0.0-1.0)

## Output Requirements

Return a JSON object matching this exact schema:

{
  "courseTitle": "Concise, descriptive course title",
  "courseDescription": "2-3 sentence course overview",
  "modules": [
    {
      "title": "Module title",
      "description": "What this module covers and why it's here",
      "topics": [
        {
          "title": "Topic title",
          "description": "What the learner will engage with",
          "keyConcepts": ["concept1", "concept2", "concept3"],
          "estimatedMinutes": 45,
          "subtopics": ["optional subtopic 1", "optional subtopic 2"],
          "difficulty": "beginner | intermediate | advanced",
          "bloomLevel": "remember | understand | apply | analyze | evaluate | create"
        }
      ]
    }
  ],
  "sequencingRationale": "Explain the pedagogical logic behind the module and topic ordering. Reference learning science principles (scaffolding, spiral curriculum, prerequisite chains, etc.)",
  "alternativeStructures": [
    {
      "title": "Alternative approach name",
      "description": "Brief description of this alternative",
      "rationale": "Why someone might prefer this approach",
      "moduleCount": 6,
      "tradeoffs": "What you gain and lose compared to the primary structure"
    }
  ],
  "confidenceScore": 0.85
}

## Curriculum Design Rules
- Every module must have a clear learning arc (introduction → depth → application)
- Topics should build on each other within a module (prerequisite ordering)
- Bloom levels should progress from lower to higher across the course
- Difficulty should generally increase, with periodic consolidation
- estimatedMinutes should reflect realistic engagement time for the target audience
- Include at least 2 alternative structures with genuine tradeoffs
- Subtopics are optional — only include when a topic genuinely needs subdivision
- Confidence score reflects how well the brief supports a clear structure
- Return ONLY the JSON object. No markdown fences, no commentary.`

// ─── Output Schema ────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['courseTitle', 'courseDescription', 'modules', 'sequencingRationale', 'alternativeStructures', 'confidenceScore'],
  properties: {
    courseTitle: { type: 'string' },
    courseDescription: { type: 'string' },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'description', 'topics'],
      },
    },
    sequencingRationale: { type: 'string' },
    alternativeStructures: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['title', 'description', 'rationale', 'moduleCount', 'tradeoffs'],
      },
    },
    confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
  },
}

// ─── Agent Runner ─────────────────────────────────────────────────────────

/** Optional constraints the human or orchestrator can pass */
export interface CurriculumConstraints {
  maxModules?: number
  maxTopicsPerModule?: number
  totalHours?: number
  focusAreas?: string[]
  excludeTopics?: string[]
}

/**
 * Run the Curriculum Strategist agent.
 *
 * @param brief - The raw project brief
 * @param archetype - Detected project archetype
 * @param audienceProfile - Audience profile from the Audience Analyst
 * @param constraints - Optional constraints on the structure
 * @returns AgentResult containing the ProposedStructure
 */
export async function runCurriculumStrategist(
  brief: string,
  archetype: ProjectArchetype,
  audienceProfile: AudienceProfile,
  constraints?: CurriculumConstraints
): Promise<AgentResult<ProposedStructure>> {
  const archetypeDef = getArchetype(archetype)

  const sections = [
    `## Project Brief\n${brief}`,
    `## Archetype: ${archetypeDef.name}`,
    `Hierarchy: ${Object.entries(archetypeDef.hierarchy).map(([d, label]) => `Level ${d} = ${label}`).join(', ')}`,
    `Max depth: ${archetypeDef.maxDepth}`,
    `Default components: ${archetypeDef.defaultComponents.join(', ')}`,
    '',
    `## Audience Profile\n${JSON.stringify(audienceProfile, null, 2)}`,
  ]

  if (constraints) {
    const parts: string[] = []
    if (constraints.totalHours) parts.push(`Total course hours: ${constraints.totalHours}`)
    if (constraints.maxModules) parts.push(`Maximum modules: ${constraints.maxModules}`)
    if (constraints.maxTopicsPerModule) parts.push(`Maximum topics per module: ${constraints.maxTopicsPerModule}`)
    if (constraints.focusAreas?.length) parts.push(`Focus areas: ${constraints.focusAreas.join(', ')}`)
    if (constraints.excludeTopics?.length) parts.push(`Exclude: ${constraints.excludeTopics.join(', ')}`)
    sections.push(`\n## Constraints\n${parts.join('\n')}`)
  }

  sections.push('', 'Design the course structure following the archetype hierarchy and audience needs.')

  return executeIdeationAgent<ProposedStructure>(
    CURRICULUM_STRATEGIST_CONFIG,
    SYSTEM_PROMPT,
    sections.join('\n'),
    OUTPUT_SCHEMA
  )
}

// ─── Self-Registration ────────────────────────────────────────────────────

registerAgent(CURRICULUM_STRATEGIST_CONFIG)
