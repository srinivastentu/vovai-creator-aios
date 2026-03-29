/**
 * Orchestrator Agent — Stage 0.1–0.7 (Master Conductor)
 *
 * Coordinates all other ideation agents. Receives the human message
 * plus accumulated context, decides what phase we're in, which agents
 * to run next, and crafts a human-facing response. The orchestrator
 * is PROACTIVE (suggests next steps), TRANSPARENT (explains what agents
 * are doing), and DECISIVE (makes phase transitions, doesn't ask "shall I?").
 *
 * Level 2 (Product) — eLearn-specific agent configuration.
 */

import type { IdeationAgentConfig, AgentResult } from './framework/types'
import type {
  IdeationPhase,
  IdeationMessageType,
  AudienceProfile,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
  GradeReport,
  Challenge,
  OrchestratorOutput,
  ProjectArchetype,
} from '../types'
import { executeIdeationAgent } from './framework/executor'
import { registerAgent } from './framework/registry'

// ─── Agent Config ─────────────────────────────────────────────────────────

export const ORCHESTRATOR_CONFIG: IdeationAgentConfig = {
  id: 'orchestrator',
  name: 'Orchestrator',
  tier: 'orchestrator',
  model: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'claude-haiku-4-5-20251001',
  },
  maxRetries: 2,
  timeoutMs: 45_000,
}

// ─── System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Orchestrator — the master conductor of an AI-powered eLearning project ideation system. You coordinate a team of specialist agents to help humans design complete learning experiences.

## Your Role

You are the ONLY agent the human talks to directly. You:
1. Receive the human's message and current project context
2. Decide which phase of ideation we are in and what needs to happen next
3. Determine which specialist agents to run
4. Craft a clear, human-facing response that explains progress and next steps

## Ideation Phases

The ideation process follows these phases in order:

- **brainstorm**: Initial project brief analysis. Detect archetype (k12_curriculum, professional_training, content_channel). Ask clarifying questions if the brief is incomplete. Once brief is clear and archetype is detected, advance to structure.
- **structure**: Agents analyze audience and design curriculum. Run audience-analyst and curriculum-strategist. Once structure is proposed, advance to refinement.
- **refinement**: Agents assign outcomes, recommend components, optimize structure, challenge assumptions. Run outcome-architect, component-recommender, structure-optimizer, devils-advocate. Then trigger grading via rubric-grader. Once graded, advance to review.
- **review**: Present the graded blueprint to human for approval, feedback, or restructure. Wait for human decision.
- **approved**: Blueprint is locked. Ready for configuration wizard.

## Phase Actions

Choose exactly ONE action per response:

- **continue**: Stay in the current phase, more work needed (e.g., gathering info in brainstorm)
- **advance_phase**: Move to the next phase (include nextPhase field)
- **request_human_input**: Ask the human a specific question or present options
- **trigger_grading**: Run the rubric-grader and devils-advocate to evaluate the blueprint

## Agent Team

You can request any of these agents to run:
- audience-analyst: Profiles the target learners
- curriculum-strategist: Designs course structure (modules, topics)
- outcome-architect: Maps learning outcomes to structure nodes
- component-recommender: Recommends components (videos, quizzes, etc.) per node
- structure-optimizer: Checks structural health (balance, gaps, sequencing)
- rubric-grader: Grades the blueprint against 7 quality dimensions
- devils-advocate: Challenges assumptions and flags risks

## Decision Guidelines

1. If the brief is vague or missing key info (audience, scope, format), ask clarifying questions (request_human_input in brainstorm phase).
2. If the brief is clear enough to detect an archetype, advance to structure phase and run audience-analyst + curriculum-strategist.
3. If audience and structure are ready, advance to refinement and run outcome-architect + component-recommender.
4. After outcomes and components are assigned, trigger grading (structure-optimizer + rubric-grader + devils-advocate).
5. After grading completes, advance to review and present results to human.
6. When human approves in review, advance to approved.

## Human-Facing Message Guidelines

- Be PROACTIVE: tell the human what comes next, don't wait to be asked
- Be TRANSPARENT: explain what the agents found or are about to do
- Be DECISIVE: make phase transitions confidently, don't ask "shall I proceed?"
- Be CONCISE: 2-4 paragraphs maximum
- Reference specific findings when available (audience insights, structure details, grade scores)

## Output Format

Return a JSON object matching this exact schema:

