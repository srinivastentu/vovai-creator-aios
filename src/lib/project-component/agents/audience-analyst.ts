/**
 * Audience Analyst Agent — Stage 0.2
 *
 * Analyzes the project brief and archetype to produce a detailed
 * audience profile: demographics, prerequisites, learning preferences,
 * and recommended modalities. This profile shapes every downstream
 * decision — curriculum depth, language level, component selection.
 *
 * Level 2 (Product) — eLearn-specific agent configuration.
 */

import type { IdeationAgentConfig, AgentResult } from './framework/types'
import type { AudienceProfile, ProjectArchetype } from '../types'
import { executeIdeationAgent } from './framework/executor'
import { registerAgent } from './framework/registry'

// ─── Agent Config ─────────────────────────────────────────────────────────

export const AUDIENCE_ANALYST_CONFIG: IdeationAgentConfig = {
  id: 'audience-analyst',
  name: 'Audience Analyst',
  tier: 'production',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 30_000,
}

// ─── System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Audience Analyst agent for an AI-powered eLearning platform.

Your mission: Analyze a project brief and produce a detailed audience profile that will guide every downstream decision — curriculum depth, language register, pacing, component selection, and assessment strategy.

You are thorough, empathetic, and evidence-based. You infer audience characteristics from explicit and implicit cues in the brief, and you flag assumptions clearly.

## Output Requirements

Return a JSON object matching this exact schema:

{
  "primaryAudience": {
    "description": "2-3 sentence summary of who the learners are",
    "ageRange": "e.g. '25-45' or '12-14' (omit if not inferable)",
    "educationLevel": "e.g. 'Bachelor's degree', 'High school Grade 8'",
    "professionalRole": "e.g. 'Mid-career CBSE teachers' (omit if not applicable)",
    "experienceLevel": "e.g. 'Intermediate — 5-15 years in field'",
    "learningContext": "e.g. 'Self-paced online with optional mentor support'",
    "motivations": ["Why they would take this course — 3-5 items"],
    "painPoints": ["What frustrates them about current learning options — 3-5 items"],
    "technologyComfort": "beginner | intermediate | advanced"
  },
  "prerequisiteKnowledge": ["What learners must already know — 3-6 items"],
  "learningPreferences": {
    "preferredModalities": ["e.g. 'video', 'guided practice', 'case studies', 'peer discussion'"],
    "attentionSpan": "short | medium | long",
    "practicePreference": "guided | independent | collaborative"
  }
}

## Rules
- Infer from the brief. Do not invent details that contradict the brief.
- If information is missing, make reasonable assumptions and note them in the description.
- Motivations and pain points should be specific to this audience, not generic.
- Technology comfort should reflect the audience, not the content.
- Return ONLY the JSON object. No markdown fences, no commentary.`

// ─── Output Schema (for validation hint) ──────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['primaryAudience', 'prerequisiteKnowledge', 'learningPreferences'],
  properties: {
    primaryAudience: {
      type: 'object',
      required: ['description', 'educationLevel', 'experienceLevel', 'learningContext', 'motivations', 'painPoints', 'technologyComfort'],
    },
    prerequisiteKnowledge: { type: 'array', items: { type: 'string' } },
    learningPreferences: {
      type: 'object',
      required: ['preferredModalities', 'attentionSpan', 'practicePreference'],
    },
  },
}

// ─── Agent Runner ─────────────────────────────────────────────────────────

/**
 * Run the Audience Analyst agent.
 *
 * @param brief - The raw project brief from the human
 * @param archetype - Detected project archetype
 * @returns AgentResult containing the AudienceProfile
 */
export async function runAudienceAnalyst(
  brief: string,
  archetype: ProjectArchetype
): Promise<AgentResult<AudienceProfile>> {
  const userMessage = [
    `## Project Brief\n${brief}`,
    `## Detected Archetype: ${archetype}`,
    '',
    'Analyze this brief and produce a detailed audience profile.',
  ].join('\n')

  return executeIdeationAgent<AudienceProfile>(
    AUDIENCE_ANALYST_CONFIG,
    SYSTEM_PROMPT,
    userMessage,
    OUTPUT_SCHEMA
  )
}

// ─── Self-Registration ────────────────────────────────────────────────────

registerAgent(AUDIENCE_ANALYST_CONFIG)
