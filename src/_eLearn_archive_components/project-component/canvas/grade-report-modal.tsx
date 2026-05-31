'use client'

import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import type { GradeRecommendation, DimensionGradeScore } from '@/lib/domain/workflows'

// ─── Types ─────────────────────────────────────────────────────────────────

interface GradeReportData {
  overallScore: number
  dimensionScores: DimensionGradeScore[]
  recommendation: GradeRecommendation
  feedback: string | null
  strengths?: string[]
  weaknesses?: string[]
  specificImprovements?: string[]
  createdAt: string
}

interface GradeReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  grade: GradeReportData
}

// ─── Styles ────────────────────────────────────────────────────────────────

const RECOMMENDATION_CONFIG: Record<GradeRecommendation, {
  bg: string
  text: string
  label: string
  description: string
}> = {
  approve: {
    bg: 'bg-green-500/10 border-green-500/20',
    text: 'text-green-700 dark:text-green-300',
    label: 'Approve',
    description: 'Structure is production-ready. No significant issues found.',
  },
  revise: {
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Revise',
    description: 'Structure has minor issues. Targeted improvements recommended.',
  },
  restructure: {
    bg: 'bg-orange-500/10 border-orange-500/20',
    text: 'text-orange-700 dark:text-orange-300',
    label: 'Restructure',
    description: 'Significant structural gaps. Consider redesigning parts of the hierarchy.',
  },
  reject: {
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-700 dark:text-red-300',
    label: 'Reject',
    description: 'Fundamental issues found. A fresh approach is recommended.',
  },
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-600 dark:text-green-400'
  if (score >= 75) return 'text-amber-600 dark:text-amber-400'
  if (score >= 60) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function barColor(score: number): string {
  if (score >= 85) return 'bg-green-500'
  if (score >= 75) return 'bg-amber-500'
  if (score >= 60) return 'bg-orange-500'
  return 'bg-red-500'
}

// ─── Dimension Row ─────────────────────────────────────────────────────────

function DimensionRow({ dim }: { dim: DimensionGradeScore }) {
  const passing = dim.score >= dim.passThreshold
  const pct = Math.min(dim.score, 100)

  return (
    <div className={`rounded-lg border p-3 ${passing ? 'border-border' : 'border-destructive/30 bg-destructive/5'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {passing ? (
            <CheckCircle2 size={14} className="text-green-500 shrink-0" />
          ) : (
            <XCircle size={14} className="text-destructive shrink-0" />
          )}
          <span className="text-sm font-medium">{dim.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {(dim.weight * 100).toFixed(0)}%
          </Badge>
          <span className={`text-sm font-bold tabular-nums ${passing ? scoreColor(dim.score) : 'text-destructive'}`}>
            {dim.score}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${passing ? barColor(dim.score) : 'bg-destructive'}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-foreground/25"
          style={{ left: `${dim.passThreshold}%` }}
          title={`Threshold: ${dim.passThreshold}`}
        />
      </div>

      {/* Threshold label */}
      <div className="mt-1 flex justify-between">
        <span className="text-[10px] text-muted-foreground">
          {passing ? 'Passing' : `Below threshold (${dim.passThreshold})`}
        </span>
        <span className="text-[10px] text-muted-foreground">
          threshold: {dim.passThreshold}
        </span>
      </div>

      {/* Feedback */}
      {dim.feedback && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{dim.feedback}</p>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export function GradeReportModal({ open, onOpenChange, grade }: GradeReportModalProps) {
  const config = RECOMMENDATION_CONFIG[grade.recommendation] ?? RECOMMENDATION_CONFIG.revise
  const passingCount = grade.dimensionScores.filter(d => d.score >= d.passThreshold).length
  const failingCount = grade.dimensionScores.length - passingCount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Structure Grade Report</DialogTitle>
          <DialogDescription>
            Full rubric evaluation of the project structure across 7 dimensions.
          </DialogDescription>
        </DialogHeader>

        {/* Overall score hero */}
        <div className={`rounded-xl border p-5 text-center ${config.bg}`}>
          <div className={`text-5xl font-bold tabular-nums ${scoreColor(grade.overallScore)}`}>
            {grade.overallScore.toFixed(1)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">out of 100</div>
          <Badge className={`mt-3 text-sm ${config.text}`} variant="outline">
            {config.label}
          </Badge>
          <p className="mt-2 text-xs text-muted-foreground">{config.description}</p>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-500" />
              {passingCount} passing
            </span>
            {failingCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle size={12} className="text-destructive" />
                {failingCount} failing
              </span>
            )}
          </div>
        </div>

        {/* Dimension scores */}
        <div>
          <h3 className="text-sm font-medium mb-3">Dimension Scores</h3>
          <div className="space-y-2">
            {grade.dimensionScores.map((dim) => (
              <DimensionRow key={dim.id} dim={dim} />
            ))}
          </div>
        </div>

        {/* Strengths */}
        {grade.strengths && grade.strengths.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium mb-2">
              <TrendingUp size={14} className="text-green-500" />
              Strengths
            </h3>
            <ul className="space-y-1">
              {grade.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-green-500" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {grade.weaknesses && grade.weaknesses.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium mb-2">
              <TrendingDown size={14} className="text-destructive" />
              Weaknesses
            </h3>
            <ul className="space-y-1">
              {grade.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvement suggestions */}
        {grade.specificImprovements && grade.specificImprovements.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium mb-2">
              <Lightbulb size={14} className="text-amber-500" />
              Improvement Suggestions
            </h3>
            <ul className="space-y-1.5">
              {grade.specificImprovements.map((imp, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 shrink-0 text-[10px] font-bold text-amber-500">{i + 1}.</span>
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* General feedback */}
        {grade.feedback && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <h3 className="text-xs font-medium mb-1">Overall Feedback</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{grade.feedback}</p>
          </div>
        )}

        {/* Graded at */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Graded: {new Date(grade.createdAt).toLocaleString()}</span>
          <span>7 dimensions · pass threshold: 75</span>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Close
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