{
  "phaseAction": "advance_phase",
  "nextPhase": "structure",
  "agentsToRun": ["audience-analyst", "curriculum-strategist"],
  "humanFacingMessage": "Your message to the human...",
  "structuredProposal": { ... optional structured data ... }
}

## Rules
- Always return valid JSON. No markdown fences, no commentary outside the JSON.
- agentsToRun must only contain valid agent IDs from the team list above.
- nextPhase is REQUIRED when phaseAction is "advance_phase".
- nextPhase must be omitted or null when phaseAction is NOT "advance_phase".
- structuredProposal is optional — use it to pass structured data like detected archetype or key decisions.
- Consider the full conversation history to maintain context across turns.`

// ─── Output Schema ────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['phaseAction', 'agentsToRun', 'humanFacingMessage'],
  properties: {
    phaseAction: {
      type: 'string',
      enum: ['continue', 'advance_phase', 'request_human_input', 'trigger_grading'],
    },
    nextPhase: {
      type: 'string',
      enum: ['brainstorm', 'structure', 'refinement', 'review', 'approved'],
    },
    agentsToRun: {
      type: 'array',
      items: { type: 'string' },
    },
    humanFacingMessage: { type: 'string' },
    structuredProposal: { type: 'object' },
  },
}

// ─── Context Builder ──────────────────────────────────────────────────────

interface OrchestratorContext {
  brief?: string
  archetype?: ProjectArchetype
  audienceProfile?: AudienceProfile
  proposedStructure?: ProposedStructure
  outcomesMap?: OutcomesMap
  componentPlan?: ComponentPlan
  gradeReport?: GradeReport
  challenges?: Challenge[]
  conversationHistory: IdeationMessageType[]
}

function buildContextSection(context: OrchestratorContext): string {
  const sections: string[] = []

  if (context.brief) {
    sections.push(`## Project Brief\n${context.brief}`)
  }

  if (context.archetype) {
    sections.push(`## Detected Archetype: ${context.archetype}`)
  }

  if (context.audienceProfile) {
    sections.push(`## Audience Profile\n${JSON.stringify(context.audienceProfile, null, 2)}`)
  }

  if (context.proposedStructure) {
    sections.push(`## Proposed Structure\n${JSON.stringify(context.proposedStructure, null, 2)}`)
  }

  if (context.outcomesMap) {
    sections.push(`## Learning Outcomes\n${JSON.stringify(context.outcomesMap, null, 2)}`)
  }

  if (context.componentPlan) {
    sections.push(`## Component Plan\n${JSON.stringify(context.componentPlan, null, 2)}`)
  }

  if (context.gradeReport) {
    sections.push(`## Grade Report\n${JSON.stringify(context.gradeReport, null, 2)}`)
  }

  if (context.challenges && context.challenges.length > 0) {
    sections.push(`## Devil's Advocate Challenges\n${JSON.stringify(context.challenges, null, 2)}`)
  }

  return sections.join('\n\n')
}

function buildConversationHistory(messages: IdeationMessageType[]): string {
  if (messages.length === 0) return ''

  const formatted = messages.map(msg => {
    const roleLabel = msg.role === 'human' ? 'Human' : `Agent (${msg.role})`
    return `[${roleLabel}]: ${msg.content}`
  }).join('\n\n')

  return `## Conversation History\n${formatted}`
}

// ─── Agent Runner ─────────────────────────────────────────────────────────

/**
 * Run the Orchestrator agent.
 *
 * @param input.humanMessage - The latest message from the human
 * @param input.currentPhase - Current ideation phase
 * @param input.context - Accumulated context from previous agents and phases
 * @returns AgentResult containing the OrchestratorOutput
 */
export async function runOrchestrator(input: {
  humanMessage: string
  currentPhase: IdeationPhase
  context: OrchestratorContext
}): Promise<AgentResult<OrchestratorOutput>> {
  const contextSection = buildContextSection(input.context)
  const historySection = buildConversationHistory(input.context.conversationHistory)

  const userMessage = [
    `## Current Phase: ${input.currentPhase}`,
    '',
    `## Human's Message\n${input.humanMessage}`,
    '',
    contextSection,
    '',
    historySection,
    '',
    'Analyze the current state and decide what should happen next.',
  ].filter(Boolean).join('\n')

  return executeIdeationAgent<OrchestratorOutput>(
    ORCHESTRATOR_CONFIG,
    SYSTEM_PROMPT,
    userMessage,
    OUTPUT_SCHEMA
  )
}

// ─── Self-Registration ────────────────────────────────────────────────────

registerAgent(ORCHESTRATOR_CONFIG)
