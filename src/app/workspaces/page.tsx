import Link from "next/link"
import { FolderPlus } from "lucide-react"
import { listWorkspaces } from "@/lib/domain/data/workspaces"
import { listPersonas } from "@/lib/domain/data/personas"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { WorkspaceRow } from "@/components/workspaces/WorkspaceRow"
import { WorkspaceSummary } from "@/components/workspaces/WorkspaceSummary"
import { AppFrame } from "@/components/shell/AppFrame"

export const dynamic = "force-dynamic"

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>
}) {
  const [workspaces, personas, { workspace: selectedId }] = await Promise.all([
    listWorkspaces(),
    listPersonas(),
    searchParams,
  ])
  const hasPersona = personas.length > 0
  const selected = selectedId ? workspaces.find((w) => w.id === selectedId) : undefined

  const left = (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Project containers for your content.
          </p>
        </div>
        <Button
          render={<Link href={hasPersona ? "/workspaces/new" : "/personas/new"} />}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          Create workspace
        </Button>
      </header>

      {workspaces.length === 0 ? (
        hasPersona ? (
          <EmptyState
            icon={FolderPlus}
            title="Create your first workspace"
            description="A workspace holds the ideas and content for one persona."
            action={{ label: "Create workspace", href: "/workspaces/new" }}
          />
        ) : (
          <EmptyState
            icon={FolderPlus}
            title="Create a persona first"
            description="A workspace needs a persona to write as. Create one to get started."
            action={{ label: "Create Persona", href: "/personas/new" }}
          />
        )
      ) : (
        <div className="space-y-3">
          {workspaces.map((w) => (
            <WorkspaceRow key={w.id} workspace={w} selected={w.id === selectedId} />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <AppFrame
      breadcrumbs={[{ label: "Workspaces" }]}
      left={left}
      preview={selected ? <WorkspaceSummary workspace={selected} /> : undefined}
      previewTitle="Workspace"
      previewEmpty={{
        title: "Select a workspace",
        description: "Choose a workspace to preview its persona, ideas, and recent activity.",
      }}
    />
  )
}
