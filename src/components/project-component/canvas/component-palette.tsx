'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Search, ChevronDown, ChevronRight, Package,
  Video, Clapperboard, BookOpen, ClipboardList, Layers, HelpCircle,
  ClipboardCheck, Award, Puzzle, Route, Trophy, MessageSquare,
  BookA, Library, GraduationCap, ListChecks, Check, AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApiMutation } from '@/lib/hooks/use-api'
import {
  listComponents,
  isComponentAvailable,
  getComponent,
  getCompatibleComponents,
} from '@/lib/project-component'
import type {
  ProjectNodeType,
  ComponentCategory,
  ComponentDefinition,
} from '@/lib/project-component'

// ─── Constants ──────────────────────────────────────────────────────────────

const COMPONENT_ICONS: Record<string, LucideIcon> = {
  video: Video,
  video_short: Clapperboard,
  study_material: BookOpen,
  practice_worksheet: ClipboardList,
  flashcards: Layers,
  quiz: HelpCircle,
  pre_assessment: ClipboardCheck,
  post_assessment: Award,
  activity: Puzzle,
  scenario_exercise: Route,
  capstone_project: Trophy,
  discussion_prompt: MessageSquare,
  glossary: BookA,
  resource_library: Library,
  certificate: GraduationCap,
  mentor_checklist: ListChecks,
}

const CATEGORY_META: Record<ComponentCategory, { label: string; color: string }> = {
  content: { label: 'Content', color: 'text-blue-600 dark:text-blue-400' },
  assessment: { label: 'Assessment', color: 'text-amber-600 dark:text-amber-400' },
  activity: { label: 'Activity', color: 'text-green-600 dark:text-green-400' },
  meta: { label: 'Meta', color: 'text-purple-600 dark:text-purple-400' },
}

const CATEGORY_ORDER: ComponentCategory[] = ['content', 'assessment', 'activity', 'meta']

// ─── Types ──────────────────────────────────────────────────────────────────

interface PaletteComponent extends ComponentDefinition {
  /** Available for this archetype (recommended or optional) */
  available: boolean
  /** Can attach at selected node's depth */
  depthValid: boolean
  /** Already at maxPerNode on selected node */
  maxedOut: boolean
  /** Already attached to the selected node */
  alreadyAttached: boolean
  /** Archetype compatibility tier */
  tier: 'recommended' | 'optional'
}

interface ComponentPaletteProps {
  archetype: string
  selectedNode: ProjectNodeType | null
  blueprintId: string
  flatNodes: ProjectNodeType[]
  onMutated: () => Promise<void>
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ComponentPalette({
  archetype,
  selectedNode,
  blueprintId,
  flatNodes,
  onMutated,
}: ComponentPaletteProps) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<ComponentCategory, boolean>>({
    content: false,
    assessment: false,
    activity: false,
    meta: false,
  })
  const [adding, setAdding] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

  const addComp = useApiMutation<
    { nodeId: string; componentType: string; priority: 'core' | 'recommended' },
    unknown
  >(`/api/blueprints/${blueprintId}/components`, 'POST')

  // Total components used across the project
  const totalUsed = useMemo(() => {
    let count = 0
    for (const n of flatNodes) count += n.components.length
    return count
  }, [flatNodes])

