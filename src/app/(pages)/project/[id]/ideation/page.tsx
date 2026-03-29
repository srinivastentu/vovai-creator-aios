'use client'

import { use, useCallback, useMemo, useState } from 'react'
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

// ─── Phase Indicator ───────────────────────────────────────────────────────

const PHASE_ORDER: IdeationPhase[] = ['brainstorm', 'structure', 'refinement', 'review', 'approved']

function PhaseIndicator({ currentPhase, score }: { currentPhase: IdeationPhase; score: number | null }) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase)

  return (
    <div className="flex items-center gap-1 border-b px-4 py-2.5">
      {PHASE_ORDER.map((phase, idx) => {
        const isCurrent = idx === currentIdx
        const isPast = idx < currentIdx
        return (
          <div key={phase} className="flex items-center gap-1">
            <div
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isPast
                    ? 'bg-muted text-foreground'
                    : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {phase}
            </div>
            {idx < PHASE_ORDER.length - 1 && (
              <div className={`h-px w-4 ${isPast ? 'bg-foreground/30' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
      {score !== null && (
        <div className="ml-auto">
          <Badge variant="outline" className="text-xs">
            Score: {score.toFixed(1)}
          </Badge>
        </div>
      )}
    </div>
  )
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
        >
          <PanelRight size={16} />
        </Button>
      </div>

      {/* Phase indicator */}
      <PhaseIndicator
        currentPhase={currentPhase}
        score={blueprint?.ideationScore ?? null}
      />

      {/* Main layout: chat (70%) + sidebar (30%) */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Chat area — takes full width on mobile, 70% on md+ */}
        <div className="flex w-full flex-col md:w-[70%]">
          {messagesLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
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

        {/* Agent sidebar — always visible on md+, slide-over on mobile */}
        <div
          className={`absolute inset-y-0 right-0 z-10 w-72 border-l bg-background transition-transform md:relative md:block md:w-[30%] md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <AgentSidebar
            currentPhase={currentPhase}
            messages={allMessages}
            activeAgents={activeAgents}
            disabled={anyLoading}
            onGrade={gradeStructure}
            gradeLoading={gradeLoading}
            gradeError={gradeError}
            onApprove={() => {
              submitReview('approve').then(() => {
                router.push(`/project/${projectId}/structure`)
              })
            }}
            onFeedback={(msg) => submitReview('feedback', msg)}
            onRestructure={() => submitReview('restructure')}
            reviewLoading={reviewLoading}
            blueprint={blueprint ? {
              archetype: blueprint.archetype,
              ideationScore: blueprint.ideationScore,
              structureSummary: blueprint.structureSummary as BlueprintSummary['structureSummary'],
            } : null}
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
