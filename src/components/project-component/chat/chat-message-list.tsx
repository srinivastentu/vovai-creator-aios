'use client'

import { useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { ChatMessage } from './chat-message'
import type { ChatMessageData } from './chat-message'
import type { IdeationPhase } from '@/lib/project-component'

export interface ConversationGroup {
  phase: IdeationPhase
  messages: ChatMessageData[]
}

const PHASE_LABELS: Record<IdeationPhase, string> = {
  brainstorm: 'Brainstorm Phase',
  structure: 'Structure Phase',
  refinement: 'Refinement Phase',
  review: 'Review Phase',
  approved: 'Approved',
}

function PhaseDivider({ phase }: { phase: IdeationPhase }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-muted-foreground">
        {PHASE_LABELS[phase]}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <MessageSquare size={32} strokeWidth={1.5} />
      <p className="text-sm">No messages yet</p>
      <p className="text-xs">Start the conversation to begin ideation</p>
    </div>
  )
}

interface ChatMessageListProps {
  conversations: ConversationGroup[]
}

export function ChatMessageList({ conversations }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [totalMessages])

  if (totalMessages === 0) {
    return (
      <div className="flex flex-1 overflow-hidden">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {conversations.map((group, groupIdx) => (
        <div key={group.phase}>
          {groupIdx > 0 && <PhaseDivider phase={group.phase} />}
          {groupIdx === 0 && <PhaseDivider phase={group.phase} />}
          <div className="flex flex-col gap-4">
            {group.messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
