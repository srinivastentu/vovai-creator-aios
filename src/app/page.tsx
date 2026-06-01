import Link from "next/link"
import { Layers, UserPlus, FolderPlus } from "lucide-react"
import { listWorkspaces } from "@/lib/domain/data/workspaces"
import { formatRelativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WorkspaceSummary } from "@/components/workspaces/WorkspaceSummary"
import { AppFrame } from "@/components/shell/AppFrame"

export const dynamic = "force-dynamic"

export default async function Home() {
  const workspaces = await listWorkspaces()
  const mostActive = workspaces[0]

  const left = (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">CreatorOS</h1>
          <p className="text-sm text-muted-foreground">
            Agentic AI content production OS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/personas/new" />}>
            <UserPlus className="size-4" />
            New persona
          </Button>
          <Button
            render={<Link href="/workspaces/new" />}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <FolderPlus className="size-4" />
            New workspace
          </Button>
        </div>
      </header>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No workspaces yet"
          description="Create a persona, then a workspace, to start producing content."
          action={{ label: "Create Persona", href: "/personas/new" }}
        />
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Your workspaces</h2>
          <ul className="space-y-3">
            {workspaces.map((w) => {
              const latestStatus = w.ideas[0]?.status
              const count = w._count.ideas
              return (
                <li key={w.id}>
                  <Link
                    href={`/workspaces/${w.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium">{w.name}</h3>
                        {latestStatus ? <StatusBadge status={latestStatus} /> : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {w.persona.name} · {count} idea{count === 1 ? "" : "s"} · active{" "}
                        {formatRelativeTime(w.lastActiveAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )

  return (
    <AppFrame
      breadcrumbs={[{ label: "Dashboard" }]}
      left={left}
      preview={mostActive ? <WorkspaceSummary workspace={mostActive} /> : undefined}
      previewTitle="Workspace"
      previewEmpty={{
        title: "Your workspace",
        description: "Open a workspace to see its active work.",
      }}
    />
  )
}
