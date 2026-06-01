import { notFound } from "next/navigation"
import { getWorkspace } from "@/lib/domain/data/workspaces"
import { listIdeas, type IdeaStatus } from "@/lib/domain/data/ideas"
import { IdeaLogTable, type IdeaFilterValues } from "@/components/ideas/IdeaLogTable"
import { IdeaPreview } from "@/components/shell/previews/IdeaPreview"
import { AppFrame } from "@/components/shell/AppFrame"

export const dynamic = "force-dynamic"

const STATUSES: IdeaStatus[] = ["captured", "in_progress", "completed", "archived"]

export default async function IdeaLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; niche?: string; q?: string; idea?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const workspace = await getWorkspace(id)
  if (!workspace) notFound()

  const status = STATUSES.find((s) => s === sp.status)
  const filter: IdeaFilterValues = {
    status,
    niche: sp.niche || undefined,
    q: sp.q || undefined,
  }

  const [ideas, all] = await Promise.all([listIdeas(id, filter), listIdeas(id)])
  const nicheUnion = [...new Set(all.flatMap((i) => i.niches))].sort()

  // Resolve the URL-selected idea from the UNFILTERED list so the preview still
  // renders when the idea is filtered out of the visible (left) list.
  const selectedIdea = sp.idea ? all.find((i) => i.id === sp.idea) : undefined

  const left = (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold">IdeaLog</h1>
        <p className="text-sm text-muted-foreground">{workspace.name}</p>
      </div>
      <IdeaLogTable
        workspaceId={id}
        ideas={ideas}
        nicheUnion={nicheUnion}
        defaultNiche={workspace.niches[0]}
        filter={filter}
        selectedIdeaId={selectedIdea?.id}
      />
    </div>
  )

  return (
    <AppFrame
      variant="standard"
      workspaceId={id}
      breadcrumbs={[
        { label: "Workspaces", href: "/workspaces" },
        { label: workspace.name, href: `/workspaces/${id}` },
        { label: "IdeaLog" },
      ]}
      left={left}
      preview={selectedIdea ? <IdeaPreview idea={selectedIdea} /> : undefined}
      previewTitle="Idea"
      previewEmpty={{
        title: "Select an idea",
        description: "Choose an idea to preview its details.",
      }}
    />
  )
}
