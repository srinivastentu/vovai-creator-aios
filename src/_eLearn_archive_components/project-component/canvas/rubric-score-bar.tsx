'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Loader2, RefreshCw, FileBarChart, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { GradeRecommendation, DimensionGradeScore } from '@/lib/domain/workflows'

// ─── Types ─────────────────────────────────────────────────────────────────

interface GradeData {
  id: string
  blueprintId: string
  overallScore: number
  dimensionScores: DimensionGradeScore[]
  recommendation: GradeRecommendation
  feedback: string | null
  createdAt: string
}

interface RubricScoreBarProps {
  grade: GradeData
  blueprintId: string
  structureChanged: boolean
  onReGraded: (grade: GradeData) => void
  onViewReport: () => void
}

// ─── Styles ────────────────────────────────────────────────────────────────

const RECOMMENDATION_STYLES: Record<GradeRecommendation, {
  bg: string
  barBg: string
  text: string
  label: string
}> = {
  approve: {
    bg: 'bg-green-500/10',
    barBg: 'bg-green-500',
    text: 'text-green-700 dark:text-green-300',
    label: 'Approve',
  },
  revise: {
    bg: 'bg-amber-500/10',
    barBg: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Revise',
  },
  restructure: {
    bg: 'bg-orange-500/10',
    barBg: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-300',
    label: 'Restructure',
  },
  reject: {
    bg: 'bg-red-500/10',
    barBg: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    label: 'Reject',
  },
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-600 dark:text-green-400'
  if (score >= 75) return 'text-amber-600 dark:text-amber-400'
  if (score >= 60) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function scoreBarColor(score: number): string {
  if (score >= 85) return 'bg-green-500'
  if (score >= 75) return 'bg-amber-500'
  if (score >= 60) return 'bg-orange-500'
  return 'bg-red-500'
}

// ─── Dimension Mini Bar ────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: DimensionGradeScore }) {
  const passing = dim.score >= dim.passThreshold
  const pct = Math.min(dim.score, 100)

  return (
    <div className="flex items-center gap-2">
      <span className={`w-24 shrink-0 text-[11px] font-medium ${passing ? 'text-foreground/70' : 'text-destructive'}`}>
        {dim.name}
      </span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${passing ? scoreBarColor(dim.score) : 'bg-destructive'}`}
          style={{ width: `${pct}%` }}
        />
        {/* threshold marker */}
        <div
          className="absolute inset-y-0 w-px bg-foreground/20"
          style={{ left: `${dim.passThreshold}%` }}
        />
      </div>
      <span className={`w-7 text-right text-[11px] font-semibold tabular-nums ${passing ? scoreColor(dim.score) : 'text-destructive'}`}>
        {dim.score}
      </span>
      {!passing && <span className="text-[10px] text-destructive">!</span>}
    </div>
  )
}

// ─── Expanded Dimension Detail ─────────────────────────────────────────────

function DimensionDetail({ dim }: { dim: DimensionGradeScore }) {
  const passing = dim.score >= dim.passThreshold

  return (
    <div className={`rounded-lg border p-3 ${passing ? 'border-border' : 'border-destructive/30 bg-destructive/5'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{dim.name}</span>
          <Badge variant="outline" className="text-[10px]">
            weight: {(dim.weight * 100).toFixed(0)}%
          </Badge>
          {!passing && (
            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
              below {dim.passThreshold}
            </Badge>
          )}
        </div>
        <span className={`text-sm font-bold tabular-nums ${passing ? scoreColor(dim.score) : 'text-destructive'}`}>
          {dim.score}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${passing ? scoreBarColor(dim.score) : 'bg-destructive'}`}
          style={{ width: `${Math.min(dim.score, 100)}%` }}
        />
      </div>
      {dim.feedback && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{dim.feedback}</p>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export function RubricScoreBar({
  grade,
  blueprintId,
  structureChanged,
  onReGraded,
  onViewReport,
}: RubricScoreBarProps) {
  const [expanded, setExpanded] = useState(false)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const style = RECOMMENDATION_STYLES[grade.recommendation] ?? RECOMMENDATION_STYLES.revise
  const pct = Math.min(grade.overallScore, 100)

  async function handleReGrade() {
    setGrading(true)
    setError(null)
    try {
      const res = await fetch(`/api/blueprints/${blueprintId}/ideation/grade`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Grading failed' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      // The grade endpoint returns the full state — extract the grade report
      if (data.gradeReport) {
        const newGrade: GradeData = {
          id: data.conversationId ?? grade.id,
          blueprintId,
          overallScore: data.gradeReport.overallScore,
          dimensionScores: data.gradeReport.dimensionScores,
          recommendation: data.gradeReport.recommendation,
          feedback: data.gradeReport.feedback ?? null,
          createdAt: new Date().toISOString(),
        }
        onReGraded(newGrade)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed')
    } finally {
      setGrading(false)
    }
  }

  // Find the lowest scoring dimension to flag as "weakest"
  const sortedDims = [...grade.dimensionScores].sort((a, b) => a.score - b.score)
  const weakestId = sortedDims[0]?.id

  return (
    <div className="border-t bg-muted/20">
      {/* Summary row — always visible */}
      <div className="flex items-center gap-2 px-4 py-3 md:gap-3">
        {/* Clickable expand area — score label + bar + score number */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-2 cursor-pointer group md:gap-3"
        >
          <span className="hidden items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors md:flex">
            Structure Score
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>

          {/* Overall progress bar */}
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${style.barBg}`}
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute inset-y-0 w-px bg-foreground/30"
              style={{ left: '75%' }}
              title="Pass threshold: 75"
            />
          </div>

          {/* Score */}
          <span className={`text-sm font-bold tabular-nums ${scoreColor(grade.overallScore)}`}>
            {grade.overallScore.toFixed(0)}
            <span className="hidden text-muted-foreground font-normal md:inline">/100</span>
          </span>
        </button>

        {/* Recommendation badge */}
        <Badge variant="outline" className={`text-xs ${style.text}`}>
          {style.label}
        </Badge>

        {/* Structure changed indicator */}
        {structureChanged && (
          <span className="hidden items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 sm:flex">
            <AlertTriangle size={12} />
            <span className="hidden md:inline">Outdated</span>
          </span>
        )}

        {/* Re-Grade button */}
        <Button
          variant="outline"
          size="xs"
          onClick={handleReGrade}
          disabled={grading}
        >
          {grading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span className="hidden md:inline">Grading…</span>
            </>
          ) : (
            <>
              <RefreshCw size={12} />
              <span className="hidden md:inline">Re-Grade</span>
            </>
          )}
        </Button>

        {/* View Full Report */}
        <Button
          variant="ghost"
          size="xs"
          onClick={onViewReport}
        >
          <FileBarChart size={12} />
          <span className="hidden md:inline">Report</span>
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 pb-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Collapsed dimension scores — hidden on mobile for compact view */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="hidden w-full flex-wrap gap-x-4 gap-y-1 px-4 pb-3 cursor-pointer hover:bg-muted/30 transition-colors md:flex"
        >
          {grade.dimensionScores.map((dim) => {
            const failing = dim.score < dim.passThreshold
            const nearThreshold = !failing && (dim.score - dim.passThreshold) <= 5
            const isWeakest = dim.id === weakestId
            return (
              <span
                key={dim.id}
                className={`text-[11px] ${
                  failing
                    ? 'text-destructive font-medium'
                    : nearThreshold || isWeakest
                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                      : 'text-muted-foreground'
                }`}
                title={dim.feedback}
              >
                {dim.name}: <span className="font-medium tabular-nums">{dim.score}</span>
                {failing && <span className="ml-0.5">!</span>}
                {(nearThreshold || isWeakest) && !failing && <span className="ml-0.5">⚠</span>}
              </span>
            )
          })}
          <span className="text-[10px] text-muted-foreground/50 ml-auto">
            click to expand ▴
          </span>
        </button>
      )}

      {/* Expanded dimension details */}
      {expanded && (
        <div className="border-t px-4 py-3">
          {/* Mini bars grid */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            {grade.dimensionScores.map((dim) => (
              <DimensionBar key={dim.id} dim={dim} />
            ))}
          </div>

          {/* Full dimension cards */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {grade.dimensionScores.map((dim) => (
              <DimensionDetail key={dim.id} dim={dim} />
            ))}
          </div>

          {/* Feedback */}
          {grade.feedback && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {grade.feedback}
            </p>
          )}

          {/* Collapse button */}
          <button
            onClick={() => setExpanded(false)}
            className="mt-3 flex w-full items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown size={12} />
            collapse
          </button>
        </div>
      )}
    </div>
  )
}
