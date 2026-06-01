"use client"

import { WorkspaceActionsMenu } from "@/components/workspaces/WorkspaceActionsMenu"

export function WorkspaceHeader({
  workspace,
}: {
  workspace: { id: string; name: string; personaName: string; niches: string[] }
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold">{workspace.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Persona: {workspace.personaName}
          {workspace.niches.length > 0 ? <> · Niches: {workspace.niches.join(", ")}</> : null}
        </p>
      </div>
      <WorkspaceActionsMenu
        workspace={{ id: workspace.id, name: workspace.name }}
        redirectOnDelete
      />
    </div>
  )
}
