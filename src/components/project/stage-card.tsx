import Link from "next/link"
import { Check, DollarSign, ShieldCheck } from "lucide-react"
import type { StageConfig, StageSession } from "@/lib/types"
import { getLoopLabel } from "@/lib/pipeline"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const statusConfig: Record<
  StageSession["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; pulse?: boolean }
> = {
  idle: { label: "Idle", variant: "outline" },
  generating: { label: "Generating", variant: "default", pulse: true },
  evaluating: { label: "Evaluating", variant: "default", pulse: true },
  presenting: { label: "Presenting", variant: "secondary" },
  awaiting_review: { label: "Awaiting Review", variant: "destructive" },
  approved: { label: "Approved", variant: "secondary" },
}

interface StageCardProps {
  config: StageConfig
  session: StageSession
}

export function StageCard({ config, session }: StageCardProps) {
  const { label, variant, pulse } = statusConfig[session.status]
  const loopLabel = getLoopLabel(config)
  const iterationCount = session.iterations.length
  const totalCost = session.iterations.reduce((sum, it) => sum + it.cost.costUSD, 0)

  return (
    <Card className={config.reviewGate ? "border-l-4 border-l-amber-500" : ""}>
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header: stage number + name */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">{config.id}.</span>
            <span className="text-sm font-semibold">{config.name}</span>
            {config.reviewGate && (
              <ShieldCheck className="text-amber-500" size={14} />
            )}
          </div>
          <Badge variant={variant} className="shrink-0">
            {pulse && (
              <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-current" />
            )}
            {session.status === "approved" && <Check className="mr-1" size={12} />}
            {label}
          </Badge>
        </div>

        {/* Loop type */}
        <span className="text-muted-foreground text-xs">{loopLabel}</span>

        {/* Iteration + cost footer */}
        {iterationCount > 0 && (
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span>Iteration {iterationCount}</span>
            <span className="flex items-center gap-0.5">
              <DollarSign size={12} />
              {totalCost.toFixed(4)}
            </span>
          </div>
        )}

        {/* Review button */}
        {session.status === "awaiting_review" && (
          <Button size="sm" render={<Link href={`/review/${session.id}`} />}>
            Review
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
