import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { MasterListItem } from "@/lib/domain/data/masters"
import type { ArtifactListItem } from "@/lib/domain/data/artifacts"
import { ARTIFACT_TYPE_LABEL } from "@/lib/domain/artifact-labels"
import { Button } from "@/components/ui/button"
import { MasterStatusBadge } from "@/components/review/MasterStatusBadge"
import { ArtifactStatusBadge } from "@/components/review/ArtifactStatusBadge"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  )
}

// Right-pane summary of a selected pipeline run (master) or repurpose output
// (artifact). Pure render of already-fetched dashboard list fields — no new
// backend read; full content lives on the Gate A/B review screens.
export function MasterSummaryPreview({
  workspaceId,
  master,
}: {
  workspaceId: string
  master: MasterListItem
}) {
  return (
    <div className="mx-auto max-w-prose space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">{master.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Long-Form Master</p>
        <div className="mt-3">
          <MasterStatusBadge status={master.status} />
        </div>
      </header>

      <dl className="space-y-1">
        <Row label="Sections">{master._count.sections}</Row>
        <Row label="Sources">{master._count.researchSources}</Row>
        <Row label="Artifacts">{master._count.artifacts}</Row>
      </dl>

      <Button
        render={<Link href={`/workspaces/${workspaceId}/master/${master.id}/review`} />}
        className="bg-blue-600 text-white hover:bg-blue-700"
      >
        Open review
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}

export function ArtifactSummaryPreview({
  workspaceId,
  artifact,
}: {
  workspaceId: string
  artifact: ArtifactListItem
}) {
  return (
    <div className="mx-auto max-w-prose space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">
          {ARTIFACT_TYPE_LABEL[artifact.artifactType] ?? artifact.artifactType}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{artifact.longFormMaster.title}</p>
        <div className="mt-3">
          <ArtifactStatusBadge status={artifact.status} />
        </div>
      </header>

      <dl className="space-y-1">
        <Row label="Best score">
          {artifact.bestScore !== null ? `${artifact.bestScore}/100` : "—"}
        </Row>
        <Row label="Cost">
          <span className="font-mono">${artifact.costUSD.toFixed(2)}</span>
        </Row>
      </dl>

      <Button
        render={<Link href={`/workspaces/${workspaceId}/artifacts/${artifact.id}/review`} />}
        className="bg-blue-600 text-white hover:bg-blue-700"
      >
        Open review
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}
