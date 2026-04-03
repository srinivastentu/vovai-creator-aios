'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/lib/hooks/use-api'
import { useIdeation } from '@/lib/hooks/use-ideation'
import { ActivityStream, deriveActivityEntries } from '@/components/project-component/chat/activity-stream'
import { AgentSidebar, computeTotalCost } from '@/components/project-component/chat/agent-sidebar'
import { PhaseActions } from '@/components/project-component/chat/phase-actions'
import { PhaseIndicator } from '@/components/project-component/chat/phase-indicator'
import { PcNav } from '@/components/project-component/shared/pc-nav'
import { Breadcrumbs } from '@/components/project-component/shared/breadcrumbs'
import { ErrorBanner } from '@/components/project-component/shared/error-banner'
import type { ChatMessageData } from '@/components/project-component/chat/chat-message'
import type { BlueprintSummary } from '@/components/project-component/chat/context-panels'
import type { IdeationPhase, AudienceProfile, ProposedStructure } from '@/lib/project-component'

// ─── API Response Types ────────────────────────────────────────────────────

interface BlueprintResponse {
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

interface ConversationInfo {
  id: string
  phase: IdeationPhase
  messageCount: number
  createdAt: string
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
  conversations: ConversationInfo[]
  groupedByPhase: PhaseGroup[]
}

// ─── Page Component ────────────────────────────────────────────────────────

export default function IdeationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const router = useRouter()

  // Fetch blueprint for this project
  const {
    data: blueprint,
    loading: blueprintLoading,
    error: blueprintError,
    refetch: refetchBlueprint,
  } = useApi<BlueprintResponse>(`/api/blueprints?projectId=${projectId}`)

