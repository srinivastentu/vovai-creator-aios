import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendMessageSchema } from '@/lib/validations/ideation'
import { formatZodError } from '@/lib/validations/blueprint'
import {
  getLatestConversation,
  addMessage,
  getMessages,
  updateConversationPhase,
} from '@/lib/project-component/ideation/conversation-manager'
import { createInitialState } from '@/lib/project-component/ideation/phase-manager'
import type { IdeationLoopState } from '@/lib/project-component/ideation/phase-manager'
import { runIdeationStep } from '@/lib/project-component/ideation/loop-engine'
import { checkCostLimit } from '@/lib/project-component/ideation/cost-guard'

// TODO(Ring-5): Add authentication + authorization middleware
// TODO(Ring-5): Add rate limiting (expensive — triggers LLM call)

import type {
  IdeationPhase,
  ProjectArchetype,
  AudienceProfile,
  ProposedStructure,
  OutcomesMap,
  ComponentPlan,
  GradeReport,
} from '@/lib/project-component/types'

/**
 * POST /api/blueprints/[blueprintId]/ideation/message
 *
 * Send a human message during brainstorming. Persists the message,
 * rebuilds loop state from the conversation, and runs the next step.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId } = await params
    const body = await request.json()

    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    // Verify blueprint exists
    const blueprint = await db.projectBlueprint.findUnique({
      where: { id: blueprintId },
    })
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 })
    }

    // Get active conversation
    const conversation = await getLatestConversation(blueprintId)
    if (!conversation) {
      return NextResponse.json(
        { error: 'No active conversation. Call /ideation/start first.' },
        { status: 400 }
      )
    }

    // Check cost limit before running agents
    const costCheck = await checkCostLimit(blueprintId)
    if (!costCheck.ok) {
      return NextResponse.json(
        { error: 'Ideation cost limit reached. Please start a new session or contact support.' },
        { status: 400 }
      )
    }

    // Persist the human message
    await addMessage({
      conversationId: conversation.id,
      role: 'human',
      content: parsed.data.message,
      messageType: 'text',
    })

    // Rebuild loop state from conversation + blueprint
    const state = await rebuildState(blueprintId, blueprint, conversation)

    // Run the next step
    const result = await runIdeationStep(state, parsed.data.message)

    // Persist the agent response (include accumulated state for rebuild)
    await addMessage({
      conversationId: conversation.id,
      role: 'facilitator',
      content: result.humanMessage,
      messageType: inferMessageType(result),
      structuredData: {
        phase: result.updatedState.currentPhase,
        archetype: result.updatedState.archetype,
        costUSD: result.stepCostUSD,
        awaitingHuman: result.awaitingHuman,
        audienceProfile: result.updatedState.audienceProfile ?? undefined,
        proposedStructure: result.updatedState.proposedStructure ?? undefined,
        outcomesMap: result.updatedState.outcomesMap ?? undefined,
        componentPlan: result.updatedState.componentPlan ?? undefined,
        gradeReport: result.updatedState.gradeReport ?? undefined,
      },
    })

    // Update conversation phase if it changed
    if (result.updatedState.currentPhase !== conversation.phase) {
      await updateConversationPhase(conversation.id, result.updatedState.currentPhase)
    }

    // Sync blueprint ideation phase
    await db.projectBlueprint.update({
      where: { id: blueprintId },
      data: { ideationPhase: result.updatedState.currentPhase },
    })

    // Fetch updated messages
    const messages = await getMessages(conversation.id)

    return NextResponse.json({
      conversationId: conversation.id,
      phase: result.updatedState.currentPhase,
      archetype: result.updatedState.archetype,
      awaitingHuman: result.awaitingHuman,
      message: result.humanMessage,
      costUSD: result.stepCostUSD,
      messages,
      state: result.updatedState,
    })
  } catch (error) {
    console.error('POST /api/blueprints/[blueprintId]/ideation/message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Rebuild IdeationLoopState from the blueprint and conversation data.
 * The loop engine is stateless — we reconstruct state each request.
 */
