'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Loader2, RotateCw, TreePine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/lib/hooks/use-api'
import type { ProposedStructure } from '@/lib/project-component'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeComponent {
  id: string
  componentType: string
}

interface ApiNode {
  id: string
  parentId: string | null
  title: string
  depth: number
  sortOrder: number
  components: NodeComponent[]
}

interface TreeNodeData {
  id: string
  title: string
  depth: number
  components: NodeComponent[]
  children: TreeNodeData[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPONENT_ICONS: Record<string, string> = {
  video: '\uD83C\uDFA5',
  video_short: '\uD83C\uDFA5',
  study_material: '\uD83D\uDCDD',
  practice_worksheet: '\uD83D\uDCDD',
  quiz: '\u2705',
  pre_assessment: '\u2705',
  post_assessment: '\u2705',
  activity: '\uD83C\uDFAF',
  scenario_exercise: '\uD83C\uDFAF',
  capstone_project: '\uD83C\uDFC6',
  flashcards: '\uD83D\uDCCB',
  glossary: '\uD83D\uDCD6',
  resource_library: '\uD83D\uDCDA',
  mentor_checklist: '\uD83D\uDCCB',
  discussion_prompt: '\uD83D\uDCAC',
}

function getComponentIcon(type: string): string {
  return COMPONENT_ICONS[type] ?? '\uD83D\uDCE6'
}

// ─── Build tree from flat list ────────────────────────────────────────────────

function buildTreeFromNodes(nodes: ApiNode[]): TreeNodeData[] {
  const map = new Map<string, TreeNodeData>()
  const roots: TreeNodeData[] = []

  // Create tree node for each API node
  for (const node of nodes) {
    map.set(node.id, {
      id: node.id,
      title: node.title,
      depth: node.depth,
      components: node.components,
      children: [],
    })
  }

  // Link children to parents
  for (const node of nodes) {
    const treeNode = map.get(node.id)!
    if (node.parentId) {
      const parent = map.get(node.parentId)
      if (parent) {
        parent.children.push(treeNode)
      } else {
        roots.push(treeNode)
      }
    } else {
      roots.push(treeNode)
    }
  }

  return roots
}

// ─── Component Badge ──────────────────────────────────────────────────────────

function ComponentBadges({ components }: { components: NodeComponent[] }) {
  if (components.length === 0) return null

  // Group by type
  const grouped = new Map<string, number>()
  for (const c of components) {
    grouped.set(c.componentType, (grouped.get(c.componentType) ?? 0) + 1)
  }

  return (
    <span className="ml-auto flex items-center gap-1 text-[10px]">
      {Array.from(grouped.entries()).map(([type, count]) => (
        <span key={type} title={`${count} ${type.replace(/_/g, ' ')}`}>
          {getComponentIcon(type)}{count}
        </span>
      ))}
    </span>
  )
}

// ─── Tooltip (hover popover) ──────────────────────────────────────────────────

function NodeTooltip({ node }: { node: TreeNodeData }) {
  const depthLabels = ['Course', 'Module', 'Topic', 'Subtopic']
  const depthLabel = depthLabels[node.depth] ?? `Depth ${node.depth}`

  return (
    <div className="absolute left-full top-0 z-20 ml-2 w-48 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">{node.title}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{depthLabel}</p>
      {node.components.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {node.components.map((c) => (
            <span key={c.id} className="text-[10px] text-muted-foreground">
              {getComponentIcon(c.componentType)} {c.componentType.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      {node.components.length === 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground italic">No components</p>
      )}
    </div>
  )
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

function TreeNodeItem({ node, defaultExpanded }: { node: TreeNodeData; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showTooltip, setShowTooltip] = useState(false)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className="group relative flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted/50"
        style={{ paddingLeft: `${node.depth * 12 + 4}px` }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted"
          >
            {expanded ? (
              <ChevronDown size={12} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={12} className="text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}

        {/* Title */}
        <span className="flex-1 truncate">{node.title}</span>

        {/* Component badges */}
        <ComponentBadges components={node.components} />

        {/* Tooltip */}
        {showTooltip && <NodeTooltip node={node} />}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem key={child.id} node={child} defaultExpanded={child.depth < 2} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stats Footer ─────────────────────────────────────────────────────────────

interface TreeStats {
  modules: number
  topics: number
  components: number
}

function computeStats(nodes: ApiNode[]): TreeStats {
  let modules = 0
  let topics = 0
  let components = 0

  for (const node of nodes) {
    if (node.depth === 1) modules++
    if (node.depth === 2) topics++
    components += node.components.length
  }

  return { modules, topics, components }
}

// ─── Convert ProposedStructure → TreeNodeData ───────────────────────────────

function buildTreeFromProposed(proposed: ProposedStructure): TreeNodeData[] {
  return proposed.modules.map((mod, mi) => ({
    id: `proposed-mod-${mi}`,
    title: mod.title,
    depth: 1,
    components: [],
    children: mod.topics.map((topic, ti) => ({
      id: `proposed-topic-${mi}-${ti}`,
      title: topic.title,
      depth: 2,
      components: [],
      children: (topic.subtopics ?? []).map((sub, si) => ({
        id: `proposed-sub-${mi}-${ti}-${si}`,
        title: sub,
        depth: 3,
        components: [],
        children: [],
      })),
    })),
  }))
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StructurePreviewProps {
  blueprintId: string | null
  projectId: string
  /** Increment this to trigger a refetch */
  refreshKey?: number
  /** Proposed structure from agent messages — shown when no DB nodes exist */
  proposedStructure?: ProposedStructure | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StructurePreview({ blueprintId, projectId, refreshKey = 0, proposedStructure = null }: StructurePreviewProps) {
  const url = blueprintId ? `/api/blueprints/${blueprintId}/nodes` : ''
  const {
    data: nodes,
    loading,
    refetch,
  } = useApi<ApiNode[]>(url, { skip: !blueprintId })

  // Track refreshKey to trigger refetches
  const lastRefresh = useRef(refreshKey)
  useEffect(() => {
    if (refreshKey !== lastRefresh.current && blueprintId) {
      lastRefresh.current = refreshKey
      refetch()
    }
  }, [refreshKey, blueprintId, refetch])

  // Expose refetch for parent
  const handleRefetch = useCallback(() => {
    if (blueprintId) refetch()
  }, [blueprintId, refetch])

  const dbTree = useMemo(() => (nodes ? buildTreeFromNodes(nodes) : []), [nodes])
  const proposedTree = useMemo(
    () => (proposedStructure ? buildTreeFromProposed(proposedStructure) : []),
    [proposedStructure]
  )
  const isProposed = dbTree.length === 0 && proposedTree.length > 0
  const tree = isProposed ? proposedTree : dbTree
  const stats = useMemo(() => (nodes ? computeStats(nodes) : null), [nodes])

  // Don't render if no blueprint or no nodes
  if (!blueprintId) return null

  return (
    <div className="border-t">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-4 py-2.5">
        <TreePine size={14} className="text-muted-foreground" />
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Structure Preview
        </p>
        {isProposed && (
          <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
            Proposed
          </Badge>
        )}
        <button
          type="button"
          onClick={handleRefetch}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RotateCw size={12} />
        </button>
      </div>

      {/* Tree content */}
      <div className="max-h-64 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          </div>
        ) : tree.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground italic">
            No structure yet
          </p>
        ) : (
          tree.map((node) => (
            <TreeNodeItem key={node.id} node={node} defaultExpanded={node.depth < 2} />
          ))
        )}
      </div>

      {/* Stats footer */}
      {isProposed && proposedStructure ? (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-[10px] text-muted-foreground">
            {proposedStructure.modules.length} modules,{' '}
            {proposedStructure.modules.reduce((s, m) => s + m.topics.length, 0)} topics
          </span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400">Draft</span>
        </div>
      ) : stats && (stats.modules > 0 || stats.topics > 0) ? (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-[10px] text-muted-foreground">
            {stats.modules} modules, {stats.topics} topics, {stats.components} components
          </span>
          <a
            href={`/project/${projectId}/structure`}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            View full structure
            <ExternalLink size={10} />
          </a>
        </div>
      ) : null}
    </div>
  )
}

