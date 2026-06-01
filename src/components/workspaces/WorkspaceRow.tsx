"use client"

import Link from "next/link"
import type { WorkspaceListItem } from "@/lib/domain/data/workspaces"
import { formatRelativeTime } from "@/lib/format"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WorkspaceActionsMenu } from "@/components/workspaces/WorkspaceActionsMenu"
import { cn } from "@/lib/utils"

export function WorkspaceRow({
  workspace,
  selected = false,
}: {
  workspace: WorkspaceListItem
  selected?: boolean
}) {
  const latestStatus = workspace.ideas[0]?.status
  const count = workspace._count.ideas

  return (
    <div
      className={cn(
        "relative flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40",
        selected && "ring-2 ring-blue-600",
      )}
    >
      {/* Full-row link selects the workspace for the preview pane. It sits
          beneath the actions menu (which has z-10). */}
      <Link
        href={`/workspaces?workspace=${workspace.id}`}
        scroll={false}
        className="absolute inset-0 rounded-lg"
        aria-label={`Preview ${workspace.name}`}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-medium">{workspace.name}</h3>
          {latestStatus ? <StatusBadge status={latestStatus} /> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {workspace.persona.name} · {count} idea{count === 1 ? "" : "s"} · active{" "}
          {formatRelativeTime(workspace.lastActiveAt)}
        </p>
      </div>
      <div className="relative z-10">
        <WorkspaceActionsMenu workspace={{ id: workspace.id, name: workspace.name }} />
      </div>
    </div>
  )
}
