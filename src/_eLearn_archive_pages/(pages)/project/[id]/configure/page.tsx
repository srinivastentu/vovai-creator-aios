'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/lib/hooks/use-api'
import { PcNav } from '@/components/project-component/shared/pc-nav'
import { Breadcrumbs } from '@/components/project-component/shared/breadcrumbs'
import { ErrorBanner } from '@/components/project-component/shared/error-banner'
import { WizardStepSkeleton } from '@/components/project-component/shared/skeleton-loader'
import { WizardStepper, generateWizardSteps } from '@/components/project-component/wizard/wizard-stepper'
import { WizardStepOverview } from '@/components/project-component/wizard/wizard-step-overview'
import { WizardStepWorkflow } from '@/components/project-component/wizard/wizard-step-workflow'
import { WizardStepVideo } from '@/components/project-component/wizard/wizard-step-video'
import { WizardStepQuiz } from '@/components/project-component/wizard/wizard-step-quiz'
import { WizardStepStudyMaterial } from '@/components/project-component/wizard/wizard-step-study-material'
import { WizardStepActivity } from '@/components/project-component/wizard/wizard-step-activity'
import { WizardStepGeneric } from '@/components/project-component/wizard/wizard-step-generic'
import { WizardStepReview } from '@/components/project-component/wizard/wizard-step-review'
import {
  getArchetype,
  COMPONENT_REGISTRY,
  buildDefaultWorkflowTemplate,
} from '@/lib/domain/workflows'
import type {
  IdeationPhase,
  ProjectNodeType,
  ComponentDefinition,
  WorkflowTemplate,
} from '@/lib/domain/workflows'

// ─── API Response Types ────────────────────────────────────────────────────

