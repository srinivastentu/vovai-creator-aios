'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ActivityCard } from './activity-card'
import type { ActivityEntry, ExpandedContentType } from './activity-card'
import type { ChatMessageData } from './chat-message'
import type { BrainstormRole, IdeationPhase, IdeationMessageKind } from '@/lib/domain/workflows'

// Re-export for convenience
export type { ActivityEntry }

// ─── Role → action text mapping ──────────────────────────────────────────────

const ROLE_ACTIONS: Record<string, Record<string, string>> = {
  facilitator: {
    default: 'Guided the discussion',
    decision: 'Made a decision',
    question: 'Asked a question',
    suggestion: 'Made a suggestion',
  },
  researcher: { default: 'Completed research analysis' },
  pedagogy_expert: { default: 'Evaluated pedagogical approach' },
  audience_analyst: { default: 'Analyzed audience profile' },
  structure_architect: {
    default: 'Updated course structure',
    structure_update: 'Proposed course structure',
  },
  creative_director: { default: 'Designed creative direction' },
  critic: { default: 'Evaluated structure quality' },
  synthesizer: { default: 'Synthesized recommendations' },
}

const ACTIVE_DESCRIPTIONS: Record<string, string> = {
  start: 'Analyzing project brief...',
  message_brainstorm: 'Processing your input...',
  message_structure: 'Reviewing structure feedback...',
  message_refinement: 'Incorporating feedback...',
  grade: 'Evaluating structure quality...',
  review: 'Processing review decision...',
}

// ─── Derive entries from messages ────────────────────────────────────────────

function getActionText(role: BrainstormRole, messageType: IdeationMessageKind): string {
  const roleMap = ROLE_ACTIONS[role]
  if (!roleMap) return 'Completed work'
  return roleMap[messageType] ?? roleMap.default ?? 'Completed work'
}

function getExpandableContent(
  msg: ChatMessageData
): { type: ExpandedContentType; data: unknown } | undefined {
  const sd = msg.structuredData as Record<string, unknown> | null
  if (!sd) {
    // Fall back to message text if long enough
    if (msg.content.length > 100) {
      return { type: 'text', data: msg.content }
    }
    return undefined
  }

  if (sd.audienceProfile) return { type: 'audience_profile', data: sd.audienceProfile }
  if (sd.proposedStructure) return { type: 'proposed_structure', data: sd.proposedStructure }
  if (sd.gradeReport) {
    // Merge in outcomes/components counts for the grade report view
    const report = sd.gradeReport as Record<string, unknown>
    const outcomes = sd.outcomesMap as Record<string, unknown> | undefined
    const components = sd.componentPlan as Record<string, unknown> | undefined
    return {
      type: 'grade_report',
      data: {
        ...report,
        totalOutcomes: outcomes?.totalOutcomes ?? report.totalOutcomes,
        totalComponents: components?.totalComponents,
      },
    }
  }
  if (sd.challenges) return { type: 'challenges', data: sd.challenges }
  if (sd.componentPlan) return { type: 'component_plan', data: sd.componentPlan }
  if (sd.outcomesMap) return { type: 'outcomes', data: sd.outcomesMap }

  // Fall back to message text
  if (msg.content.length > 100) {
    return { type: 'text', data: msg.content }
  }
  return undefined
}

function getHumanActionText(content: string): string {
  const lower = content.toLowerCase().trim()
  if (lower === 'proceed') return 'Proceeded to next phase'
  if (content.length > 60) return `"${content.slice(0, 57)}..."`
  return `"${content}"`
}

export function deriveActivityEntries(
  messages: ChatMessageData[],
  activeAgents: BrainstormRole[],
  currentAction: string | null,
  currentPhase: IdeationPhase
): ActivityEntry[] {
  const entries: ActivityEntry[] = []

  // Walk messages chronologically
  for (const msg of messages) {
    if (msg.role === 'human') {
      entries.push({
        id: msg.id,
        role: 'human',
        action: getHumanActionText(msg.content),
        timestamp: msg.createdAt,
        status: 'completed',
        phase: currentPhase, // approximate — messages don't carry phase individually
        expandable: false,
      })
    } else {
      const expandedContent = getExpandableContent(msg)
      entries.push({
        id: msg.id,
        role: msg.role,
        action: getActionText(msg.role, msg.messageType),
        detail: msg.content,
        timestamp: msg.createdAt,
        status: 'completed',
        phase: currentPhase,
        expandable: !!expandedContent,
        expandedContent,
      })
    }
  }

  // Append active agents at the bottom
  const actionDesc = currentAction ? ACTIVE_DESCRIPTIONS[currentAction] ?? 'Working...' : 'Working...'
  for (const agent of activeAgents) {
    if (agent === 'human') continue
    entries.push({
      id: `active-${agent}`,
      role: agent,
      action: actionDesc,
      timestamp: new Date().toISOString(),
      status: 'active',
      phase: currentPhase,
      expandable: false,
    })
  }

  return entries
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActivityStreamProps {
  entries: ActivityEntry[]
}

export function ActivityStream({ entries }: ActivityStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Auto-scroll to bottom when new entries appear
  const prevCountRef = useRef(entries.length)
  useEffect(() => {
    if (entries.length > prevCountRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
    prevCountRef.current = entries.length
  }, [entries.length])

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  if (entries.length === 0) {
    return (
      <div ref={scrollRef} className="flex flex-1 flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
        <p className="text-sm text-muted-foreground">
          Agents are analyzing your brief...
        </p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {entries.map((entry) => (
          <ActivityCard
            key={entry.id}
            entry={entry}
            expanded={expandedId === entry.id}
            onToggleExpand={() => handleToggleExpand(entry.id)}
          />
        ))}
      </div>
    </div>
  )
}
