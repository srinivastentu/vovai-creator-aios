'use client'

import { use, useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useApi } from '@/lib/hooks/use-api'
import { PcNav } from '@/components/project-component/shared/pc-nav'
import { WizardStepper, generateWizardSteps } from '@/components/project-component/wizard/wizard-stepper'
import { WizardStepOverview } from '@/components/project-component/wizard/wizard-step-overview'
import {
  getArchetype,
  COMPONENT_REGISTRY,
} from '@/lib/project-component'
import type {
  IdeationPhase,
  ProjectNodeType,
  ComponentDefinition,
} from '@/lib/project-component'

// ─── API Response Types ────────────────────────────────────────────────────

interface BlueprintResponse {
  id: string
  projectId: string
  archetype: string
  enabledComponents: string[]
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
  const [applyingDefaults, setApplyingDefaults] = useState(false)

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

  // Compute component instance counts from actual nodes
  const componentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!flatNodes) return counts
    for (const node of flatNodes) {
      for (const comp of node.components) {
        counts[comp.componentType] = (counts[comp.componentType] ?? 0) + 1
      }
    }
    return counts
  }, [flatNodes])

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
    const enabled = blueprint?.enabledComponents ?? []
    return enabled
      .map(type => COMPONENT_REGISTRY[type])
      .filter((d): d is ComponentDefinition => d !== undefined)
  }, [blueprint?.enabledComponents])

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
      blueprint?.enabledComponents ?? [],
      enabledComponentDefs,
      componentCounts,
    ),
    [blueprint?.enabledComponents, enabledComponentDefs, componentCounts],
  )

  // Step navigation
  const handleStepClick = useCallback((idx: number) => {
    if (idx < currentStep) setCurrentStep(idx)
  }, [currentStep])

  const handleNext = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, wizardSteps.length - 1))
  }, [wizardSteps.length])

  const handlePrevious = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }, [])

  // Apply archetype defaults handler
  const handleApplyDefaults = useCallback(() => {
    setApplyingDefaults(true)
    // TODO (PC-8.2): Apply default configs from registry to all component instances
    setTimeout(() => setApplyingDefaults(false), 500)
  }, [])

  const currentPhase = blueprint?.ideationPhase ?? 'brainstorm'
  const loading = blueprintLoading || nodesLoading

  // Loading state
  if (blueprintLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
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
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">{blueprintError}</p>
            </CardContent>
          </Card>
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
        <h1 className="text-sm font-medium">Configuration Wizard</h1>
        <Badge variant="outline" className="text-xs capitalize">
          {blueprint?.archetype?.replace('_', ' ')}
        </Badge>
      </div>

      {/* PC Navigation */}
      <PcNav projectId={projectId} currentPhase={currentPhase} />

      {/* Wizard content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
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
                  applyingDefaults={applyingDefaults}
                />
              )}

              {/* Steps 1..N-2: Component config forms (PC-8.2) */}
              {currentStep > 0 && currentStep < wizardSteps.length - 1 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      {wizardSteps[currentStep].label} configuration form
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Coming in PC-8.2 &mdash; {wizardSteps[currentStep].instanceCount} instance
                      {(wizardSteps[currentStep].instanceCount ?? 0) !== 1 ? 's' : ''} to configure
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Last step: Review & Confirm */}
              {currentStep === wizardSteps.length - 1 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Review &amp; Confirm — summary and launch
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Coming in PC-8.2
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
