'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Check, DollarSign, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { RoleAvatar, getRoleConfig } from './role-avatar'
import type { ChatMessageData } from './chat-message'
import type { BrainstormRole, IdeationPhase } from '@/lib/project-component'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlueprintSummary {
  archetype: string
  ideationScore: number | null
  structureSummary: {
    totalModules?: number
    totalTopics?: number
    totalSubtopics?: number
    componentBreakdown?: Record<string, number>
    estimatedHours?: number
    recommendation?: string
  } | null
}

export interface AgentSidebarProps {
  currentPhase: IdeationPhase
  messages: ChatMessageData[]
  blueprint: BlueprintSummary | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES: BrainstormRole[] = [
  'human',
  'facilitator',
  'researcher',
  'pedagogy_expert',
  'audience_analyst',
  'structure_architect',
  'creative_director',
  'critic',
  'synthesizer',
]

const PHASE_COLORS: Record<IdeationPhase, string> = {
  brainstorm: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  structure: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  refinement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  review: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AgentStatus = 'active' | 'completed' | 'idle'

function deriveAgentStatuses(
  messages: ChatMessageData[]
): Map<BrainstormRole, AgentStatus> {
  const statuses = new Map<BrainstormRole, AgentStatus>()
  for (const msg of messages) {
    statuses.set(msg.role, 'completed')
  }
  return statuses
}

function computeTotalCost(messages: ChatMessageData[]): number {
  let total = 0
  for (const msg of messages) {
    const data = msg.structuredData
    if (data && typeof data === 'object') {
      const cost = (data as Record<string, unknown>).costUSD
      if (typeof cost === 'number') {
        total += cost
      }
    }
  }
  return total
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

// ─── Status Indicator ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AgentStatus }) {
  switch (status) {
    case 'active':
      return (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )
    case 'completed':
      return <Check size={12} className="text-green-600 dark:text-green-400" />
    case 'idle':
      return <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/30" />
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentSidebar({ currentPhase, messages, blueprint }: AgentSidebarProps) {
  const [summaryOpen, setSummaryOpen] = useState(false)

  const agentStatuses = useMemo(() => deriveAgentStatuses(messages), [messages])
  const totalCost = useMemo(() => computeTotalCost(messages), [messages])

  const summary = blueprint?.structureSummary
  const totalComponents = summary?.componentBreakdown
    ? Object.values(summary.componentBreakdown).reduce((a, b) => a + b, 0)
    : 0
  const totalNodes = (summary?.totalModules ?? 0)
    + (summary?.totalTopics ?? 0)
    + (summary?.totalSubtopics ?? 0)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Phase badge */}
      <div className="border-b px-4 py-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Current Phase
        </p>
        <Badge className={`capitalize ${PHASE_COLORS[currentPhase]}`}>
          {currentPhase}
        </Badge>
      </div>

      {/* Agent list */}
      <div className="border-b px-4 py-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Agents ({agentStatuses.size}/{ALL_ROLES.length} active)
        </p>
        <div className="flex flex-col gap-1">
          {ALL_ROLES.map((role) => {
            const config = getRoleConfig(role)
            const status = agentStatuses.get(role) ?? 'idle'
            return (
              <div
                key={role}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                  status !== 'idle' ? 'bg-muted/50' : 'opacity-60'
                }`}
              >
                <RoleAvatar role={role} size="sm" />
                <span className="flex-1 truncate font-medium">{config.label}</span>
                <StatusDot status={status} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Cost tracker */}
      <div className="border-b px-4 py-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Session Cost
        </p>
        <div className="flex items-center gap-1.5">
          <DollarSign size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold tabular-nums">{formatCost(totalCost)}</span>
        </div>
      </div>

      {/* Blueprint summary (collapsible) */}
      {blueprint && (
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
          <div className="px-4 py-3">
            <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
              <div className="flex items-center gap-1.5">
                <Layers size={14} className="text-muted-foreground" />
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Blueprint
                </p>
              </div>
              <ChevronDown
                size={14}
                className={`text-muted-foreground transition-transform ${
                  summaryOpen ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="mt-2 flex flex-col gap-2">
                {/* Archetype */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Archetype</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {blueprint.archetype.replace(/_/g, ' ')}
                  </Badge>
                </div>

                {/* Node count */}
                {totalNodes > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Nodes</span>
                    <span className="text-xs font-medium">{totalNodes}</span>
                  </div>
                )}

                {/* Module breakdown */}
                {summary && (summary.totalModules ?? 0) > 0 && (
                  <div className="ml-2 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                    {summary.totalModules && <span>{summary.totalModules} modules</span>}
                    {summary.totalTopics && <span>{summary.totalTopics} topics</span>}
                    {summary.totalSubtopics && <span>{summary.totalSubtopics} subtopics</span>}
                  </div>
                )}

                {/* Component count */}
                {totalComponents > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Components</span>
                    <span className="text-xs font-medium">{totalComponents}</span>
                  </div>
                )}

                {/* Score */}
                {blueprint.ideationScore !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Score</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        (blueprint.ideationScore ?? 0) >= 75
                          ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                          : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {blueprint.ideationScore?.toFixed(1)}/100
                    </Badge>
                  </div>
                )}

                {/* Estimated hours */}
                {summary?.estimatedHours && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Est. hours</span>
                    <span className="text-xs font-medium">{summary.estimatedHours}h</span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  )
}
