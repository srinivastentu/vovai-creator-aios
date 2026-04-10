'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Component,
  DollarSign,
  FolderTree,
  Rocket,
  Settings,
  Shield,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { COMPONENT_ICONS, COMPONENT_ICON_FALLBACK } from '@/components/project-component/shared/component-icons'
import { COMPONENT_REGISTRY } from '@/lib/domain/workflows'
import type {
  ArchetypeDefinition,
  ComponentDefinition,
  WorkflowTemplate,
  ComponentCategory,
  ProjectNodeType,
} from '@/lib/domain/workflows'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WizardStepReviewProps {
  projectId: string
  projectName: string
  targetAudience: string
  archetype: ArchetypeDefinition
  workflowTemplate: WorkflowTemplate
  componentDefs: ComponentDefinition[]
  componentCounts: Record<string, number>
  totalNodes: number
  totalComponents: number
  depthCounts: Record<number, number>
  costRange: { min: number; max: number }
  configuredTypes: Set<string>
  ideationScore: number | null
  flatNodes: ProjectNodeType[] | null
  onGoToStep: (stepIndex: number) => void
  onWorkflowChange?: (template: WorkflowTemplate) => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

/** Avg production days per item for each pipeline phase */
const PIPELINE_DAYS_PER_ITEM: Record<string, number> = {
  document: 0.1,
  assessment: 0.15,
  video: 0.5,
  activity: 0.2,
  capstone: 0.3,
  meta: 0.05,
}

function getScoreRecommendation(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'Not graded', color: 'text-muted-foreground' }
  if (score >= 85) return { label: 'Approve', color: 'text-green-600 dark:text-green-400' }
  if (score >= 75) return { label: 'Revise', color: 'text-amber-600 dark:text-amber-400' }
  if (score >= 60) return { label: 'Restructure', color: 'text-orange-600 dark:text-orange-400' }
  return { label: 'Reject', color: 'text-red-600 dark:text-red-400' }
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WizardStepReview({
  projectId,
  projectName,
  targetAudience,
  archetype,
  workflowTemplate,
  componentDefs,
  componentCounts,
  totalNodes,
  totalComponents,
  depthCounts,
  costRange,
  configuredTypes,
  ideationScore,
  flatNodes,
  onGoToStep,
}: WizardStepReviewProps) {
  const router = useRouter()
  const defMap = new Map(componentDefs.map(d => [d.id, d]))
  const [confirmed, setConfirmed] = useState(false)

  // ─── Derived data ────────────────────────────────────────────────────────

  // Structure summary string: "X modules, Y topics, Z subtopics"
  const structureSummary = useMemo(() => {
    const parts: string[] = []
    for (const [depth, count] of Object.entries(depthCounts)) {
      const d = Number(depth)
      const label = archetype.hierarchy[d] ?? `Level ${d}`
      parts.push(`${count} ${label}${count !== 1 ? 's' : ''}`)
    }
    return parts.join(', ')
  }, [depthCounts, archetype.hierarchy])

  // Rubric score recommendation
  const recommendation = useMemo(() => getScoreRecommendation(ideationScore), [ideationScore])

  // Component breakdown rows grouped by pipeline phase
  const breakdownRows = useMemo(() => {
    const rows: {
      type: string
      def: ComponentDefinition
      count: number
      costMin: number
      costMax: number
      configSummary: string
    }[] = []

    for (const type of workflowTemplate.productionOrder) {
      const count = componentCounts[type] ?? 0
      if (count === 0) continue
      const def = defMap.get(type) ?? COMPONENT_REGISTRY[type]
      if (!def) continue

      const costMin = def.estimatedCost.min * count
      const costMax = def.estimatedCost.max * count

      // Build a short config summary from defaults
      const defaults = (def.configSchema as { defaults?: Record<string, unknown> })?.defaults
      const configParts: string[] = []
      if (defaults) {
        if ('duration' in defaults) configParts.push(String(defaults.duration))
        if ('questionCount' in defaults) configParts.push(`${defaults.questionCount} Qs`)
        if ('questionTypes' in defaults && Array.isArray(defaults.questionTypes)) {
          configParts.push(defaults.questionTypes.length <= 2 ? (defaults.questionTypes as string[]).join(', ') : 'mixed')
        }
        if ('readingLevel' in defaults) configParts.push(String(defaults.readingLevel))
        if ('activityType' in defaults) configParts.push(String(defaults.activityType).replace('_', ' '))
        if ('groupSize' in defaults) configParts.push(String(defaults.groupSize))
        if ('scenarioType' in defaults) configParts.push(String(defaults.scenarioType).replace('_', ' '))
        if ('cardCount' in defaults) configParts.push(`${defaults.cardCount} cards`)
        if ('promptCount' in defaults) configParts.push(`${defaults.promptCount} prompts`)
        if ('checkpointCount' in defaults) configParts.push(`${defaults.checkpointCount} checkpoints`)
      }

      rows.push({
        type,
        def,
        count,
        costMin,
        costMax,
        configSummary: configParts.slice(0, 3).join(', ') || 'default',
      })
    }
    return rows
  }, [workflowTemplate.productionOrder, componentCounts, defMap])

  // Production timeline estimate grouped by phase
  const timelineEstimate = useMemo(() => {
    const phases: { phase: string; label: string; itemCount: number; days: number }[] = []
    const phaseItems: Record<string, number> = {}

    for (const type of workflowTemplate.productionOrder) {
      const count = componentCounts[type] ?? 0
      if (count === 0) continue
      const def = defMap.get(type) ?? COMPONENT_REGISTRY[type]
      if (!def) continue
      phaseItems[def.pipelineType] = (phaseItems[def.pipelineType] ?? 0) + count
    }

    for (const [phase, count] of Object.entries(phaseItems)) {
      const daysPerItem = PIPELINE_DAYS_PER_ITEM[phase] ?? 0.2
      let days = count * daysPerItem
      // Videos batched in groups of 10
      if (phase === 'video') {
        days = Math.ceil(count / 10) * 10 * daysPerItem
      }
      phases.push({
        phase,
        label: PIPELINE_LABELS[phase] ?? phase,
        itemCount: count,
        days: Math.max(Math.round(days * 10) / 10, 0.5),
      })
    }

    const totalDays = phases.reduce((sum, p) => sum + p.days, 0)
    return { phases, totalDays: Math.round(totalDays * 10) / 10 }
  }, [workflowTemplate.productionOrder, componentCounts, defMap])

  // Configuration warnings
  const warnings = useMemo(() => {
    const items: { message: string; severity: 'warning' | 'info' }[] = []

    // Nodes with no components
    if (flatNodes) {
      const emptyNodes = flatNodes.filter(
        n => n.components.length === 0 && n.depth > 0,
      )
      if (emptyNodes.length > 0) {
        items.push({
          message: `${emptyNodes.length} node${emptyNodes.length !== 1 ? 's have' : ' has'} no components attached.`,
          severity: 'warning',
        })
      }
    }

    // Learning outcomes without assessment coverage
    if (flatNodes) {
      const assessmentTypes = new Set(['quiz', 'pre_assessment', 'post_assessment'])
      const enabledSet = new Set(workflowTemplate.enabledComponents)
      const hasAssessments = [...assessmentTypes].some(t => enabledSet.has(t))

      if (!hasAssessments) {
        const nodesWithOutcomes = flatNodes.filter(n => n.learningOutcomes.length > 0)
        if (nodesWithOutcomes.length > 0) {
          items.push({
            message: `${nodesWithOutcomes.length} node${nodesWithOutcomes.length !== 1 ? 's have' : ' has'} learning outcomes but no assessment components are enabled.`,
            severity: 'warning',
          })
        }
      }
    }

    // Recommended components that were skipped
    const skippedRecommended = archetype.defaultComponents.filter(
      t => !workflowTemplate.enabledComponents.includes(t),
    )
    if (skippedRecommended.length > 0) {
      const names = skippedRecommended
        .map(t => COMPONENT_REGISTRY[t]?.name ?? t)
        .join(', ')
      items.push({
        message: `Skipped recommended components: ${names}.`,
        severity: 'info',
      })
    }

    // Unconfigured components
    const unconfigured = workflowTemplate.enabledComponents.filter(
      t => !configuredTypes.has(t) && (componentCounts[t] ?? 0) > 0,
    )
    if (unconfigured.length > 0) {
      items.push({
        message: `${unconfigured.length} component type${unconfigured.length !== 1 ? 's' : ''} using default settings (not explicitly configured).`,
        severity: 'info',
      })
    }

    return items
  }, [flatNodes, workflowTemplate, archetype.defaultComponents, configuredTypes, componentCounts])

  // Launch handler
  const handleLaunch = useCallback(() => {
    router.push(`/project/${projectId}/launch`)
  }, [router, projectId])

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

      {/* ─── SECTION 1: Project Summary ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Project Summary</CardTitle>
          <CardDescription className="text-xs">
            {archetype.name} &middot; {archetype.productionMode.replace('_', ' ')} production
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Project name & audience */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{projectName}</p>
            <p className="text-xs text-muted-foreground">{targetAudience}</p>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
              <FolderTree size={13} className="text-muted-foreground" />
              <span className="text-muted-foreground">{structureSummary}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
              <Component size={13} className="text-muted-foreground" />
              <span className="font-medium">{totalComponents}</span>
              <span className="text-muted-foreground">components</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5">
              <Settings size={13} className="text-muted-foreground" />
              <span className="font-medium">{configuredTypes.size}</span>
              <span className="text-muted-foreground">
                of {workflowTemplate.enabledComponents.length} configured
              </span>
            </div>
          </div>

          {/* Rubric score */}
          {ideationScore !== null && (
            <div className="flex items-center gap-2 text-xs">
              <Shield size={13} className="text-muted-foreground" />
              <span className="text-muted-foreground">Rubric score:</span>
              <span className="font-semibold">{ideationScore}</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${recommendation.color}`}
              >
                {recommendation.label}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── SECTION 2: Component Breakdown Table ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Component Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Cost estimates based on AI provider pricing
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Component Type</th>
                  <th className="pb-2 pr-3 text-right font-medium">Count</th>
                  <th className="pb-2 pr-3 font-medium">Config Summary</th>
                  <th className="pb-2 text-right font-medium">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {breakdownRows.map(row => {
                  const Icon = COMPONENT_ICONS[row.type] ?? COMPONENT_ICON_FALLBACK
                  return (
                    <tr key={row.type}>
                      <td className="py-2 pr-3">
                        <div className={`flex items-center gap-2 ${CATEGORY_COLORS[row.def.category]}`}>
                          <Icon size={13} className="shrink-0" />
                          <span className="font-medium">{row.def.name}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.count}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.configSummary}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCost(row.costMin)}&ndash;{formatCost(row.costMax)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="pt-2 pr-3">Total</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{totalComponents}</td>
                  <td className="pt-2 pr-3"></td>
                  <td className="pt-2 text-right tabular-nums">
                    {formatCost(costRange.min)}&ndash;{formatCost(costRange.max)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 3: Production Timeline Estimate ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar size={14} />
            Production Timeline Estimate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="space-y-2">
            {timelineEstimate.phases.map(phase => (
              <div key={phase.phase} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{phase.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {phase.itemCount} item{phase.itemCount !== 1 ? 's' : ''}
                    {phase.phase === 'video' ? ' (batched ×10)' : ''}
                  </span>
                  <span className="font-medium tabular-nums">
                    ~{phase.days} day{phase.days !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold">
              <Clock size={13} />
              Total estimated
            </div>
            <span className="font-semibold tabular-nums">
              ~{timelineEstimate.totalDays} day{timelineEstimate.totalDays !== 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Estimates assume sequential production. Actual time depends on
            review cycles and revision rounds.
          </p>
        </CardContent>
      </Card>

      {/* ─── SECTION 4: Configuration Warnings ───────────────────────────────── */}
      {warnings.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle size={14} />
              Configuration Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                  w.severity === 'warning'
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{w.message}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">
              These are informational — they won&apos;t block production launch.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── SECTION 5: Launch Button ────────────────────────────────────────── */}
      <Card className="border-green-200 dark:border-green-800">
        <CardContent className="space-y-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
              <DollarSign size={18} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estimated total cost</p>
              <p className="text-base font-semibold">
                {formatCost(costRange.min)} &ndash; {formatCost(costRange.max)}
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5">
            <Checkbox
              checked={confirmed}
              onCheckedChange={setConfirmed}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed">
              I&apos;ve reviewed the project structure, component configuration,
              and production settings.
            </span>
          </label>

          <Button
            size="lg"
            className="w-full gap-2"
            disabled={!confirmed}
            onClick={handleLaunch}
          >
            <Rocket size={16} />
            Launch to Production
            <ArrowRight size={14} />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