interface BlueprintResponse {
  id: string
  projectId: string
  archetype: string
  enabledComponents: string[]
  workflowTemplate: WorkflowTemplate | null
  ideationPhase: IdeationPhase
  ideationScore: number | null
  structureSummary: Record<string, unknown> | null
  project: {
    id: string
    name: string
    topic: string
    targetAudience: string
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ConfigurePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const [currentStep, setCurrentStep] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Fetch blueprint
  const {
    data: blueprint,
    loading: blueprintLoading,
    error: blueprintError,
  } = useApi<BlueprintResponse>(`/api/blueprints?projectId=${projectId}`)

  // Fetch nodes (depends on blueprint)
  const nodesUrl = blueprint ? `/api/blueprints/${blueprint.id}/nodes` : ''
  const {
    data: flatNodes,
    loading: nodesLoading,
  } = useApi<ProjectNodeType[]>(nodesUrl, { skip: !blueprint })

  // Derive archetype definition
  const archetypeDef = useMemo(() => {
    if (!blueprint) return null
    try {
      return getArchetype(blueprint.archetype)
    } catch {
      return null
    }
  }, [blueprint])

  // Workflow template — use saved value or generate default from archetype
  const [workflowTemplate, setWorkflowTemplate] = useState<WorkflowTemplate | null>(null)
  const effectiveWorkflow = useMemo(() => {
    if (workflowTemplate) return workflowTemplate
    if (blueprint?.workflowTemplate) return blueprint.workflowTemplate
    if (archetypeDef) return buildDefaultWorkflowTemplate(archetypeDef, COMPONENT_REGISTRY)
    return null
  }, [workflowTemplate, blueprint?.workflowTemplate, archetypeDef])

  // Debounced save — prevents race conditions from rapid toggling
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<WorkflowTemplate | null>(null)

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  // Persist workflow template changes to API (optimistic + debounced + rollback)
  const handleWorkflowChange = useCallback((template: WorkflowTemplate) => {
    setWorkflowTemplate(template)
    setSaveError(null)
    if (!blueprint) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/blueprints/${blueprint.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowTemplate: template,
            enabledComponents: template.enabledComponents,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `Save failed (${res.status})` }))
          const message = (body as { error?: string }).error ?? `Save failed (${res.status})`
          setWorkflowTemplate(lastSavedRef.current)
          setSaveError(message)
        } else {
          lastSavedRef.current = template
        }
      } catch {
        setWorkflowTemplate(lastSavedRef.current)
        setSaveError('Network error — changes were not saved')
      }
    }, 500)
  }, [blueprint])

  // Compute component instance counts from actual nodes (filtered to enabled types)
  const componentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!flatNodes) return counts
    const enabledSet = effectiveWorkflow
      ? new Set(effectiveWorkflow.enabledComponents)
      : null
    for (const node of flatNodes) {
      for (const comp of node.components) {
        if (!enabledSet || enabledSet.has(comp.componentType)) {
          counts[comp.componentType] = (counts[comp.componentType] ?? 0) + 1
        }
      }
    }
    return counts
  }, [flatNodes, effectiveWorkflow?.enabledComponents])

  // Compute depth-level counts
  const depthCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    if (!flatNodes) return counts
    for (const node of flatNodes) {
      counts[node.depth] = (counts[node.depth] ?? 0) + 1
    }
    return counts
  }, [flatNodes])

  // Total nodes and components
  const totalNodes = flatNodes?.length ?? 0
  const totalComponents = useMemo(
    () => Object.values(componentCounts).reduce((sum, c) => sum + c, 0),
    [componentCounts],
  )

  // Component definitions for enabled types
  const enabledComponentDefs = useMemo((): ComponentDefinition[] => {
    const enabled = effectiveWorkflow?.enabledComponents ?? blueprint?.enabledComponents ?? []
    return enabled
      .map(type => COMPONENT_REGISTRY[type])
      .filter((d): d is ComponentDefinition => d !== undefined)
  }, [effectiveWorkflow?.enabledComponents, blueprint?.enabledComponents])

  // Cost range
  const costRange = useMemo(() => {
    let min = 0
    let max = 0
    for (const [type, count] of Object.entries(componentCounts)) {
      const def = COMPONENT_REGISTRY[type]
      if (!def) continue
      min += def.estimatedCost.min * count
      max += def.estimatedCost.max * count
    }
    return { min, max }
  }, [componentCounts])

  // Generate wizard steps dynamically
  const wizardSteps = useMemo(
    () => generateWizardSteps(
      effectiveWorkflow?.enabledComponents ?? blueprint?.enabledComponents ?? [],
      enabledComponentDefs,
      componentCounts,
      effectiveWorkflow,
    ),
    [effectiveWorkflow, blueprint?.enabledComponents, enabledComponentDefs, componentCounts],
  )

  // Step navigation
  const handleStepClick = useCallback((idx: number) => {
    if (idx < currentStep) setCurrentStep(idx)
  }, [currentStep])

  const handleNext = useCallback(() => {
    // Block advancement from workflow step if no components enabled
    if (currentStep === 1 && !effectiveWorkflow) return
    setCurrentStep(prev => Math.min(prev + 1, wizardSteps.length - 1))
  }, [currentStep, effectiveWorkflow, wizardSteps.length])

  const handlePrevious = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }, [])

  // Apply archetype defaults — resets workflow to archetype defaults
  const handleApplyDefaults = useCallback(() => {
    if (!archetypeDef) return
    const defaults = buildDefaultWorkflowTemplate(archetypeDef, COMPONENT_REGISTRY)
    handleWorkflowChange(defaults)
  }, [archetypeDef, handleWorkflowChange])

  // Track which component types have been explicitly configured
  const [configuredTypes, setConfiguredTypes] = useState<Set<string>>(new Set())

  // Module count (depth-1 nodes) — used by video form's "customize per module"
  const moduleCount = useMemo(() => depthCounts[1] ?? 0, [depthCounts])

  // Extract initial config for a component type from existing NodeComponent records
  const getInitialConfig = useCallback((componentType: string): Record<string, unknown> => {
    if (!flatNodes) return {}
    // Find the first component of this type and use its config as the initial value
    for (const node of flatNodes) {
      for (const comp of node.components) {
        if (comp.componentType === componentType && comp.config && Object.keys(comp.config).length > 0) {
          return comp.config as Record<string, unknown>
        }
      }
    }
    return {}
  }, [flatNodes])

  // Save component config via PATCH /api/blueprints/[id]/components
  const handleConfigSave = useCallback(async (
    componentType: string,
    config: Record<string, unknown>,
    applyToAll: boolean,
  ) => {
    if (!blueprint) return
    setSaveError(null)

    try {
      const res = await fetch(`/api/blueprints/${blueprint.id}/components`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            componentType,
            config,
            applyToAll,
          }],
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Save failed (${res.status})` }))
        const message = (body as { error?: string }).error ?? `Save failed (${res.status})`
        setSaveError(message)
        throw new Error(message)
      }

      setConfiguredTypes(prev => new Set([...prev, componentType]))
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('Save failed')) {
        setSaveError('Network error — config was not saved')
      }
      throw err
    }
  }, [blueprint])

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track save status from workflow changes
  useEffect(() => {
    if (saveTimerRef.current) {
      setSaveStatus('saving')
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    }
  }, [workflowTemplate])

  // Show "saved" briefly after successful save
  const originalHandleWorkflowChange = handleWorkflowChange
  // We'll track save completion via the saveError state clearing

  const currentPhase = blueprint?.ideationPhase ?? 'brainstorm'
  const loading = blueprintLoading || nodesLoading

  // Loading state
  if (blueprintLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-2">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
        <span className="text-sm text-muted-foreground">Loading configuration...</span>
      </main>
    )
  }

  // Error state
  if (blueprintError) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Link
            href={`/project/${projectId}`}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to Project
          </Link>
          <ErrorBanner
            message={blueprintError}
            onRetry={() => window.location.reload()}
            variant="card"
          />
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </Link>
        <Breadcrumbs crumbs={[
          { label: 'Project', href: `/project/${projectId}` },
          { label: 'Configure' },
        ]} />
        <Badge variant="outline" className="ml-1 text-xs capitalize">
          {blueprint?.archetype?.replace('_', ' ')}
        </Badge>
      </div>

      {/* PC Navigation */}
      <PcNav projectId={projectId} currentPhase={currentPhase} />

      {/* Wizard content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="mx-auto w-full max-w-3xl px-4 py-8">
            <WizardStepSkeleton />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-5">
            {/* Step indicator */}
            <WizardStepper
              steps={wizardSteps}
              currentStep={currentStep}
              onStepClick={handleStepClick}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />

            {/* Save error banner */}
            {saveError && (
              <div className="mt-3">
                <ErrorBanner
                  message={saveError}
                  onDismiss={() => setSaveError(null)}
                />
              </div>
            )}

            {/* Step content */}
            <div className="mt-5 flex-1 overflow-y-auto pb-6">
              {/* Step 0: Overview */}
              {currentStep === 0 && archetypeDef && (
                <WizardStepOverview
                  archetype={archetypeDef}
                  totalNodes={totalNodes}
                  depthCounts={depthCounts}
                  componentCounts={componentCounts}
                  totalComponents={totalComponents}
                  componentDefs={enabledComponentDefs}
                  costRange={costRange}
                  onApplyDefaults={handleApplyDefaults}
                />
              )}

              {/* Step 1: Production Workflow */}
              {currentStep === 1 && archetypeDef && effectiveWorkflow && (
                <WizardStepWorkflow
                  archetype={archetypeDef}
                  workflowTemplate={effectiveWorkflow}
                  onChange={handleWorkflowChange}
                />
              )}

              {/* Steps 2..N-2: Component config forms */}
              {currentStep > 1 && currentStep < wizardSteps.length - 1 && blueprint && (() => {
                const step = wizardSteps[currentStep]
                const compType = step.componentType
                if (!compType) return null
                const compDef = COMPONENT_REGISTRY[compType]
                if (!compDef) return null
                const count = step.instanceCount ?? 0
                const initialConfig = getInitialConfig(compType)

                switch (compType) {
                  case 'video':
                  case 'video_short':
                    return (
                      <WizardStepVideo
                        blueprintId={blueprint.id}
                        instanceCount={count}
                        moduleCount={moduleCount}
                        initialConfig={initialConfig}
                        onSave={async (config, applyToAll) => {
                          await handleConfigSave(compType, { ...config }, applyToAll)
                        }}
                      />
                    )
                  case 'quiz':
                  case 'pre_assessment':
                  case 'post_assessment':
                    return (
                      <WizardStepQuiz
                        blueprintId={blueprint.id}
                        instanceCount={count}
                        initialConfig={initialConfig}
                        onSave={async (config, applyToAll) => {
                          await handleConfigSave(compType, { ...config }, applyToAll)
                        }}
                      />
                    )
                  case 'study_material':
                    return (
                      <WizardStepStudyMaterial
                        blueprintId={blueprint.id}
                        instanceCount={count}
                        initialConfig={initialConfig}
                        onSave={async (config, applyToAll) => {
                          await handleConfigSave(compType, { ...config }, applyToAll)
                        }}
                      />
                    )
                  case 'activity':
                  case 'scenario_exercise':
                    return (
                      <WizardStepActivity
                        blueprintId={blueprint.id}
                        instanceCount={count}
                        initialConfig={initialConfig}
                        onSave={async (config, applyToAll) => {
                          await handleConfigSave(compType, { ...config }, applyToAll)
                        }}
                      />
                    )
                  default:
                    return (
                      <WizardStepGeneric
                        blueprintId={blueprint.id}
                        componentDef={compDef}
                        instanceCount={count}
                        initialConfig={initialConfig}
                        onSave={async (config, applyToAll) => {
                          await handleConfigSave(compType, config, applyToAll)
                        }}
                      />
                    )
                }
              })()}

              {/* Last step: Review & Confirm */}
              {currentStep === wizardSteps.length - 1 && archetypeDef && effectiveWorkflow && (
                <WizardStepReview
                  projectId={projectId}
                  projectName={blueprint?.project?.name ?? 'Untitled Project'}
                  targetAudience={blueprint?.project?.targetAudience ?? ''}
                  archetype={archetypeDef}
                  workflowTemplate={effectiveWorkflow}
                  componentDefs={enabledComponentDefs}
                  componentCounts={componentCounts}
                  totalNodes={totalNodes}
                  totalComponents={totalComponents}
                  depthCounts={depthCounts}
                  costRange={costRange}
                  configuredTypes={configuredTypes}
                  ideationScore={blueprint?.ideationScore ?? null}
                  flatNodes={flatNodes ?? null}
                  onGoToStep={handleStepClick}
                  onWorkflowChange={handleWorkflowChange}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
