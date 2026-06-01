import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { WorkspaceListItem } from "@/lib/domain/data/workspaces"
import { formatRelativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"

// Right-pane summary of a selected workspace. Pure render of already-fetched
// list fields (no new backend read) + a primary link into the workspace.
export function WorkspaceSummary({ workspace }: { workspace: WorkspaceListItem }) {
  const latestStatus = workspace.ideas[0]?.status
  const count = workspace._count.ideas

  return (
    <div className="mx-auto max-w-prose space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">{workspace.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Persona: {workspace.persona.name}
        </p>
      </header>

      <dl className="space-y-1">
        <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5">
          <dt className="text-xs font-medium text-muted-foreground">Ideas</dt>
          <dd className="text-sm text-foreground">
            {count} idea{count === 1 ? "" : "s"}
          </dd>
        </div>
        <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5">
          <dt className="text-xs font-medium text-muted-foreground">Latest</dt>
          <dd className="text-sm text-foreground">
            {latestStatus ? <StatusBadge status={latestStatus} /> : "—"}
          </dd>
        </div>
        <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5">
          <dt className="text-xs font-medium text-muted-foreground">Last active</dt>
          <dd className="text-sm text-foreground">{formatRelativeTime(workspace.lastActiveAt)}</dd>
        </div>
        {workspace.niches.length > 0 ? (
          <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5">
            <dt className="text-xs font-medium text-muted-foreground">Niches</dt>
            <dd className="flex min-w-0 flex-wrap gap-1.5">
              {workspace.niches.map((n) => (
                <span key={n} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {n}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>

      <Button
        render={<Link href={`/workspaces/${workspace.id}`} />}
        className="bg-blue-600 text-white hover:bg-blue-700"
      >
        Open workspace
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}
