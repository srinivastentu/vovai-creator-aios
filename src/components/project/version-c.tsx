"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Circle, CircleDot, DollarSign, ShieldCheck } from "lucide-react"
import type { StageConfig, StageSession } from "@/lib/types"
import { RINGS, STAGES, getStage, getLoopLabel } from "@/lib/pipeline"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface PipelineViewProps {
  sessions: StageSession[]
}

function sidebarDot(status: StageSession["status"]) {
  switch (status) {
    case "approved":
      return <Check size={12} className="text-green-500" />
    case "generating":
    case "evaluating":
      return <CircleDot size={12} className="animate-pulse text-blue-500" />
    case "presenting":
      return <CircleDot size={12} className="text-blue-400" />
    case "awaiting_review":
      return <CircleDot size={12} className="text-amber-500" />
    default:
      return <Circle size={12} className="text-muted-foreground/30" />
  }
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className={`h-2 rounded-full ${
          score >= 8 ? "bg-green-500" : score >= 6 ? "bg-blue-500" : "bg-amber-500"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function DetailCard({ config, session }: { config: StageConfig; session: StageSession }) {
  const iterationCount = session.iterations.length
  const totalCost = session.iterations.reduce((sum, it) => sum + it.cost.costUSD, 0)
  const grade = session.bestGrade
  const isGate = config.reviewGate

  return (
    <Card className={isGate ? "border-amber-500/40 bg-amber-500/5" : ""}>
      <CardContent className="space-y-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{config.id}.</span>
            <span className="font-semibold">{config.name}</span>
            {isGate && <ShieldCheck size={14} className="text-amber-500" />}
          </div>
          <Badge
            variant={
              session.status === "approved"
                ? "secondary"
                : session.status === "awaiting_review"
                  ? "destructive"
                  : session.status === "idle"
                    ? "outline"
                    : "default"
            }
          >
            {session.status === "approved" && <Check size={12} className="mr-1" />}
            {session.status.replace("_", " ")}
          </Badge>
        </div>

        <span className="text-xs text-muted-foreground">{getLoopLabel(config)}</span>

        {/* Score breakdown */}
        {grade && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Score: {grade.compositeScore.toFixed(1)}/10
              </span>
              <ScoreBar score={grade.compositeScore} />
            </div>
            <div className="space-y-1.5">
              {grade.dimensions.map((dim) => (
                <div key={dim.name} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-muted-foreground">{dim.name}</span>
                  <div className="flex-1">
                    <ScoreBar score={dim.score} />
                  </div>
                  <span className="w-8 text-right font-medium">{dim.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          {iterationCount > 0 ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {iterationCount} iteration{iterationCount !== 1 ? "s" : ""}
              <span className="flex items-center gap-0.5">
                <DollarSign size={12} />
                {totalCost.toFixed(2)}
              </span>
            </span>
          ) : (
            <span />
          )}
          {session.status === "awaiting_review" && (
            <Button size="sm" nativeButton={false} render={<Link href={`/review/${session.id}`} />}>
              Review
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function VersionC({ sessions }: PipelineViewProps) {
  const [activeRing, setActiveRing] = useState(1)

  const activeRingConfig = RINGS.find((r) => r.ring === activeRing) ?? RINGS[0]

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-56 shrink-0 space-y-4">
        {RINGS.map((ring) => (
          <div key={ring.ring}>
            <button
              type="button"
              onClick={() => setActiveRing(ring.ring)}
              className={`mb-1.5 w-full text-left text-xs font-semibold uppercase tracking-wider ${
                activeRing === ring.ring
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ring {ring.ring} — {ring.label}
            </button>
            <ul className="space-y-1">
              {ring.stages.map((stageId) => {
                const config = getStage(stageId)
                const session = sessions.find((s) => s.stageId === stageId)
                if (!session) return null
                return (
                  <li key={stageId}>
                    <button
                      type="button"
                      onClick={() => setActiveRing(ring.ring)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${
                        activeRing === ring.ring
                          ? "bg-muted"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {sidebarDot(session.status)}
                      <span className="truncate">{config.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      <div className="flex-1 space-y-4">
        <h2 className="text-lg font-semibold">
          Ring {activeRingConfig.ring} — {activeRingConfig.label}
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {activeRingConfig.stages.map((stageId) => {
            const config = getStage(stageId)
            const session = sessions.find((s) => s.stageId === stageId)
            if (!session) return null
            return <DetailCard key={stageId} config={config} session={session} />
          })}
        </div>
      </div>
    </div>
  )
}
