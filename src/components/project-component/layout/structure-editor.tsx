'use client'

import { useState, useCallback } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TreeView } from '@/components/project-component/canvas/tree-view'
import { NodeDetailPanel } from '@/components/project-component/canvas/node-detail'
import { EmptyState } from '@/components/project-component/shared/empty-state'
import { useApi } from '@/lib/hooks/use-api'
import type { ProjectNodeType, ProposedStructure } from '@/lib/project-component'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StructureEditorProps {
  blueprintId: string
  projectName: string
  archetype: string | null
  isMaterialized: boolean
  proposedStructure: ProposedStructure | null
  onMaterialize: () => Promise<void>
  materializeLoading: boolean
}

// ─── Tree Builder ──────────────────────────────────────────────────────────────

/** Build nested tree from flat node array (API returns flat). */
function buildTree(nodes: ProjectNodeType[]): ProjectNodeType[] {
  const map = new Map<string, ProjectNodeType & { children: ProjectNodeType[] }>()
  const roots: (ProjectNodeType & { children: ProjectNodeType[] })[] = []

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] })
  }
  for (const node of nodes) {
    const mapped = map.get(node.id)!
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(mapped)
    } else {
      roots.push(mapped)
    }
  }
  return roots
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function StructureEditor({
  blueprintId,
  projectName,
  archetype,
  isMaterialized,
  proposedStructure,
  onMaterialize,
  materializeLoading,
}: StructureEditorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Fetch real nodes only when materialized
  const {
    data: nodes,
    loading: nodesLoading,
    refetch: refetchNodes,
  } = useApi<ProjectNodeType[]>(
    isMaterialized ? `/api/blueprints/${blueprintId}/nodes` : '',
    { skip: !isMaterialized }
  )

  const handleMutated = useCallback(async () => {
    await refetchNodes()
  }, [refetchNodes])

  const selectedNode = nodes?.find(n => n.id === selectedNodeId) ?? null
  const tree = buildTree(nodes ?? [])

  // ── PROPOSED MODE (not materialized) ──────────────────────────────────────

  if (!isMaterialized) {
    return (
      <div className="flex h-full flex-col">
        {/* Materialize banner */}
        <div className="border-b bg-amber-500/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Proposed Structure
              </p>
              <p className="text-xs text-muted-foreground">
                Materialize to enable editing, adding nodes, and managing components.
              </p>
            </div>
            <Button
              size="sm"
              onClick={onMaterialize}
              disabled={materializeLoading || !proposedStructure}
              className="shrink-0 bg-amber-600 text-white hover:bg-amber-700"
            >
              {materializeLoading ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Wand2 size={14} className="mr-2" />
              )}
              Materialize &amp; Edit
            </Button>
          </div>
        </div>

        {/* Read-only proposed structure preview */}
        <div className="flex-1 overflow-y-auto p-4">
          {proposedStructure?.modules?.length ? (
            proposedStructure.modules.map((mod, mi) => (
              <div key={mi} className="mb-3">
                <p className="text-sm font-medium">{mod.title}</p>
                {mod.description && (
                  <p className="text-xs text-muted-foreground">{mod.description}</p>
                )}
                {mod.topics?.map((topic, ti) => (
                  <div key={ti} className="ml-4 mt-1">
                    <p className="text-xs text-muted-foreground">&bull; {topic.title}</p>
                    {topic.subtopics?.map((sub, si) => (
                      <p key={si} className="ml-4 text-xs text-muted-foreground/70">
                        - {typeof sub === 'string' ? sub : (sub as { title: string }).title}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ))
          ) : (
            <EmptyState
              icon={Wand2}
              title="No structure proposed yet"
              description="Structure will appear once agents design the course."
            />
          )}
        </div>
      </div>
    )
  }

  // ── MATERIALIZED MODE (full editor) ───────────────────────────────────────

  if (nodesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    )
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <EmptyState
          icon={Wand2}
          title="No nodes found"
          description="The structure was materialized but no nodes were created."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Tree view — left half */}
      <div className="w-1/2 overflow-y-auto border-r">
        <TreeView
          tree={tree}
          projectName={projectName}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      </div>

      {/* Node detail — right half */}
      <div className="w-1/2 overflow-y-auto">
        <NodeDetailPanel
          node={selectedNode}
          blueprintId={blueprintId}
          archetype={archetype ?? 'professional_training'}
          flatNodes={nodes}
          onMutated={handleMutated}
        />
      </div>
    </div>
  )
}
