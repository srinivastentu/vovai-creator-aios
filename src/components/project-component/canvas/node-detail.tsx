'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import {
  Network, Plus, X, Trash2, ChevronUp, ChevronDown, Pencil,
} from 'lucide-react'
import { COMPONENT_ICONS } from '@/components/project-component/shared/component-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useApiMutation } from '@/lib/hooks/use-api'
import {
  getArchetype,
  getComponent,
} from '@/lib/project-component'
import type {
  ProjectNodeType,
  LearningOutcome,
  BloomLevel,
  NodeStatus,
  ComponentPriority,
} from '@/lib/project-component'

// ─── Constants ──────────────────────────────────────────────────────────────

const BLOOM_LEVELS: BloomLevel[] = [
  'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create',
]

const BLOOM_STYLES: Record<BloomLevel, string> = {
  remember: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  understand: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  apply: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  analyze: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  evaluate: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  create: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

const STATUS_STYLES: Record<NodeStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground' },
  ideating: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300' },
  structured: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300' },
  approved: { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-300' },
  in_production: { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300' },
  completed: { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' },
}

const PRIORITY_STYLES: Record<ComponentPriority, string> = {
  core: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  recommended: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  optional: 'bg-muted text-muted-foreground',
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface NodeDetailPanelProps {
  node: ProjectNodeType | null
  blueprintId: string
  archetype: string
  flatNodes: ProjectNodeType[]
  onMutated: () => Promise<void>
}

// ─── Main Export ────────────────────────────────────────────────────────────

export function NodeDetailPanel({
  node,
  blueprintId,
  archetype,
  flatNodes,
  onMutated,
}: NodeDetailPanelProps) {
  if (!node) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Network size={28} strokeWidth={1.5} />
        <p className="text-sm">Select a node to view details</p>
      </div>
    )
  }

  return (
    <NodeDetail
      node={node}
      blueprintId={blueprintId}
      archetype={archetype}
      flatNodes={flatNodes}
      onMutated={onMutated}
    />
  )
}

// ─── Inner Content (hooks require unconditional rendering) ──────────────────

function NodeDetail({
  node,
  blueprintId,
  archetype,
  flatNodes,
  onMutated,
}: {
  node: ProjectNodeType
  blueprintId: string
  archetype: string
  flatNodes: ProjectNodeType[]
  onMutated: () => Promise<void>
}) {
  // ── Local state ───────────────────────────────────────────────────────
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(node.title)
  const [descDraft, setDescDraft] = useState(node.description ?? '')
  const [outcomes, setOutcomes] = useState<LearningOutcome[]>(
    () => node.learningOutcomes.map(lo => ({ ...lo }))
  )
  const outcomesRef = useRef(outcomes)
  outcomesRef.current = outcomes

  const [showDeleteNode, setShowDeleteNode] = useState(false)
  const [componentToDelete, setComponentToDelete] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ── Derived data ──────────────────────────────────────────────────────
  const archetypeDef = useMemo(() => getArchetype(archetype), [archetype])
  const depthLabel = archetypeDef.hierarchy[node.depth] ?? `Depth ${node.depth}`
  const statusStyle = STATUS_STYLES[node.status] ?? STATUS_STYLES.draft
  const canAddChild = node.depth < archetypeDef.maxDepth

  const siblings = useMemo(
    () => flatNodes
      .filter(n => n.parentId === node.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [flatNodes, node.parentId],
  )
  const siblingIndex = siblings.findIndex(s => s.id === node.id)
  const canMoveUp = siblingIndex > 0
  const canMoveDown = siblingIndex >= 0 && siblingIndex < siblings.length - 1

  const descendantCount = useMemo(
    () => flatNodes.filter(n => n.path.startsWith(`${node.path}/`)).length,
    [flatNodes, node.path],
  )


  // ── Mutations ─────────────────────────────────────────────────────────
  const nodeUrl = `/api/blueprints/${blueprintId}/nodes/${node.id}`
  const { mutate: patchNode } = useApiMutation<Record<string, unknown>, ProjectNodeType>(nodeUrl, 'PATCH')
  const { mutate: deleteNodeMut } = useApiMutation<Record<string, never>, { deleted: number }>(nodeUrl, 'DELETE')
  const { mutate: createNode } = useApiMutation<Record<string, unknown>, ProjectNodeType>(
    `/api/blueprints/${blueprintId}/nodes`, 'POST',
  )
  const { mutate: reorderMut } = useApiMutation<
    Array<{ nodeId: string; parentId: string | null; sortOrder: number }>,
    unknown
  >(`/api/blueprints/${blueprintId}/nodes/reorder`, 'POST')

  // ── Handlers ──────────────────────────────────────────────────────────

  const saveTitle = useCallback(async () => {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === node.title) {
      setTitleDraft(node.title)
      setEditingTitle(false)
      return
    }
    try {
      await patchNode({ title: trimmed })
      await onMutated()
    } catch {
      setTitleDraft(node.title)
      setErrorMessage('Failed to save title. Please try again.')
    }
    setEditingTitle(false)
  }, [titleDraft, node.title, patchNode, onMutated])

  const saveDescription = useCallback(async () => {
    const val = descDraft.trim() || null
    if (val === (node.description ?? null)) return
    try {
      await patchNode({ description: val })
      await onMutated()
    } catch {
      setDescDraft(node.description ?? '')
      setErrorMessage('Failed to save description. Please try again.')
    }
  }, [descDraft, node.description, patchNode, onMutated])

  const saveOutcomes = useCallback(async (updated: LearningOutcome[]) => {
    const previous = outcomesRef.current
    outcomesRef.current = updated
    setOutcomes(updated)
    try {
      await patchNode({ learningOutcomes: updated })
      await onMutated()
    } catch {
      outcomesRef.current = previous
      setOutcomes(previous)
      setErrorMessage('Failed to save outcomes. Please try again.')
    }
  }, [patchNode, onMutated])

  const addOutcome = useCallback(() => {
    const newOutcome: LearningOutcome = {
      id: crypto.randomUUID(),
      text: '',
      bloomLevel: 'understand',
      measurable: false,
      status: 'draft',
    }
    const updated = [...outcomesRef.current, newOutcome]
    outcomesRef.current = updated
    setOutcomes(updated)
  }, [])

  const removeOutcome = useCallback(async (id: string) => {
    const updated = outcomesRef.current.filter(o => o.id !== id)
    await saveOutcomes(updated)
  }, [saveOutcomes])

  const updateOutcomeField = useCallback((id: string, changes: Partial<LearningOutcome>) => {
    const updated = outcomesRef.current.map(o => o.id === id ? { ...o, ...changes } : o)
    outcomesRef.current = updated
    setOutcomes(updated)
  }, [])


  const handleRemoveComponent = useCallback(async () => {
    if (!componentToDelete) return
    try {
      const res = await fetch(
        `/api/blueprints/${blueprintId}/components?componentId=${componentToDelete}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Failed to remove component')
      await onMutated()
      setComponentToDelete(null)
    } catch (err) {
      console.error('Failed to remove component:', err)
      setErrorMessage('Failed to remove component. Please try again.')
      setComponentToDelete(null)
    }
  }, [componentToDelete, blueprintId, onMutated])

  const handleAddChild = useCallback(async () => {
    try {
      await createNode({ title: 'New node', parentId: node.id })
      await onMutated()
    } catch (err) {
      console.error('Failed to add child node:', err)
      setErrorMessage('Failed to add child node. Please try again.')
    }
  }, [node.id, createNode, onMutated])

  const handleDeleteNode = useCallback(async () => {
    try {
      await deleteNodeMut({} as Record<string, never>)
      await onMutated()
      setShowDeleteNode(false)
    } catch (err) {
      console.error('Failed to delete node:', err)
      setErrorMessage('Failed to delete node. Please try again.')
      setShowDeleteNode(false)
    }
  }, [deleteNodeMut, onMutated])

  const handleMove = useCallback(async (dir: 'up' | 'down') => {
    const swapIdx = dir === 'up' ? siblingIndex - 1 : siblingIndex + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const a = siblings[siblingIndex]
    const b = siblings[swapIdx]
    try {
      await reorderMut([
        { nodeId: a.id, parentId: a.parentId, sortOrder: b.sortOrder },
        { nodeId: b.id, parentId: b.parentId, sortOrder: a.sortOrder },
      ])
      await onMutated()
    } catch {
      setErrorMessage('Failed to reorder nodes. Please try again.')
    }
  }, [siblingIndex, siblings, reorderMut, onMutated])

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* ── Error Banner ──────────────────────────────────────────────── */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="shrink-0 rounded p-0.5 hover:bg-destructive/20"
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {/* ── Section 1: Header ──────────────────────────────────────────── */}
      <div className="border-b px-4 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {depthLabel}
          </Badge>
          <Badge
            variant="outline"
            className={`text-[10px] ${statusStyle.bg} ${statusStyle.text}`}
          >
            {node.status.replace('_', ' ')}
          </Badge>
          {node.agentConfidence !== null && (
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
              {(node.agentConfidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>

        {editingTitle ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') {
                setTitleDraft(node.title)
                setEditingTitle(false)
              }
            }}
            className="text-base font-semibold"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="group flex w-full items-center gap-1.5 text-left"
          >
            <h3 className="text-base font-semibold">{node.title}</h3>
            <Pencil
              size={12}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        )}
      </div>

      {/* ── Section 2: Description ─────────────────────────────────────── */}
      <div className="border-b px-4 py-3">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Description
        </h4>
        <Textarea
          value={descDraft}
          onChange={e => setDescDraft(e.target.value)}
          onBlur={saveDescription}
          placeholder="Describe what this topic covers..."
          className="min-h-[72px] resize-none text-sm"
          rows={3}
        />
      </div>

      {/* ── Section 3: Learning Outcomes ────────────────────────────────── */}
      <div className="border-b px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Learning Outcomes ({outcomes.length})
          </h4>
          <Button variant="ghost" size="xs" onClick={addOutcome}>
            <Plus size={14} />
            Add
          </Button>
        </div>

        {outcomes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No outcomes defined yet.</p>
        ) : (
          <div className="space-y-2">
            {outcomes.map(lo => (
              <OutcomeRow
                key={lo.id}
                outcome={lo}
                onUpdate={updateOutcomeField}
                onSave={() => saveOutcomes(outcomesRef.current)}
                onRemove={() => removeOutcome(lo.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Attached Components ──────────────────────────────── */}
      <div className="border-b px-4 py-3">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Components ({node.components.length})
        </h4>

        {node.components.length === 0 && (
          <div className="flex items-center gap-2 rounded-md border border-dashed py-3 px-3">
            <Plus size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Add components from the palette on the left
            </span>
          </div>
        )}

        {node.components.length > 0 && (
          <div className="mb-2 space-y-1">
            {node.components.map(comp => {
              const def = getComponent(comp.componentType)
              const Icon = COMPONENT_ICONS[comp.componentType]
              const priStyle = PRIORITY_STYLES[comp.priority] ?? PRIORITY_STYLES.optional
              return (
                <div
                  key={comp.id}
                  className="group flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5"
                >
                  {Icon && <Icon size={14} className="shrink-0 text-muted-foreground" />}
                  <span className="flex-1 text-sm">
                    {def?.name ?? comp.componentType.replace(/_/g, ' ')}
                  </span>
                  <Badge variant="outline" className={`text-[9px] capitalize ${priStyle}`}>
                    {comp.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] capitalize">
                    {comp.status.replace('_', ' ')}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                    onClick={() => setComponentToDelete(comp.id)}
                  >
                    <X size={12} />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Component adding moved to ComponentPalette panel */}
      </div>

      {/* ── Section 5: Node Actions ─────────────────────────────────────── */}
      <div className="px-4 py-3">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </h4>
        <div className="flex flex-wrap gap-2">
          {canAddChild && (
            <Button variant="outline" size="sm" onClick={handleAddChild}>
              <Plus size={14} />
              Add child
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!canMoveUp}
            onClick={() => handleMove('up')}
          >
            <ChevronUp size={14} />
            Move up
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canMoveDown}
            onClick={() => handleMove('down')}
          >
            <ChevronDown size={14} />
            Move down
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteNode(true)}
          >
            <Trash2 size={14} />
            Delete node
          </Button>
        </div>
      </div>

      {/* ── Delete Node Confirmation ──────────────────────────────────── */}
      <AlertDialog open={showDeleteNode} onOpenChange={open => setShowDeleteNode(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{node.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this node
              {descendantCount > 0
                ? ` and ${descendantCount} descendant${descendantCount === 1 ? '' : 's'}`
                : ''}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteNode}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Remove Component Confirmation ─────────────────────────────── */}
      <AlertDialog
        open={!!componentToDelete}
        onOpenChange={open => { if (!open) setComponentToDelete(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove component?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the component from this node. Any production data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRemoveComponent}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Outcome Row ───────────────────────────────────────────────────────────

function OutcomeRow({
  outcome,
  onUpdate,
  onSave,
  onRemove,
}: {
  outcome: LearningOutcome
  onUpdate: (id: string, changes: Partial<LearningOutcome>) => void
  onSave: () => void
  onRemove: () => void
}) {
  const bloomStyle = BLOOM_STYLES[outcome.bloomLevel] ?? ''

  return (
    <div className="group flex items-start gap-2 rounded-md bg-muted/30 p-2">
      <input
        type="checkbox"
        checked={outcome.measurable}
        onChange={e => {
          onUpdate(outcome.id, { measurable: e.target.checked })
          onSave()
        }}
        title="Measurable"
        className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded"
      />
      <div className="flex-1 space-y-1.5">
        <Input
          value={outcome.text}
          onChange={e => onUpdate(outcome.id, { text: e.target.value })}
          onBlur={onSave}
          placeholder="Describe the learning outcome..."
          className="h-7 text-xs"
        />
        <div className="flex items-center gap-1.5">
          <select
            value={outcome.bloomLevel}
            onChange={e => {
              onUpdate(outcome.id, { bloomLevel: e.target.value as BloomLevel })
              onSave()
            }}
            className="h-6 rounded border border-input bg-transparent px-1.5 text-[10px] outline-none"
          >
            {BLOOM_LEVELS.map(level => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
          <Badge variant="outline" className={`text-[9px] ${bloomStyle}`}>
            {outcome.bloomLevel}
          </Badge>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={onRemove}
      >
        <X size={12} />
      </Button>
    </div>
  )
}
