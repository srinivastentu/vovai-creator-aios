import Link from "next/link"
import { Check, CircleDot, Circle, DollarSign, ShieldCheck } from "lucide-react"
import type { StageSession } from "@/lib/types"
import { RINGS, getStage, getLoopLabel } from "@/lib/pipeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface PipelineViewProps {
  sessions: StageSession[]
}

function statusDot(status: StageSession["status"]) {
  switch (status) {
    case "approved":
      return <Check size={16} className="text-green-500" />
    case "generating":
    case "evaluating":
      return <CircleDot size={16} className="animate-pulse text-blue-500" />
    case "presenting":
      return <CircleDot size={16} className="text-blue-400" />
    case "awaiting_review":
      return <CircleDot size={16} className="text-amber-500" />
    default:
      return <Circle size={16} className="text-muted-foreground/40" />
  }
}

export function VersionB({ sessions }: PipelineViewProps) {
  return (
    <div className="space-y-6">
      {RINGS.map((ring) => (
        <section key={ring.ring}>
          {/* Ring divider */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm font-semibold text-muted-foreground">
              Ring {ring.ring} — {ring.label}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Timeline stages */}
          <div className="relative ml-4">
            {ring.stages.map((stageId, idx) => {
              const config = getStage(stageId)
              const session = sessions.find((s) => s.stageId === stageId)
              if (!session) return null

              const iterationCount = session.iterations.length
              const totalCost = session.iterations.reduce((sum, it) => sum + it.cost.costUSD, 0)
              const bestScore = session.bestGrade?.compositeScore
              const isLast = idx === ring.stages.length - 1
              const isGate = config.reviewGate

              return (
                <div key={stageId} className="relative flex items-stretch">
                  {/* Vertical connecting line */}
                  <div className="flex w-8 flex-col items-center">
                    <div className="flex size-8 shrink-0 items-center justify-center">
                      {statusDot(session.status)}
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>

                  {/* Stage row */}
                  <div
                    className={`mb-2 ml-2 flex flex-1 items-center gap-4 rounded-lg border px-4 py-3 ${
                      isGate
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-border"
                    }`}
                  >
                    {/* Stage info */}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{config.id}.</span>
                      <span className="text-sm font-medium">{config.name}</span>
                      {isGate && <ShieldCheck size={14} className="text-amber-500" />}
                      <span className="text-xs text-muted-foreground">
                        {getLoopLabel(config)}
                      </span>
                    </div>

                    {/* Status + metrics */}
                    <div className="flex items-center gap-3 shrink-0">
                      {bestScore !== undefined && bestScore !== null && (
                        <span className="text-sm font-medium">
                          {bestScore.toFixed(1)}/10
                        </span>
                      )}
                      {iterationCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <DollarSign size={12} />
                          {totalCost.toFixed(2)}
                        </span>
                      )}
                      {session.status === "awaiting_review" ? (
                        <Button size="sm" nativeButton={false} render={<Link href={`/review/${session.id}`} />}>
                          Review
                        </Button>
                      ) : (
                        <Badge
                          variant={
                            session.status === "approved"
                              ? "secondary"
                              : session.status === "idle"
                                ? "outline"
                                : "default"
                          }
                        >
                          {session.status === "approved" && <Check size={12} className="mr-1" />}
                          {session.status.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
