'use client'

import { Check, RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { IdeationPhase } from '@/lib/project-component'

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES: { key: IdeationPhase; label: string }[] = [
  { key: 'brainstorm', label: 'Brainstorm' },
  { key: 'structure', label: 'Structure' },
  { key: 'refinement', label: 'Refinement' },
  { key: 'review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
]

const PHASE_COLORS: Record<'past' | 'current' | 'future', string> = {
  past: 'bg-primary/20 text-primary border-primary/30',
  current: 'bg-primary text-primary-foreground border-primary',
  future: 'bg-muted/50 text-muted-foreground border-border',
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PhaseIndicatorProps {
  currentPhase: IdeationPhase
  score: number | null
  loopCount?: number
  maxLoops?: number
  /** Phases that have messages (for click-to-scroll) */
  completedPhases?: IdeationPhase[]
  onPhaseClick?: (phase: IdeationPhase) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhaseIndicator({
  currentPhase,
  score,
  loopCount = 0,
  maxLoops = 5,
  completedPhases = [],
  onPhaseClick,
}: PhaseIndicatorProps) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase)

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b bg-background/95 px-4 py-2.5 backdrop-blur-sm">
      {PHASES.map((phase, idx) => {
        const isPast = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isFuture = idx > currentIdx
        const hasMessages = completedPhases.includes(phase.key)
        const isClickable = isPast && hasMessages && onPhaseClick
        const colorKey = isCurrent ? 'current' : isPast ? 'past' : 'future'

        // Refinement shows loop count
        const label =
          phase.key === 'refinement' && isCurrent && loopCount > 0
            ? `${phase.label} (${loopCount}/${maxLoops})`
            : phase.label

        return (
          <div key={phase.key} className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onPhaseClick(phase.key)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                PHASE_COLORS[colorKey]
              } ${isClickable ? 'cursor-pointer hover:bg-primary/30' : ''} ${
                isFuture ? 'opacity-50' : ''
              }`}
            >
              {isPast && <Check size={12} className="shrink-0" />}
              {isCurrent && phase.key === 'refinement' && loopCount > 0 && (
                <RotateCw size={12} className="shrink-0" />
              )}
              {label}
            </button>

            {/* Connector line */}
            {idx < PHASES.length - 1 && (
              <div
                className={`h-px w-5 ${
                  isPast ? 'bg-primary/40' : 'bg-border'
                }`}
              />
            )}
          </div>
        )
      })}

      {/* Score badge */}
      {score !== null && (
        <div className="ml-auto">
          <Badge
            variant="outline"
            className={`text-xs tabular-nums ${
              score >= 75
                ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
            }`}
          >
            Score: {score.toFixed(1)}
          </Badge>
        </div>
      )}
    </div>
  )
}
