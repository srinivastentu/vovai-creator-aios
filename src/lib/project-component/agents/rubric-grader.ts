/**
 * Rubric Grader Agent — Stage 0.4
 *
 * Scores a proposed blueprint against the 7-dimension structure rubric.
 * Uses the STRUCTURE_RUBRIC definition to prompt the judge, then runs
 * calculateOverallScore() and getRecommendation() on the returned scores
 * to produce a deterministic final verdict.
 *
 * Model: claude-sonnet-4-20250514 (premium for grading accuracy).
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
  GradeReport,
  DimensionGradeScore,
} from '../types'
import { executeIdeationAgent } from './framework/executor'
import { registerAgent } from './framework/registry'
import { getArchetype } from '../archetypes'
import {
  STRUCTURE_RUBRIC,
  calculateOverallScore,
  getRecommendation,
} from '../rubrics/structure-rubric'

// ─── Agent Config ─────────────────────────────────────────────────────────

export const RUBRIC_GRADER_CONFIG: IdeationAgentConfig = {
  id: 'rubric-grader',
  name: 'Rubric Grader',
  tier: 'governance',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 90_000,
  maxTokens: 8192,
}

// ─── Types ────────────────────────────────────────────────────────────────

/** Raw LLM output — dimension scores + qualitative analysis */
interface RawGradeOutput {
  dimensionScores: {
    dimensionId: string
    score: number
    feedback: string
  }[]
  strengths: string[]
  weaknesses: string[]
  specificImprovements: string[]
  feedback?: string
}

// ─── System Prompt ────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const dimTable = STRUCTURE_RUBRIC.dimensions.map(d =>
    `| ${d.id} | ${d.name} | ${d.weight} | ${d.passThreshold} | ${d.description} |`
  ).join('\n')

  const dimCriteria = STRUCTURE_RUBRIC.dimensions.map(d =>
    `### ${d.name} (${d.id})\n- **Excellent (85-100):** ${d.criteria.excellent}\n- **Good (70-84):** ${d.criteria.good}\n- **Adequate (55-69):** ${d.criteria.adequate}\n- **Poor (0-54):** ${d.criteria.poor}`
  ).join('\n\n')

  return `You are the Rubric Grader agent for an AI-powered eLearning platform.

Your mission: Evaluate a proposed course structure against a 7-dimension quality rubric. Score each dimension on a 0-100 scale with specific feedback. Be fair, evidence-based, and precise.

## Rubric: ${STRUCTURE_RUBRIC.name}

| ID | Name | Weight | Pass Threshold | Description |
|---|---|---|---|---|
${dimTable}

## Scoring Criteria

${dimCriteria}

## Scoring Rules

1. Score each dimension independently on 0-100 scale.
2. Use the criteria bands to calibrate your scores.
3. Provide specific, actionable feedback for each dimension — reference actual nodes, modules, or topics.
4. List 2-5 strengths (things the structure does well).
5. List 2-5 weaknesses (things that need improvement).
6. List 3-7 specific improvements (concrete, actionable steps).
7. Be calibrated: don't grade everything 80. A mediocre structure should score 50-65.

## Output Format

Return a JSON object matching this exact schema:

{
  "dimensionScores": [
    {
      "dimensionId": "coverage",
      "score": 78,
      "feedback": "Good coverage of core ID concepts. Missing assessment-specific topics that the brief mentions."
    },
    ...
  ],
  "strengths": [
    "Strong logical progression from foundational to applied topics",
    "Good balance of theory and practice"
  ],
  "weaknesses": [
    "Module 3 is significantly larger than other modules",
    "No capstone or synthesis activity"
  ],
  "specificImprovements": [
    "Add a topic on formative assessment design in Module 2",
    "Split Module 3 into 'Classroom Strategies' and 'Technology Integration'",
    "Add a final capstone module that synthesizes all concepts"
  ]
}

## Important
- You MUST score ALL 7 dimensions. Use the exact dimension IDs: ${STRUCTURE_RUBRIC.dimensions.map(d => d.id).join(', ')}.
- Scores must be integers between 0 and 100.
- Feedback must reference specific parts of the structure.
- Do NOT compute the overall score or recommendation — the system handles that deterministically.
- Return ONLY the JSON object. No markdown fences, no commentary.`
}

// ─── Output Schema ────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['dimensionScores', 'strengths', 'weaknesses', 'specificImprovements'],
  properties: {
    dimensionScores: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      items: {
        type: 'object',
        required: ['dimensionId', 'score', 'feedback'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
    specificImprovements: { type: 'array', items: { type: 'string' } },
    feedback: { type: 'string', description: 'Overall assessment summary of the structure quality' },
  },
}

// ─── Agent Runner ─────────────────────────────────────────────────────────

/**
 * Run the Rubric Grader agent.
 *
 * The LLM scores each dimension and provides qualitative analysis.
 * calculateOverallScore() and getRecommendation() are then applied
 * deterministically to produce the final GradeReport.
 *
 * @param brief - The raw project brief
 * @param archetype - Detected project archetype
 * @param structure - Proposed course structure
 * @param outcomesMap - Learning outcomes per node
 * @param componentPlan - Component assignments per node
 * @param audienceProfile - Audience profile
 * @returns AgentResult containing the GradeReport
 */
export async function runRubricGrader(
  brief: string,
  archetype: ProjectArchetype,
  structure: ProposedStructure,
  outcomesMap: OutcomesMap,
  componentPlan: ComponentPlan,
  audienceProfile: AudienceProfile
): Promise<AgentResult<GradeReport>> {
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
    'Grade this structure against all 7 rubric dimensions.',
  ]

  const rawResult = await executeIdeationAgent<RawGradeOutput>(
    RUBRIC_GRADER_CONFIG,
    buildSystemPrompt(),
    sections.join('\n'),
    OUTPUT_SCHEMA
  )

  // If the LLM call failed, return error as-is
  if (!rawResult.success || !rawResult.output) {
    return {
      ...rawResult,
      output: null,
    } as AgentResult<GradeReport>
  }

  // ─── Deterministic post-processing ─────────────────────────────────
  const raw = rawResult.output

  // Build dimension scores with rubric metadata
  const dimensionScores: DimensionGradeScore[] = raw.dimensionScores.map(ds => {
    const rubricDim = STRUCTURE_RUBRIC.dimensions.find(d => d.id === ds.dimensionId)
    return {
      id: ds.dimensionId,
      name: rubricDim?.name ?? ds.dimensionId,
      score: ds.score,
      weight: rubricDim?.weight ?? 0,
      passThreshold: rubricDim?.passThreshold ?? 0,
      feedback: ds.feedback,
    }
  })

  // Calculate overall score deterministically
  const scoreResult = calculateOverallScore(
    raw.dimensionScores.map(ds => ({ dimensionId: ds.dimensionId, score: ds.score }))
  )

  // Get recommendation deterministically
  const recommendation = getRecommendation(
    scoreResult.overallScore,
    scoreResult.failingDimensions
  )

  const gradeReport: GradeReport = {
    overallScore: scoreResult.overallScore,
    passesThreshold: scoreResult.passesThreshold,
    dimensionScores,
    strengths: raw.strengths,
    weaknesses: raw.weaknesses,
    recommendation,
    specificImprovements: raw.specificImprovements,
    feedback: raw.feedback ?? null,
  }

  return {
    ...rawResult,
    output: gradeReport,
  } as AgentResult<GradeReport>
}

// ─── Self-Registration ────────────────────────────────────────────────────

registerAgent(RUBRIC_GRADER_CONFIG)
