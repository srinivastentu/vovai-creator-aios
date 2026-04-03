'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ArrowLeft, PanelRightClose, PanelRightOpen, DollarSign, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCost } from '@/components/project-component/chat/agent-sidebar'
import type { IdeationPhase } from '@/lib/project-component'

// ─── Phase Badge Colors ───────────────────────────────────────────────────────

const PHASE_COLORS: Record<IdeationPhase, string> = {
  brainstorm: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  structure: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  refinement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  review: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProjectTopBarProps {
  projectName: string
  currentPhase: IdeationPhase
  sessionCost: number
  panelOpen: boolean
  onTogglePanel: () => void
  onBack: () => void
  onRename?: (name: string) => Promise<void>
}

export function ProjectTopBar({
  projectName,
  currentPhase,
  sessionCost,
  panelOpen,
  onTogglePanel,
  onBack,
  onRename,
}: ProjectTopBarProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(projectName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(projectName)
  }, [projectName])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === projectName) {
      setDraft(projectName)
      setEditing(false)
      return
    }
    try {
      await onRename?.(trimmed)
    } catch {
      setDraft(projectName)
    }
    setEditing(false)
  }, [draft, projectName, onRename])

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
      {/* Left: back + brand */}
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        VOVAI
      </span>

      {/* Center: editable project name */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                setDraft(projectName)
                setEditing(false)
              }
            }}
            className="w-full rounded border border-input bg-background px-1.5 py-0.5 text-sm font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        ) : (
          <button
            onClick={() => onRename && setEditing(true)}
            className="group flex max-w-full items-center gap-1.5 text-left"
            title={projectName}
          >
            <h1 className="truncate text-sm font-medium">{projectName}</h1>
            {onRename && (
              <Pencil
                size={11}
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              />
            )}
          </button>
        )}
      </div>

      {/* Right: phase badge + cost + panel toggle */}
      <div className="flex items-center gap-2">
        <Badge className={`text-[10px] capitalize ${PHASE_COLORS[currentPhase]}`}>
          {currentPhase}
        </Badge>

        <div className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="size-3" />
          <span className="text-xs tabular-nums">{formatCost(sessionCost)}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onTogglePanel}
          title={panelOpen ? 'Close artifact panel' : 'Open artifact panel'}
        >
          {panelOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>
      </div>
    </header>
  )
}
