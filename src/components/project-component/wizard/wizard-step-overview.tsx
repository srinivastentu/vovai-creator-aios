'use client'

import {
  Video,
  Clapperboard,
  BookOpen,
  ClipboardList,
  Layers,
  HelpCircle,
  ClipboardCheck,
  Award,
  Puzzle,
  Route,
  Trophy,
  MessageSquare,
  BookA,
  Library,
  GraduationCap,
  ListChecks,
  Package,
  Sparkles,
  DollarSign,
  FolderTree,
  Component,
  Info,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  ProjectArchetype,
  ArchetypeDefinition,
  ComponentDefinition,
  ComponentCategory,
} from '@/lib/project-component'

// ─── Icon Map ────────────────────────────────────────────────────────────────

const COMPONENT_ICONS: Record<string, LucideIcon> = {
  video: Video,
  video_short: Clapperboard,
  study_material: BookOpen,
  practice_worksheet: ClipboardList,
  flashcards: Layers,
  quiz: HelpCircle,
  pre_assessment: ClipboardCheck,
  post_assessment: Award,
  activity: Puzzle,
  scenario_exercise: Route,
  capstone_project: Trophy,
  discussion_prompt: MessageSquare,
  glossary: BookA,
  resource_library: Library,
  certificate: GraduationCap,
  mentor_checklist: ListChecks,
}

const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  content: 'text-blue-600 dark:text-blue-400',
  assessment: 'text-amber-600 dark:text-amber-400',
  activity: 'text-green-600 dark:text-green-400',
  meta: 'text-purple-600 dark:text-purple-400',
}

const CATEGORY_BG: Record<ComponentCategory, string> = {
  content: 'bg-blue-50 dark:bg-blue-950/30',
  assessment: 'bg-amber-50 dark:bg-amber-950/30',
  activity: 'bg-green-50 dark:bg-green-950/30',
  meta: 'bg-purple-50 dark:bg-purple-950/30',
}

const ARCHETYPE_TIPS: Record<ProjectArchetype, string[]> = {
  k12_curriculum: [
    'Videos are the primary deliverable — keep study materials supplementary',
    'Practice worksheets work best at topic level (depth 2-3)',
    'Batch production groups of 10 videos for efficient review',
  ],
  professional_training: [
    'Study materials form the content foundation — produce them first',
    'Capstone projects synthesize module-level learning',
    'Pre/post assessments at module level measure learning gains',
    'Activities bridge theory (documents) and practice (assessments)',
  ],
  content_channel: [
    'Each episode is a standalone video — keep dependencies minimal',
    'Quizzes are optional engagement boosters, not formal assessments',
    'Rolling production means episodes publish as they complete',
  ],
}

const PRODUCTION_MODE_LABELS: Record<string, string> = {
  batch: 'Batch (groups of 10)',
  module_sequential: 'Module-sequential',
  rolling: 'Rolling (continuous)',
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WizardStepOverviewProps {
  archetype: ArchetypeDefinition
  totalNodes: number
  depthCounts: Record<number, number>
  componentCounts: Record<string, number>
  totalComponents: number
  componentDefs: ComponentDefinition[]
  costRange: { min: number; max: number }
  onApplyDefaults: () => void
  applyingDefaults: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepOverview({
  archetype,
  totalNodes,
  depthCounts,
  componentCounts,
  totalComponents,
  componentDefs,
  costRange,
  onApplyDefaults,
  applyingDefaults,
}: WizardStepOverviewProps) {
  const defMap = new Map(componentDefs.map(d => [d.id, d]))
  const tips = ARCHETYPE_TIPS[archetype.id] ?? []

  return (
    <div className="flex flex-col gap-5">
      {/* Archetype header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{archetype.name}</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {archetype.description}
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs capitalize">
              {PRODUCTION_MODE_LABELS[archetype.productionMode] ?? archetype.productionMode}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 pt-0 text-xs">
          {/* Node hierarchy summary */}
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
            <FolderTree size={13} className="text-muted-foreground" />
            <span className="font-medium">{totalNodes}</span>
            <span className="text-muted-foreground">nodes</span>
          </div>
          {Object.entries(archetype.hierarchy).map(([level, label]) => {
            const count = depthCounts[Number(level)] ?? 0
            if (count === 0) return null
            return (
              <div key={level} className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
                <span className="font-medium">{count}</span>
                <span className="text-muted-foreground">{label}{count !== 1 ? 's' : ''}</span>
              </div>
            )
          })}
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
            <Component size={13} className="text-muted-foreground" />
            <span className="font-medium">{totalComponents}</span>
            <span className="text-muted-foreground">components</span>
          </div>
        </CardContent>
      </Card>

      {/* Component breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Component Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Settings will apply to all instances of each type
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(componentCounts)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => {
                const def = defMap.get(type)
                if (!def) return null
                const Icon = COMPONENT_ICONS[type] ?? Package
                const costMin = (def.estimatedCost.min * count).toFixed(2)
                const costMax = (def.estimatedCost.max * count).toFixed(2)
                return (
                  <div
                    key={type}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${CATEGORY_BG[def.category]}`}
                  >
                    <Icon size={15} className={`shrink-0 ${CATEGORY_COLORS[def.category]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{def.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {count} instance{count !== 1 ? 's' : ''} &middot; ${costMin}–${costMax}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                      {count}
                    </Badge>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {/* Cost estimate + apply defaults */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
              <DollarSign size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estimated total cost</p>
              <p className="text-sm font-semibold">
                ${costRange.min.toFixed(2)} – ${costRange.max.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          size="sm"
          onClick={onApplyDefaults}
          disabled={applyingDefaults}
          className="gap-2 self-start sm:self-center"
        >
          <Sparkles size={14} />
          Apply Archetype Defaults
        </Button>
      </div>

      {/* Archetype tips */}
      {tips.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Info size={14} className="text-blue-500" />
              Tips for {archetype.name.split(' ')[0]} Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {tips.map((tip, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-muted-foreground/60">&bull;</span>
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
