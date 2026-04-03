'use client'

import { ChevronDown, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RoleAvatar, getRoleConfig } from './role-avatar'
import type { BrainstormRole, IdeationPhase, AudienceProfile } from '@/lib/project-component'
import type { ArtifactTab } from '@/components/project-component/layout/artifact-panel'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpandedContentType =
  | 'audience_profile'
  | 'proposed_structure'
  | 'grade_report'
  | 'challenges'
  | 'component_plan'
  | 'outcomes'
  | 'text'

export interface ActivityEntry {
  id: string
  role: BrainstormRole
  action: string
  detail?: string
  timestamp: string
  status: 'active' | 'completed'
  phase: IdeationPhase
  expandable: boolean
  expandedContent?: {
    type: ExpandedContentType
    data: unknown
  }
}

interface ActivityCardProps {
  entry: ActivityEntry
  expanded: boolean
  onToggleExpand: () => void
  onNavigateToTab?: (tab: ArtifactTab) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}

function getExpandLabel(type: ExpandedContentType): string {
  switch (type) {
    case 'audience_profile': return 'View full profile'
    case 'proposed_structure': return 'View proposed structure'
    case 'grade_report': return 'View grade report'
    case 'challenges': return 'View challenges'
    case 'component_plan': return 'View component plan'
    case 'outcomes': return 'View outcomes'
    case 'text': return 'View details'
  }
}

// Role border colors (left accent)
const ROLE_BORDER_COLORS: Record<BrainstormRole, string> = {
  human: 'border-l-primary',
  facilitator: 'border-l-blue-400',
  researcher: 'border-l-emerald-400',
  pedagogy_expert: 'border-l-purple-400',
  audience_analyst: 'border-l-amber-400',
  structure_architect: 'border-l-cyan-400',
  creative_director: 'border-l-pink-400',
  critic: 'border-l-red-400',
  synthesizer: 'border-l-indigo-400',
}

// ─── Expanded Content Renderers ──────────────────────────────────────────────

function AudienceProfileCompact({
  data,
  onNavigateToTab,
}: {
  data: unknown
  onNavigateToTab?: (tab: ArtifactTab) => void
}) {
  const profile = data as AudienceProfile | null
  if (!profile?.primaryAudience) return null
  const pa = profile.primaryAudience
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <p className="line-clamp-2 text-foreground">{pa.description}</p>
      {pa.educationLevel && (
        <p className="text-muted-foreground">
          {pa.educationLevel}{pa.experienceLevel ? ` · ${pa.experienceLevel}` : ''}
        </p>
      )}
      {onNavigateToTab && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigateToTab('audience') }}
          className="self-start text-xs font-medium text-primary hover:underline"
        >
          View full profile →
        </button>
      )}
    </div>
  )
}

interface GradeReportData {
  overallScore: number
  recommendation: string
  dimensionScores?: Array<{ id?: string; name: string; score: number }>
  totalOutcomes?: number
  totalComponents?: number
}

