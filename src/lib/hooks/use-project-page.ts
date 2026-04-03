'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi, useApiMutation } from './use-api'
import { useIdeation, type UseIdeationReturn } from './use-ideation'
import { deriveActivityEntries } from '@/components/project-component/chat/activity-stream'
import { computeTotalCost } from '@/components/project-component/chat/agent-sidebar'
import type { ActivityEntry } from '@/components/project-component/chat/activity-card'
import type { ChatMessageData } from '@/components/project-component/chat/chat-message'
import type { IdeationPhase, AudienceProfile, ProposedStructure, BlueprintSummary } from '@/lib/project-component'
import type { ArtifactTab } from '@/components/project-component/layout/artifact-panel'

// ─── API Response Types ────────────────────────────────────────────────────────

export interface BlueprintResponse {
  id: string
  projectId: string
  archetype: string
  ideationPhase: IdeationPhase
  ideationScore: number | null
  structureSummary: Record<string, unknown> | null
  project: {
    id: string
    name: string
    topic: string
    targetAudience: string
  }
}

interface PhaseGroup {
  conversationId: string
  phase: IdeationPhase
  messages: ChatMessageData[]
}

interface MessagesResponse {
  conversationId: string | null
  phase: IdeationPhase
  messages: ChatMessageData[]
  conversations: { id: string; phase: IdeationPhase; messageCount: number; createdAt: string }[]
  groupedByPhase: PhaseGroup[]
}

// ─── Hook Return ──────────────────────────────────────────────────────────────

export interface UseProjectPageReturn {
  // Data
  blueprint: BlueprintResponse | null
  blueprintSummary: BlueprintSummary | null
  allMessages: ChatMessageData[]
  activityEntries: ActivityEntry[]

  // Derived
  currentPhase: IdeationPhase
  hasConversation: boolean
  proposedStructure: ProposedStructure | null
  audienceProfile: AudienceProfile | null
  awaitingAudienceConfirmation: boolean
  totalCost: number
  score: number | null
  loopCount: number
  completedPhases: IdeationPhase[]
  showProceed: boolean
  structureRefreshKey: number

  // Ideation mutations
  ideation: UseIdeationReturn

  // Loading / error
  blueprintLoading: boolean
  messagesLoading: boolean
  messagesError: string | null
  autoStarting: boolean
  autoCreateError: string | null
  isNotFound: boolean

  // Handlers
  handleSendMessage: (message: string) => Promise<void>
  renameProject: (name: string) => Promise<void>
  retryBlueprint: () => void
  retryMessages: () => Promise<unknown>

