import type { StageSession } from "@/lib/types"
import { RINGS, getStage } from "@/lib/pipeline"
import { StageCard } from "@/components/project/stage-card"
import { Layers } from "lucide-react"

interface PipelineViewProps {
  sessions: StageSession[]
}

export function VersionA({ sessions }: PipelineViewProps) {
  return (
    <div className="space-y-8">
      {RINGS.map((ring) => (
        <section key={ring.ring}>
          <div className="mb-3 flex items-center gap-2">
            <Layers size={16} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Ring {ring.ring} — {ring.label}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ring.stages.map((stageId) => {
              const config = getStage(stageId)
              const session = sessions.find((s) => s.stageId === stageId)
              if (!session) return null
              return <StageCard key={stageId} config={config} session={session} />
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
