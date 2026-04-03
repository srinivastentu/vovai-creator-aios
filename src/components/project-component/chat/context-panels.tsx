'use client'

import { TreePine, Users, Info, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StructurePreview } from './structure-preview'
import type { ProposedStructure, AudienceProfile } from '@/lib/project-component'

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

type TabId = 'structure' | 'audience' | 'session'

interface ContextPanelsProps {
  activeTab: TabId | null
  onTabChange: (tab: TabId | null) => void
  proposedStructure: ProposedStructure | null
  audienceProfile: AudienceProfile | null
  blueprint: BlueprintSummary | null
  blueprintId: string | null
  projectId: string
  structureRefreshKey: number
  totalCost: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

// ─── Tab Button ──────────────────────────────────────────────────────────────

function TabButton({
  id,
  icon: Icon,
  label,
  badge,
  active,
  onClick,
}: {
  id: TabId
  icon: typeof TreePine
  label: string
  badge?: string
  active: boolean
  onClick: (id: TabId) => void
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon size={13} />
      <span>{label}</span>
      {badge && (
        <Badge variant="secondary" className="ml-0.5 px-1 py-0 text-[9px]">
          {badge}
        </Badge>
      )}
    </button>
  )
}

// ─── Audience Profile Panel ─────────────────────────────────────────────────

function AudiencePanel({ profile }: { profile: AudienceProfile }) {
  const pa = profile.primaryAudience
  if (!pa) return <p className="text-xs text-muted-foreground">No audience data yet</p>

  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="text-sm text-foreground">{pa.description}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {pa.educationLevel && <DetailRow label="Education" value={pa.educationLevel} />}
        {pa.experienceLevel && <DetailRow label="Experience" value={pa.experienceLevel} />}
        {pa.technologyComfort && <DetailRow label="Tech comfort" value={pa.technologyComfort} />}
        {pa.ageRange && <DetailRow label="Age range" value={pa.ageRange} />}
        {pa.learningContext && <DetailRow label="Context" value={pa.learningContext} />}
      </div>
      {pa.motivations?.length > 0 && (
        <div>
          <p className="mb-0.5 font-medium text-muted-foreground">Motivations</p>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {pa.motivations.map((m, i) => <li key={i}>&bull; {m}</li>)}
          </ul>
        </div>
      )}
      {pa.painPoints?.length > 0 && (
        <div>
          <p className="mb-0.5 font-medium text-muted-foreground">Pain Points</p>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {pa.painPoints.map((p, i) => <li key={i}>&bull; {p}</li>)}
          </ul>
        </div>
      )}
      {profile.learningPreferences && (
        <div>
          <p className="mb-0.5 font-medium text-muted-foreground">Learning Preferences</p>
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

// ─── Session Info Panel ─────────────────────────────────────────────────────

function SessionPanel({
  blueprint,
  totalCost,
}: {
  blueprint: BlueprintSummary | null
  totalCost: number
}) {
  const summary = blueprint?.structureSummary
  const totalComponents = summary?.componentBreakdown
    ? Object.values(summary.componentBreakdown).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="flex flex-col gap-2 text-xs">
      {/* Cost */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <DollarSign size={13} />
          <span>Session Cost</span>
        </div>
        <span className="font-semibold tabular-nums">{formatCost(totalCost)}</span>
      </div>

      {blueprint && (
        <>
          {/* Archetype */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Archetype</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {blueprint.archetype.replace(/_/g, ' ')}
            </Badge>
          </div>

          {/* Score */}
          {blueprint.ideationScore != null && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Score</span>
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

          {/* Structure counts */}
          {summary && (summary.totalModules ?? 0) > 0 && (
            <div className="flex flex-col gap-0.5 text-muted-foreground">
              {summary.totalModules && <span>{summary.totalModules} modules</span>}
              {summary.totalTopics && <span>{summary.totalTopics} topics</span>}
              {summary.totalSubtopics && <span>{summary.totalSubtopics} subtopics</span>}
            </div>
          )}

          {/* Component count */}
          {totalComponents > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Components</span>
              <span className="font-medium">{totalComponents}</span>
            </div>
          )}

          {/* Estimated hours */}
          {summary?.estimatedHours && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Est. hours</span>
              <span className="font-medium">{summary.estimatedHours}h</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize text-foreground">{value}</span>
    </>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContextPanels({
  activeTab,
  onTabChange,
  proposedStructure,
  audienceProfile,
  blueprint,
  blueprintId,
  projectId,
  structureRefreshKey,
  totalCost,
}: ContextPanelsProps) {
  const handleTabClick = (id: TabId) => {
    onTabChange(activeTab === id ? null : id)
  }

  // Tab badges
  const structureBadge = blueprint?.structureSummary?.totalModules
    ? `${blueprint.structureSummary.totalModules}m`
    : undefined
  const audienceBadge = audienceProfile?.primaryAudience ? undefined : undefined // no badge needed
  const sessionBadge = totalCost > 0 ? formatCost(totalCost) : undefined

  return (
    <div className="border-t bg-muted/20">
      {/* Tab bar */}
      <div className="flex gap-1 px-3 py-2">
        <TabButton
          id="structure"
          icon={TreePine}
          label="Structure"
          badge={structureBadge}
          active={activeTab === 'structure'}
          onClick={handleTabClick}
        />
        <TabButton
          id="audience"
          icon={Users}
          label="Audience"
          active={activeTab === 'audience'}
          onClick={handleTabClick}
        />
        <TabButton
          id="session"
          icon={Info}
          label="Session"
          badge={sessionBadge}
          active={activeTab === 'session'}
          onClick={handleTabClick}
        />
      </div>

      {/* Panel content */}
      {activeTab && (
        <div className="max-h-64 overflow-y-auto border-t px-4 py-3">
          {activeTab === 'structure' && (
            <StructurePreview
              blueprintId={blueprintId}
              projectId={projectId}
              refreshKey={structureRefreshKey}
              proposedStructure={proposedStructure}
            />
          )}
          {activeTab === 'audience' && (
            audienceProfile
              ? <AudiencePanel profile={audienceProfile} />
              : <p className="text-xs text-muted-foreground">No audience profile yet</p>
          )}
          {activeTab === 'session' && (
            <SessionPanel blueprint={blueprint} totalCost={totalCost} />
          )}
        </div>
      )}
    </div>
  )
}