  // Build enriched palette items — only components available for this archetype
  const paletteItems = useMemo(() => {
    const all = listComponents()
    const compat = getCompatibleComponents(archetype)
    const items: PaletteComponent[] = []

    for (const def of all) {
      const available = isComponentAvailable(archetype, def.id)
      if (!available) continue // hide unavailable entirely

      const depthValid = selectedNode
        ? def.attachableAt.includes(selectedNode.depth)
        : true

      // Count how many of this type are already on the selected node
      let attachedCount = 0
      if (selectedNode) {
        for (const c of selectedNode.components) {
          if (c.componentType === def.id) attachedCount++
        }
      }

      const tier = compat.recommended.includes(def.id) ? 'recommended' : 'optional'

      items.push({
        ...def,
        available,
        depthValid,
        maxedOut: selectedNode ? attachedCount >= def.maxPerNode : false,
        alreadyAttached: attachedCount > 0,
        tier,
      })
    }

    return items
  }, [archetype, selectedNode])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return paletteItems
    const q = search.toLowerCase()
    return paletteItems.filter(
      c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    )
  }, [paletteItems, search])

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<ComponentCategory, PaletteComponent[]> = {
      content: [],
      assessment: [],
      activity: [],
      meta: [],
    }
    for (const item of filtered) {
      map[item.category].push(item)
    }
    return map
  }, [filtered])

  const availableCount = paletteItems.length

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleAdd = useCallback(async (comp: PaletteComponent) => {
    if (!selectedNode) return
    if (!comp.depthValid || comp.maxedOut) return

    setAdding(comp.id)
    try {
      const def = getComponent(comp.id)
      await addComp.mutate({
        nodeId: selectedNode.id,
        componentType: comp.id,
        priority: def?.required ? 'core' : 'recommended',
      })
      // Flash effect
      setFlashId(comp.id)
      setTimeout(() => setFlashId(null), 800)
      await onMutated()
    } catch {
      // mutation hook shows error
    } finally {
      setAdding(null)
    }
  }, [selectedNode, addComp, onMutated])

  const toggleCategory = useCallback((cat: ComponentCategory) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col border-r bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Package size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Components
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{availableCount} available</span>
          <span className="text-muted-foreground/40">&middot;</span>
          <span>{totalUsed} used</span>
        </div>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter components..."
            className="h-7 pl-8 text-xs"
          />
        </div>
      </div>

      {/* No node selected message */}
      {!selectedNode && (
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-center text-xs text-muted-foreground">
            Select a node in the tree to add components
          </p>
        </div>
      )}

      {/* Component list */}
      {selectedNode && (
        <div className="flex-1 overflow-y-auto">
          {CATEGORY_ORDER.map(cat => {
            const items = grouped[cat]
            if (items.length === 0) return null
            const meta = CATEGORY_META[cat]
            const isCollapsed = collapsed[cat]

            return (
              <div key={cat}>
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-muted/50"
                >
                  {isCollapsed
                    ? <ChevronRight size={12} className="text-muted-foreground" />
                    : <ChevronDown size={12} className="text-muted-foreground" />
                  }
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({items.length})
                  </span>
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="pb-1">
                    {items.map(comp => (
                      <PaletteItem
                        key={comp.id}
                        comp={comp}
                        isAdding={adding === comp.id}
                        isFlashing={flashId === comp.id}
                        onAdd={handleAdd}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && search.trim() && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No components match &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Palette Item ─────────────────────────────────────────────────────────

function PaletteItem({
  comp,
  isAdding,
  isFlashing,
  onAdd,
}: {
  comp: PaletteComponent
  isAdding: boolean
  isFlashing: boolean
  onAdd: (comp: PaletteComponent) => void
}) {
  const Icon = COMPONENT_ICONS[comp.id] ?? Package
  const disabled = !comp.depthValid || comp.maxedOut
  const costLabel = `$${comp.estimatedCost.min.toFixed(2)}–$${comp.estimatedCost.max.toFixed(2)}`

  // Tooltip for disabled state
  let disabledReason = ''
  if (!comp.depthValid) {
    const levels = comp.attachableAt.map(d => `depth ${d}`).join(', ')
    disabledReason = `Only available at ${levels}`
  } else if (comp.maxedOut) {
    disabledReason = `Max ${comp.maxPerNode} per node`
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled || isAdding}
      onClick={() => onAdd(comp)}
      title={disabled ? disabledReason : comp.description}
      className={`
        group relative mx-1.5 mb-0.5 flex h-auto w-[calc(100%-12px)] items-start gap-2.5 px-2.5 py-2 text-left
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${isFlashing ? 'bg-green-100 dark:bg-green-950' : ''}
        ${comp.alreadyAttached && !disabled ? 'bg-accent/50' : ''}
      `}
    >
      {/* Icon */}
      <Icon
        size={15}
        className={`mt-0.5 shrink-0 ${disabled ? 'text-muted-foreground' : CATEGORY_META[comp.category].color}`}
      />

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium">{comp.name}</span>
          {comp.alreadyAttached && !disabled && (
            <Check size={11} className="shrink-0 text-green-600 dark:text-green-400" />
          )}
          {comp.tier === 'recommended' && (
            <Badge variant="outline" className="h-3.5 px-1 text-[9px] leading-none">
              rec
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{costLabel}</span>
          {disabled && disabledReason && (
            <span className="flex items-center gap-0.5 text-destructive/70">
              <AlertCircle size={9} />
              <span className="truncate">{disabledReason}</span>
            </span>
          )}
        </div>
      </div>
    </Button>
  )
}
