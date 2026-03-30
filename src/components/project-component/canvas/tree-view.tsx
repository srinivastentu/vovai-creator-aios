'use client'

import { useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderClosed,
  Paperclip,
} from 'lucide-react'
import type { ProjectNodeType, NodeStatus } from '@/lib/project-component'

// ─── Component Color Map ─────────────────────────────────────────────────────

const COMPONENT_COLORS: Record<string, string> = {
  video: 'bg-blue-500',
  video_short: 'bg-blue-400',
  study_material: 'bg-orange-500',
  practice_worksheet: 'bg-orange-400',
  quiz: 'bg-green-500',
  pre_assessment: 'bg-green-400',
  post_assessment: 'bg-green-600',
  activity: 'bg-purple-500',
  scenario_exercise: 'bg-purple-400',
  capstone_project: 'bg-yellow-500',
  flashcards: 'bg-teal-400',
  glossary: 'bg-slate-400',
  resource_library: 'bg-slate-500',
  mentor_checklist: 'bg-pink-400',
  discussion_prompt: 'bg-indigo-400',
}

const COMPONENT_LABELS: Record<string, string> = {
  video: 'Video',
  video_short: 'Short Video',
  study_material: 'Study Material',
  practice_worksheet: 'Worksheet',
  quiz: 'Quiz',
  pre_assessment: 'Pre-Assessment',
  post_assessment: 'Post-Assessment',
  activity: 'Activity',
  scenario_exercise: 'Scenario',
  capstone_project: 'Capstone',
  flashcards: 'Flashcards',
  glossary: 'Glossary',
  resource_library: 'Resources',
  mentor_checklist: 'Checklist',
  discussion_prompt: 'Discussion',
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<NodeStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground' },
  ideating: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300' },
  structured: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300' },
  approved: { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-300' },
  in_production: { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300' },
  completed: { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' },
}

function StatusBadge({ status }: { status: NodeStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ─── Component Dots ──────────────────────────────────────────────────────────

function ComponentDots({ components }: { components: ProjectNodeType['components'] }) {
  if (components.length === 0) return null

  const grouped = new Map<string, number>()
  for (const c of components) {
    grouped.set(c.componentType, (grouped.get(c.componentType) ?? 0) + 1)
  }

  return (
    <span className="flex items-center gap-1">
      {Array.from(grouped.entries()).map(([type, count]) => (
        <span
          key={type}
          className="flex items-center gap-0.5"
          title={`${count} ${COMPONENT_LABELS[type] ?? type}`}
        >
          <span className={`inline-block h-2 w-2 rounded-full ${COMPONENT_COLORS[type] ?? 'bg-gray-400'}`} />
          {count > 1 && (
            <span className="text-[10px] text-muted-foreground">{count}</span>
          )}
        </span>
      ))}
    </span>
  )
}

// ─── Depth Icons ─────────────────────────────────────────────────────────────

function DepthIcon({ depth }: { depth: number }) {
  switch (depth) {
    case 0:
      return <FolderClosed size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
    case 1:
      return <FileText size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />
    default:
      return <Paperclip size={12} className="shrink-0 text-muted-foreground" />
  }
}

// ─── Tree Node Row ───────────────────────────────────────────────────────────

interface TreeNodeRowProps {
  node: ProjectNodeType
  selectedId: string | null
  onSelect: (id: string) => void
  defaultExpanded: boolean
}

function TreeNodeRow({ node, selectedId, onSelect, defaultExpanded }: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <div
        className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
          isSelected
            ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
            : 'text-foreground/80 hover:bg-muted/60'
        }`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Chevron */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
          >
            {expanded ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}

        {/* Depth icon */}
        <DepthIcon depth={node.depth} />

        {/* Title */}
        <span className="flex-1 truncate">{node.title}</span>

        {/* Component dots */}
        <ComponentDots components={node.components} />

        {/* Status badge */}
        <StatusBadge status={node.status} />
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultExpanded={child.depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TreeViewProps {
  tree: ProjectNodeType[]
  projectName: string
  selectedNodeId: string | null
  onSelectNode: (nodeId: string | null) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TreeView({ tree, projectName, selectedNodeId, onSelectNode }: TreeViewProps) {
  const handleSelect = (nodeId: string) => {
    onSelectNode(selectedNodeId === nodeId ? null : nodeId)
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <FolderClosed size={28} strokeWidth={1.5} />
        <p className="text-sm">No structure yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Course header row */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <BookOpen size={16} className="shrink-0 text-primary" />
        <span className="text-sm font-medium">{projectName}</span>
      </div>

      {/* Scrollable tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {tree.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            selectedId={selectedNodeId}
            onSelect={handleSelect}
            defaultExpanded
          />
        ))}
      </div>
    </div>
  )
}
