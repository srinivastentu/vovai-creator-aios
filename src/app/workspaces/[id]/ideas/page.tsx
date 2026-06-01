import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getWorkspace } from "@/lib/domain/data/workspaces"
import { listIdeas, type IdeaStatus } from "@/lib/domain/data/ideas"
import { IdeaLogTable, type IdeaFilterValues } from "@/components/ideas/IdeaLogTable"

export const dynamic = "force-dynamic"

const STATUSES: IdeaStatus[] = ["captured", "in_progress", "completed", "archived"]

export default async function IdeaLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; niche?: string; q?: string }>
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

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/workspaces/${id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to workspace
      </Link>
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
      />
    </main>
  )
}