async function rebuildState(
  blueprintId: string,
  blueprint: {
    ideationPhase: string
    archetype: string | null
    targetAudience: unknown
    structureSummary: unknown
  },
  conversation: {
    messages: Array<{
      role: string
      content: string
      messageType: string
      structuredData: unknown
    }>
  }
): Promise<IdeationLoopState> {
  // Find the brief from the first human message
  const firstHumanMsg = conversation.messages.find(m => m.role === 'human')
  const brief = firstHumanMsg?.content ?? ''

  // Extract accumulated state from the latest messages that have each field
  let archetype: ProjectArchetype | null = blueprint.archetype as ProjectArchetype | null
  let audienceProfile: AudienceProfile | null = null
  let proposedStructure: ProposedStructure | null = null
  let outcomesMap: OutcomesMap | null = null
  let componentPlan: ComponentPlan | null = null
  let gradeReport: GradeReport | null = null

  for (const msg of conversation.messages) {
    const data = msg.structuredData as Record<string, unknown> | null
    if (!data) continue
    if (data.archetype) archetype = data.archetype as ProjectArchetype
    if (data.audienceProfile) audienceProfile = data.audienceProfile as AudienceProfile
    if (data.proposedStructure) proposedStructure = data.proposedStructure as ProposedStructure
    if (data.outcomesMap) outcomesMap = data.outcomesMap as OutcomesMap
    if (data.componentPlan) componentPlan = data.componentPlan as ComponentPlan
    if (data.gradeReport) gradeReport = data.gradeReport as GradeReport
  }

  // Fall back to blueprint columns if conversation messages lack the data
  // (e.g. seeded projects where early messages don't carry structuredData)
  if (!audienceProfile && blueprint.targetAudience) {
    audienceProfile = blueprint.targetAudience as AudienceProfile
  }
  if (!proposedStructure) {
    // Synthesize a minimal ProposedStructure from the blueprint's actual nodes
    // so the loop engine can proceed with refinement
    const nodes = await db.projectNode.findMany({
      where: { blueprintId },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, title: true, description: true, depth: true, parentId: true, learningOutcomes: true },
    })
    if (nodes.length > 0) {
      const modules = nodes.filter(n => n.depth === 0)
      proposedStructure = {
        courseTitle: blueprint.structureSummary
          ? (blueprint.structureSummary as Record<string, unknown>).courseTitle as string ?? 'Untitled Course'
          : 'Untitled Course',
        courseDescription: '',
        modules: modules.map(mod => ({
          title: mod.title,
          description: mod.description ?? '',
          topics: nodes
            .filter(n => n.parentId === mod.id && n.depth === 1)
            .map(topic => ({
              title: topic.title,
              description: topic.description ?? '',
              keyConcepts: [],
              estimatedMinutes: 60,
              subtopics: nodes
                .filter(n => n.parentId === topic.id)
                .map(st => st.title),
              difficulty: 'intermediate' as const,
              bloomLevel: 'apply' as const,
            })),
        })),
        sequencingRationale: '',
        alternativeStructures: [],
        confidenceScore: 0.8,
      }
    }
  }

  const state = createInitialState(blueprintId, brief)
  state.currentPhase = blueprint.ideationPhase as IdeationPhase
  state.archetype = archetype
  state.audienceProfile = audienceProfile
  state.proposedStructure = proposedStructure
  state.outcomesMap = outcomesMap
  state.componentPlan = componentPlan
  state.gradeReport = gradeReport

  // Rebuild conversation history for the orchestrator
  state.conversationHistory = conversation.messages.map((m, i) => ({
    id: `msg-${i}`,
    conversationId: '',
    role: m.role as IdeationLoopState['conversationHistory'][number]['role'],
    messageType: m.messageType as IdeationLoopState['conversationHistory'][number]['messageType'],
    content: m.content,
    structuredData: (m.structuredData as Record<string, unknown>) ?? undefined,
    createdAt: new Date(),
  }))

  return state
}

function inferMessageType(result: { updatedState: IdeationLoopState; awaitingHuman: boolean }): 'question' | 'decision' | 'structure_update' {
  if (result.updatedState.currentPhase === 'brainstorm' && result.awaitingHuman) {
    return 'question'
  }
  if (result.updatedState.currentPhase === 'structure' || result.updatedState.currentPhase === 'refinement') {
    return 'structure_update'
  }
  return 'decision'
}
