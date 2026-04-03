'use client'

import { DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ChatMessageData } from './chat-message'
import type { IdeationPhase } from '@/lib/project-component'

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface GradeReportSummary {
  overallScore: number
  recommendation: string
  totalOutcomes: number
  totalComponents: number
  dimensions: Array<{ id: string; name: string; score: number }>
}

// ─── Exported Helpers (reused by other components) ──────────────────────────

export function computeTotalCost(messages: ChatMessageData[]): number {
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

export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

export function extractLatestGradeReport(messages: ChatMessageData[]): GradeReportSummary | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const data = messages[i].structuredData as Record<string, unknown> | null
    if (!data?.gradeReport) continue
    const report = data.gradeReport as Record<string, unknown>
    const outcomes = data.outcomesMap as Record<string, unknown> | undefined
    const components = data.componentPlan as Record<string, unknown> | undefined
    return {
      overallScore: (report.overallScore as number) ?? 0,
      recommendation: (report.recommendation as string) ?? '',
      totalOutcomes: (outcomes?.totalOutcomes as number) ??
        ((report.totalOutcomes as number) ?? 0),
      totalComponents: (components?.totalComponents as number) ?? 0,
      dimensions: (report.dimensionScores as GradeReportSummary['dimensions']) ?? [],
    }
  }
  return null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<IdeationPhase, string> = {
  brainstorm: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  structure: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  refinement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  review: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
}

// ─── Minimal Sidebar Props ──────────────────────────────────────────────────

export interface AgentSidebarProps {
  currentPhase: IdeationPhase
  totalCost: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentSidebar({ currentPhase, totalCost }: AgentSidebarProps) {
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
    </div>
  )
}