function GradeReportCompact({
  data,
  onNavigateToTab,
}: {
  data: unknown
  onNavigateToTab?: (tab: ArtifactTab) => void
}) {
  const report = data as GradeReportData | null
  if (!report) return null
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-[10px] ${
            report.overallScore >= 75
              ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
              : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
          }`}
        >
          {report.overallScore.toFixed(1)}/100
        </Badge>
        <span className="text-muted-foreground capitalize">{report.recommendation}</span>
      </div>
      {onNavigateToTab && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigateToTab('grade') }}
          className="self-start text-xs font-medium text-primary hover:underline"
        >
          View full report →
        </button>
      )}
    </div>
  )
}

interface ProposedStructureData {
  courseTitle?: string
  modules?: Array<{
    title: string
    description?: string
    topics?: Array<{ title: string; subtopics?: Array<{ title: string }> }>
  }>
}

function ProposedStructureCompact({
  data,
  onNavigateToTab,
}: {
  data: unknown
  onNavigateToTab?: (tab: ArtifactTab) => void
}) {
  const structure = data as ProposedStructureData | null
  if (!structure?.modules?.length) return null
  const topicCount = structure.modules.reduce(
    (sum, m) => sum + (m.topics?.length ?? 0), 0
  )
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {structure.courseTitle && (
        <p className="font-medium text-foreground">{structure.courseTitle}</p>
      )}
      <p className="text-muted-foreground">
        {structure.modules.length} modules · {topicCount} topics
      </p>
      {onNavigateToTab && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigateToTab('structure') }}
          className="self-start text-xs font-medium text-primary hover:underline"
        >
          View structure →
        </button>
      )}
    </div>
  )
}

function ChallengesExpanded({ data }: { data: unknown }) {
  const challenges = data as Array<{ title?: string; description?: string }> | null
  if (!challenges?.length) return null
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {challenges.map((c, i) => (
        <div key={i} className="text-muted-foreground">
          {c.title && <p className="font-medium text-foreground">{c.title}</p>}
          {c.description && <p>{c.description}</p>}
          {!c.title && !c.description && typeof c === 'string' && <p>&bull; {c}</p>}
        </div>
      ))}
    </div>
  )
}

function TextExpanded({ data }: { data: unknown }) {
  const text = typeof data === 'string' ? data : ''
  if (!text) return null
  return <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{text}</p>
}

function ExpandedContent({
  type,
  data,
  onNavigateToTab,
}: {
  type: ExpandedContentType
  data: unknown
  onNavigateToTab?: (tab: ArtifactTab) => void
}) {
  switch (type) {
    case 'audience_profile': return <AudienceProfileCompact data={data} onNavigateToTab={onNavigateToTab} />
    case 'proposed_structure': return <ProposedStructureCompact data={data} onNavigateToTab={onNavigateToTab} />
    case 'grade_report': return <GradeReportCompact data={data} onNavigateToTab={onNavigateToTab} />
    case 'challenges': return <ChallengesExpanded data={data} />
    case 'text': return <TextExpanded data={data} />
    default: return <TextExpanded data={data} />
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityCard({ entry, expanded, onToggleExpand, onNavigateToTab }: ActivityCardProps) {
  const isHuman = entry.role === 'human'
  const isActive = entry.status === 'active'
  const config = getRoleConfig(entry.role)

  // Human action card — smaller, muted
  if (isHuman) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 px-4 py-2.5">
        <RoleAvatar role="human" size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">You</span>
            <span className="text-[10px] text-muted-foreground/60">{relativeTime(entry.timestamp)}</span>
          </div>
          <p className="mt-0.5 text-sm text-foreground/80 truncate">{entry.action}</p>
        </div>
      </div>
    )
  }

  // Active agent card — pulsing border
  if (isActive) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-green-300/50 bg-green-50/30 px-4 py-3 dark:border-green-700/30 dark:bg-green-950/20">
        {/* Pulsing indicator bar */}
        <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-green-500/60" />
        <div className="flex items-start gap-3">
          <RoleAvatar role={entry.role} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{config.label}</span>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">working</span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{entry.action}</p>
          </div>
        </div>
      </div>
    )
  }

  // Completed agent card — expandable
  return (
    <div className={`rounded-lg border-l-2 bg-card px-4 py-3 ring-1 ring-foreground/5 ${ROLE_BORDER_COLORS[entry.role]}`}>
      <div className="flex items-start gap-3">
        <RoleAvatar role={entry.role} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{config.label}</span>
              <Check size={12} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="text-[10px] text-muted-foreground/60">{relativeTime(entry.timestamp)}</span>
          </div>
          <p className="mt-0.5 text-sm text-foreground/80">{entry.action}</p>

          {/* Expand toggle */}
          {entry.expandable && entry.expandedContent && (
            <button
              onClick={onToggleExpand}
              className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <span>{getExpandLabel(entry.expandedContent.type)}</span>
              <ChevronDown
                size={12}
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && entry.expandedContent && (
        <div className="mt-3 ml-10 border-t pt-3">
          <ExpandedContent
            type={entry.expandedContent.type}
            data={entry.expandedContent.data}
            onNavigateToTab={onNavigateToTab}
          />
        </div>
      )}
    </div>
  )
}
