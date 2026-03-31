'use client'

import { use, useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  FileText,
  HelpCircle,
  Loader2,
  Package,
  Play,
  Puzzle,
  Rocket,
  Trophy,
  Video,
  BookOpen,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/hooks/use-api'
import { PcNav } from '@/components/project-component/shared/pc-nav'
import { estimateProjectCost } from '@/lib/project-component/production/cost-estimator'
import type { CostEstimate } from '@/lib/project-component/production/cost-estimator'
import type { IdeationPhase, WorkflowTemplate } from '@/lib/project-component'

// ─── API Response Types ─────────────────────────────────────────────────────

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

interface NodeResponse {
  id: string
  depth: number
  components: {
    id: string
    componentType: string
    status: string
  }[]
}

interface HandoffApiResponse {
  success: boolean
  data: {
    totalJobs: number
    jobsByPhase: {
      documents: number
      assessments: number
      videos: number
      activities: number
      capstone: number
      meta: number
    }
    videoBatchCount: number
    estimatedCost: CostEstimate
    createdSessionIds: string[]
  }
}

// ─── Phase icons ────────────────────────────────────────────────────────────

const PHASE_ICONS: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  Documents: FileText,
  Assessments: HelpCircle,
  Videos: Video,
  Activities: Puzzle,
  Capstone: Trophy,
  Meta: BookOpen,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCost(min: number, max: number): string {
  if (min === max) return `$${min.toFixed(2)}`
  return `$${min.toFixed(2)} – $${max.toFixed(2)}`
}

function buildJobSummary(
  jobsByPhase: HandoffApiResponse['data']['jobsByPhase'],
  batchCount: number,
): string {
  const parts: string[] = []
  if (jobsByPhase.documents > 0) parts.push(`${jobsByPhase.documents} documents`)
  if (jobsByPhase.assessments > 0) parts.push(`${jobsByPhase.assessments} assessments`)
  if (jobsByPhase.videos > 0) {
    const batchNote = batchCount > 0 ? ` (${batchCount} batch${batchCount > 1 ? 'es' : ''})` : ''
    parts.push(`${jobsByPhase.videos} videos${batchNote}`)
  }
  if (jobsByPhase.activities > 0) parts.push(`${jobsByPhase.activities} activities`)
  if (jobsByPhase.capstone > 0) parts.push(`${jobsByPhase.capstone} capstone`)
  if (jobsByPhase.meta > 0) parts.push(`${jobsByPhase.meta} meta`)
  return parts.join(', ')
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function LaunchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)

  const [handoffResult, setHandoffResult] = useState<HandoffApiResponse['data'] | null>(null)
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffError, setHandoffError] = useState<string | null>(null)

  // Fetch blueprint
  const {
    data: blueprint,
    loading: bpLoading,
    error: bpError,
  } = useApi<BlueprintResponse>(`/api/blueprints?projectId=${projectId}`)

  // Fetch nodes with components
  const blueprintId = blueprint?.id
  const {
    data: nodes,
    loading: nodesLoading,
  } = useApi<NodeResponse[]>(
    blueprintId ? `/api/blueprints/${blueprintId}/nodes` : '/api/__skip__',
    { skip: !blueprintId },
  )

  // Compute cost estimate from eligible components
  const costEstimate = useMemo<CostEstimate | null>(() => {
    if (!nodes) return null
    const types: string[] = []
    for (const node of nodes) {
      for (const comp of node.components) {
        if (comp.status !== 'planned' && comp.status !== 'configured') continue
        types.push(comp.componentType)
      }
    }
    return types.length > 0 ? estimateProjectCost(types) : null
  }, [nodes])

  // Execute handoff
  const handleHandoff = useCallback(async () => {
    if (!blueprintId) return
    setHandoffLoading(true)
    setHandoffError(null)

    try {
      const res = await fetch('/api/project-component/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setHandoffError(json.error ?? `Handoff failed (${res.status})`)
        return
      }
      setHandoffResult(json.data)
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setHandoffLoading(false)
    }
  }, [blueprintId])

  // ── Loading ─────────────────────────────────────────────────────────────
  if (bpLoading || nodesLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      </main>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (bpError || !blueprint) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-sm text-destructive">{bpError ?? 'Blueprint not found'}</p>
        </div>
      </main>
    )
  }

  const componentCount = costEstimate?.totalComponents ?? 0

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PcNav projectId={projectId} currentPhase={blueprint.ideationPhase} />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/project/${projectId}/configure`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to Configuration
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Production Handoff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the production plan and launch {componentCount} component{componentCount !== 1 ? 's' : ''} into the pipeline.
          </p>
        </div>

        {/* ── Pre-handoff: cost estimate + plan + button ──────── */}
        {!handoffResult && (
          <>
            {/* Cost Estimate */}
            {costEstimate && (
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign size={16} className="text-green-600" />
                    Estimated Cost
                  </CardTitle>
                  <CardDescription>
                    {formatCost(costEstimate.total.min, costEstimate.total.max)} for {costEstimate.totalComponents} components
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {costEstimate.byPhase.map((phase) => {
                      const Icon = PHASE_ICONS[phase.phase] ?? Package
                      return (
                        <div key={phase.phase} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Icon size={14} />
                            {phase.phase}
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              {phase.componentCount}
                            </Badge>
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatCost(phase.cost.min, phase.cost.max)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Production Plan */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package size={16} />
                  Production Plan
                </CardTitle>
                <CardDescription>
                  Components produced in dependency order: Documents &rarr; Assessments &rarr; Videos &rarr; Activities &rarr; Capstone
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costEstimate ? (
                  <div className="space-y-1.5">
                    {costEstimate.byType.map((t) => (
                      <div key={t.componentType} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t.name}</span>
                        <Badge variant="outline" className="tabular-nums text-xs">
                          x{t.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No eligible components found.</p>
                )}
              </CardContent>
            </Card>

            {/* Execute Button */}
            <div className="flex flex-col items-center gap-3">
              <Button
                size="lg"
                onClick={handleHandoff}
                disabled={handoffLoading || componentCount === 0}
                className="gap-2"
              >
                {handoffLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating production jobs...
                  </>
                ) : (
                  <>
                    <Rocket size={16} />
                    Execute Handoff
                  </>
                )}
              </Button>

              {handoffError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Handoff failed</p>
                    <p className="mt-0.5 text-xs">{handoffError}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Post-handoff: success result ────────────────────── */}
        {handoffResult && (
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-3 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
                <CheckCircle2 size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-lg">Production Launched</CardTitle>
              <CardDescription>
                Created {handoffResult.totalJobs} production job{handoffResult.totalJobs !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                {buildJobSummary(handoffResult.jobsByPhase, handoffResult.videoBatchCount)}
              </p>

              {/* Phase breakdown */}
              <div className="space-y-2 rounded-md border p-3">
                {Object.entries(handoffResult.jobsByPhase)
                  .filter(([, count]) => count > 0)
                  .map(([phase, count]) => {
                    const label = phase.charAt(0).toUpperCase() + phase.slice(1)
                    const Icon = PHASE_ICONS[label] ?? Package
                    return (
                      <div key={phase} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Icon size={14} className="text-muted-foreground" />
                          {label}
                        </span>
                        <Badge variant="secondary" className="tabular-nums">
                          {count} job{count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )
                  })}
              </div>

              {/* Cost */}
              <p className="text-center text-sm text-muted-foreground">
                Estimated cost: {formatCost(
                  handoffResult.estimatedCost.total.min,
                  handoffResult.estimatedCost.total.max,
                )}
              </p>

              {/* Link to dashboard */}
              <div className="flex justify-center pt-2">
                <Link href={`/project/${projectId}`}>
                  <Button variant="outline" className="gap-2">
                    <Play size={14} />
                    Go to Project Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
