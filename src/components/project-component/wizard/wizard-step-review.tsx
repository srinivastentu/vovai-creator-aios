'use client'

import {
  Check,
  DollarSign,
  FolderTree,
  Component,
  ArrowRight,
  Settings,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { COMPONENT_ICONS, COMPONENT_ICON_FALLBACK } from '@/components/project-component/shared/component-icons'
import type {
  ArchetypeDefinition,
  ComponentDefinition,
  WorkflowTemplate,
  ComponentCategory,
} from '@/lib/project-component'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WizardStepReviewProps {
  archetype: ArchetypeDefinition
  workflowTemplate: WorkflowTemplate
  componentDefs: ComponentDefinition[]
  componentCounts: Record<string, number>
  totalNodes: number
  totalComponents: number
  costRange: { min: number; max: number }
  configuredTypes: Set<string>
  onGoToStep: (stepIndex: number) => void
}

const CATEGORY_BG: Record<ComponentCategory, string> = {
  content: 'bg-blue-50 dark:bg-blue-950/30',
  assessment: 'bg-amber-50 dark:bg-amber-950/30',
  activity: 'bg-green-50 dark:bg-green-950/30',
  meta: 'bg-purple-50 dark:bg-purple-950/30',
}

const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  content: 'text-blue-600 dark:text-blue-400',
  assessment: 'text-amber-600 dark:text-amber-400',
  activity: 'text-green-600 dark:text-green-400',
  meta: 'text-purple-600 dark:text-purple-400',
}

const PIPELINE_LABELS: Record<string, string> = {
  document: 'Phase 1: Documents',
  assessment: 'Phase 2: Assessments',
  video: 'Phase 3: Videos',
  activity: 'Phase 4: Activities',
  capstone: 'Phase 5: Capstone',
  meta: 'Meta',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepReview({
  archetype,
  workflowTemplate,
  componentDefs,
  componentCounts,
  totalNodes,
  totalComponents,
  costRange,
  configuredTypes,
  onGoToStep,
}: WizardStepReviewProps) {
  const defMap = new Map(componentDefs.map(d => [d.id, d]))

  // Group production order by pipeline phase
  const phaseGroups: { phase: string; label: string; components: string[] }[] = []
  const seen = new Set<string>()
  for (const type of workflowTemplate.productionOrder) {
    const def = defMap.get(type)
    if (!def) continue
    const phase = def.pipelineType
    if (!seen.has(phase)) {
      seen.add(phase)
      phaseGroups.push({
        phase,
        label: PIPELINE_LABELS[phase] ?? phase,
        components: [],
      })
    }
    phaseGroups.find(g => g.phase === phase)?.components.push(type)
  }

  const unconfiguredTypes = workflowTemplate.enabledComponents.filter(
    t => !configuredTypes.has(t) && (componentCounts[t] ?? 0) > 0,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Check size={18} />
          Review &amp; Confirm
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your configuration before launching production.
        </p>
      </div>

      {/* Project summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Project Summary</CardTitle>
          <CardDescription className="text-xs">
            {archetype.name} &middot; {archetype.productionMode.replace('_', ' ')} production
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 pt-0 text-xs">
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
            <FolderTree size={13} className="text-muted-foreground" />
            <span className="font-medium">{totalNodes}</span>
            <span className="text-muted-foreground">nodes</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
            <Component size={13} className="text-muted-foreground" />
            <span className="font-medium">{totalComponents}</span>
            <span className="text-muted-foreground">components</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
            <Settings size={13} className="text-muted-foreground" />
            <span className="font-medium">{configuredTypes.size}</span>
            <span className="text-muted-foreground">of {workflowTemplate.enabledComponents.length} types configured</span>
          </div>
        </CardContent>
      </Card>

      {/* Production pipeline order */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Production Pipeline</CardTitle>
          <CardDescription className="text-xs">
            Components will be produced in this order
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {phaseGroups.map((group, gi) => (
              <div key={group.phase}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.components.map(type => {
                    const def = defMap.get(type)
                    if (!def) return null
                    const count = componentCounts[type] ?? 0
                    const isConfigured = configuredTypes.has(type)
                    const Icon = COMPONENT_ICONS[type] ?? COMPONENT_ICON_FALLBACK

                    return (
                      <div
                        key={type}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${CATEGORY_BG[def.category]}`}
                      >
                        <Icon size={14} className={`shrink-0 ${CATEGORY_COLORS[def.category]}`} />
                        <span className="flex-1 text-xs font-medium">{def.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {count}
                        </Badge>
                        {isConfigured ? (
                          <Badge variant="outline" className="gap-1 text-[10px] text-green-600 border-green-200 dark:border-green-800 dark:text-green-400">
                            <Check size={10} />
                            Configured
                          </Badge>
                        ) : count > 0 ? (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400">
                            Defaults
                          </Badge>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                {gi < phaseGroups.length - 1 && (
                  <div className="mt-3 flex justify-center">
                    <ArrowRight size={14} className="text-muted-foreground/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost estimate */}
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
            <DollarSign size={16} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimated total cost</p>
            <p className="text-sm font-semibold">
              ${costRange.min.toFixed(2)} &ndash; ${costRange.max.toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Unconfigured warning */}
      {unconfiguredTypes.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="py-4">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {unconfiguredTypes.length} component type{unconfiguredTypes.length !== 1 ? 's' : ''} using
              default settings:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unconfiguredTypes.map(type => {
                const def = defMap.get(type)
                if (!def) return null
                const Icon = COMPONENT_ICONS[type] ?? COMPONENT_ICON_FALLBACK
                return (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:text-amber-400"
                  >
                    <Icon size={10} />
                    {def.name}
                  </span>
                )
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              You can go back and customize these, or proceed with archetype defaults.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Per-level summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Level Defaults</CardTitle>
          <CardDescription className="text-xs">
            Which components attach at each hierarchy level
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {workflowTemplate.levelDefaults.map(ld => (
              <div key={ld.depth} className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">
                  {ld.label}
                </Badge>
                <div className="flex flex-wrap gap-1">
                  {ld.enabledComponents.length > 0 ? (
                    ld.enabledComponents.map(type => {
                      const def = defMap.get(type)
                      if (!def) return null
                      const Icon = COMPONENT_ICONS[type] ?? COMPONENT_ICON_FALLBACK
                      return (
                        <span
                          key={type}
                          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                        >
                          <Icon size={10} />
                          {def.name}
                        </span>
                      )
                    })
                  ) : (
                    <span className="text-[10px] text-muted-foreground">None</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
