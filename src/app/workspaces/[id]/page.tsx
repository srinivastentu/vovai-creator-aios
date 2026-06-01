import Link from "next/link"
import { notFound } from "next/navigation"
import { Lightbulb } from "lucide-react"
import { getWorkspaceDetail, touchLastActive } from "@/lib/domain/data/workspaces"
import { listMastersForWorkspace } from "@/lib/domain/data/masters"
import { listArtifactsForWorkspace } from "@/lib/domain/data/artifacts"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { MasterStatusBadge } from "@/components/review/MasterStatusBadge"
import { ArtifactStatusBadge } from "@/components/review/ArtifactStatusBadge"
import { WorkspaceHeader } from "@/components/workspaces/WorkspaceHeader"
import {
  MasterSummaryPreview,
  ArtifactSummaryPreview,
} from "@/components/workspaces/DashboardItemPreview"
import { ARTIFACT_TYPE_LABEL } from "@/lib/domain/artifact-labels"
import { AppFrame } from "@/components/shell/AppFrame"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function WorkspaceDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { id } = await params
  const workspace = await getWorkspaceDetail(id)
  if (!workspace) notFound()

  await touchLastActive(id)
  const [masters, artifacts, { preview }] = await Promise.all([
    listMastersForWorkspace(id),
    listArtifactsForWorkspace(id),
    searchParams,
  ])

  // preview = "master:<id>" | "artifact:<id>". Prisma CUIDs are colon-free, so a
  // single split on the first ":" is unambiguous (kind first, id second).
  const [previewKind, previewId] = preview ? preview.split(":") : [undefined, undefined]
  const selectedMaster =
    previewKind === "master" ? masters.find((m) => m.id === previewId) : undefined
  const selectedArtifact =
    previewKind === "artifact" ? artifacts.find((a) => a.id === previewId) : undefined

  const previewNode = selectedMaster ? (
    <MasterSummaryPreview workspaceId={workspace.id} master={selectedMaster} />
  ) : selectedArtifact ? (
    <ArtifactSummaryPreview workspaceId={workspace.id} artifact={selectedArtifact} />
  ) : undefined

  const left = (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <WorkspaceHeader
        workspace={{
          id: workspace.id,
          name: workspace.name,
          personaName: workspace.persona.name,
          niches: workspace.niches,
        }}
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Recent ideas</h2>
            <Link
              href={`/workspaces/${workspace.id}/ideas`}
              className="text-sm text-blue-600 hover:underline"
            >
              Open IdeaLog →
            </Link>
          </div>
          {workspace.ideas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ideas yet. Open the IdeaLog to capture or coach some.
            </p>
          ) : (
            <ul className="space-y-2">
              {workspace.ideas.map((idea) => (
                <li key={idea.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{idea.title}</span>
                  <StatusBadge status={idea.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 font-medium">Pipeline runs</h2>
          {masters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Long-Form Masters yet. Run the research → master pipeline to
              produce one for review.
            </p>
          ) : (
            <ul className="space-y-2">
              {masters.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/workspaces/${workspace.id}?preview=master:${m.id}`}
                    scroll={false}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted/40",
                      selectedMaster?.id === m.id && "ring-2 ring-blue-600",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m._count.sections} sections · {m._count.researchSources} sources
                        {m._count.artifacts > 0 ? ` · ${m._count.artifacts} artifacts` : ""}
                      </p>
                    </div>
                    <MasterStatusBadge status={m.status} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-border p-4">
        <h2 className="mb-3 font-medium">Repurposed artifacts</h2>
        {artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No artifacts yet. Run the repurpose pipeline (LinkedIn post / article) to
            produce artifacts for Gate B review.
          </p>
        ) : (
          <ul className="space-y-2">
            {artifacts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/workspaces/${workspace.id}?preview=artifact:${a.id}`}
                  scroll={false}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted/40",
                    selectedArtifact?.id === a.id && "ring-2 ring-blue-600",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {ARTIFACT_TYPE_LABEL[a.artifactType] ?? a.artifactType}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.longFormMaster.title}
                      {a.bestScore !== null ? ` · ${a.bestScore}/100` : ""} · $
                      {a.costUSD.toFixed(2)}
                    </p>
                  </div>
                  <ArtifactStatusBadge status={a.status} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <Button
          render={<Link href={`/workspaces/${workspace.id}/ideas`} />}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Lightbulb className="size-4" />
          Go to IdeaLog
        </Button>
      </div>
    </div>
  )

  return (
    <AppFrame
      workspaceId={workspace.id}
      breadcrumbs={[
        { label: "Workspaces", href: "/workspaces" },
        { label: workspace.name },
      ]}
      left={left}
      preview={previewNode}
      previewTitle={selectedArtifact ? "Artifact" : "Pipeline run"}
      previewEmpty={{
        title: "Select a run or artifact",
        description: "Choose a pipeline run or repurpose output to see its summary and jump to review.",
      }}
    />
  )
}
