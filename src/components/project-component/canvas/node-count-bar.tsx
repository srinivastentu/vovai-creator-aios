'use client'

import { Boxes } from 'lucide-react'
import type { TreeStats } from '@/lib/project-component'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface NodeCountBarProps {
  stats: TreeStats
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NodeCountBar({ stats }: NodeCountBarProps) {
  // Count nodes by depth from the componentBreakdown
  // We can derive module/topic/subtopic counts from the raw flat nodes,
  // but TreeStats only gives us totalNodes, maxDepth, and componentBreakdown.
  // We'll accept supplementary counts as well.
  const totalComponents = Object.values(stats.componentBreakdown).reduce((a, b) => a + b, 0)

  return (
    <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-2">
      <Boxes size={14} className="shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {stats.totalNodes} nodes · {totalComponents} components
      </span>

      {/* Component type breakdown */}
      {totalComponents > 0 && (
        <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          {Object.entries(stats.componentBreakdown).map(([type, count]) => (
            <span key={type}>
              {count} {type.replace(/_/g, ' ')}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

// ─── Extended version with depth-level counts ────────────────────────────────

export interface NodeCountBarExtendedProps {
  modules: number
  topics: number
  subtopics: number
  totalComponents: number
}

export function NodeCountBarExtended({ modules, topics, subtopics, totalComponents }: NodeCountBarExtendedProps) {
  const parts: string[] = []
  if (modules > 0) parts.push(`${modules} module${modules !== 1 ? 's' : ''}`)
  if (topics > 0) parts.push(`${topics} topic${topics !== 1 ? 's' : ''}`)
  if (subtopics > 0) parts.push(`${subtopics} subtopic${subtopics !== 1 ? 's' : ''}`)
  parts.push(`${totalComponents} component${totalComponents !== 1 ? 's' : ''}`)

  return (
    <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-2">
      <Boxes size={14} className="shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {parts.join(' · ')}
      </span>
    </div>
  )
}
