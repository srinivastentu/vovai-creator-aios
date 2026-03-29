'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/lib/hooks/use-api'
import { ChatMessageList } from '@/components/project-component/chat/chat-message-list'
import { ChatInput } from '@/components/project-component/chat/chat-input'
import { RoleAvatar, getRoleConfig } from '@/components/project-component/chat/role-avatar'
import type { ChatMessageData } from '@/components/project-component/chat/chat-message'
import type { ConversationGroup } from '@/components/project-component/chat/chat-message-list'
import type { BrainstormRole, IdeationPhase } from '@/lib/project-component'

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

// ─── Agent Activity Sidebar ────────────────────────────────────────────────

const ALL_AGENTS: BrainstormRole[] = [
  'facilitator',
  'researcher',
  'pedagogy_expert',
  'audience_analyst',
  'structure_architect',
  'creative_director',
  'critic',
  'synthesizer',
]

function AgentActivitySidebar({
  activeAgents,
  currentPhase,
}: {
  activeAgents: Set<BrainstormRole>
  currentPhase: IdeationPhase
}) {
  return (
    <Card className="h-full">
      <CardHeader className="border-b">
        <CardTitle className="text-sm">Agent Activity</CardTitle>
        <Badge variant="outline" className="w-fit text-xs capitalize">
          {currentPhase} phase
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col">
          {ALL_AGENTS.map((role) => {
            const config = getRoleConfig(role)
            const isActive = activeAgents.has(role)
            return (
              <div
                key={role}
                className={`flex items-center gap-2.5 px-4 py-2.5 border-b last:border-b-0 ${
                  isActive ? 'bg-muted/50' : 'opacity-50'
                }`}
              >
                <RoleAvatar role={role} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{config.label}</p>
                </div>
                {isActive ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Active
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Idle</span>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
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

  // Determine which agents have spoken
  const activeAgents = useMemo(() => {
    const agents = new Set<BrainstormRole>()
    for (const group of conversationGroups) {
      for (const msg of group.messages) {
        if (msg.role !== 'human') {
          agents.add(msg.role)
        }
      }
    }
    return agents
  }, [conversationGroups])

  const currentPhase = blueprint?.ideationPhase ?? 'brainstorm'

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
      </div>

      {/* Phase indicator */}
      <PhaseIndicator
        currentPhase={currentPhase}
        score={blueprint?.ideationScore ?? null}
      />

      {/* Main layout: chat + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex flex-1 flex-col">
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

        {/* Agent activity sidebar */}
        <div className="hidden w-64 shrink-0 border-l lg:block">
          <AgentActivitySidebar
            activeAgents={activeAgents}
            currentPhase={currentPhase}
          />
        </div>
      </div>
    </main>
  )
}
