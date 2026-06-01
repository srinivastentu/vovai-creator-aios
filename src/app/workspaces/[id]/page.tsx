import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Lightbulb } from "lucide-react"
import { getWorkspaceDetail, touchLastActive } from "@/lib/domain/data/workspaces"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WorkspaceHeader } from "@/components/workspaces/WorkspaceHeader"

export const dynamic = "force-dynamic"

export default async function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const workspace = await getWorkspaceDetail(id)
  if (!workspace) notFound()

  await touchLastActive(id)

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/workspaces"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Workspaces
      </Link>

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

        {/* TODO(CR-pipeline): real approved-artifact data once the pipeline UI lands. */}
        <section className="rounded-lg border border-dashed border-border p-4">
          <h2 className="mb-3 font-medium">Recently approved</h2>
          <p className="text-sm text-muted-foreground">
            Approved artifacts will appear here once the pipeline runs.
          </p>
        </section>
      </div>

      <div className="mt-6">
        <Button
          render={<Link href={`/workspaces/${workspace.id}/ideas`} />}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Lightbulb className="size-4" />
          Go to IdeaLog
        </Button>
      </div>
    </main>
  )
}
