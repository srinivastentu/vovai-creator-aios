'use client'

import { use, useCallback, useMemo, useState } from 'react'
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
import { RubricScoreBar } from '@/components/project-component/canvas/rubric-score-bar'
import { GradeReportModal } from '@/components/project-component/canvas/grade-report-modal'
import { AgentChatDrawer } from '@/components/project-component/canvas/agent-chat-drawer'
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

// ─── Page Component ─────────────────────────────────────────────────────────

export default function StructurePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: projectId } = use(params)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [structureChanged, setStructureChanged] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [gradeOverride, setGradeOverride] = useState<GradeResponse | null>(null)

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

  // Effective grade — use override if available, else fetched
  const effectiveGrade = gradeOverride ?? grade

  // Mutation handler: refetch nodes + mark structure as changed
  const handleNodesMutated = useCallback(async () => {
    await refetchNodes()
    setStructureChanged(true)
  }, [refetchNodes])

  // Re-grade handler: update grade and clear changed indicator
  const handleReGraded = useCallback((newGrade: GradeResponse) => {
    setGradeOverride(newGrade)
    setStructureChanged(false)
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
            onMutated={handleNodesMutated}
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
            onMutated={handleNodesMutated}
          />
        </div>
      </div>

      {/* Rubric score bar (bottom) */}
      {!gradeLoading && effectiveGrade && (
        <RubricScoreBar
          grade={effectiveGrade}
          blueprintId={blueprint?.id ?? ''}
          structureChanged={structureChanged}
          onReGraded={handleReGraded}
          onViewReport={() => setReportOpen(true)}
        />
      )}

      {/* Grade report modal */}
      {effectiveGrade && (
        <GradeReportModal
          open={reportOpen}
          onOpenChange={setReportOpen}
          grade={effectiveGrade}
        />
      )}

      {/* Agent chat drawer */}
      {blueprint && <AgentChatDrawer blueprintId={blueprint.id} />}
    </main>
  )
}
