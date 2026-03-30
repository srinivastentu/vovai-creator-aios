'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Check, DollarSign, Layers, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  activeAgents?: BrainstormRole[]
  /** Disables all action buttons (e.g. when another mutation is in progress) */
  disabled?: boolean
  onGrade?: () => void
  gradeLoading?: boolean
  gradeError?: string | null
  onApprove?: () => void
  onFeedback?: (message: string) => void
  onRestructure?: () => void
  reviewLoading?: boolean
  reviewError?: string | null
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
  messages: ChatMessageData[],
  activeAgents: BrainstormRole[] = []
): Map<BrainstormRole, AgentStatus> {
  const statuses = new Map<BrainstormRole, AgentStatus>()
  for (const msg of messages) {
    statuses.set(msg.role, 'completed')
  }
  for (const agent of activeAgents) {
    statuses.set(agent, 'active')
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

interface GradeReportSummary {
  overallScore: number
  recommendation: string
  totalOutcomes: number
  totalComponents: number
  dimensions: Array<{ id: string; name: string; score: number }>
}

function extractLatestGradeReport(messages: ChatMessageData[]): GradeReportSummary | null {
  // Walk messages in reverse to find the latest grade report
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

export function AgentSidebar({
  currentPhase,
  messages,
  blueprint,
  activeAgents = [],
  disabled = false,
  onGrade,
  gradeLoading = false,
  gradeError = null,
  onApprove,
  onFeedback,
  onRestructure,
  reviewLoading = false,
  reviewError = null,
}: AgentSidebarProps) {
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')

  const agentStatuses = useMemo(
    () => deriveAgentStatuses(messages, activeAgents),
    [messages, activeAgents]
  )
  const totalCost = useMemo(() => computeTotalCost(messages), [messages])
  const gradeReport = useMemo(() => extractLatestGradeReport(messages), [messages])

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

      {/* Grade report details */}
      {gradeReport && (
        <Collapsible>
          <div className="border-b px-4 py-3">
            <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Grade Report
              </p>
              <ChevronDown size={14} className="text-muted-foreground" />
            </CollapsibleTrigger>

            {/* Score summary — always visible */}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Score</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  gradeReport.overallScore >= 75
                    ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                    : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                }`}
              >
                {gradeReport.overallScore.toFixed(1)}/100 ({gradeReport.recommendation})
              </Badge>
            </div>

            <CollapsibleContent>
              <div className="mt-2 flex flex-col gap-1.5">
                {/* Outcomes & components */}
                {gradeReport.totalOutcomes > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Outcomes</span>
                    <span className="text-xs font-medium">{gradeReport.totalOutcomes}</span>
                  </div>
                )}
                {gradeReport.totalComponents > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Components</span>
                    <span className="text-xs font-medium">{gradeReport.totalComponents}</span>
                  </div>
                )}

                {/* Dimension scores */}
                {gradeReport.dimensions.length > 0 && (
                  <div className="mt-1">
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground">Dimensions</p>
                    <div className="flex flex-col gap-1">
                      {gradeReport.dimensions.map((dim) => (
                        <div key={dim.id || dim.name} className="flex items-center gap-2">
                          <span className="flex-1 truncate text-[11px] text-muted-foreground">
                            {dim.name}
                          </span>
                          <div className="h-1.5 w-16 rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${
                                dim.score >= 75 ? 'bg-green-500' : dim.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(dim.score, 100)}%` }}
                            />
                          </div>
                          <span className="w-7 text-right text-[10px] tabular-nums font-medium">
                            {dim.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Grade action */}
      {onGrade && (currentPhase === 'structure' || currentPhase === 'refinement') && (
        <div className="border-b px-4 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Actions
          </p>
          <Button
            size="sm"
            className="w-full"
            onClick={onGrade}
            disabled={disabled || gradeLoading}
          >
            {gradeLoading ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Grading...
              </>
            ) : (
              'Grade Structure'
            )}
          </Button>
          {gradeError && (
            <p className="mt-2 text-xs text-destructive">{gradeError}</p>
          )}
        </div>
      )}

      {/* Review actions */}
      {currentPhase === 'review' && onApprove && (
        <div className="border-b px-4 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Review Actions
          </p>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              className="w-full bg-green-600 text-white hover:bg-green-700"
              onClick={onApprove}
              disabled={disabled || reviewLoading}
            >
              {reviewLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Approve Structure'
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setFeedbackOpen(true)}
              disabled={disabled || reviewLoading || feedbackOpen}
            >
              Give Feedback
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                if (window.confirm('Start over from brainstorm? Brief and audience will be retained.')) {
                  onRestructure?.()
                }
              }}
              disabled={disabled || reviewLoading}
            >
              Restructure
            </Button>
          </div>

          {reviewError && (
            <p className="mt-2 text-xs text-destructive">{reviewError}</p>
          )}

          {/* Inline feedback textarea */}
          {feedbackOpen && (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Describe what should change..."
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (feedbackText.trim()) {
                      onFeedback?.(feedbackText.trim())
                      setFeedbackText('')
                      setFeedbackOpen(false)
                    }
                  }}
                  disabled={reviewLoading || !feedbackText.trim()}
                >
                  {reviewLoading ? <Loader2 size={14} className="animate-spin" /> : 'Send Feedback'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setFeedbackOpen(false); setFeedbackText('') }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

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
