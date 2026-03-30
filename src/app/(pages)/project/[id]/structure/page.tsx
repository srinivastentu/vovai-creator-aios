'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useApi } from '@/lib/hooks/use-api'
import { PcNav } from '@/components/project-component/shared/pc-nav'
import { TreeView } from '@/components/project-component/canvas/tree-view'
import { NodeCountBarExtended } from '@/components/project-component/canvas/node-count-bar'
import { NodeDetailPanel } from '@/components/project-component/canvas/node-detail'
import { ComponentPalette } from '@/components/project-component/canvas/component-palette'
import { buildTree, findNode } from '@/lib/project-component'
import type { IdeationPhase, ProjectNodeType, GradeRecommendation, DimensionGradeScore } from '@/lib/project-component'

// ─── API Response Types ────────────────────────────────────────────────────

interface BlueprintResponse {
  id: string
  projectId: string
  archetype: string
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

interface GradeResponse {
  id: string
  blueprintId: string
  overallScore: number
  dimensionScores: DimensionGradeScore[]
  recommendation: GradeRecommendation
  feedback: string | null
  createdAt: string
}

// ─── Rubric Score Bar ──────────────────────────────────────────────────────

const RECOMMENDATION_STYLES: Record<GradeRecommendation, { bg: string; text: string; label: string }> = {
  approve: { bg: 'bg-green-500', text: 'text-green-700 dark:text-green-300', label: 'Approve' },
  revise: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', label: 'Revise' },
  restructure: { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', label: 'Restructure' },
  reject: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-300', label: 'Reject' },
}

function RubricScoreBar({ grade }: { grade: GradeResponse }) {
  const pct = Math.min(grade.overallScore, 100)
  const style = RECOMMENDATION_STYLES[grade.recommendation] ?? RECOMMENDATION_STYLES.revise

  return (
    <div className="border-t bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Rubric Score</span>

        {/* Progress bar */}
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${style.bg}`}
            style={{ width: `${pct}%` }}
          />
          {/* 75 threshold marker */}
          <div
            className="absolute inset-y-0 w-px bg-foreground/30"
            style={{ left: '75%' }}
            title="Pass threshold: 75"
          />
        </div>

        {/* Score */}
        <span className="text-sm font-semibold tabular-nums">
          {grade.overallScore.toFixed(2)}
          <span className="text-muted-foreground">/100</span>
        </span>

        {/* Recommendation badge */}
        <Badge
          variant="outline"
          className={`text-xs ${style.text}`}
        >
          {style.label}
        </Badge>
      </div>

      {/* Dimension scores (collapsed row) */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {grade.dimensionScores.map((dim) => {
          const passing = dim.score >= dim.passThreshold
          return (
            <span
              key={dim.id}
              className={`text-[11px] ${passing ? 'text-muted-foreground' : 'text-destructive'}`}
              title={dim.feedback}
            >
              {dim.name}: <span className="font-medium tabular-nums">{dim.score}</span>
              {!passing && <span className="ml-0.5">!</span>}
            </span>
          )
        })}
      </div>

      {/* Feedback */}
      {grade.feedback && (
        <p className="mt-2 text-xs text-muted-foreground">{grade.feedback}</p>
      )}
    </div>
  )
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function StructurePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

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
    error: nodesError,
    refetch: refetchNodes,
  } = useApi<ProjectNodeType[]>(nodesUrl, { skip: !blueprint })

  // Fetch latest grade (depends on blueprint)
  const gradeUrl = blueprint ? `/api/blueprints/${blueprint.id}/grades` : ''
  const {
    data: grade,
    loading: gradeLoading,
  } = useApi<GradeResponse | null>(gradeUrl, { skip: !blueprint })

  // Build tree from flat nodes
  const tree = useMemo(() => (flatNodes ? buildTree(flatNodes) : []), [flatNodes])

  // Compute depth-level counts
  const depthCounts = useMemo(() => {
    if (!flatNodes) return { modules: 0, topics: 0, subtopics: 0, totalComponents: 0 }
    let modules = 0
    let topics = 0
    let subtopics = 0
    let totalComponents = 0
    for (const node of flatNodes) {
      if (node.depth === 0) modules++
      else if (node.depth === 1) topics++
      else if (node.depth >= 2) subtopics++
      totalComponents += node.components.length
    }
    return { modules, topics, subtopics, totalComponents }
  }, [flatNodes])

  // Find selected node in tree
  const selectedNode = useMemo(
    () => (selectedNodeId && tree.length > 0 ? findNode(tree, selectedNodeId) : null),
    [selectedNodeId, tree]
  )

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
        <div className="mx-auto max-w-6xl px-4 py-8">
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
        <h1 className="text-sm font-medium">Structure Editor</h1>
        <Badge variant="outline" className="text-xs capitalize">
          {blueprint?.archetype?.replace('_', ' ')}
        </Badge>
      </div>

      {/* PC Navigation */}
      <PcNav projectId={projectId} currentPhase={currentPhase} />

      {/* Main layout: palette + tree + detail panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — component palette */}
        <div className="hidden w-[220px] shrink-0 flex-col md:flex">
          <ComponentPalette
            archetype={blueprint?.archetype ?? 'professional_training'}
            selectedNode={selectedNode}
            blueprintId={blueprint?.id ?? ''}
            flatNodes={flatNodes ?? []}
            onMutated={refetchNodes}
          />
        </div>

        {/* Center panel — tree visualization */}
        <div className="flex w-full flex-col md:flex-1">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          ) : nodesError ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-destructive">{nodesError}</p>
            </div>
          ) : (
            <TreeView
              tree={tree}
              projectName={blueprint?.project.name ?? 'Untitled Project'}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          )}

          {/* Node count bar */}
          {!loading && flatNodes && flatNodes.length > 0 && (
            <NodeCountBarExtended
              modules={depthCounts.modules}
              topics={depthCounts.topics}
              subtopics={depthCounts.subtopics}
              totalComponents={depthCounts.totalComponents}
            />
          )}
        </div>

        {/* Right panel — node detail */}
        <div className="hidden flex-col md:flex md:w-[35%]">
          <NodeDetailPanel
            key={selectedNodeId}
            node={selectedNode}
            blueprintId={blueprint?.id ?? ''}
            archetype={blueprint?.archetype ?? 'professional_training'}
            flatNodes={flatNodes ?? []}
            onMutated={refetchNodes}
          />
        </div>
      </div>

      {/* Rubric score bar (bottom) */}
      {!gradeLoading && grade && <RubricScoreBar grade={grade} />}
    </main>
  )
}
