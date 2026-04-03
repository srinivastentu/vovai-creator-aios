'use client'

import {
  Network,
  BarChart3,
  Users,
  Settings,
  Rocket,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/lib/hooks/use-api'
import { EmptyState } from '@/components/project-component/shared/empty-state'
import { StructureEditor } from './structure-editor'
import type { ProposedStructure, AudienceProfile, DimensionGradeScore, GradeRecommendation } from '@/lib/project-component'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArtifactTab = 'structure' | 'grade' | 'audience' | 'configure' | 'launch'

interface TabConfig {
  id: ArtifactTab
  label: string
  icon: LucideIcon
  emptyTitle: string
  emptyDescription: string
}

const TAB_CONFIG: TabConfig[] = [
  {
    id: 'structure',
    label: 'Structure',
    icon: Network,
    emptyTitle: 'No structure yet',
    emptyDescription: 'The course structure will appear here once agents propose a design.',
  },
  {
    id: 'grade',
    label: 'Grade',
    icon: BarChart3,
    emptyTitle: 'No grade yet',
    emptyDescription: 'Rubric scores will appear here after grading the structure.',
  },
  {
    id: 'audience',
    label: 'Audience',
    icon: Users,
    emptyTitle: 'No audience profile yet',
    emptyDescription: 'The audience analysis will appear here once agents profile the learners.',
  },
  {
    id: 'configure',
    label: 'Configure',
    icon: Settings,
    emptyTitle: 'Configuration available after approval',
    emptyDescription: 'The component configuration wizard will appear here once the structure is approved.',
  },
  {
    id: 'launch',
    label: 'Launch',
    icon: Rocket,
    emptyTitle: 'Ready to launch after configuration',
    emptyDescription: 'Cost breakdown and production handoff will appear here.',
  },
]

// ─── Grade Types ─────────────────────────────────────────────────────────────

interface GradeData {
  overallScore: number
  dimensionScores: DimensionGradeScore[]
  recommendation: GradeRecommendation
  feedback: string | null
  createdAt: string
}

// ─── Grade Panel ─────────────────────────────────────────────────────────────

const RECOMMENDATION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  approve: { bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-700 dark:text-green-300', label: 'Approve' },
  revise: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-700 dark:text-amber-300', label: 'Revise' },
  restructure: { bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-700 dark:text-orange-300', label: 'Restructure' },
  reject: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-700 dark:text-red-300', label: 'Reject' },
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-600 dark:text-green-400'
  if (score >= 75) return 'text-amber-600 dark:text-amber-400'
  if (score >= 60) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function barColor(score: number): string {
  if (score >= 85) return 'bg-green-500'
  if (score >= 75) return 'bg-amber-500'
  if (score >= 60) return 'bg-orange-500'
  return 'bg-red-500'
}

function GradePanel({ blueprintId }: { blueprintId: string }) {
  const { data: grade, loading } = useApi<GradeData>(
    `/api/blueprints/${blueprintId}/grades`
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!grade) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <EmptyState icon={BarChart3} title="No grade yet" description="Rubric scores will appear here after grading." />
      </div>
    )
  }

  const config = RECOMMENDATION_STYLES[grade.recommendation] ?? RECOMMENDATION_STYLES.revise
  const passingCount = grade.dimensionScores.filter(d => d.score >= d.passThreshold).length
  const failingCount = grade.dimensionScores.length - passingCount

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Score hero */}
      <div className={`rounded-xl border p-4 text-center ${config.bg}`}>
        <div className={`text-4xl font-bold tabular-nums ${scoreColor(grade.overallScore)}`}>
          {grade.overallScore.toFixed(1)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">out of 100</div>
        <Badge className={`mt-2 text-xs ${config.text}`} variant="outline">
          {config.label}
        </Badge>
        <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={11} className="text-green-500" />
            {passingCount} passing
          </span>
          {failingCount > 0 && (
            <span className="flex items-center gap-1">
              <XCircle size={11} className="text-destructive" />
              {failingCount} failing
            </span>
          )}
        </div>
      </div>

      {/* Dimensions */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dimensions</h3>
        {grade.dimensionScores.map((dim) => {
          const passing = dim.score >= dim.passThreshold
          return (
            <div key={dim.id} className={`rounded-lg border p-2.5 ${passing ? 'border-border' : 'border-destructive/30 bg-destructive/5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {passing ? (
                    <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                  ) : (
                    <XCircle size={12} className="text-destructive shrink-0" />
                  )}
                  <span className="text-xs font-medium">{dim.name}</span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${passing ? scoreColor(dim.score) : 'text-destructive'}`}>
                  {dim.score}
                </span>
              </div>
              <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${passing ? barColor(dim.score) : 'bg-destructive'}`}
                  style={{ width: `${Math.min(dim.score, 100)}%` }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-foreground/25"
                  style={{ left: `${dim.passThreshold}%` }}
                />
              </div>
              {dim.feedback && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{dim.feedback}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Feedback */}
      {grade.feedback && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb size={12} className="text-amber-500" />
            <h3 className="text-xs font-medium">Overall Feedback</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{grade.feedback}</p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Graded: {new Date(grade.createdAt).toLocaleString()}
      </p>
    </div>
  )
}

// ─── Audience Panel ──────────────────────────────────────────────────────────

function AudienceDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize text-foreground">{value}</span>
    </>
  )
}

function AudiencePanel({ profile }: { profile: AudienceProfile }) {
  const pa = profile.primaryAudience
  if (!pa) return <p className="text-xs text-muted-foreground p-4">No audience data yet</p>

  return (
    <div className="flex flex-col gap-3 p-4 text-xs">
      <p className="text-sm text-foreground">{pa.description}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {pa.educationLevel && <AudienceDetailRow label="Education" value={pa.educationLevel} />}
        {pa.experienceLevel && <AudienceDetailRow label="Experience" value={pa.experienceLevel} />}
        {pa.technologyComfort && <AudienceDetailRow label="Tech comfort" value={pa.technologyComfort} />}
        {pa.ageRange && <AudienceDetailRow label="Age range" value={pa.ageRange} />}
        {pa.learningContext && <AudienceDetailRow label="Context" value={pa.learningContext} />}
      </div>
      {pa.motivations?.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingUp size={12} className="text-green-500" /> Motivations
          </p>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {pa.motivations.map((m, i) => <li key={i}>&bull; {m}</li>)}
          </ul>
        </div>
      )}
      {pa.painPoints?.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingDown size={12} className="text-destructive" /> Pain Points
          </p>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {pa.painPoints.map((p, i) => <li key={i}>&bull; {p}</li>)}
          </ul>
        </div>
      )}
      {profile.learningPreferences && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground">Learning Preferences</p>
          <div className="flex flex-col gap-0.5 text-muted-foreground">
            {profile.learningPreferences.preferredModalities?.length > 0 && (
              <p>Modalities: {profile.learningPreferences.preferredModalities.join(', ')}</p>
            )}
            {profile.learningPreferences.attentionSpan && (
              <p>Attention span: {profile.learningPreferences.attentionSpan}</p>
            )}
            {profile.learningPreferences.practicePreference && (
              <p>Practice: {profile.learningPreferences.practicePreference}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ArtifactPanelProps {
  activeTab: ArtifactTab
  onTabChange: (tab: ArtifactTab) => void
  visibleTabs: Set<ArtifactTab>
  // Data for tab content
  blueprintId: string | null
  projectId: string
  proposedStructure: ProposedStructure | null
  audienceProfile: AudienceProfile | null
  structureRefreshKey: number
  // Materialize
  isMaterialized: boolean
  onMaterialize: () => Promise<void>
  materializeLoading: boolean
  archetype: string | null
  projectName: string
  children?: React.ReactNode
}

export function ArtifactPanel({
  activeTab,
  onTabChange,
  visibleTabs,
  blueprintId,
  projectId,
  proposedStructure,
  audienceProfile,
  structureRefreshKey,
  isMaterialized,
  onMaterialize,
  materializeLoading,
  archetype,
  projectName,
  children,
}: ArtifactPanelProps) {
  const tabs = TAB_CONFIG.filter(t => visibleTabs.has(t.id))
  const activeConfig = TAB_CONFIG.find(t => t.id === activeTab)

  if (tabs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <EmptyState
          icon={Network}
          title="Artifacts will appear here"
          description="As agents produce structures, grades, and other artifacts, they'll open in this panel."
        />
      </div>
    )
  }

  // Render tab content based on active tab
  function renderContent() {
    // If explicit children are passed, use them
    if (children) return children

    switch (activeTab) {
      case 'structure':
        if (blueprintId) {
          return (
            <StructureEditor
              blueprintId={blueprintId}
              projectName={projectName}
              archetype={archetype}
              isMaterialized={isMaterialized}
              proposedStructure={proposedStructure}
              onMaterialize={onMaterialize}
              materializeLoading={materializeLoading}
            />
          )
        }
        break
      case 'grade':
        if (blueprintId) {
          return <GradePanel blueprintId={blueprintId} />
        }
        break
      case 'audience':
        if (audienceProfile) {
          return <AudiencePanel profile={audienceProfile} />
        }
        break
    }

    // Fallback to empty state
    if (activeConfig) {
      return (
        <div className="flex h-full items-center justify-center px-6">
          <EmptyState
            icon={activeConfig.icon}
            title={activeConfig.emptyTitle}
            description={activeConfig.emptyDescription}
          />
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 gap-1 border-b px-3 pt-2">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition-colors
                ${isActive
                  ? 'border-b-2 border-primary bg-muted/50 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'}
              `}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  )
}
