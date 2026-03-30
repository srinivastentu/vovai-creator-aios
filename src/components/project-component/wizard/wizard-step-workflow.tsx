'use client'

import { useCallback, useMemo } from 'react'
import {
  ChevronUp,
  ChevronDown,
  RotateCcw,
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
  AlertTriangle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  ArchetypeDefinition,
  ComponentDefinition,
  WorkflowTemplate,
} from '@/lib/project-component'
import {
  COMPONENT_REGISTRY,
  COMPONENT_COMPATIBILITY,
  getRecommendedProductionOrder,
} from '@/lib/project-component'
import type { ProjectArchetype } from '@/lib/project-component'

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

const CATEGORY_COLORS: Record<string, string> = {
  content: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  assessment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  activity: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  meta: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

const PIPELINE_LABELS: Record<string, string> = {
  document: 'Phase 1',
  assessment: 'Phase 2',
  video: 'Phase 3',
  activity: 'Phase 4',
  capstone: 'Phase 5',
  meta: 'Meta',
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface WizardStepWorkflowProps {
  archetype: ArchetypeDefinition
  workflowTemplate: WorkflowTemplate
  onChange: (template: WorkflowTemplate) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WizardStepWorkflow({
  archetype,
  workflowTemplate,
  onChange,
}: WizardStepWorkflowProps) {
  const { enabledComponents, productionOrder, levelDefaults } = workflowTemplate

  // Get compatibility for this archetype
  const compatibility = COMPONENT_COMPATIBILITY[archetype.id as ProjectArchetype]

  // All available components for this archetype (recommended + optional)
  const availableTypes = useMemo(
    () => [...compatibility.recommended, ...compatibility.optional],
    [compatibility],
  )

  // Dependency warnings: check if any enabled component depends on something ordered after it
  const dependencyWarnings = useMemo(() => {
    const warnings: Record<string, string> = {}
    for (const type of productionOrder) {
      const def = COMPONENT_REGISTRY[type]
      if (!def) continue
      for (const dep of def.dependsOn) {
        const depIndex = productionOrder.indexOf(dep)
        const typeIndex = productionOrder.indexOf(type)
        if (depIndex === -1 && enabledComponents.includes(dep)) continue
        if (depIndex > typeIndex) {
          warnings[type] = `Depends on "${COMPONENT_REGISTRY[dep]?.name ?? dep}" which is ordered after it`
        }
        if (depIndex === -1 && !enabledComponents.includes(dep)) {
          warnings[type] = `Depends on "${COMPONENT_REGISTRY[dep]?.name ?? dep}" which is not enabled`
        }
      }
    }
    return warnings
  }, [productionOrder, enabledComponents])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleComponent = useCallback((type: string) => {
    const isEnabled = enabledComponents.includes(type)

    let newEnabled: string[]
    let newOrder: string[]
    let newLevelDefaults = [...levelDefaults]

    if (isEnabled) {
      // Removing: filter from all lists
      newEnabled = enabledComponents.filter(t => t !== type)
      newOrder = productionOrder.filter(t => t !== type)
      newLevelDefaults = newLevelDefaults.map(ld => ({
        ...ld,
        enabledComponents: ld.enabledComponents.filter(t => t !== type),
      }))
    } else {
      // Adding: append to enabled + order, add to applicable levels
      newEnabled = [...enabledComponents, type]
      newOrder = [...productionOrder, type]
      const def = COMPONENT_REGISTRY[type]
      if (def) {
        newLevelDefaults = newLevelDefaults.map(ld => {
          if (def.attachableAt.includes(ld.depth)) {
            return { ...ld, enabledComponents: [...ld.enabledComponents, type] }
          }
          return ld
        })
      }
    }

    onChange({
      enabledComponents: newEnabled,
      productionOrder: newOrder,
      levelDefaults: newLevelDefaults,
    })
  }, [enabledComponents, productionOrder, levelDefaults, onChange])

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return
    const newOrder = [...productionOrder]
    const temp = newOrder[index - 1]
    newOrder[index - 1] = newOrder[index]
    newOrder[index] = temp
    onChange({ ...workflowTemplate, productionOrder: newOrder })
  }, [productionOrder, workflowTemplate, onChange])

  const handleMoveDown = useCallback((index: number) => {
    if (index >= productionOrder.length - 1) return
    const newOrder = [...productionOrder]
    const temp = newOrder[index + 1]
    newOrder[index + 1] = newOrder[index]
    newOrder[index] = temp
    onChange({ ...workflowTemplate, productionOrder: newOrder })
  }, [productionOrder, workflowTemplate, onChange])

  const handleResetOrder = useCallback(() => {
    const recommended = getRecommendedProductionOrder(
      enabledComponents,
      COMPONENT_REGISTRY,
    )
    onChange({ ...workflowTemplate, productionOrder: recommended })
  }, [enabledComponents, workflowTemplate, onChange])

  const handleToggleLevelComponent = useCallback((depth: number, type: string) => {
    const newLevelDefaults = levelDefaults.map(ld => {
      if (ld.depth !== depth) return ld
      const has = ld.enabledComponents.includes(type)
      return {
        ...ld,
        enabledComponents: has
          ? ld.enabledComponents.filter(t => t !== type)
          : [...ld.enabledComponents, type],
      }
    })
    onChange({ ...workflowTemplate, levelDefaults: newLevelDefaults })
  }, [levelDefaults, workflowTemplate, onChange])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold">Production Workflow</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select components, set production order, and configure which hierarchy levels get which deliverables.
        </p>
      </div>

      {/* Section 1: Component Selection */}
      <section>
        <h3 className="mb-3 text-sm font-medium">Component Selection</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Toggle component types on or off for this project. Pre-selected based on {archetype.name} defaults.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {availableTypes.map(type => {
            const def = COMPONENT_REGISTRY[type]
            if (!def) return null
            const isEnabled = enabledComponents.includes(type)
            const isRecommended = compatibility.recommended.includes(type)
            const Icon = COMPONENT_ICONS[type] ?? Package
            const categoryColor = CATEGORY_COLORS[def.category] ?? ''

            return (
              <button
                key={type}
                type="button"
                onClick={() => handleToggleComponent(type)}
                className={`
                  flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all
                  ${isEnabled
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card opacity-50 hover:opacity-75'
                  }
                `}
              >
                <Icon size={16} className={`mt-0.5 shrink-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium leading-tight">{def.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColor}`}>
                      {def.category}
                    </span>
                    {isRecommended && (
                      <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        recommended
                      </span>
                    )}
                  </div>
                </div>
                {/* Toggle indicator */}
                <div className={`
                  mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors
                  ${isEnabled
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/40 bg-transparent'
                  }
                `}>
                  {isEnabled && (
                    <svg viewBox="0 0 16 16" className="h-full w-full text-primary-foreground">
                      <path fill="currentColor" d="M6.5 11.5L3.5 8.5l1-1 2 2 4.5-4.5 1 1z" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Section 2: Production Order */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Production Order</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Determines wizard step order, pipeline execution, and job creation sequence.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetOrder}
            className="gap-1.5 text-xs"
          >
            <RotateCcw size={12} />
            Reset to recommended
          </Button>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {productionOrder.map((type, index) => {
              const def = COMPONENT_REGISTRY[type]
              if (!def) return null
              const Icon = COMPONENT_ICONS[type] ?? Package
              const warning = dependencyWarnings[type]

              return (
                <div
                  key={type}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  {/* Position number */}
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>

                  {/* Icon + name */}
                  <Icon size={14} className="shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{def.name}</span>

                  {/* Pipeline phase badge */}
                  <Badge variant="outline" className="text-[10px]">
                    {PIPELINE_LABELS[def.pipelineType] ?? def.pipelineType}
                  </Badge>

                  {/* Dependency warning */}
                  {warning && (
                    <span title={warning}>
                      <AlertTriangle size={14} className="text-amber-500" />
                    </span>
                  )}

                  {/* Up/down arrows */}
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === productionOrder.length - 1}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
            {productionOrder.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No components enabled. Select at least one above.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Section 3: Per-Level Defaults */}
      <section>
        <h3 className="mb-3 text-sm font-medium">Per-Level Component Defaults</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Configure which component types are attached at each hierarchy level by default.
          Only shows components whose depth rules allow attachment at that level.
        </p>
        <div className="space-y-3">
          {levelDefaults.map(ld => {
            // Components that CAN attach at this depth AND are enabled
            const attachable = enabledComponents.filter(type => {
              const def = COMPONENT_REGISTRY[type]
              return def ? def.attachableAt.includes(ld.depth) : false
            })

            if (attachable.length === 0) {
              return (
                <Card key={ld.depth}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <span className="text-sm font-medium">{ld.label}</span>
                    <Badge variant="outline" className="text-[10px]">depth {ld.depth}</Badge>
                    <span className="flex-1 text-right text-xs text-muted-foreground">
                      No compatible components at this level
                    </span>
                  </CardContent>
                </Card>
              )
            }

            return (
              <Card key={ld.depth}>
                <CardContent className="py-3">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="text-sm font-medium">{ld.label}</span>
                    <Badge variant="outline" className="text-[10px]">depth {ld.depth}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {attachable.map(type => {
                      const def = COMPONENT_REGISTRY[type] as ComponentDefinition | undefined
                      if (!def) return null
                      const isActive = ld.enabledComponents.includes(type)
                      const Icon = COMPONENT_ICONS[type] ?? Package

                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleToggleLevelComponent(ld.depth, type)}
                          className={`
                            inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all
                            ${isActive
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-muted-foreground/60'
                            }
                          `}
                        >
                          <Icon size={12} />
                          {def.name}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
