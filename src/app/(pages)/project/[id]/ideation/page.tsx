'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, PanelRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/hooks/use-api'
import { ChatMessageList } from '@/components/project-component/chat/chat-message-list'
import { ChatInput } from '@/components/project-component/chat/chat-input'
import { AgentSidebar } from '@/components/project-component/chat/agent-sidebar'
import type { ChatMessageData } from '@/components/project-component/chat/chat-message'
import type { ConversationGroup } from '@/components/project-component/chat/chat-message-list'
import type { IdeationPhase } from '@/lib/project-component'

// ─── API Response Types ────────────────────────────────────────────────────

interface BlueprintResponse {
  id: string
  projectId: string
  archetype: string
  ideationPhase: IdeationPhase
  ideationScore: number | null
  structureSummary: Record<string, unknown> | null
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

  // Fetch blueprint for this project
  const {
    data: blueprint,
    loading: blueprintLoading,
    error: blueprintError,
  } = useApi<BlueprintResponse>(`/api/blueprints?projectId=${projectId}`)

  // Fetch all messages (depends on blueprint being loaded)
  const messagesUrl = blueprint ? `/api/blueprints/${blueprint.id}/ideation/messages` : null
  const {
    data: messagesData,
    loading: messagesLoading,
  } = useApi<MessagesResponse>(messagesUrl ?? '', { skip: !blueprint })

  // Group messages by conversation phase
  const conversationGroups: ConversationGroup[] = useMemo(() => {
    if (!messagesData) return []

    // Use groupedByPhase from the API — already organized by conversation phase
    if (messagesData.groupedByPhase?.length > 0) {
      return messagesData.groupedByPhase.map((group) => ({
        phase: group.phase as IdeationPhase,
        messages: group.messages,
      }))
    }

    // Fallback: single group from flat messages
    if (messagesData.messages?.length > 0) {
      return [{
        phase: messagesData.phase as IdeationPhase,
        messages: messagesData.messages,
      }]
    }

    return []
  }, [messagesData])

  // Flatten all messages for the sidebar
  const allMessages = useMemo(
    () => conversationGroups.flatMap((g) => g.messages),
    [conversationGroups]
  )

  const currentPhase = blueprint?.ideationPhase ?? 'brainstorm'

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
          ) : (
            <ChatMessageList conversations={conversationGroups} />
          )}
          <ChatInput
            onSend={() => {
              // Visual-first: no-op for now. Will wire to API in PC-6.3.
            }}
          />
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
            blueprint={blueprint ? {
              archetype: blueprint.archetype,
              ideationScore: blueprint.ideationScore,
              structureSummary: blueprint.structureSummary as {
                totalModules?: number
                totalTopics?: number
                totalSubtopics?: number
                componentBreakdown?: Record<string, number>
                estimatedHours?: number
                recommendation?: string
              } | null,
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
