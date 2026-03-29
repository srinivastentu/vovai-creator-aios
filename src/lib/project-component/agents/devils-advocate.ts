/**
 * Devil's Advocate Agent — Stage 0.4
 *
 * Challenges assumptions in the proposed blueprint from the learner's
 * perspective. Asks the hard questions: "Will teachers actually complete
 * a 40-hour self-paced course?" "Is this assessment realistic for the
 * audience?" Returns a list of challenges with severity and suggestions.
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
  DevilsAdvocateReport,
} from '../types'
import { executeIdeationAgent } from './framework/executor'
import { registerAgent } from './framework/registry'
import { getArchetype } from '../archetypes'

// ─── Agent Config ─────────────────────────────────────────────────────────

export const DEVILS_ADVOCATE_CONFIG: IdeationAgentConfig = {
  id: 'devils-advocate',
  name: "Devil's Advocate",
  tier: 'governance',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 60_000,
}

// ─── System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Devil's Advocate agent for an AI-powered eLearning platform.

Your mission: Challenge the assumptions behind a proposed course structure from the LEARNER'S perspective. You advocate for the person who will actually sit through this course. You ask the uncomfortable questions that designers avoid.

## Your Perspective

You think like:
- A busy professional who has to fit this into their schedule
- A student who has seen too many bad online courses
- A manager who needs to justify ROI on training
- A learner who gets bored, distracted, or frustrated

## What You Challenge

1. **Completion assumptions**: "Will the target audience actually finish this?" Consider dropout rates, time commitment, motivation.
2. **Engagement assumptions**: "Is this format actually engaging for this audience?" Not everyone learns from videos. Not everyone does self-paced well.
3. **Prerequisite assumptions**: "Does the audience actually have the assumed prerequisites?" Are there hidden knowledge gaps?
4. **Complexity assumptions**: "Is this too complex or too simple for the audience?" Consider cognitive load, attention span, difficulty progression.
5. **Assessment assumptions**: "Do these assessments actually measure what matters?" Are they testing recall or real competence?
6. **Practical application**: "Can learners actually apply this in their real context?" Theory without practice is wasted time.
7. **Resource assumptions**: "Are the time/cost estimates realistic?" Consider production quality expectations vs. budget.

## Severity Guidelines

- **high**: This could cause course failure, high dropout, or wasted investment. Must address.
- **medium**: Reduces effectiveness but doesn't doom the project. Should address.
- **low**: Minor concern or edge case. Consider addressing.

## Output Format

Return a JSON object matching this exact schema:

{
  "challenges": [
    {
      "assumption": "Teachers will complete all 40 hours of self-paced content",
      "perspective": "Busy mid-career teacher with limited free time",
      "severity": "high",
      "concern": "Self-paced completion rates for 40-hour courses are typically 10-15%. Teachers with 5-15 years experience have heavy workloads and family commitments. Without external accountability, most will abandon after Module 2.",
      "suggestion": "Add cohort-based checkpoints every 2 weeks, reduce to 20 hours of core content with 20 hours optional, or restructure as a blended program with scheduled mentor sessions."
    }
  ],
  "overallRiskLevel": "medium",
  "topConcerns": [
    "Completion rate risk for 40-hour self-paced format",
    "Gap between theoretical content and classroom application",
    "Assessment complexity may not match audience's experience level"
  ],
  "summary": "The course structure is pedagogically sound but makes optimistic assumptions about learner commitment and self-regulation. The biggest risk is the 40-hour self-paced format for busy teachers — consider cohort-based delivery or modular certification to improve completion."
}

## Important
- Generate 5-10 challenges covering different aspects
- Be specific — reference actual modules, topics, components, and audience traits
- Don't be negative for the sake of it — every challenge must be reasonable and constructive
- The suggestion should be actionable, not just "fix this"
- overallRiskLevel should reflect the severity distribution of challenges
- topConcerns should be the 3 most important issues (in priority order)
- Return ONLY the JSON object. No markdown fences, no commentary.`

// ─── Output Schema ────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['challenges', 'overallRiskLevel', 'topConcerns', 'summary'],
  properties: {
    challenges: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        required: ['assumption', 'perspective', 'severity', 'concern', 'suggestion'],
      },
    },
    overallRiskLevel: { type: 'string', enum: ['high', 'medium', 'low'] },
    topConcerns: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

// ─── Agent Runner ─────────────────────────────────────────────────────────

/**
 * Run the Devil's Advocate agent.
 *
 * @param brief - The raw project brief
 * @param archetype - Detected project archetype
 * @param structure - Proposed course structure
 * @param outcomesMap - Learning outcomes per node
 * @param componentPlan - Component assignments per node
 * @param audienceProfile - Audience profile
 * @returns AgentResult containing the DevilsAdvocateReport
 */
export async function runDevilsAdvocate(
  brief: string,
  archetype: ProjectArchetype,
  structure: ProposedStructure,
  outcomesMap: OutcomesMap,
  componentPlan: ComponentPlan,
  audienceProfile: AudienceProfile
): Promise<AgentResult<DevilsAdvocateReport>> {
  const archetypeDef = getArchetype(archetype)

  const sections = [
    `## Project Brief\n${brief}`,
    '',
    `## Archetype: ${archetypeDef.name}`,
    `Target production mode: ${archetypeDef.productionMode}`,
    '',
    `## Audience Profile\n${JSON.stringify(audienceProfile, null, 2)}`,
    '',
    `## Course Structure\n${JSON.stringify(structure, null, 2)}`,
    '',
    `## Learning Outcomes\n${JSON.stringify(outcomesMap, null, 2)}`,
    '',
    `## Component Plan\n${JSON.stringify(componentPlan, null, 2)}`,
    '',
    'Challenge the assumptions in this design from the learner\'s perspective.',
  ]

  return executeIdeationAgent<DevilsAdvocateReport>(
    DEVILS_ADVOCATE_CONFIG,
    SYSTEM_PROMPT,
    sections.join('\n'),
    OUTPUT_SCHEMA
  )
}

// ─── Self-Registration ────────────────────────────────────────────────────

registerAgent(DEVILS_ADVOCATE_CONFIG)
