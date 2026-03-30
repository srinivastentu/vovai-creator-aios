'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, MessageSquare, PanelRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/hooks/use-api'
import { useIdeation } from '@/lib/hooks/use-ideation'
import { ChatMessageList } from '@/components/project-component/chat/chat-message-list'
import { ChatInput } from '@/components/project-component/chat/chat-input'
import { AgentSidebar } from '@/components/project-component/chat/agent-sidebar'
import { PhaseIndicator } from '@/components/project-component/chat/phase-indicator'
import { StructurePreview } from '@/components/project-component/chat/structure-preview'
import { PcNav } from '@/components/project-component/shared/pc-nav'
import type { ChatMessageData } from '@/components/project-component/chat/chat-message'
import type { ConversationGroup } from '@/components/project-component/chat/chat-message-list'
import type { BlueprintSummary } from '@/components/project-component/chat/agent-sidebar'
import type { IdeationPhase } from '@/lib/project-component'

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
  } = useIdeation({
    blueprintId: blueprint?.id ?? null,
    currentPhase,
    hasConversation,
    refetchMessages,
    refetchBlueprint,
  })

  // "Start Ideation" reveals the input; first message goes to /start
  const [readyToChat, setReadyToChat] = useState(false)

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
        // First message — create conversation via /start
        await startIdeation(message)
      } else {
        await sendMessage(message)
      }
      setOptimisticMessages([])
    } catch (err) {
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      throw err // Re-throw so ChatInput preserves the text
    }
  }, [hasConversation, startIdeation, sendMessage])

  // Group messages by conversation phase
  const conversationGroups: ConversationGroup[] = useMemo(() => {
    let groups: ConversationGroup[] = []

    if (!messagesData) {
      groups = []
    } else if (messagesData.groupedByPhase?.length > 0) {
      groups = messagesData.groupedByPhase.map((group) => ({
        phase: group.phase as IdeationPhase,
        messages: group.messages,
      }))
    } else if (messagesData.messages?.length > 0) {
      groups = [{
        phase: messagesData.phase as IdeationPhase,
        messages: messagesData.messages,
      }]
    }

    // Append optimistic messages to the last group
    if (optimisticMessages.length > 0) {
      const lastGroup = groups[groups.length - 1]
      if (lastGroup) {
        return [
          ...groups.slice(0, -1),
          { ...lastGroup, messages: [...lastGroup.messages, ...optimisticMessages] },
        ]
      }
      return [{ phase: currentPhase, messages: optimisticMessages }]
    }

    return groups
  }, [messagesData, optimisticMessages, currentPhase])

  // Flatten all messages for the sidebar
  const allMessages = useMemo(
    () => conversationGroups.flatMap((g) => g.messages),
    [conversationGroups]
  )

  // Mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Structure preview refresh key — increments after each agent message
  const [structureRefreshKey, setStructureRefreshKey] = useState(0)

  // Track structure-update messages to detect when tree should refresh
  const lastStructureMsg = useMemo(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const data = allMessages[i].structuredData as Record<string, unknown> | null
      if (data?.proposedStructure || allMessages[i].messageType === 'structure_update') {
        return allMessages[i].id
      }
    }
    return null
  }, [allMessages])

  // Bump refresh key when new structure data arrives (use ref to avoid render-phase setState)
  const lastKnownStructureMsgRef = useRef<string | null>(null)
  useEffect(() => {
    if (lastStructureMsg && lastStructureMsg !== lastKnownStructureMsgRef.current) {
      lastKnownStructureMsgRef.current = lastStructureMsg
      setStructureRefreshKey(k => k + 1)
    }
  }, [lastStructureMsg])

  // Completed phases (for phase indicator click-to-scroll)
  const completedPhases = useMemo(
    () => conversationGroups.map((g) => g.phase),
    [conversationGroups]
  )

  // Derive loop count from messages
  const loopCount = useMemo(() => {
    let count = 0
    for (const msg of allMessages) {
      const data = msg.structuredData as Record<string, unknown> | null
      if (typeof data?.loopCount === 'number') count = data.loopCount as number
    }
    return count
  }, [allMessages])

  // Scroll to a phase's messages in the chat
  const handlePhaseClick = useCallback((phase: IdeationPhase) => {
    const el = document.querySelector(`[data-phase="${phase}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Loading state
  if (blueprintLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </main>
    )
  }

  // Error state
  if (blueprintError) {
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
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">{blueprintError}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

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
        <h1 className="text-sm font-medium">Project Ideation</h1>
        <Badge variant="outline" className="text-xs capitalize">
          {blueprint?.archetype?.replace('_', ' ')}
        </Badge>
        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto md:hidden"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle agent sidebar"
        >
          <PanelRight size={16} />
        </Button>
      </div>

      {/* Project Component navigation */}
      <PcNav projectId={projectId} currentPhase={currentPhase} />

      {/* Phase indicator (sticky above chat) */}
      <PhaseIndicator
        currentPhase={currentPhase}
        score={blueprint?.ideationScore ?? null}
        loopCount={loopCount}
        completedPhases={completedPhases}
        onPhaseClick={handlePhaseClick}
      />

      {/* Main layout: chat (70%) + sidebar (30%) */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Chat area — takes full width on mobile, 70% on md+ */}
        <div className="flex w-full flex-col md:w-[70%]">
          {messagesLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          ) : messagesError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <p className="text-sm text-destructive">{messagesError}</p>
              <button
                type="button"
                onClick={() => refetchMessages()}
                className="text-xs underline hover:text-foreground"
              >
                Retry?
              </button>
            </div>
          ) : !hasConversation && !readyToChat ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
              <MessageSquare size={32} strokeWidth={1.5} />
              <div className="text-center">
                <p className="text-sm font-medium">Ready to begin ideation</p>
                <p className="mt-1 text-xs">Describe your course idea and AI agents will brainstorm the structure</p>
              </div>
              <Button onClick={() => setReadyToChat(true)}>
                Start Ideation
              </Button>
            </div>
          ) : (
            <ChatMessageList conversations={conversationGroups} />
          )}
          {(hasConversation || readyToChat) && (
            <ChatInput
              onSend={handleSendMessage}
              loading={startLoading || sendLoading}
              disabled={anyLoading}
              error={startError || sendError}
              placeholder={!hasConversation
                ? 'Describe your course idea... (Ctrl+Enter to send)'
                : undefined
              }
            />
          )}
        </div>

        {/* Agent sidebar + structure preview — always visible on md+, slide-over on mobile */}
        <div
          className={`absolute inset-y-0 right-0 z-10 w-72 border-l bg-background transition-transform md:relative md:flex md:w-[30%] md:translate-x-0 md:flex-col ${
            sidebarOpen ? 'flex translate-x-0 flex-col' : 'translate-x-full md:translate-x-0'
          }`}
        >
          {/* Agent sidebar (scrolls independently) */}
          <div className="flex-1 overflow-y-auto">
            <AgentSidebar
              currentPhase={currentPhase}
              messages={allMessages}
              activeAgents={activeAgents}
              disabled={anyLoading}
              onGrade={gradeStructure}
              gradeLoading={gradeLoading}
              gradeError={gradeError}
              onApprove={async () => {
                try {
                  await submitReview('approve')
                  router.push(`/project/${projectId}/structure`)
                } catch {
                  // Error already captured in reviewError and displayed by AgentSidebar
                }
              }}
              onFeedback={(msg) => submitReview('feedback', msg)}
              onRestructure={() => submitReview('restructure')}
              reviewLoading={reviewLoading}
              reviewError={reviewError}
              blueprint={blueprint ? {
                archetype: blueprint.archetype,
                ideationScore: blueprint.ideationScore,
                structureSummary: blueprint.structureSummary as BlueprintSummary['structureSummary'],
              } : null}
            />
          </div>

          {/* Structure preview (pinned to bottom of sidebar) */}
          <StructurePreview
            blueprintId={blueprint?.id ?? null}
            projectId={projectId}
            refreshKey={structureRefreshKey}
          />
        </div>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-[9] bg-black/20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </main>
  )
}