  // Artifact panel
  panelOpen: boolean
  setPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  activeTab: ArtifactTab
  setActiveTab: (tab: ArtifactTab) => void
  visibleTabs: Set<ArtifactTab>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectPage(projectId: string): UseProjectPageReturn {
  // ── UI State ──────────────────────────────────────────────────────────────

  const [panelOpen, setPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ArtifactTab>('structure')
  const [visibleTabs, setVisibleTabs] = useState<Set<ArtifactTab>>(() => new Set())

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const {
    data: blueprint,
    loading: blueprintLoading,
    error: blueprintError,
    refetch: refetchBlueprint,
  } = useApi<BlueprintResponse>(`/api/blueprints?projectId=${projectId}`)

  const messagesUrl = blueprint ? `/api/blueprints/${blueprint.id}/ideation/messages` : ''
  const {
    data: messagesData,
    loading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useApi<MessagesResponse>(messagesUrl, { skip: !blueprint })

  const currentPhase = blueprint?.ideationPhase ?? 'brainstorm'
  const hasConversation = (messagesData?.conversations?.length ?? 0) > 0

  // ── Ideation Mutations ────────────────────────────────────────────────────

  const ideation = useIdeation({
    blueprintId: blueprint?.id ?? null,
    currentPhase,
    hasConversation,
    refetchMessages,
    refetchBlueprint,
  })

  // ── Auto-Create Blueprint ─────────────────────────────────────────────────

  const [autoCreateError, setAutoCreateError] = useState<string | null>(null)
  const autoCreateAttempted = useRef(false)

  const isNotFound = blueprintError
    ? (() => {
        const lower = blueprintError.toLowerCase()
        return lower.includes('not found') || lower.includes('no blueprint') || lower.includes('404')
      })()
    : false

  useEffect(() => {
    if (!isNotFound || autoCreateAttempted.current) return
    autoCreateAttempted.current = true

    fetch('/api/blueprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? `Failed to create blueprint (${res.status})`)
        }
        return refetchBlueprint()
      })
      .catch((err) => {
        setAutoCreateError(err instanceof Error ? err.message : 'Failed to create blueprint')
      })
  }, [isNotFound, projectId, refetchBlueprint])

  const retryBlueprint = useCallback(() => {
    if (autoCreateError) {
      setAutoCreateError(null)
      autoCreateAttempted.current = false
    } else {
      refetchBlueprint()
    }
  }, [autoCreateError, refetchBlueprint])

  // ── Auto-Start Ideation ───────────────────────────────────────────────────

  const autoStartAttempted = useRef(false)
  const [autoStarting, setAutoStarting] = useState(false)

  useEffect(() => {
    if (
      autoStartAttempted.current ||
      !blueprint ||
      blueprintLoading ||
      messagesLoading ||
      hasConversation
    ) return
    autoStartAttempted.current = true
    setAutoStarting(true)

    const storedBrief = typeof window !== 'undefined' ? sessionStorage.getItem('brief') : null
    const brief = storedBrief ?? [
      `Project: ${blueprint.project.name}`,
      `Topic: ${blueprint.project.topic}`,
      blueprint.project.targetAudience ? `Target Audience: ${blueprint.project.targetAudience}` : '',
    ].filter(Boolean).join('\n')

    if (storedBrief && typeof window !== 'undefined') {
      sessionStorage.removeItem('brief')
    }

    ideation.startIdeation(brief)
      .catch(() => { /* Error captured in startError */ })
      .finally(() => setAutoStarting(false))
  }, [blueprint, blueprintLoading, messagesLoading, hasConversation, ideation.startIdeation])

  // ── Optimistic Messages ───────────────────────────────────────────────────

  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessageData[]>([])

  const handleSendMessage = useCallback(async (message: string) => {
    const optimisticMsg: ChatMessageData = {
      id: `optimistic-${Date.now()}`,
      role: 'human',
      messageType: 'text',
      content: message,
      createdAt: new Date().toISOString(),
    }
    setOptimisticMessages(prev => [...prev, optimisticMsg])

    try {
      if (!hasConversation) {
        await ideation.startIdeation(message)
      } else {
        await ideation.sendMessage(message)
      }
      setOptimisticMessages([])
    } catch {
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
    }
  }, [hasConversation, ideation])

  // ── Project Rename ────────────────────────────────────────────────────────

  const { mutate: patchProject } = useApiMutation<{ name: string }, { id: string; name: string }>(
    `/api/projects/${projectId}`,
    'PATCH',
  )

  const renameProject = useCallback(async (name: string) => {
    await patchProject({ name })
    refetchBlueprint()
  }, [patchProject, refetchBlueprint])

  // ── Derived State ─────────────────────────────────────────────────────────

  const allApiMessages = useMemo<ChatMessageData[]>(() => {
    if (!messagesData) return []
    if (messagesData.groupedByPhase?.length > 0) {
      return messagesData.groupedByPhase.flatMap(g => g.messages)
    }
    return messagesData.messages ?? []
  }, [messagesData])

  const allMessages = useMemo(
    () => [...allApiMessages, ...optimisticMessages],
    [allApiMessages, optimisticMessages],
  )

  const completedPhases = useMemo(() => {
    if (!messagesData?.groupedByPhase) return [] as IdeationPhase[]
    return messagesData.groupedByPhase.map(g => g.phase)
  }, [messagesData])

  const loopCount = useMemo(() => {
    let count = 0
    for (const msg of allMessages) {
      const data = msg.structuredData as Record<string, unknown> | null
      if (typeof data?.loopCount === 'number') count = data.loopCount as number
    }
    return count
  }, [allMessages])

  const audienceProfile = useMemo<AudienceProfile | null>(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const data = allMessages[i].structuredData as Record<string, unknown> | null
      if (data?.audienceProfile) return data.audienceProfile as AudienceProfile
    }
    return null
  }, [allMessages])

  const proposedStructure = useMemo<ProposedStructure | null>(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const data = allMessages[i].structuredData as Record<string, unknown> | null
      if (data?.proposedStructure) return data.proposedStructure as ProposedStructure
    }
    return null
  }, [allMessages])

  const awaitingAudienceConfirmation = useMemo(() => {
    if (currentPhase !== 'structure') return false
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const sd = allMessages[i].structuredData as Record<string, unknown> | null
      if (sd?.awaitingAudienceConfirmation !== undefined) {
        return sd.awaitingAudienceConfirmation as boolean
      }
    }
    // Fallback: if we have audience but no structure in structure phase
    return !!audienceProfile && !proposedStructure && currentPhase === 'structure'
  }, [allMessages, currentPhase, audienceProfile, proposedStructure])

  const totalCost = useMemo(() => computeTotalCost(allMessages), [allMessages])

  const showProceed = useMemo(() => {
    if (currentPhase !== 'brainstorm') return false
    return allMessages.filter(m => m.role === 'human').length >= 2
  }, [currentPhase, allMessages])

  const activityEntries = useMemo(
    () => deriveActivityEntries(allMessages, ideation.activeAgents, ideation.currentAction, currentPhase),
    [allMessages, ideation.activeAgents, ideation.currentAction, currentPhase],
  )

  const blueprintSummary = useMemo<BlueprintSummary | null>(() => {
    if (!blueprint) return null
    return {
      archetype: blueprint.archetype,
      ideationScore: blueprint.ideationScore,
      structureSummary: blueprint.structureSummary as BlueprintSummary['structureSummary'],
    }
  }, [blueprint])

  // ── Structure Refresh Key ─────────────────────────────────────────────────

  const [structureRefreshKey, setStructureRefreshKey] = useState(0)

  const lastStructureMsg = useMemo(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const data = allMessages[i].structuredData as Record<string, unknown> | null
      if (data?.proposedStructure || allMessages[i].messageType === 'structure_update') {
        return allMessages[i].id
      }
    }
    return null
  }, [allMessages])

  const lastKnownStructureMsgRef = useRef<string | null>(null)
  useEffect(() => {
    if (lastStructureMsg && lastStructureMsg !== lastKnownStructureMsgRef.current) {
      lastKnownStructureMsgRef.current = lastStructureMsg
      setStructureRefreshKey(k => k + 1)
    }
  }, [lastStructureMsg])

  // ── Artifact Panel Visibility ─────────────────────────────────────────────

  const prevVisibleCountRef = useRef(0)

  useEffect(() => {
    const next = new Set<ArtifactTab>()
    if (proposedStructure) next.add('structure')
    if (audienceProfile) next.add('audience')
    if (blueprint?.ideationScore != null) next.add('grade')
    if (currentPhase === 'approved') {
      next.add('configure')
      next.add('launch')
    }

    setVisibleTabs(next)

    if (next.size > 0 && prevVisibleCountRef.current === 0) {
      setPanelOpen(true)
      const first = (['structure', 'grade', 'audience', 'configure', 'launch'] as ArtifactTab[])
        .find(t => next.has(t))
      if (first) setActiveTab(first)
    }
    prevVisibleCountRef.current = next.size
  }, [proposedStructure, audienceProfile, blueprint?.ideationScore, currentPhase])

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    blueprint,
    blueprintSummary,
    allMessages,
    activityEntries,
    currentPhase,
    hasConversation,
    proposedStructure,
    audienceProfile,
    awaitingAudienceConfirmation,
    totalCost,
    score: blueprint?.ideationScore ?? null,
    loopCount,
    completedPhases,
    showProceed,
    structureRefreshKey,
    ideation,
    blueprintLoading,
    messagesLoading,
    messagesError,
    autoStarting,
    autoCreateError,
    isNotFound,
    handleSendMessage,
    renameProject,
    retryBlueprint,
    retryMessages: refetchMessages,
    panelOpen,
    setPanelOpen,
    activeTab,
    setActiveTab,
    visibleTabs,
  }
}