  // Fetch all messages (depends on blueprint being loaded)
  const messagesUrl = blueprint ? `/api/blueprints/${blueprint.id}/ideation/messages` : null
  const {
    data: messagesData,
    loading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useApi<MessagesResponse>(messagesUrl ?? '', { skip: !blueprint })

  const currentPhase = blueprint?.ideationPhase ?? 'brainstorm'
  const hasConversation = (messagesData?.conversations?.length ?? 0) > 0

  // Ideation mutation hook
  const {
    startIdeation,
    startLoading,
    startError,
    sendMessage,
    sendLoading,
    sendError,
    gradeStructure,
    gradeLoading,
    gradeError,
    submitReview,
    reviewLoading,
    reviewError,
    anyLoading,
    activeAgents,
    currentAction,
  } = useIdeation({
    blueprintId: blueprint?.id ?? null,
    currentPhase,
    hasConversation,
    refetchMessages,
    refetchBlueprint,
  })

  // Auto-start ideation when no conversation exists
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

    const brief = [
      `Project: ${blueprint.project.name}`,
      `Topic: ${blueprint.project.topic}`,
      blueprint.project.targetAudience ? `Target Audience: ${blueprint.project.targetAudience}` : '',
    ].filter(Boolean).join('\n')

    startIdeation(brief)
      .catch(() => {
        // Error is captured in startError — user can retry via input
      })
      .finally(() => setAutoStarting(false))
  }, [blueprint, blueprintLoading, messagesLoading, hasConversation, startIdeation])

  // Optimistic messages — shown immediately before API responds
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
        await startIdeation(message)
      } else {
        await sendMessage(message)
      }
      setOptimisticMessages([])
    } catch (err) {
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      throw err
    }
  }, [hasConversation, startIdeation, sendMessage])

  // Flatten all messages from API response
  const allApiMessages = useMemo<ChatMessageData[]>(() => {
    if (!messagesData) return []
    if (messagesData.groupedByPhase?.length > 0) {
      return messagesData.groupedByPhase.flatMap(g => g.messages)
    }
    return messagesData.messages ?? []
  }, [messagesData])

  // Combine API messages + optimistic messages
  const allMessages = useMemo(
    () => [...allApiMessages, ...optimisticMessages],
    [allApiMessages, optimisticMessages]
  )

  // Structure preview refresh key — increments after each structure update
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

  // Completed phases (for phase indicator)
  const completedPhases = useMemo(() => {
    if (!messagesData?.groupedByPhase) return []
    return messagesData.groupedByPhase.map(g => g.phase)
  }, [messagesData])

  // Derive loop count from messages
  const loopCount = useMemo(() => {
    let count = 0
    for (const msg of allMessages) {
      const data = msg.structuredData as Record<string, unknown> | null
      if (typeof data?.loopCount === 'number') count = data.loopCount as number
    }
    return count
  }, [allMessages])

  // Extract latest audience profile
  const audienceProfile = useMemo<AudienceProfile | null>(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const data = allMessages[i].structuredData as Record<string, unknown> | null
      if (data?.audienceProfile) return data.audienceProfile as AudienceProfile
    }
    return null
  }, [allMessages])

  // Extract latest proposed structure
  const proposedStructure = useMemo<ProposedStructure | null>(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const data = allMessages[i].structuredData as Record<string, unknown> | null
      if (data?.proposedStructure) return data.proposedStructure as ProposedStructure
    }
    return null
  }, [allMessages])

  // Total cost
  const totalCost = useMemo(() => computeTotalCost(allMessages), [allMessages])

  // Show "Proceed" button in brainstorm after 2+ human messages
  const showProceed = useMemo(() => {
    if (currentPhase !== 'brainstorm') return false
    return allMessages.filter(m => m.role === 'human').length >= 2
  }, [currentPhase, allMessages])

  // Activity stream entries
  const activityEntries = useMemo(
    () => deriveActivityEntries(allMessages, activeAgents, currentAction, currentPhase),
    [allMessages, activeAgents, currentAction, currentPhase]
  )

  // Blueprint summary for context panels
  const blueprintSummary = useMemo<BlueprintSummary | null>(() => {
    if (!blueprint) return null
    return {
      archetype: blueprint.archetype,
      ideationScore: blueprint.ideationScore,
      structureSummary: blueprint.structureSummary as BlueprintSummary['structureSummary'],
    }
  }, [blueprint])

  // Phase click → scroll (legacy, may not be needed with new stream)
  const handlePhaseClick = useCallback((phase: IdeationPhase) => {
    const el = document.querySelector(`[data-phase="${phase}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Auto-create blueprint when none exists
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
          throw new Error(body.error ?? `Failed to create blueprint (${res.status})`)
        }
        return refetchBlueprint()
      })
      .catch((err) => {
        setAutoCreateError(err instanceof Error ? err.message : 'Failed to create blueprint')
      })
  }, [isNotFound, projectId, refetchBlueprint])

  // ─── Loading / Error States ────────────────────────────────────────────────

  if (blueprintLoading || (isNotFound && !autoCreateError)) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-2">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
        <span className="text-sm text-muted-foreground">
          {isNotFound ? 'Setting up ideation...' : 'Loading project...'}
        </span>
      </main>
    )
  }

  if (autoCreateError) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Link
            href={`/project/${projectId}`}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to Project
          </Link>
          <ErrorBanner
            message={autoCreateError}
            onRetry={() => {
              setAutoCreateError(null)
              autoCreateAttempted.current = false
            }}
            variant="card"
          />
        </div>
      </main>
    )
  }

  if (blueprintError && !isNotFound) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Link
            href={`/project/${projectId}`}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to Project
          </Link>
          <ErrorBanner
            message={blueprintError}
            onRetry={() => refetchBlueprint()}
            variant="card"
          />
        </div>
      </main>
    )
  }

  // ─── Main Layout ───────────────────────────────────────────────────────────

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </Link>
        <Breadcrumbs crumbs={[
          { label: 'Project', href: `/project/${projectId}` },
          { label: 'Ideation' },
        ]} />
        <Badge variant="outline" className="ml-1 text-xs capitalize">
          {blueprint?.archetype?.replace('_', ' ')}
        </Badge>
      </div>

      {/* Project Component navigation */}
      <PcNav projectId={projectId} currentPhase={currentPhase} />

      {/* Phase indicator */}
      <PhaseIndicator
        currentPhase={currentPhase}
        score={blueprint?.ideationScore ?? null}
        loopCount={loopCount}
        completedPhases={completedPhases}
        onPhaseClick={handlePhaseClick}
      />

      {/* Main layout: Activity Stream (70%) + Minimal Sidebar (30%) */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Main content: activity stream + action panel */}
        <div className="flex w-full flex-col md:w-[70%]">
          {messagesLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
              <span className="text-xs text-muted-foreground">Loading conversation...</span>
            </div>
          ) : messagesError ? (
            <ErrorBanner
              message={messagesError}
              onRetry={() => refetchMessages()}
              variant="card"
            />
          ) : !hasConversation && (autoStarting || startLoading) ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
              <p className="text-sm text-muted-foreground">
                AI agents are analyzing your brief and designing the course structure...
              </p>
            </div>
          ) : (
            <ActivityStream entries={activityEntries} />
          )}

          {/* Sticky action panel */}
          {hasConversation && (
            <PhaseActions
              currentPhase={currentPhase}
              anyLoading={anyLoading}
              gradeLoading={gradeLoading}
              reviewLoading={reviewLoading}
              sendLoading={sendLoading}
              gradeError={gradeError}
              reviewError={reviewError}
              sendError={sendError}
              score={blueprint?.ideationScore ?? null}
              showProceed={showProceed}
              onProceed={() => sendMessage('proceed')}
              onGrade={gradeStructure}
              onApprove={async () => {
                try {
                  await submitReview('approve')
                  router.push(`/project/${projectId}/structure`)
                } catch {
                  // Error captured in reviewError
                }
              }}
              onSendFeedback={(msg) => submitReview('feedback', msg)}
              onRestructure={() => {
                if (window.confirm('Start over from brainstorm? Brief and audience will be retained.')) {
                  submitReview('restructure')
                }
              }}
              onSendMessage={handleSendMessage}
              proposedStructure={proposedStructure}
              audienceProfile={audienceProfile}
              blueprint={blueprintSummary}
              blueprintId={blueprint?.id ?? null}
              projectId={projectId}
              structureRefreshKey={structureRefreshKey}
              totalCost={totalCost}
            />
          )}
        </div>

        {/* Minimal sidebar — phase badge + cost */}
        <div className="hidden border-l bg-background md:flex md:w-[30%] md:flex-col">
          <AgentSidebar
            currentPhase={currentPhase}
            totalCost={totalCost}
          />
        </div>
      </div>
    </main>
  )
}
