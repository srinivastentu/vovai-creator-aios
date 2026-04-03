/**
 * State Rebuilder — Reconstruct IdeationLoopState from persisted data.
 *
 * The loop engine is stateless — we reconstruct state each request from
 * the conversation messages and blueprint columns. Extracted here so it
 * can be shared across multiple API routes (message, confirm-audience, etc.).
 */

import { db } from '@/lib/db'
import { createInitialState } from '@/lib/project-component/ideation/phase-manager'
import type { IdeationLoopState } from '@/lib/project-component/ideation/phase-manager'
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
 * Rebuild IdeationLoopState from the blueprint and conversation data.
 * The loop engine is stateless — we reconstruct state each request.
 */
export async function rebuildState(
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

  // Extract awaitingAudienceConfirmation from latest message that has it
  let awaitingAudienceConfirmation = false
  for (const msg of [...conversation.messages].reverse()) {
    const data = msg.structuredData as Record<string, unknown> | null
    if (data?.awaitingAudienceConfirmation !== undefined) {
      awaitingAudienceConfirmation = data.awaitingAudienceConfirmation as boolean
      break
    }
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
  state.awaitingAudienceConfirmation = awaitingAudienceConfirmation
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
