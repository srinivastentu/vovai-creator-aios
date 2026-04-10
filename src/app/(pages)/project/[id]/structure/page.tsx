'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FolderClosed, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/hooks/use-api'
import { PcNav } from '@/components/project-component/shared/pc-nav'
import { Breadcrumbs } from '@/components/project-component/shared/breadcrumbs'
import { ErrorBanner } from '@/components/project-component/shared/error-banner'
import { EmptyState } from '@/components/project-component/shared/empty-state'
import { TreeSkeleton, NodeDetailSkeleton } from '@/components/project-component/shared/skeleton-loader'
import { TreeView } from '@/components/project-component/canvas/tree-view'
import { NodeCountBarExtended } from '@/components/project-component/canvas/node-count-bar'
import { NodeDetailPanel } from '@/components/project-component/canvas/node-detail'
import { ComponentPalette } from '@/components/project-component/canvas/component-palette'
import { RubricScoreBar } from '@/components/project-component/canvas/rubric-score-bar'
import { GradeReportModal } from '@/components/project-component/canvas/grade-report-modal'
import { AgentChatDrawer } from '@/components/project-component/canvas/agent-chat-drawer'
import { buildTree, findNode } from '@/lib/domain/workflows'
import type { IdeationPhase, ProjectNodeType, GradeRecommendation, DimensionGradeScore } from '@/lib/domain/workflows'

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
    const updatedNodes = await refetchNodes()
    setStructureChanged(true)
    setGradeOverride(null)
    // Clear selection if the selected node was deleted — use refetched data, not stale closure
    setSelectedNodeId(prev => {
      if (!prev) return prev
      const stillExists = updatedNodes?.some(n => n.id === prev)
      return stillExists ? prev : null
    })
  }, [refetchNodes])

  // Re-grade handler: update grade and clear changed indicator
  const handleReGraded = useCallback((newGrade: GradeResponse) => {
    setGradeOverride(newGrade)
    setStructureChanged(false)
  }, [])

  const currentPhase = blueprint?.ideationPhase ?? 'brainstorm'
  const loading = blueprintLoading || nodesLoading

  // Mobile bottom sheet for node detail
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  // Open bottom sheet when node is selected on mobile
  useEffect(() => {
    if (selectedNodeId) setMobileDetailOpen(true)
  }, [selectedNodeId])

  // Loading state
  if (blueprintLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-2">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
        <span className="text-sm text-muted-foreground">Loading structure...</span>
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
          { label: 'Structure' },
        ]} />
        <Badge variant="outline" className="ml-1 text-xs capitalize">
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
            <TreeSkeleton />
          ) : nodesError ? (
            <ErrorBanner
              message={nodesError}
              onRetry={() => refetchNodes()}
              variant="card"
            />
          ) : tree.length === 0 ? (
            <EmptyState
              icon={FolderClosed}
              title="Your project structure will appear here after ideation"
              description="Go to the Ideation tab to brainstorm your project structure with AI agents."
            />
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

        {/* Right panel — node detail (desktop) */}
        <div className="hidden flex-col md:flex md:w-[35%]">
          {nodesLoading ? (
            <NodeDetailSkeleton />
          ) : (
            <NodeDetailPanel
              key={selectedNodeId}
              node={selectedNode}
              blueprintId={blueprint?.id ?? ''}
              archetype={blueprint?.archetype ?? 'professional_training'}
              flatNodes={flatNodes ?? []}
              onMutated={handleNodesMutated}
            />
          )}
        </div>
      </div>

      {/* Mobile bottom sheet for node detail */}
      {mobileDetailOpen && selectedNode && (
        <div className="fixed inset-0 z-20 md:hidden">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setMobileDetailOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-xl border-t bg-background shadow-lg">
            <div className="sticky top-0 flex items-center justify-between border-b bg-background px-4 py-2">
              <span className="text-sm font-medium">{selectedNode.title}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMobileDetailOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>
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
      )}

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
